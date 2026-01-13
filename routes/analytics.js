// routes/analytics.js
const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');

/* ===================== DASHBOARD OVERVIEW ===================== */
router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    // Total sales and revenue
    const totalSales = await Sale.countDocuments({ status: 'Completed' });
    const totalRevenue = await Sale.aggregate([
      { $match: { status: 'Completed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    // Today's stats
    const todaySales = await Sale.countDocuments({
      status: 'Completed',
      date: { $gte: today }
    });
    const todayRevenue = await Sale.aggregate([
      { $match: { status: 'Completed', date: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    // This week's stats
    const weekSales = await Sale.countDocuments({
      status: 'Completed',
      date: { $gte: weekAgo }
    });
    const weekRevenue = await Sale.aggregate([
      { $match: { status: 'Completed', date: { $gte: weekAgo } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    // This month's stats
    const monthSales = await Sale.countDocuments({
      status: 'Completed',
      date: { $gte: monthAgo }
    });
    const monthRevenue = await Sale.aggregate([
      { $match: { status: 'Completed', date: { $gte: monthAgo } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    // Total customers and products
    const totalCustomers = await Customer.countDocuments();
    const totalProducts = await Product.countDocuments();
    const lowStockProducts = await Product.countDocuments({ 
      $expr: { $lte: ['$stock', '$minStock'] }
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalSales,
          totalRevenue: totalRevenue[0]?.total || 0,
          totalCustomers,
          totalProducts,
          lowStockProducts,
          averageSale: totalSales > 0 ? (totalRevenue[0]?.total || 0) / totalSales : 0
        },
        today: {
          sales: todaySales,
          revenue: todayRevenue[0]?.total || 0
        },
        week: {
          sales: weekSales,
          revenue: weekRevenue[0]?.total || 0
        },
        month: {
          sales: monthSales,
          revenue: monthRevenue[0]?.total || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

/* ===================== SALES BY PAYMENT MODE ===================== */
router.get('/payment-modes', async (req, res) => {
  try {
    const paymentStats = await Sale.aggregate([
      { $match: { status: 'Completed' } },
      {
        $group: {
          _id: '$paymentMode',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.json({
      success: true,
      data: paymentStats
    });
  } catch (error) {
    console.error('Error fetching payment mode analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment mode analytics',
      error: error.message
    });
  }
});

/* ===================== TOP SELLING PRODUCTS ===================== */
router.get('/top-products', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const topProducts = await Sale.aggregate([
      { $match: { status: 'Completed' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' },
          salesCount: { $sum: 1 }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limit }
    ]);

    res.json({
      success: true,
      data: topProducts
    });
  } catch (error) {
    console.error('Error fetching top products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top products',
      error: error.message
    });
  }
});

/* ===================== TOP CUSTOMERS ===================== */
router.get('/top-customers', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const topCustomers = await Sale.aggregate([
      { $match: { status: 'Completed' } },
      {
        $group: {
          _id: '$customerName',
          totalPurchases: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: limit }
    ]);

    res.json({
      success: true,
      data: topCustomers
    });
  } catch (error) {
    console.error('Error fetching top customers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top customers',
      error: error.message
    });
  }
});

/* ===================== SALES TREND (DAILY/WEEKLY/MONTHLY) ===================== */
router.get('/sales-trend', async (req, res) => {
  try {
    const { period = 'daily', days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    startDate.setHours(0, 0, 0, 0);

    let groupBy;
    if (period === 'daily') {
      groupBy = {
        year: { $year: '$date' },
        month: { $month: '$date' },
        day: { $dayOfMonth: '$date' }
      };
    } else if (period === 'weekly') {
      groupBy = {
        year: { $year: '$date' },
        week: { $week: '$date' }
      };
    } else if (period === 'monthly') {
      groupBy = {
        year: { $year: '$date' },
        month: { $month: '$date' }
      };
    }

    const salesTrend = await Sale.aggregate([
      { $match: { status: 'Completed', date: { $gte: startDate } } },
      {
        $group: {
          _id: groupBy,
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    res.json({
      success: true,
      data: salesTrend
    });
  } catch (error) {
    console.error('Error fetching sales trend:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales trend',
      error: error.message
    });
  }
});

/* ===================== REVENUE BY CATEGORY ===================== */
router.get('/revenue-by-category', async (req, res) => {
  try {
    const revenueByCategory = await Sale.aggregate([
      { $match: { status: 'Completed' } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$product.category',
          totalRevenue: { $sum: '$items.total' },
          itemsSold: { $sum: '$items.quantity' }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    res.json({
      success: true,
      data: revenueByCategory
    });
  } catch (error) {
    console.error('Error fetching revenue by category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue by category',
      error: error.message
    });
  }
});

/* ===================== LOW STOCK ALERTS ===================== */
router.get('/low-stock', async (req, res) => {
  try {
    const lowStockProducts = await Product.find({
      $expr: { $lte: ['$stock', '$minStock'] }
    }).sort({ stock: 1 });

    res.json({
      success: true,
      data: lowStockProducts
    });
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock products',
      error: error.message
    });
  }
});

/* ===================== MONTHLY COMPARISON ===================== */
router.get('/monthly-comparison', async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;
    
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const monthlyData = await Sale.aggregate([
      { $match: { status: 'Completed', date: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          sales: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          averageSale: { $avg: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: monthlyData
    });
  } catch (error) {
    console.error('Error fetching monthly comparison:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly comparison',
      error: error.message
    });
  }
});

module.exports = router;


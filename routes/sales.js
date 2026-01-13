// routes/sales.js
const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');

/* ===================== GET ALL SALES ===================== */
router.get('/', async (req, res) => {
  try {
    const { 
      search, 
      dateFilter, 
      paymentMode, 
      startDate, 
      endDate,
      limit = 100,
      page = 1
    } = req.query;

    let query = {};

    // Search by bill number or customer name
    if (search) {
      query.$or = [
        { billNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by payment mode
    if (paymentMode && paymentMode !== 'all') {
      query.paymentMode = paymentMode;
    }

    // Date filtering
    if (dateFilter && dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch(dateFilter) {
        case 'today':
          query.date = { $gte: today };
          break;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          query.date = { $gte: weekAgo };
          break;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setDate(monthAgo.getDate() - 30);
          query.date = { $gte: monthAgo };
          break;
      }
    }

    // Custom date range
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch sales with pagination
    const sales = await Sale.find(query)
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Get total count for pagination
    const totalCount = await Sale.countDocuments(query);

    res.json({
      success: true,
      data: sales,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales',
      error: error.message
    });
  }
});

/* ===================== GET SINGLE SALE BY ID ===================== */
router.get('/:id', async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('customerId', 'name email phone')
      .populate('items.productId', 'name category');

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    res.json({
      success: true,
      data: sale
    });
  } catch (error) {
    console.error('Error fetching sale:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sale',
      error: error.message
    });
  }
});

/* ===================== GET SALE BY BILL NUMBER ===================== */
router.get('/bill/:billNumber', async (req, res) => {
  try {
    const sale = await Sale.findOne({ billNumber: req.params.billNumber })
      .populate('customerId', 'name email phone')
      .populate('items.productId', 'name category');

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    res.json({
      success: true,
      data: sale
    });
  } catch (error) {
    console.error('Error fetching sale:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sale',
      error: error.message
    });
  }
});

/* ===================== CREATE NEW SALE ===================== */
router.post('/', async (req, res) => {
  try {
    const { customerName, customerId, items, paymentMode, subtotal, gst, totalAmount } = req.body;

    // Validate required fields
    if (!customerName || !items || items.length === 0 || !paymentMode || !totalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Generate bill number
    const lastSale = await Sale.findOne().sort({ createdAt: -1 });
    let billNumber = 'BILL0001';
    
    if (lastSale && lastSale.billNumber) {
      const lastNumber = parseInt(lastSale.billNumber.replace('BILL', ''));
      billNumber = `BILL${String(lastNumber + 1).padStart(4, '0')}`;
    }

    // Calculate totals if not provided
    let calculatedSubtotal = subtotal;
    if (!calculatedSubtotal) {
      calculatedSubtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    let calculatedGst = gst;
    if (!calculatedGst) {
      calculatedGst = calculatedSubtotal * 0.18; // 18% GST
    }

    let calculatedTotal = totalAmount;
    if (!calculatedTotal) {
      calculatedTotal = calculatedSubtotal + calculatedGst;
    }

    // Process items and update stock
    const processedItems = [];
    for (const item of items) {
      // Update product stock if productId is provided
      if (item.productId) {
        const product = await Product.findById(item.productId);
        if (product) {
          if (product.stock < item.quantity) {
            return res.status(400).json({
              success: false,
              message: `Insufficient stock for ${product.name}. Available: ${product.stock}`
            });
          }
          product.stock -= item.quantity;
          await product.save();
        }
      }

      processedItems.push({
        name: item.name,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        total: item.quantity * item.price
      });
    }

    // Create sale
    const sale = new Sale({
      billNumber,
      customerName,
      customerId,
      items: processedItems,
      subtotal: calculatedSubtotal,
      gst: calculatedGst,
      totalAmount: calculatedTotal,
      paymentMode,
      status: 'Completed'
    });

    await sale.save();

    // Update customer stats if customerId is provided
    if (customerId) {
      await Customer.findByIdAndUpdate(customerId, {
        $inc: { 
          totalOrders: 1,
          totalSpent: calculatedTotal
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Sale created successfully',
      data: sale
    });
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create sale',
      error: error.message
    });
  }
});

/* ===================== UPDATE SALE ===================== */
router.put('/:id', async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Update allowed fields
    const allowedUpdates = ['status', 'customerName', 'paymentMode'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        sale[field] = req.body[field];
      }
    });

    await sale.save();

    res.json({
      success: true,
      message: 'Sale updated successfully',
      data: sale
    });
  } catch (error) {
    console.error('Error updating sale:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update sale',
      error: error.message
    });
  }
});

/* ===================== DELETE SALE ===================== */
router.delete('/:id', async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Restore stock for all items
    for (const item of sale.items) {
      if (item.productId) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: item.quantity }
        });
      }
    }

    // Update customer stats if customerId exists
    if (sale.customerId) {
      await Customer.findByIdAndUpdate(sale.customerId, {
        $inc: { 
          totalOrders: -1,
          totalSpent: -sale.totalAmount
        }
      });
    }

    await Sale.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Sale deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting sale:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete sale',
      error: error.message
    });
  }
});

/* ===================== EXPORT SALES TO CSV ===================== */
router.get('/export/csv', async (req, res) => {
  try {
    const sales = await Sale.find().sort({ date: -1 }).lean();

    // Create CSV header
    const headers = ['Bill Number', 'Date', 'Customer Name', 'Total Amount', 'GST', 'Payment Mode', 'Status'];
    
    // Create CSV rows
    const rows = sales.map(sale => [
      sale.billNumber,
      new Date(sale.date).toLocaleDateString(),
      sale.customerName,
      sale.totalAmount.toFixed(2),
      sale.gst.toFixed(2),
      sale.paymentMode,
      sale.status
    ]);

    // Combine headers and rows
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=sales_export.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting sales:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export sales',
      error: error.message
    });
  }
});

/* ===================== GET SALES STATISTICS ===================== */
router.get('/stats/summary', async (req, res) => {
  try {
    const totalSales = await Sale.countDocuments({ status: 'Completed' });
    const totalRevenue = await Sale.aggregate([
      { $match: { status: 'Completed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaySales = await Sale.countDocuments({
      status: 'Completed',
      date: { $gte: today }
    });

    const todayRevenue = await Sale.aggregate([
      { $match: { status: 'Completed', date: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.json({
      success: true,
      data: {
        totalSales,
        totalRevenue: totalRevenue[0]?.total || 0,
        todaySales,
        todayRevenue: todayRevenue[0]?.total || 0,
        averageSale: totalSales > 0 ? (totalRevenue[0]?.total || 0) / totalSales : 0
      }
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Customer = require('../models/Customer');

// ✅ GET ALL TRANSACTIONS
router.get('/', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      type, 
      customerId,
      limit = 50,
      page = 1 
    } = req.query;
    
    let filter = {};
    
    // Date filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }
    
    // Type filter
    if (type && type !== 'all') {
      filter.type = type;
    }
    
    // Customer filter
    if (customerId) {
      filter.customerId = customerId;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const transactions = await Transaction.find(filter)
      .populate('customerId', 'customerId name phone membershipTier')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalTransactions = await Transaction.countDocuments(filter);
    
    res.json({
      success: true,
      count: transactions.length,
      total: totalTransactions,
      page: parseInt(page),
      totalPages: Math.ceil(totalTransactions / parseInt(limit)),
      transactions: transactions
    });
  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching transactions'
    });
  }
});

// ✅ GET TRANSACTION BY ID
router.get('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('customerId', 'customerId name phone address membershipTier');
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }
    
    res.json({
      success: true,
      transaction: transaction
    });
  } catch (error) {
    console.error('❌ Error fetching transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ✅ GET TODAY'S TRANSACTION STATS
router.get('/today/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Today's transactions
    const todayTransactions = await Transaction.find({
      createdAt: { $gte: today, $lt: tomorrow }
    })
    .populate('customerId', 'customerId name phone')
    .sort({ createdAt: -1 });
    
    // Calculate stats
    const todayStats = {
      totalTransactions: todayTransactions.length,
      totalPurchases: todayTransactions
        .filter(t => t.type === 'Purchase')
        .reduce((sum, t) => sum + t.purchaseAmount, 0),
      totalCoinsEarned: todayTransactions
        .filter(t => t.coins > 0)
        .reduce((sum, t) => sum + t.coins, 0),
      totalCoinsRedeemed: Math.abs(todayTransactions
        .filter(t => t.coins < 0)
        .reduce((sum, t) => sum + t.coins, 0)),
      totalDiscountGiven: Math.abs(todayTransactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0)),
      transactionTypes: todayTransactions.reduce((acc, t) => {
        acc[t.type] = (acc[t.type] || 0) + 1;
        return acc;
      }, {})
    };
    
    res.json({
      success: true,
      stats: todayStats,
      transactions: todayTransactions
    });
  } catch (error) {
    console.error('❌ Error fetching today stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching today stats'
    });
  }
});

// ✅ GET TRANSACTIONS BY CUSTOMER ID
router.get('/customer/:customerId', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const transactions = await Transaction.find({ customerId: customer._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalTransactions = await Transaction.countDocuments({ customerId: customer._id });
    
    // Calculate customer transaction stats
    const transactionStats = {
      totalTransactions,
      totalPurchases: await Transaction.aggregate([
        { $match: { customerId: customer._id, type: 'Purchase' } },
        { $group: { _id: null, total: { $sum: '$purchaseAmount' } } }
      ]).then(res => res[0]?.total || 0),
      totalCoinsEarned: await Transaction.aggregate([
        { $match: { customerId: customer._id, coins: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$coins' } } }
      ]).then(res => res[0]?.total || 0),
      totalCoinsRedeemed: await Transaction.aggregate([
        { $match: { customerId: customer._id, coins: { $lt: 0 } } },
        { $group: { _id: null, total: { $sum: { $abs: '$coins' } } } }
      ]).then(res => res[0]?.total || 0)
    };
    
    res.json({
      success: true,
      customer: {
        id: customer._id,
        customerId: customer.customerId,
        name: customer.name,
        currentCoins: customer.coins
      },
      stats: transactionStats,
      count: transactions.length,
      total: totalTransactions,
      page: parseInt(page),
      totalPages: Math.ceil(totalTransactions / parseInt(limit)),
      transactions: transactions
    });
    
  } catch (error) {
    console.error('❌ Error fetching customer transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching customer transactions'
    });
  }
});

// ✅ GET TRANSACTION SUMMARY BY DATE RANGE
router.get('/summary/range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const transactions = await Transaction.find({
      createdAt: { $gte: start, $lte: end }
    }).populate('customerId', 'customerId name');
    
    // Group by date
    const dailySummary = transactions.reduce((acc, transaction) => {
      const date = transaction.createdAt.toISOString().split('T')[0];
      
      if (!acc[date]) {
        acc[date] = {
          date,
          purchases: 0,
          purchaseAmount: 0,
          redemptions: 0,
          redemptionAmount: 0,
          coinsEarned: 0,
          coinsRedeemed: 0,
          transactionCount: 0
        };
      }
      
      acc[date].transactionCount++;
      
      if (transaction.type === 'Purchase') {
        acc[date].purchases++;
        acc[date].purchaseAmount += transaction.purchaseAmount;
      }
      
      if (transaction.type === 'Redeem') {
        acc[date].redemptions++;
        acc[date].redemptionAmount += Math.abs(transaction.amount);
      }
      
      if (transaction.coins > 0) {
        acc[date].coinsEarned += transaction.coins;
      } else if (transaction.coins < 0) {
        acc[date].coinsRedeemed += Math.abs(transaction.coins);
      }
      
      return acc;
    }, {});
    
    // Convert to array
    const summaryArray = Object.values(dailySummary);
    
    // Calculate totals
    const totals = {
      totalTransactions: transactions.length,
      totalPurchases: summaryArray.reduce((sum, day) => sum + day.purchases, 0),
      totalPurchaseAmount: summaryArray.reduce((sum, day) => sum + day.purchaseAmount, 0),
      totalRedemptions: summaryArray.reduce((sum, day) => sum + day.redemptions, 0),
      totalRedemptionAmount: summaryArray.reduce((sum, day) => sum + day.redemptionAmount, 0),
      totalCoinsEarned: summaryArray.reduce((sum, day) => sum + day.coinsEarned, 0),
      totalCoinsRedeemed: summaryArray.reduce((sum, day) => sum + day.coinsRedeemed, 0)
    };
    
    res.json({
      success: true,
      period: { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] },
      totals,
      dailySummary: summaryArray
    });
    
  } catch (error) {
    console.error('❌ Error fetching transaction summary:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching transaction summary'
    });
  }
});

// ✅ EXPORT TRANSACTIONS (CSV format)
router.get('/export/csv', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let filter = {};
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }
    
    const transactions = await Transaction.find(filter)
      .populate('customerId', 'customerId name phone')
      .sort({ createdAt: -1 })
      .limit(1000); // Limit for export
    
    // Convert to CSV
    const csvHeaders = [
      'Transaction ID',
      'Date',
      'Customer ID',
      'Customer Name',
      'Type',
      'Amount (₹)',
      'Coins',
      'Purchase Amount (₹)',
      'Discount Value (₹)',
      'Balance Before',
      'Balance After',
      'Note',
      'Bill Number'
    ].join(',');
    
    const csvRows = transactions.map(t => [
      t.transactionId,
      t.createdAt.toISOString(),
      t.customerId?.customerId || 'N/A',
      t.customerId?.name || 'N/A',
      t.type,
      t.amount,
      t.coins,
      t.purchaseAmount,
      t.discountValue,
      t.balanceBefore,
      t.balanceAfter,
      `"${(t.note || '').replace(/"/g, '""')}"`,
      t.billNumber || ''
    ].join(','));
    
    const csvContent = [csvHeaders, ...csvRows].join('\n');
    
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename=transactions.csv');
    res.send(csvContent);
    
  } catch (error) {
    console.error('❌ Error exporting transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting transactions'
    });
  }
});

module.exports = router;
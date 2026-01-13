const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');

// ✅ GET COIN SYSTEM STATS
router.get('/stats', async (req, res) => {
  try {
    // Get total coins in system
    const totalCoinsResult = await Customer.aggregate([
      { $group: { _id: null, totalCoins: { $sum: '$coins' } } }
    ]);
    
    // Get total customers
    const totalCustomers = await Customer.countDocuments();
    
    // Get active customers
    const activeCustomers = await Customer.countDocuments({ status: 'active' });
    
    // Get tier distribution
    const tierDistribution = await Customer.aggregate([
      { $group: { _id: '$membershipTier', count: { $sum: 1 } } }
    ]);
    
    // Get total coins earned and redeemed
    const totalEarnedResult = await Customer.aggregate([
      { $group: { _id: null, totalEarned: { $sum: '$coinsEarned' } } }
    ]);
    
    const totalRedeemedResult = await Customer.aggregate([
      { $group: { _id: null, totalRedeemed: { $sum: '$coinsRedeemed' } } }
    ]);
    
    // Get today's transactions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayTransactions = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalCoins: { $sum: '$coins' },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);
    
    const stats = {
      totalCoins: totalCoinsResult[0]?.totalCoins || 0,
      totalCustomers,
      activeCustomers,
      tierDistribution,
      totalCoinsEarned: totalEarnedResult[0]?.totalEarned || 0,
      totalCoinsRedeemed: totalRedeemedResult[0]?.totalRedeemed || 0,
      todayTransactions
    };
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    console.error('❌ Error fetching coin stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching coin stats'
    });
  }
});

// ✅ GET CUSTOMER WALLET BY ID
router.get('/customer/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    // Get recent transactions
    const recentTransactions = await Transaction.find({ customerId: customer._id })
      .sort({ createdAt: -1 })
      .limit(10);
    
    const walletData = {
      customerId: customer.customerId,
      name: customer.name,
      phone: customer.phone,
      membershipTier: customer.membershipTier,
      currentCoins: customer.coins,
      totalEarned: customer.coinsEarned,
      totalRedeemed: customer.coinsRedeemed,
      totalPurchases: customer.totalPurchases,
      totalSpent: customer.totalSpent,
      visitCount: customer.visitCount,
      discountValue: customer.getDiscountValue(),
      joinDate: customer.joinDate,
      lastVisit: customer.lastVisit,
      status: customer.status,
      recentTransactions
    };
    
    res.json({
      success: true,
      wallet: walletData
    });
    
  } catch (error) {
    console.error('❌ Error fetching customer wallet:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching customer wallet'
    });
  }
});

// ✅ ADD COINS FROM PURCHASE
router.post('/purchase', async (req, res) => {
  try {
    const { customerId, purchaseAmount, billNumber, note } = req.body;
    
    if (!customerId || !purchaseAmount || purchaseAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID and valid purchase amount are required'
      });
    }
    
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    // Earn coins based on purchase
    const balanceBefore = customer.coins;
    const earnedCoins = customer.earnCoinsFromPurchase(parseFloat(purchaseAmount));
    await customer.save();
    
    // Create transaction record
    const purchaseTransaction = new Transaction({
      customerId: customer._id,
      type: 'Purchase',
      amount: parseFloat(purchaseAmount),
      coins: earnedCoins,
      purchaseAmount: parseFloat(purchaseAmount),
      balanceBefore,
      balanceAfter: customer.coins,
      note: note || `Purchase: ₹${purchaseAmount}`,
      billNumber: billNumber || ''
    });
    await purchaseTransaction.save();
    
    // Emit socket event
    if (req.io) {
      req.io.to('coins').emit('coinUpdate', {
        customerId: customer.customerId,
        customerName: customer.name,
        type: 'purchase',
        coins: earnedCoins,
        totalCoins: customer.coins,
        purchaseAmount
      });
      
      req.io.to('transactions').emit('newTransaction', {
        transaction: purchaseTransaction,
        customerName: customer.name
      });
    }
    
    res.json({
      success: true,
      message: `Purchase recorded! ${earnedCoins} coins earned.`,
      customer: {
        id: customer._id,
        customerId: customer.customerId,
        name: customer.name,
        coins: customer.coins,
        membershipTier: customer.membershipTier
      },
      transaction: purchaseTransaction
    });
    
  } catch (error) {
    console.error('❌ Error recording purchase:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while recording purchase'
    });
  }
});

// ✅ REDEEM COINS
router.post('/redeem', async (req, res) => {
  try {
    const { customerId, coins, note, billNumber } = req.body;
    
    if (!customerId || !coins || coins <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID and valid coin amount are required'
      });
    }
    
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    if (customer.coins < coins) {
      return res.status(400).json({
        success: false,
        message: `Insufficient coins. Available: ${customer.coins}`
      });
    }
    
    const balanceBefore = customer.coins;
    customer.redeemCoins(parseInt(coins));
    await customer.save();
    
    // Calculate discount value (₹0.5 per coin)
    const discountValue = coins * 0.5;
    
    // Create transaction record
    const redeemTransaction = new Transaction({
      customerId: customer._id,
      type: 'Redeem',
      amount: -discountValue,
      coins: -parseInt(coins),
      discountValue: discountValue,
      balanceBefore,
      balanceAfter: customer.coins,
      note: note || `Redeemed ${coins} coins for ₹${discountValue} discount`,
      billNumber: billNumber || ''
    });
    await redeemTransaction.save();
    
    // Emit socket event
    if (req.io) {
      req.io.to('coins').emit('coinUpdate', {
        customerId: customer.customerId,
        customerName: customer.name,
        type: 'redeem',
        coins: -coins,
        totalCoins: customer.coins,
        discountValue
      });
      
      req.io.to('transactions').emit('newTransaction', {
        transaction: redeemTransaction,
        customerName: customer.name
      });
    }
    
    res.json({
      success: true,
      message: `Redeemed ${coins} coins for ₹${discountValue} discount!`,
      customer: {
        id: customer._id,
        customerId: customer.customerId,
        name: customer.name,
        coins: customer.coins
      },
      transaction: redeemTransaction,
      discountValue
    });
    
  } catch (error) {
    console.error('❌ Error redeeming coins:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while redeeming coins'
    });
  }
});

// ✅ MANUAL COIN ADJUSTMENT
router.post('/adjust', async (req, res) => {
  try {
    const { customerId, type, coins, note } = req.body;
    
    if (!customerId || !type || !coins || coins <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID, type and valid coin amount are required'
      });
    }
    
    if (!['Manual Credit', 'Manual Debit'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be "Manual Credit" or "Manual Debit"'
      });
    }
    
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    if (type === 'Manual Debit' && customer.coins < coins) {
      return res.status(400).json({
        success: false,
        message: `Insufficient coins. Available: ${customer.coins}`
      });
    }
    
    const balanceBefore = customer.coins;
    
    if (type === 'Manual Credit') {
      customer.coins += parseInt(coins);
      customer.coinsEarned += parseInt(coins);
    } else {
      customer.coins -= parseInt(coins);
      customer.coinsRedeemed += parseInt(coins);
    }
    
    await customer.save();
    
    // Create transaction record
    const adjustmentTransaction = new Transaction({
      customerId: customer._id,
      type: type,
      amount: type === 'Manual Credit' ? parseInt(coins) : -parseInt(coins),
      coins: type === 'Manual Credit' ? parseInt(coins) : -parseInt(coins),
      balanceBefore,
      balanceAfter: customer.coins,
      note: note || `${type}: ${coins} coins`
    });
    await adjustmentTransaction.save();
    
    // Emit socket event
    if (req.io) {
      req.io.to('coins').emit('coinUpdate', {
        customerId: customer.customerId,
        customerName: customer.name,
        type: 'adjustment',
        adjustmentType: type.toLowerCase().replace('manual ', ''),
        coins: type === 'Manual Credit' ? parseInt(coins) : -parseInt(coins),
        totalCoins: customer.coins
      });
      
      req.io.to('transactions').emit('newTransaction', {
        transaction: adjustmentTransaction,
        customerName: customer.name
      });
    }
    
    res.json({
      success: true,
      message: `${type} of ${coins} coins completed!`,
      customer: {
        id: customer._id,
        customerId: customer.customerId,
        name: customer.name,
        coins: customer.coins
      },
      transaction: adjustmentTransaction
    });
    
  } catch (error) {
    console.error('❌ Error adjusting coins:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adjusting coins'
    });
  }
});

// ✅ UPDATE MEMBERSHIP TIER
router.put('/tier/:customerId', async (req, res) => {
  try {
    const { tier } = req.body;
    
    if (!['Bronze', 'Silver', 'Gold', 'Platinum'].includes(tier)) {
      return res.status(400).json({
        success: false,
        message: 'Tier must be Bronze, Silver, Gold, or Platinum'
      });
    }
    
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    const oldTier = customer.membershipTier;
    customer.membershipTier = tier;
    await customer.save();
    
    // Emit socket event
    if (req.io) {
      req.io.to('coins').emit('tierUpdate', {
        customerId: customer.customerId,
        customerName: customer.name,
        oldTier,
        newTier: tier
      });
    }
    
    res.json({
      success: true,
      message: `Membership tier updated from ${oldTier} to ${tier}`,
      customer: {
        id: customer._id,
        customerId: customer.customerId,
        name: customer.name,
        membershipTier: customer.membershipTier
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating tier:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating tier'
    });
  }
});

// ✅ GET TOP CUSTOMERS BY COINS
router.get('/top/customers', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const topCustomers = await Customer.find()
      .sort({ coins: -1 })
      .limit(parseInt(limit))
      .select('customerId name phone membershipTier coins totalPurchases visitCount');
    
    res.json({
      success: true,
      count: topCustomers.length,
      customers: topCustomers
    });
    
  } catch (error) {
    console.error('❌ Error fetching top customers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching top customers'
    });
  }
});

module.exports = router;
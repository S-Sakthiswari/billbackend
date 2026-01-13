const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');

// ✅ GET ALL CUSTOMERS (with coin stats)
router.get('/', async (req, res) => {
  try {
    const { tier, status, minCoins, maxCoins } = req.query;
    
    let filter = {};
    
    if (tier && tier !== 'all') {
      filter.membershipTier = tier;
    }
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    if (minCoins) {
      filter.coins = { $gte: parseInt(minCoins) };
    }
    
    if (maxCoins) {
      filter.coins = { ...filter.coins, $lte: parseInt(maxCoins) };
    }
    
    const customers = await Customer.find(filter).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: customers.length,
      customers: customers
    });
  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching customers'
    });
  }
});

// ✅ GET SINGLE CUSTOMER with transaction history
router.get('/:id', async (req, res) => {
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
    
    res.json({
      success: true,
      customer: {
        ...customer.toObject(),
        recentTransactions
      }
    });
  } catch (error) {
    console.error('❌ Error fetching customer:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ✅ CREATE NEW CUSTOMER (with welcome bonus)
router.post('/', async (req, res) => {
  try {
    console.log('👤 Creating customer with data:', req.body);
    
    const { name, phone, address, status, email } = req.body;
    
    // Validation
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name and phone'
      });
    }
    
    // Check if phone already exists
    const existingCustomer = await Customer.findOne({ phone: phone.trim() });
    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: 'Customer with this phone number already exists'
      });
    }
    
    // Create new customer
    const newCustomer = new Customer({
      name: name.trim(),
      phone: phone.trim(),
      address: address ? address.trim() : '',
      email: email ? email.trim() : '',
      status: status || 'active'
    });
    
    // Add welcome bonus coins
    newCustomer.coins = 50; // Welcome bonus
    newCustomer.coinsEarned = 50;
    
    const savedCustomer = await newCustomer.save();
    
    // Create welcome bonus transaction
    const welcomeTransaction = new Transaction({
      customerId: savedCustomer._id,
      type: 'Welcome Bonus',
      amount: 0,
      coins: 50,
      balanceBefore: 0,
      balanceAfter: 50,
      note: 'Welcome to Supermarket Loyalty Program!'
    });
    await welcomeTransaction.save();
    
    console.log('✅ Customer created with welcome bonus:', savedCustomer.customerId);
    
    res.status(201).json({
      success: true,
      message: 'Customer created successfully with 50 welcome coins!',
      customer: savedCustomer
    });
  } catch (error) {
    console.error('❌ Error creating customer:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while creating customer'
    });
  }
});

// ✅ UPDATE CUSTOMER
router.put('/:id', async (req, res) => {
  try {
    console.log('🔄 Updating customer:', req.params.id);
    
    const { name, phone, address, status, email, membershipTier } = req.body;
    
    // Check if phone already exists for another customer
    if (phone) {
      const existingCustomer = await Customer.findOne({ 
        phone: phone.trim(),
        _id: { $ne: req.params.id }
      });
      if (existingCustomer) {
        return res.status(400).json({
          success: false,
          message: 'Another customer with this phone number already exists'
        });
      }
    }
    
    const updateData = {
      name: name ? name.trim() : undefined,
      phone: phone ? phone.trim() : undefined,
      address: address !== undefined ? address.trim() : undefined,
      email: email !== undefined ? email.trim() : undefined,
      status: status || undefined,
      membershipTier: membershipTier || undefined,
      updatedAt: Date.now()
    };
    
    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    const updatedCustomer = await Customer.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );
    
    if (!updatedCustomer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    console.log('✅ Customer updated:', updatedCustomer.customerId);
    
    res.json({
      success: true,
      message: 'Customer updated successfully',
      customer: updatedCustomer
    });
  } catch (error) {
    console.error('❌ Error updating customer:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already exists for another customer'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating customer'
    });
  }
});

// ✅ DELETE CUSTOMER
router.delete('/:id', async (req, res) => {
  try {
    console.log('🗑️ Deleting customer:', req.params.id);
    
    const deletedCustomer = await Customer.findByIdAndDelete(req.params.id);
    
    if (!deletedCustomer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    // Delete associated transactions
    await Transaction.deleteMany({ customerId: deletedCustomer._id });
    
    console.log('✅ Customer deleted:', deletedCustomer.customerId);
    
    res.json({
      success: true,
      message: 'Customer and their transactions deleted successfully',
      deletedCustomerId: deletedCustomer.customerId
    });
  } catch (error) {
    console.error('❌ Error deleting customer:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting customer'
    });
  }
});

// ✅ SEARCH CUSTOMERS
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    console.log('🔍 Searching customers for:', q);
    
    if (!q || q.trim() === '') {
      const customers = await Customer.find().sort({ createdAt: -1 });
      return res.json({
        success: true,
        customers: customers
      });
    }
    
    const customers = await Customer.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { customerId: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { address: { $regex: q, $options: 'i' } }
      ]
    }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: customers.length,
      customers: customers
    });
  } catch (error) {
    console.error('❌ Error searching customers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while searching'
    });
  }
});

// ✅ COIN OPERATIONS

// Add coins from purchase
router.post('/:id/purchase', async (req, res) => {
  try {
    const { purchaseAmount, billNumber, note } = req.body;
    
    if (!purchaseAmount || purchaseAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid purchase amount is required'
      });
    }
    
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    // Earn coins based on purchase
    const earnedCoins = customer.earnCoinsFromPurchase(parseFloat(purchaseAmount));
    
    // Update customer statistics
    customer.totalOrders += 1;
    customer.totalSpent += parseFloat(purchaseAmount);
    await customer.save();
    
    // Create transaction record
    const purchaseTransaction = new Transaction({
      customerId: customer._id,
      type: 'Purchase',
      amount: parseFloat(purchaseAmount),
      coins: earnedCoins,
      purchaseAmount: parseFloat(purchaseAmount),
      balanceBefore: customer.coins - earnedCoins,
      balanceAfter: customer.coins,
      note: note || `Purchase: ₹${purchaseAmount}`,
      billNumber: billNumber || ''
    });
    await purchaseTransaction.save();
    
    res.json({
      success: true,
      message: `Purchase recorded! ${earnedCoins} coins earned.`,
      customer: customer,
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

// Redeem coins
router.post('/:id/redeem', async (req, res) => {
  try {
    const { coins, note, billNumber } = req.body;
    
    if (!coins || coins <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid coin amount is required'
      });
    }
    
    const customer = await Customer.findById(req.params.id);
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
    
    // Calculate discount value
    const discountValue = coins * 0.5; // ₹0.5 per coin
    
    // Create transaction record
    const redeemTransaction = new Transaction({
      customerId: customer._id,
      type: 'Redeem',
      amount: -discountValue,
      coins: -parseInt(coins),
      discountValue: discountValue,
      balanceBefore: balanceBefore,
      balanceAfter: customer.coins,
      note: note || `Redeemed ${coins} coins for ₹${discountValue} discount`,
      billNumber: billNumber || ''
    });
    await redeemTransaction.save();
    
    res.json({
      success: true,
      message: `Redeemed ${coins} coins for ₹${discountValue} discount!`,
      customer: customer,
      transaction: redeemTransaction
    });
    
  } catch (error) {
    console.error('❌ Error redeeming coins:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while redeeming coins'
    });
  }
});

// Manual coin adjustment
router.post('/:id/coins', async (req, res) => {
  try {
    const { type, coins, note } = req.body;
    
    if (!type || !coins || coins <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Type and valid coin amount are required'
      });
    }
    
    if (!['Manual Credit', 'Manual Debit'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be "Manual Credit" or "Manual Debit"'
      });
    }
    
    const customer = await Customer.findById(req.params.id);
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
      balanceBefore: balanceBefore,
      balanceAfter: customer.coins,
      note: note || `${type}: ${coins} coins`
    });
    await adjustmentTransaction.save();
    
    res.json({
      success: true,
      message: `${type} of ${coins} coins completed!`,
      customer: customer,
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

// Get customer transaction history
router.get('/:id/transactions', async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    
    const customer = await Customer.findById(req.params.id);
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

// Get customer wallet stats
router.get('/:id/wallet', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    // Calculate stats
    const walletStats = {
      customerId: customer.customerId,
      name: customer.name,
      membershipTier: customer.membershipTier,
      currentCoins: customer.coins,
      totalEarned: customer.coinsEarned,
      totalRedeemed: customer.coinsRedeemed,
      totalPurchases: customer.totalPurchases,
      visitCount: customer.visitCount,
      discountValue: customer.getDiscountValue(),
      joinDate: customer.joinDate,
      lastVisit: customer.lastVisit,
      status: customer.status
    };
    
    res.json({
      success: true,
      stats: walletStats
    });
    
  } catch (error) {
    console.error('❌ Error fetching wallet stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching wallet stats'
    });
  }
});

module.exports = router;
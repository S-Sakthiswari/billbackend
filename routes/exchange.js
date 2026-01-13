const express = require('express');
const router = express.Router();
const Exchange = require('../models/Exchange');

// Create exchange product
router.post('/', async (req, res) => {
  try {
    const exchangeData = req.body;
    
    // Create new exchange
    const exchange = new Exchange({
      ...exchangeData,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'pending'
    });

    await exchange.save();
    
    // Emit notification
    if (req.io) {
      req.io.emit('new_notification', {
        type: 'exchange_added',
        title: 'Exchange Product Added',
        message: `Exchange product "${exchangeData.name}" added with value ₹${exchangeData.assignedValue}`,
        priority: 'medium',
        color: 'purple',
        icon: 'Repeat',
        timestamp: new Date(),
        isRead: false
      });
    }

    res.status(201).json({
      success: true,
      message: 'Exchange product created successfully',
      exchange
    });
  } catch (error) {
    console.error('Error creating exchange:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create exchange product'
    });
  }
});

// Get all exchange products
router.get('/', async (req, res) => {
  try {
    const exchanges = await Exchange.find()
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      count: exchanges.length,
      exchanges
    });
  } catch (error) {
    console.error('Error fetching exchanges:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch exchange products'
    });
  }
});

// Get exchange by ID
router.get('/:id', async (req, res) => {
  try {
    const exchange = await Exchange.findById(req.params.id);
    
    if (!exchange) {
      return res.status(404).json({
        success: false,
        error: 'Exchange product not found'
      });
    }

    res.json({
      success: true,
      exchange
    });
  } catch (error) {
    console.error('Error fetching exchange:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch exchange product'
    });
  }
});

// Update exchange
router.put('/:id', async (req, res) => {
  try {
    const exchange = await Exchange.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!exchange) {
      return res.status(404).json({
        success: false,
        error: 'Exchange product not found'
      });
    }

    res.json({
      success: true,
      message: 'Exchange updated successfully',
      exchange
    });
  } catch (error) {
    console.error('Error updating exchange:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update exchange product'
    });
  }
});

// Delete exchange
router.delete('/:id', async (req, res) => {
  try {
    const exchange = await Exchange.findByIdAndDelete(req.params.id);

    if (!exchange) {
      return res.status(404).json({
        success: false,
        error: 'Exchange product not found'
      });
    }

    res.json({
      success: true,
      message: 'Exchange product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting exchange:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete exchange product'
    });
  }
});

// Get exchanges by customer
router.get('/customer/:customerId', async (req, res) => {
  try {
    const exchanges = await Exchange.find({ customerId: req.params.customerId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: exchanges.length,
      exchanges
    });
  } catch (error) {
    console.error('Error fetching customer exchanges:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch customer exchange products'
    });
  }
});

module.exports = router;
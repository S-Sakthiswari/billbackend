const express = require('express');
const router = express.Router();
const Discount = require('../models/Discount');

// ✅ GET ALL DISCOUNTS
router.get('/', async (req, res) => {
  try {
    const discounts = await Discount.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      count: discounts.length,
      discounts: discounts
    });
  } catch (error) {
    console.error('❌ Error fetching discounts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching discounts'
    });
  }
});

// ✅ GET SINGLE DISCOUNT
router.get('/:id', async (req, res) => {
  try {
    const discount = await Discount.findById(req.params.id);
    
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }
    
    res.json({
      success: true,
      discount: discount
    });
  } catch (error) {
    console.error('❌ Error fetching discount:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ✅ CREATE NEW DISCOUNT
router.post('/', async (req, res) => {
  try {
    console.log('🎯 Creating discount with data:', req.body);
    
    const { name, type, value, minBillAmount, description, status } = req.body;
    
    // Validation
    if (!name || !type || value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, type, and value'
      });
    }
    
    // Validate percentage value (0-100)
    if (type === 'percentage' && (value < 0 || value > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Percentage value must be between 0 and 100'
      });
    }
    
    // Validate fixed amount
    if (type === 'fixed_amount' && value < 0) {
      return res.status(400).json({
        success: false,
        message: 'Fixed amount cannot be negative'
      });
    }
    
    // Check if discount with same name exists
    const existingDiscount = await Discount.findOne({ name: name.trim() });
    if (existingDiscount) {
      return res.status(400).json({
        success: false,
        message: 'Discount with this name already exists'
      });
    }
    
    // Create new discount
    const newDiscount = new Discount({
      name: name.trim(),
      type,
      value: parseFloat(value),
      minBillAmount: parseFloat(minBillAmount) || 0,
      description: description ? description.trim() : '',
      status: status || 'active',
      totalApplied: 0
    });
    
    const savedDiscount = await newDiscount.save();
    console.log('✅ Discount created:', savedDiscount._id);
    
    res.status(201).json({
      success: true,
      message: 'Discount created successfully',
      discount: savedDiscount
    });
  } catch (error) {
    console.error('❌ Error creating discount:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while creating discount'
    });
  }
});

// ✅ UPDATE DISCOUNT
router.put('/:id', async (req, res) => {
  try {
    console.log('🔄 Updating discount:', req.params.id);
    
    const { name, type, value, minBillAmount, description, status } = req.body;
    
    // Validation
    if (type === 'percentage' && (value < 0 || value > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Percentage value must be between 0 and 100'
      });
    }
    
    if (type === 'fixed_amount' && value < 0) {
      return res.status(400).json({
        success: false,
        message: 'Fixed amount cannot be negative'
      });
    }
    
    // Check if name exists for another discount
    if (name) {
      const existingDiscount = await Discount.findOne({ 
        name: name.trim(),
        _id: { $ne: req.params.id }
      });
      if (existingDiscount) {
        return res.status(400).json({
          success: false,
          message: 'Another discount with this name already exists'
        });
      }
    }
    
    const updatedDiscount = await Discount.findByIdAndUpdate(
      req.params.id,
      {
        name: name.trim(),
        type,
        value: parseFloat(value),
        minBillAmount: parseFloat(minBillAmount) || 0,
        description: description ? description.trim() : '',
        status: status || 'active',
        updatedAt: new Date()
      },
      {
        new: true,
        runValidators: true
      }
    );
    
    if (!updatedDiscount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }
    
    console.log('✅ Discount updated:', updatedDiscount._id);
    
    res.json({
      success: true,
      message: 'Discount updated successfully',
      discount: updatedDiscount
    });
  } catch (error) {
    console.error('❌ Error updating discount:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating discount'
    });
  }
});

// ✅ DELETE DISCOUNT
router.delete('/:id', async (req, res) => {
  try {
    console.log('🗑️ Deleting discount:', req.params.id);
    
    const deletedDiscount = await Discount.findByIdAndDelete(req.params.id);
    
    if (!deletedDiscount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }
    
    console.log('✅ Discount deleted:', deletedDiscount._id);
    
    res.json({
      success: true,
      message: 'Discount deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting discount:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting discount'
    });
  }
});

// ✅ SEARCH DISCOUNTS
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    console.log('🔍 Searching discounts for:', q);
    
    if (!q || q.trim() === '') {
      const discounts = await Discount.find().sort({ createdAt: -1 });
      return res.json({
        success: true,
        discounts: discounts
      });
    }
    
    const discounts = await Discount.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ]
    }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: discounts.length,
      discounts: discounts
    });
  } catch (error) {
    console.error('❌ Error searching discounts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while searching'
    });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const Coupon = require('../models/Coupon');

// ✅ GET ALL COUPONS
router.get('/', async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      count: coupons.length,
      coupons: coupons
    });
  } catch (error) {
    console.error('❌ Error fetching coupons:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching coupons'
    });
  }
});

// ✅ GET SINGLE COUPON
router.get('/:id', async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }
    
    res.json({
      success: true,
      coupon: coupon
    });
  } catch (error) {
    console.error('❌ Error fetching coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ✅ GET COUPON BY CODE
router.get('/code/:code', async (req, res) => {
  try {
    const coupon = await Coupon.findOne({ code: req.params.code.toUpperCase() });
    
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }
    
    res.json({
      success: true,
      coupon: coupon
    });
  } catch (error) {
    console.error('❌ Error fetching coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ✅ CREATE NEW COUPON
router.post('/', async (req, res) => {
  try {
    console.log('🎟️ Creating coupon with data:', req.body);
    
    const { code, description, discountType, value, expiryDate, usageLimit, minPurchase } = req.body;
    
    // Validation
    if (!code || !discountType || value === undefined || !expiryDate || !usageLimit) {
      return res.status(400).json({
        success: false,
        message: 'Please provide code, discountType, value, expiryDate, and usageLimit'
      });
    }
    
    // Validate percentage value (0-100)
    if (discountType === 'percentage' && (value < 0 || value > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Percentage value must be between 0 and 100'
      });
    }
    
    // Validate fixed amount
    if (discountType === 'fixed' && value < 0) {
      return res.status(400).json({
        success: false,
        message: 'Fixed amount cannot be negative'
      });
    }
    
    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: code.trim().toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: 'Coupon with this code already exists'
      });
    }
    
    // Create new coupon
    const newCoupon = new Coupon({
      code: code.trim().toUpperCase(),
      description: description ? description.trim() : '',
      discountType,
      value: parseFloat(value),
      expiryDate: new Date(expiryDate),
      usageLimit: parseInt(usageLimit),
      usageCount: 0,
      minPurchase: parseFloat(minPurchase) || 0
    });
    
    const savedCoupon = await newCoupon.save();
    console.log('✅ Coupon created:', savedCoupon._id);
    
    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon: savedCoupon
    });
  } catch (error) {
    console.error('❌ Error creating coupon:', error);
    
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
        message: 'Coupon code already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while creating coupon'
    });
  }
});

// ✅ UPDATE COUPON
router.put('/:id', async (req, res) => {
  try {
    console.log('🔄 Updating coupon:', req.params.id);
    
    const { code, description, discountType, value, expiryDate, usageLimit, minPurchase } = req.body;
    
    // Validation
    if (discountType === 'percentage' && (value < 0 || value > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Percentage value must be between 0 and 100'
      });
    }
    
    if (discountType === 'fixed' && value < 0) {
      return res.status(400).json({
        success: false,
        message: 'Fixed amount cannot be negative'
      });
    }
    
    // Check if code exists for another coupon
    if (code) {
      const existingCoupon = await Coupon.findOne({ 
        code: code.trim().toUpperCase(),
        _id: { $ne: req.params.id }
      });
      if (existingCoupon) {
        return res.status(400).json({
          success: false,
          message: 'Another coupon with this code already exists'
        });
      }
    }
    
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      {
        code: code.trim().toUpperCase(),
        description: description ? description.trim() : '',
        discountType,
        value: parseFloat(value),
        expiryDate: new Date(expiryDate),
        usageLimit: parseInt(usageLimit),
        minPurchase: parseFloat(minPurchase) || 0,
        updatedAt: new Date()
      },
      {
        new: true,
        runValidators: true
      }
    );
    
    if (!updatedCoupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }
    
    console.log('✅ Coupon updated:', updatedCoupon._id);
    
    res.json({
      success: true,
      message: 'Coupon updated successfully',
      coupon: updatedCoupon
    });
  } catch (error) {
    console.error('❌ Error updating coupon:', error);
    
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
        message: 'Coupon code already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating coupon'
    });
  }
});

// ✅ DELETE COUPON
router.delete('/:id', async (req, res) => {
  try {
    console.log('🗑️ Deleting coupon:', req.params.id);
    
    const deletedCoupon = await Coupon.findByIdAndDelete(req.params.id);
    
    if (!deletedCoupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }
    
    console.log('✅ Coupon deleted:', deletedCoupon._id);
    
    res.json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting coupon'
    });
  }
});

// ✅ SEARCH COUPONS
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    console.log('🔍 Searching coupons for:', q);
    
    if (!q || q.trim() === '') {
      const coupons = await Coupon.find().sort({ createdAt: -1 });
      return res.json({
        success: true,
        coupons: coupons
      });
    }
    
    const coupons = await Coupon.find({
      $or: [
        { code: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ]
    }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: coupons.length,
      coupons: coupons
    });
  } catch (error) {
    console.error('❌ Error searching coupons:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while searching'
    });
  }
});

// ✅ VALIDATE COUPON (For checkout/POS)
router.post('/validate', async (req, res) => {
  try {
    const { code, totalAmount } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required'
      });
    }
    
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }
    
    const today = new Date();
    const expiryDate = new Date(coupon.expiryDate);
    
    // Check expiry
    if (today > expiryDate) {
      return res.status(400).json({
        success: false,
        message: 'Coupon has expired'
      });
    }
    
    // Check usage limit
    if (coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        message: 'Coupon usage limit reached'
      });
    }
    
    // Check minimum purchase
    if (totalAmount && totalAmount < coupon.minPurchase) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase of ₹${coupon.minPurchase} required`
      });
    }
    
    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (totalAmount * coupon.value) / 100;
    } else {
      discountAmount = coupon.value;
    }
    
    res.json({
      success: true,
      message: 'Coupon is valid',
      coupon: coupon,
      discountAmount: discountAmount,
      finalAmount: totalAmount - discountAmount
    });
  } catch (error) {
    console.error('❌ Error validating coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while validating coupon'
    });
  }
});

module.exports = router;
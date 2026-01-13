const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');

// Process payment
router.post('/process', async (req, res) => {
  try {
    const paymentData = req.body;
    
    // Generate payment ID
    const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create payment record
    const payment = new Payment({
      ...paymentData,
      paymentId,
      status: 'completed',
      processedAt: new Date(),
      createdAt: new Date()
    });

    await payment.save();
    
    // Emit notification
    if (req.io) {
      req.io.emit('new_notification', {
        type: 'payment_processed',
        title: 'Payment Processed',
        message: `Payment of ₹${paymentData.amount} processed via ${paymentData.method}`,
        amount: paymentData.amount,
        method: paymentData.method,
        priority: 'high',
        color: 'green',
        icon: 'CreditCard',
        timestamp: new Date(),
        isRead: false
      });
    }

    res.json({
      success: true,
      message: 'Payment processed successfully',
      payment: {
        paymentId,
        amount: paymentData.amount,
        method: paymentData.method,
        status: 'completed',
        timestamp: payment.processedAt
      }
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Payment processing failed'
    });
  }
});

// Get all payments
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, method, startDate, endDate } = req.query;
    
    const query = {};
    
    if (method) {
      query.method = method;
    }
    
    if (startDate || endDate) {
      query.processedAt = {};
      if (startDate) query.processedAt.$gte = new Date(startDate);
      if (endDate) query.processedAt.$lte = new Date(endDate);
    }
    
    const payments = await Payment.find(query)
      .sort({ processedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(query);
    const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);

    res.json({
      success: true,
      count: payments.length,
      total,
      totalAmount,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      payments
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch payments'
    });
  }
});

// Get payment by ID
router.get('/:id', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      payment
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch payment'
    });
  }
});

// Get payments by invoice ID
router.get('/invoice/:invoiceId', async (req, res) => {
  try {
    const payments = await Payment.find({ invoiceId: req.params.invoiceId })
      .sort({ processedAt: -1 });

    res.json({
      success: true,
      count: payments.length,
      payments
    });
  } catch (error) {
    console.error('Error fetching invoice payments:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch invoice payments'
    });
  }
});

// Refund payment
router.post('/:id/refund', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    if (payment.status === 'refunded') {
      return res.status(400).json({
        success: false,
        error: 'Payment already refunded'
      });
    }

    payment.status = 'refunded';
    payment.refundedAt = new Date();
    payment.refundReason = req.body.reason || 'Customer request';
    await payment.save();
    
    // Emit notification
    if (req.io) {
      req.io.emit('new_notification', {
        type: 'payment_refunded',
        title: 'Payment Refunded',
        message: `Refund of ₹${payment.amount} processed`,
        amount: payment.amount,
        method: payment.method,
        priority: 'medium',
        color: 'orange',
        icon: 'CreditCard',
        timestamp: new Date(),
        isRead: false
      });
    }

    res.json({
      success: true,
      message: 'Payment refunded successfully',
      payment
    });
  } catch (error) {
    console.error('Error refunding payment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to refund payment'
    });
  }
});

// Get payment summary by method
router.get('/summary/methods', async (req, res) => {
  try {
    const summary = await Payment.aggregate([
      {
        $group: {
          _id: '$method',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    const total = await Payment.aggregate([
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    res.json({
      success: true,
      summary,
      total: total[0] || { count: 0, totalAmount: 0 }
    });
  } catch (error) {
    console.error('Error fetching payment summary:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch payment summary'
    });
  }
});

module.exports = router;
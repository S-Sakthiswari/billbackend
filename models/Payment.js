const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.Mixed, // Allow both String and ObjectId
    required: true
  },
  paymentId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  invoiceId: {
    type: mongoose.Schema.Types.Mixed, // Allow both String and ObjectId
    ref: 'Invoice',
    required: true
  },
  invoiceNumber: {
    type: String,
    required: true,
    trim: true
  },
  customerId: {
    type: mongoose.Schema.Types.Mixed, // Allow both String and ObjectId
    ref: 'Customer',
    required: true
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount cannot be negative']
  },
  method: {
    type: String,
    required: true,
    enum: ['cash', 'card', 'upi', 'bank_transfer', 'wallet', 'credit'],
    default: 'cash'
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  transactionId: {
    type: String,
    trim: true
  },
  referenceNumber: {
    type: String,
    trim: true
  },
  processedAt: {
    type: Date,
    default: Date.now
  },
  refundedAt: {
    type: Date
  },
  refundReason: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
PaymentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Auto-generate payment ID if not provided
  if (!this.paymentId && this._id) {
    this.paymentId = typeof this._id === 'string' ? this._id : `pay_${Date.now()}`;
  }
  
  if (typeof next === 'function') {
    next();
  }
});

// Indexes for faster queries
PaymentSchema.index({ paymentId: 1 });
PaymentSchema.index({ invoiceId: 1 });
PaymentSchema.index({ customerId: 1 });
PaymentSchema.index({ processedAt: -1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ method: 1 });
PaymentSchema.index({ amount: 1 });

module.exports = mongoose.model('Payment', PaymentSchema);
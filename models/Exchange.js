const mongoose = require('mongoose');

const ExchangeSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.Mixed, // Allow both String and ObjectId
    required: true
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  brand: {
    type: String,
    trim: true
  },
  model: {
    type: String,
    trim: true
  },
  yearsUsed: {
    type: Number,
    required: true,
    min: [0, 'Years used cannot be negative'],
    default: 1
  },
  condition: {
    type: String,
    required: true,
    enum: ['excellent', 'good', 'fair', 'poor'],
    default: 'good'
  },
  remarks: {
    type: String,
    trim: true
  },
  assignedValue: {
    type: Number,
    required: true,
    min: [0, 'Assigned value cannot be negative'],
    default: 0
  },
  customerId: {
    type: mongoose.Schema.Types.Mixed, // Allow both String and ObjectId
    ref: 'Customer',
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  invoiceId: {
    type: mongoose.Schema.Types.Mixed, // Allow both String and ObjectId
    ref: 'Invoice'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending'
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
ExchangeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (typeof next === 'function') {
    next();
  }
});

// Indexes
ExchangeSchema.index({ customerId: 1 });
ExchangeSchema.index({ invoiceId: 1 });
ExchangeSchema.index({ status: 1 });
ExchangeSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Exchange', ExchangeSchema);
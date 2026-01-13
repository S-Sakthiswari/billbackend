const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  uniqueCode: {
    type: String,
    required: true,
    index: true
  },
  productName: {
    type: String,
    required: true
  },
  transactionType: {
    type: String,
    enum: ['add', 'remove', 'adjust', 'initial'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  previousStock: {
    type: Number,
    required: true
  },
  newStock: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    trim: true,
    default: ''
  },
  notes: {
    type: String,
    trim: true
  },
  performedBy: {
    type: String,
    default: 'system'
  },
  transactionDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
stockSchema.index({ productId: 1, createdAt: -1 });
stockSchema.index({ uniqueCode: 1, createdAt: -1 });

module.exports = mongoose.model('Stock', stockSchema);
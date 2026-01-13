const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['Low Stock', 'Out of Stock', 'Payment Alert', 'GST Alert', 'System Alert']
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  productName: String,
  currentStock: Number,
  minStock: Number,
  orderId: String,
  taxId: String,
  invoiceNo: String,
  billNumber: String,
  invoiceNumber: String,
  customerName: String,
  customer: String,
  customerPhone: String,
  gstin: String,
  amount: Number,
  paymentMode: String,
  daysSince: Number,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  color: {
    type: String,
    enum: ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'],
    default: 'gray'
  },
  icon: {
    type: String,
    default: 'Bell'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isResolved: {
    type: Boolean,
    default: false
  },
  resolutionNote: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  resolvedAt: Date,
  notificationHash: {
    type: String,
    unique: true,
    sparse: true
  },
  status: String,
  isHighValue: Boolean
}, {
  timestamps: true
});

// Index for faster queries
notificationSchema.index({ isResolved: 1, isRead: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ timestamp: -1 });
notificationSchema.index({ notificationHash: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Notification', notificationSchema);
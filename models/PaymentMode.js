// models/PaymentMode.js
const mongoose = require('mongoose');

const paymentModeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    trim: true
  },
  icon: {
    type: String,
    default: 'payment'
  }
}, { 
  timestamps: true 
});

// Add indexes for better query performance
paymentModeSchema.index({ name: 1 });
paymentModeSchema.index({ isActive: 1 });

module.exports = mongoose.model('PaymentMode', paymentModeSchema);
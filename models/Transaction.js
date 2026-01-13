const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },

  transactionId: {
    type: String,
    unique: true
  },

  type: {
    type: String,
    enum: [
      'Purchase',
      'Redeem',
      'Manual Credit',
      'Manual Debit',
      'Welcome Bonus',
      'Referral Bonus',
      'Tier Upgrade Bonus',
      'Refund',
      'Adjustment'
    ],
    required: true
  },

  amount: {
    type: Number,
    required: true
  },

  coins: {
    type: Number,
    default: 0
  },

  purchaseAmount: {
    type: Number,
    default: 0
  },

  discountValue: {
    type: Number,
    default: 0
  },

  balanceBefore: {
    type: Number,
    required: true
  },

  balanceAfter: {
    type: Number,
    required: true
  },

  note: {
    type: String,
    trim: true
  },

  billNumber: String,
  storeLocation: String,
  cashierId: String,

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});


// ===================================================
// 🔐 AUTO-GENERATE TRANSACTION ID (FIXED)
// ===================================================
transactionSchema.pre('save', async function () {
  this.updatedAt = Date.now();

  if (this.transactionId) return;

  const Counter = mongoose.model('Counter');

  const counter = await Counter.findOneAndUpdate(
    { name: 'transaction' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  this.transactionId = `TXN-${year}${month}${day}-${String(counter.seq).padStart(6, '0')}`;
});


// ===================================================
// INDEXES
// ===================================================
transactionSchema.index({ customerId: 1, createdAt: -1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ createdAt: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);

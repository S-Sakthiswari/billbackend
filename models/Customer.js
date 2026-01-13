const mongoose = require('mongoose');
const Counter = require('./Counter');

const customerSchema = new mongoose.Schema({
  customerId: { type: String, unique: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  address: { type: String, default: '' },
  email: { type: String, trim: true, lowercase: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },

  membershipTier: {
    type: String,
    enum: ['Bronze', 'Silver', 'Gold', 'Platinum'],
    default: 'Bronze'
  },

  coins: { type: Number, default: 0, min: 0 },
  totalPurchases: { type: Number, default: 0 },
  visitCount: { type: Number, default: 0 },
  coinsEarned: { type: Number, default: 0 },
  coinsRedeemed: { type: Number, default: 0 },
  lastVisit: { type: Date, default: Date.now },
  joinDate: { type: Date, default: Date.now },

  totalOrders: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});


// ===================================================
// 🔐 AUTO-GENERATE CUSTOMER ID
// ===================================================
customerSchema.pre('save', async function () {
  this.updatedAt = Date.now();

  if (this.customerId) return;

  const counter = await Counter.findOneAndUpdate(
    { name: 'customer' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  this.customerId = `CUST-${String(counter.seq).padStart(4, '0')}`;
});


// ===================================================
// 🏆 AUTO MEMBERSHIP TIER (ASYNC — NO next)
// ===================================================
customerSchema.pre('save', async function () {
  if (!this.isModified('totalPurchases') && !this.isNew) return;

  if (this.totalPurchases >= 5000) {
    this.membershipTier = 'Platinum';
  } else if (this.totalPurchases >= 2000) {
    this.membershipTier = 'Gold';
  } else if (this.totalPurchases >= 500) {
    this.membershipTier = 'Silver';
  } else {
    this.membershipTier = 'Bronze';
  }
});


// ===================================================
// 💰 METHODS
// ===================================================
customerSchema.methods.getDiscountValue = function () {
  const rates = { Bronze: 0.5, Silver: 0.55, Gold: 0.6, Platinum: 0.65 };
  return this.coins * rates[this.membershipTier];
};

customerSchema.methods.earnCoinsFromPurchase = function (amount) {
  const rates = { Bronze: 10, Silver: 11, Gold: 12, Platinum: 13 };
  const earned = Math.floor((amount / 100) * rates[this.membershipTier]);

  this.coins += earned;
  this.coinsEarned += earned;
  this.totalPurchases += amount;
  this.totalSpent += amount;
  this.visitCount += 1;
  this.totalOrders += 1;
  this.lastVisit = Date.now();

  return earned;
};

customerSchema.methods.redeemCoins = function (coins) {
  if (coins > this.coins) throw new Error('Insufficient coins');

  this.coins -= coins;
  this.coinsRedeemed += coins;
  return this.coins;
};

module.exports = mongoose.model('Customer', customerSchema);

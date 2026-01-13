// models/Expense.js
const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  receivedBy: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['RENT', 'UTILITY', 'STATIONERY', 'SOFTWARE', 'MAINTENANCE', 'GENERAL', 'SALARY', 'TRANSPORT'],
    uppercase: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMode: {
    type: String,
    required: true,
    enum: ['CASH', 'UPI', 'BANK'],
    uppercase: true
  },
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Paid', 'Pending', 'Cancelled'],
    default: 'Paid'
  }
}, { 
  timestamps: true 
});

// Indexes for better query performance
expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ paymentMode: 1 });
expenseSchema.index({ description: 'text', receivedBy: 'text' });

// Virtual for formatted date
expenseSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });
});

// Method to get category label
expenseSchema.methods.getCategoryLabel = function() {
  const labels = {
    RENT: 'Rent',
    UTILITY: 'Utility',
    STATIONERY: 'Stationery',
    SOFTWARE: 'Software',
    MAINTENANCE: 'Maintenance',
    GENERAL: 'General Expense',
    SALARY: 'Staff Salary',
    TRANSPORT: 'Transport'
  };
  return labels[this.category] || this.category;
};

// Static method to get total expenses by category
expenseSchema.statics.getTotalByCategory = async function(category, startDate, endDate) {
  const query = { category };
  if (startDate && endDate) {
    query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }
  
  const result = await this.aggregate([
    { $match: query },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  
  return result[0]?.total || 0;
};

// Static method to get expenses summary
expenseSchema.statics.getSummary = async function(startDate, endDate) {
  const query = {};
  if (startDate && endDate) {
    query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }
  
  const summary = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { total: -1 } }
  ]);
  
  return summary;
};

module.exports = mongoose.model('Expense', expenseSchema);
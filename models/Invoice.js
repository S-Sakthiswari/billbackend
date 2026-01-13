const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  // Basic info
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled', 'refunded'],
    default: 'completed'
  },
  type: {
    type: String,
    enum: ['sale', 'return', 'exchange'],
    default: 'sale'
  },
  
  // Customer info
  customerId: String,
  customerName: String,
  customerPhone: String,
  customerEmail: String,
  customerAddress: String,
  
  // Items
  items: [{
    productId: String,
    productName: String,
    sku: String,
    quantity: Number,
    unitPrice: Number,
    totalPrice: Number,
    gstRate: Number,
    gstAmount: Number,
    cgst: Number,
    sgst: Number,
    igst: Number,
    category: String,
    hsnCode: String,
    discount: Number
  }],
  
  // Exchange items
  exchangeItems: [{
    name: String,
    brand: String,
    model: String,
    yearsUsed: Number,
    condition: String,
    remarks: String,
    assignedValue: Number,
    status: String,
    exchangeDate: Date
  }],
  
  // Financial summary
  subtotal: Number,
  totalGST: Number,
  cgstTotal: Number,
  sgstTotal: Number,
  igstTotal: Number,
  exchangeDiscount: Number,
  couponDiscount: Number,
  additionalDiscounts: Number,
  totalDiscount: Number,
  totalAmount: Number,
  amountAfterDiscount: Number,
  finalAmount: Number,
  roundOff: Number,
  
  // Payment info
payment: {
  method: {
    type: String,
    enum: ['cash', 'upi', 'card', 'bank_transfer'],
    required: true
  },
  status: String,
  transactionId: String,
  amount: Number,
  paidAmount: Number,
  change: Number,
  paymentDate: Date
},
  
  // GST settings
  gstMode: String,
  gstInclusive: Boolean,
  roundOffEnabled: Boolean,
  gstBreakdown: [{
    name: String,
    amount: Number
  }],
  
  // Coupon info
   couponInfo: {
    code: String,
    type: String,
    value: Number,
    discountAmount: Number,
    couponId: mongoose.Schema.Types.ObjectId
  },
  
  // Store info
  storeInfo: {
    name: String,
    address: String,
    phone: String,
    gstin: String,
    email: String
  },
  
  // Stock updates
  stockUpdates: [{
    productId: String,
    oldStock: Number,
    newStock: Number,
    quantity: Number,
    date: Date
  }],
  
  // Metadata
  notes: String,
  createdBy: String,
  whatsappSent: {
    type: Boolean,
    default: false
  },
  whatsappSentAt: Date,
  whatsappMessageId: String,
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create index for faster queries
InvoiceSchema.index({ invoiceNumber: 1 });
InvoiceSchema.index({ customerId: 1 });
InvoiceSchema.index({ date: 1 });
InvoiceSchema.index({ status: 1 });

module.exports = mongoose.model('Invoice', InvoiceSchema);
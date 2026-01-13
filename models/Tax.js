const mongoose = require('mongoose');

const taxItemSchema = new mongoose.Schema({
  name: String,
  quantity: { type: Number, default: 1 },
  price: { type: Number, default: 0 },
  taxSlabId: mongoose.Schema.Types.ObjectId,
  hsn: String
});

const taxEntrySchema = new mongoose.Schema({
  invoiceNo: String,
  date: { type: Date, default: Date.now },
  customer: String,
  gstin: String,
  items: [taxItemSchema],
  isInterState: { type: Boolean, default: false },
  totalTax: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  taxableValue: { type: Number, default: 0 },
  status: { type: String, default: 'Draft' },
  notes: { type: String, default: '' }
}, { timestamps: true });

const taxSlabSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rate: { type: Number, required: true },
  type: { type: String, default: 'Regular' },
  category: { type: String, required: true, default: 'Standard' },
  hsnCode: { type: String, required: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

// ✅ UNIQUE INDEX TO STOP DUPLICATES
taxSlabSchema.index(
  { hsnCode: 1, rate: 1, category: 1 },
  { unique: true }
);

const TaxEntry = mongoose.model('TaxEntry', taxEntrySchema);
const TaxSlab = mongoose.model('TaxSlab', taxSlabSchema);

module.exports = { TaxEntry, TaxSlab };

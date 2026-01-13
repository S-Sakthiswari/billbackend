const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    product: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    price: {
        type: Number,
        required: true,
        min: 0
    }
});

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true
    },
    billNumber: {
        type: String,
        required: true,
        unique: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    customerName: {
        type: String,
        required: true
    },
    customerPhone: {
        type: String,
        required: true
    },
    customerEmail: {
        type: String
    },
    items: [itemSchema],
    subtotal: {
        type: Number,
        required: true
    },
    gst: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        required: true
    },
    paymentMode: {
        type: String,
        enum: ['Cash', 'Card', 'UPI', 'Net Banking'],
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['Paid', 'Pending', 'Cancelled'],
        required: true
    },
    status: {
        type: String,
        enum: ['Completed', 'Pending', 'Processing', 'Cancelled', 'Refunded'],
        required: true
    },
    isOffline: {
        type: Boolean,
        default: false
    },
    notes: {
        type: String
    }
}, {
    timestamps: true  // This automatically adds createdAt and updatedAt fields
});

// Remove the problematic middleware - Mongoose timestamps handles this automatically
// orderSchema.pre('save', function(next) {
//     this.updatedAt = Date.now();
//     next();
// });

// orderSchema.pre('findOneAndUpdate', function(next) {
//     this.set({ updatedAt: Date.now() });
//     next();
// });

module.exports = mongoose.model('Order', orderSchema);
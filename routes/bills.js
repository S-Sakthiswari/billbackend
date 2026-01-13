const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

// Generate unique order ID
const generateOrderId = async () => {
    const latestOrder = await Order.findOne().sort({ createdAt: -1 });
    if (latestOrder && latestOrder.orderId) {
        const lastNumber = parseInt(latestOrder.orderId.replace('ORD', '')) || 0;
        return `ORD${String(lastNumber + 1).padStart(5, '0')}`;
    }
    return 'ORD00001';
};

// Generate unique bill number
const generateBillNumber = async () => {
    const latestOrder = await Order.findOne().sort({ createdAt: -1 });
    if (latestOrder && latestOrder.billNumber) {
        const lastNumber = parseInt(latestOrder.billNumber.replace('BILL', '')) || 0;
        return `BILL${String(lastNumber + 1).padStart(4, '0')}`;
    }
    return 'BILL0001';
};

// Create offline bill
router.post('/create', async (req, res) => {
    try {
        const {
            customerName,
            customerPhone,
            customerEmail,
            items,
            paymentMode,
            paymentStatus,
            discount,
            notes
        } = req.body;

        console.log('Received bill data:', req.body);

        // Validate required fields
        if (!customerName || !customerPhone) {
            return res.status(400).json({ 
                error: 'Customer name and phone are required',
                receivedData: req.body 
            });
        }

        if (!items || items.length === 0) {
            return res.status(400).json({ 
                error: 'At least one item is required',
                receivedData: req.body 
            });
        }

        // Validate items
        const validItems = items.filter(item => item.product && item.quantity > 0);
        if (validItems.length === 0) {
            return res.status(400).json({ error: 'Please add valid items with product name and quantity' });
        }

        // Calculate totals
        const subtotal = validItems.reduce((sum, item) => {
            const price = parseFloat(item.price) || 0;
            const quantity = parseInt(item.quantity) || 0;
            return sum + (quantity * price);
        }, 0);
        
        const gst = subtotal * 0.18;
        const discountAmount = parseFloat(discount) || 0;
        const totalAmount = subtotal + gst - discountAmount;

        console.log('Calculated totals:', { subtotal, gst, discountAmount, totalAmount });

        // Generate IDs
        const orderId = await generateOrderId();
        const billNumber = await generateBillNumber();

        console.log('Generated IDs:', { orderId, billNumber });

        // Create order
        const orderData = {
            orderId,
            billNumber,
            date: new Date(),
            customerName,
            customerPhone,
            customerEmail: customerEmail || '',
            items: validItems.map(item => ({
                product: item.product,
                quantity: parseInt(item.quantity) || 1,
                price: parseFloat(item.price) || 0
            })),
            subtotal: parseFloat(subtotal.toFixed(2)),
            gst: parseFloat(gst.toFixed(2)),
            discount: discountAmount,
            totalAmount: parseFloat(totalAmount.toFixed(2)),
            paymentMode: paymentMode || 'Cash',
            paymentStatus: paymentStatus || 'Paid',
            status: paymentStatus === 'Paid' ? 'Completed' : 'Pending',
            isOffline: true,
            notes: notes || ''
        };

        console.log('Order data to save:', orderData);

        const order = new Order(orderData);
        await order.save();

        console.log('Order saved successfully:', order._id);

        res.status(201).json({
            message: 'Bill created successfully',
            order
        });
    } catch (error) {
        console.error('Error creating bill:', error);
        res.status(500).json({ 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Generate invoice PDF
router.get('/:id/invoice', async (req, res) => {
    try {
        const order = await Order.findOne({ 
            $or: [
                { orderId: req.params.id },
                { billNumber: req.params.id }
            ]
        });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({
            message: 'Invoice data',
            order,
            invoiceNumber: `INV-${order.billNumber}`,
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
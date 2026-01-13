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

// Get all orders with filters
router.get('/', async (req, res) => {
    try {
        const {
            search,
            status,
            paymentStatus,
            startDate,
            endDate,
            isOffline,
            limit = 50,
            page = 1
        } = req.query;

        const query = {};

        // Search filter
        if (search) {
            query.$or = [
                { orderId: { $regex: search, $options: 'i' } },
                { billNumber: { $regex: search, $options: 'i' } },
                { customerName: { $regex: search, $options: 'i' } },
                { customerPhone: { $regex: search, $options: 'i' } }
            ];
        }

        // Status filter
        if (status && status !== 'all') {
            query.status = status;
        }

        // Payment status filter
        if (paymentStatus && paymentStatus !== 'all') {
            query.paymentStatus = paymentStatus;
        }

        // Date range filter
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        // Offline filter
        if (isOffline === 'true') {
            query.isOffline = true;
        }

        const skip = (page - 1) * limit;

        const orders = await Order.find(query)
            .sort({ date: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Order.countDocuments(query);

        res.json({
            orders,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single order
router.get('/:id', async (req, res) => {
    try {
        const order = await Order.findOne({ 
            $or: [
                { orderId: req.params.id },
                { billNumber: req.params.id },
                { _id: req.params.id }
            ]
        });
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new order
router.post('/', async (req, res) => {
    try {
        const orderId = await generateOrderId();
        const billNumber = await generateBillNumber();

        const orderData = {
            ...req.body,
            orderId,
            billNumber,
            date: req.body.date || new Date()
        };

        const order = new Order(orderData);
        await order.save();

        res.status(201).json({
            message: 'Order created successfully',
            order
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update order
router.put('/:id', async (req, res) => {
    try {
        const order = await Order.findOneAndUpdate(
            { orderId: req.params.id },
            req.body,
            { new: true, runValidators: true }
        );

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({
            message: 'Order updated successfully',
            order
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete order
router.delete('/:id', async (req, res) => {
    try {
        const order = await Order.findOneAndDelete({ orderId: req.params.id });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({
            message: 'Order deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update order status
router.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const order = await Order.findOneAndUpdate(
            { orderId: req.params.id },
            { 
                status,
                // Update payment status based on order status
                paymentStatus: status === 'Completed' ? 'Paid' : 
                              status === 'Cancelled' ? 'Cancelled' : 'Pending'
            },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({
            message: 'Order status updated successfully',
            order
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get order statistics
router.get('/statistics/summary', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);

        const matchStage = {};
        if (startDate || endDate) {
            matchStage.date = dateFilter;
        }

        const statistics = await Order.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: '$totalAmount' },
                    completedOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
                    },
                    pendingOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] }
                    },
                    processingOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'Processing'] }, 1, 0] }
                    },
                    cancelledOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] }
                    },
                    refundedOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'Refunded'] }, 1, 0] }
                    },
                    avgOrderValue: { $avg: '$totalAmount' }
                }
            }
        ]);

        const result = statistics[0] || {
            totalOrders: 0,
            totalRevenue: 0,
            completedOrders: 0,
            pendingOrders: 0,
            processingOrders: 0,
            cancelledOrders: 0,
            refundedOrders: 0,
            avgOrderValue: 0
        };

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
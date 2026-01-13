const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');

// Create invoice
router.post('/', async (req, res) => {
  try {
    const invoiceData = req.body;
    
    // Generate invoice number
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const invoiceCount = await Invoice.countDocuments();
    const invoiceNumber = `INV-${year}${month}-${String(invoiceCount + 1).padStart(4, '0')}`;
    
    // Update product stocks
    if (invoiceData.items && invoiceData.items.length > 0) {
      for (const item of invoiceData.items) {
        const product = await Product.findById(item.productId);
        if (product) {
          product.stock = Math.max(0, product.stock - item.quantity);
          await product.save();
          
          // Emit stock update notification
          if (req.io && product.stock <= 5) {
            req.io.emit('stock_updated', {
              productId: product._id,
              productName: product.name,
              currentStock: product.stock,
              minStock: 5,
              action: 'sale'
            });
          }
        }
      }
    }

    // Create new invoice
    const invoice = new Invoice({
      ...invoiceData,
      invoiceNumber,
      createdAt: date,
      updatedAt: date,
      status: 'completed'
    });

    await invoice.save();
    
    // Emit notification
    if (req.io) {
      req.io.emit('new_notification', {
        type: 'invoice_created',
        title: 'New Invoice Created',
        message: `Invoice ${invoiceNumber} created for ${invoiceData.customer?.name || 'Customer'}`,
        invoiceNumber: invoiceNumber,
        amount: invoiceData.totalAmount,
        priority: 'high',
        color: 'green',
        icon: 'Receipt',
        timestamp: new Date(),
        isRead: false
      });
    }

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      invoice: invoice,
      invoiceNumber: invoiceNumber
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create invoice'
    });
  }
});

// Get all invoices
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, customerId, status, startDate, endDate } = req.query;
    
    const query = {};
    
    if (customerId) {
      query['customer.customerId'] = customerId;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments(query);

    res.json({
      success: true,
      count: invoices.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      invoices
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch invoices'
    });
  }
});

// Get invoice by ID
router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      invoice
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch invoice'
    });
  }
});

// Update invoice
router.put('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      invoice
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update invoice'
    });
  }
});

// Delete invoice
router.delete('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete invoice'
    });
  }
});

// Get invoice PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    // In a real implementation, you would generate PDF here
    // For now, return JSON with PDF generation instructions
    res.json({
      success: true,
      message: 'PDF generation endpoint',
      invoiceNumber: invoice.invoiceNumber,
      instructions: 'PDF generation would be implemented here',
      invoiceData: {
        invoiceNumber: invoice.invoiceNumber,
        customer: invoice.customer,
        items: invoice.items,
        totalAmount: invoice.totalAmount,
        date: invoice.createdAt
      }
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate PDF'
    });
  }
});

// Get today's invoices summary
router.get('/summary/today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayInvoices = await Invoice.find({
      createdAt: {
        $gte: today,
        $lt: tomorrow
      }
    });

    const totalSales = todayInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalItems = todayInvoices.reduce((sum, inv) => 
      sum + (inv.items ? inv.items.reduce((itemSum, item) => itemSum + item.quantity, 0) : 0), 0
    );

    res.json({
      success: true,
      summary: {
        date: today,
        totalInvoices: todayInvoices.length,
        totalSales,
        totalItems,
        averageSale: todayInvoices.length > 0 ? totalSales / todayInvoices.length : 0
      },
      invoices: todayInvoices
    });
  } catch (error) {
    console.error('Error fetching today summary:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch today summary'
    });
  }
});

module.exports = router;
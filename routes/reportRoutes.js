const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// Export stock data
router.get('/export', async (req, res) => {
  try {
    const { format = 'json', status, category } = req.query;
    
    let query = {};
    if (status && status !== 'all') query.status = status;
    if (category) query.category = category;
    
    const products = await Product.find(query);
    
    if (format === 'csv') {
      const csv = [
        ['Unique Code', 'Product Name', 'Category', 'Current Stock', 'Min Level', 'Max Level', 'Status', 'Price', 'Last Restocked', 'Supplier', 'Location'].join(','),
        ...products.map(p => [
          p.uniqueCode,
          `"${p.name}"`,
          p.category,
          p.currentStock,
          p.minStockLevel,
          p.maxStockLevel,
          p.status,
          p.price,
          p.lastRestocked.toISOString().split('T')[0],
          `"${p.supplier}"`,
          `"${p.location}"`
        ].join(','))
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=stock-report-${Date.now()}.csv`);
      return res.send(csv);
    }
    
    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating report',
      error: error.message
    });
  }
});

// Inventory value by category
router.get('/inventory-value', async (req, res) => {
  try {
    const report = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          totalProducts: { $sum: 1 },
          totalStock: { $sum: '$currentStock' },
          totalValue: { $sum: { $multiply: ['$currentStock', '$price'] } },
          avgPrice: { $avg: '$price' }
        }
      },
      {
        $sort: { totalValue: -1 }
      }
    ]);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating inventory value report',
      error: error.message
    });
  }
});

module.exports = router;
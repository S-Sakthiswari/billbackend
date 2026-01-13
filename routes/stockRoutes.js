const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

// Get all products with stock information
router.get('/products', stockController.getAllProducts);

// Get single product
router.get('/products/:id', stockController.getProductById);

// Update stock (add/remove)
router.post('/update/:id', stockController.updateStock);

// Get stock transaction history
router.get('/history/:id', stockController.getStockHistory);

// Get stock statistics and alerts
router.get('/stats', stockController.getStockStats);

// Get low stock alerts
router.get('/alerts', stockController.getLowStockAlerts);

// Sync product status (useful for initial setup)
router.post('/sync', stockController.syncProductStatus);

module.exports = router;
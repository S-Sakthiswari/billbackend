// routes/productRoutes.js

const express = require('express');
const router = express.Router();

// Import all controller functions
const {
  getAllProducts,
  getProductById,
  getProductByProductId,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
  getLowStockProducts,
  getOutOfStockProducts,
  getProductsByCategory,
  getProductStats
} = require('../controllers/productController');

// ============================================
// IMPORTANT: Route Order Matters!
// More specific routes should come BEFORE generic ones
// ============================================

// ============================================
// STATISTICS ROUTE
// ============================================
/**
 * @route   GET /api/products/stats
 * @desc    Get product statistics (total, in stock, low stock, out of stock, inventory value)
 * @access  Public
 * @example GET http://localhost:5000/api/products/stats
 */
router.get('/stats', getProductStats);

// ============================================
// SEARCH ROUTE
// ============================================
/**
 * @route   GET /api/products/search
 * @desc    Search products by keyword in name, category, productId, or description
 * @access  Public
 * @query   q - Search keyword (required)
 * @example GET http://localhost:5000/api/products/search?q=laptop
 */
router.get('/search', searchProducts);

// ============================================
// LOW STOCK ROUTE
// ============================================
/**
 * @route   GET /api/products/low-stock
 * @desc    Get all products with low stock (stock <= minStock but > 0)
 * @access  Public
 * @example GET http://localhost:5000/api/products/low-stock
 */
router.get('/low-stock', getLowStockProducts);

// ============================================
// OUT OF STOCK ROUTE
// ============================================
/**
 * @route   GET /api/products/out-of-stock
 * @desc    Get all products that are out of stock (stock <= 0)
 * @access  Public
 * @example GET http://localhost:5000/api/products/out-of-stock
 */
router.get('/out-of-stock', getOutOfStockProducts);

// ============================================
// CATEGORY ROUTE
// ============================================
/**
 * @route   GET /api/products/category/:category
 * @desc    Get all products in a specific category
 * @access  Public
 * @param   category - Category name (case-insensitive)
 * @example GET http://localhost:5000/api/products/category/Electronics
 */
router.get('/category/:category', getProductsByCategory);

// ============================================
// PRODUCT ID ROUTE (Custom Product ID like PRD-123)
// ============================================
/**
 * @route   GET /api/products/product-id/:productId
 * @desc    Get a single product by its custom product ID (e.g., PRD-123456789)
 * @access  Public
 * @param   productId - Custom product identifier
 * @example GET http://localhost:5000/api/products/product-id/PRD-123456789
 */
router.get('/product-id/:productId', getProductByProductId);

// ============================================
// GET ALL PRODUCTS
// ============================================
/**
 * @route   GET /api/products
 * @desc    Get all products with optional pagination, sorting, and filtering
 * @access  Public
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 100)
 * @query   sortBy - Field to sort by (default: createdAt)
 * @query   order - Sort order: asc or desc (default: desc)
 * @query   category - Filter by category
 * @query   minPrice - Minimum price filter
 * @query   maxPrice - Maximum price filter
 * @example GET http://localhost:5000/api/products?page=1&limit=10&sortBy=price&order=asc
 * @example GET http://localhost:5000/api/products?category=Electronics&minPrice=100&maxPrice=1000
 */
router.get('/', getAllProducts);

// ============================================
// GET SINGLE PRODUCT BY MONGODB ID
// ============================================
/**
 * @route   GET /api/products/:id
 * @desc    Get a single product by MongoDB _id
 * @access  Public
 * @param   id - MongoDB ObjectId
 * @example GET http://localhost:5000/api/products/507f1f77bcf86cd799439011
 */
router.get('/:id', getProductById);

// ============================================
// CREATE NEW PRODUCT
// ============================================
/**
 * @route   POST /api/products
 * @desc    Create a new product
 * @access  Public
 * @body    {
 *            productId: String (required, unique, e.g., "PRD-123456789"),
 *            name: String (required),
 *            category: String (required),
 *            price: Number (required, >= 0),
 *            stock: Number (required, >= 0),
 *            minStock: Number (optional, default: 5),
 *            description: String (optional),
 *            image: String (optional, base64 or URL)
 *          }
 * @example POST http://localhost:5000/api/products
 *          Body: {
 *            "productId": "PRD-123456789",
 *            "name": "Laptop",
 *            "category": "Electronics",
 *            "price": 45000,
 *            "stock": 10,
 *            "minStock": 5,
 *            "description": "High-performance laptop",
 *            "image": "data:image/jpeg;base64,..."
 *          }
 */
router.post('/', createProduct);

// ============================================
// UPDATE PRODUCT
// ============================================
/**
 * @route   PUT /api/products/:id
 * @desc    Update an existing product by MongoDB _id
 * @access  Public
 * @param   id - MongoDB ObjectId
 * @body    {
 *            name: String (optional),
 *            category: String (optional),
 *            price: Number (optional),
 *            stock: Number (optional),
 *            minStock: Number (optional),
 *            description: String (optional),
 *            image: String (optional)
 *          }
 * @note    Only provided fields will be updated
 * @example PUT http://localhost:5000/api/products/507f1f77bcf86cd799439011
 *          Body: {
 *            "price": 42000,
 *            "stock": 15
 *          }
 */
router.put('/:id', updateProduct);

// ============================================
// DELETE PRODUCT
// ============================================
/**
 * @route   DELETE /api/products/:id
 * @desc    Delete a product by MongoDB _id
 * @access  Public
 * @param   id - MongoDB ObjectId
 * @example DELETE http://localhost:5000/api/products/507f1f77bcf86cd799439011
 */
router.delete('/:id', deleteProduct);

// ============================================
// EXPORT ROUTER
// ============================================
module.exports = router;
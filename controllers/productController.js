// controllers/productController.js

const Product = require('../models/Product');

// ============================================
// @desc    Get all products
// @route   GET /api/products
// @access  Public
// ============================================
const getAllProducts = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 100, 
      sortBy = 'createdAt', 
      order = 'desc',
      category,
      minPrice,
      maxPrice 
    } = req.query;

    // Build filter object
    const filter = {};
    if (category) filter.category = category;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const sortOrder = order === 'asc' ? 1 : -1;

    // Execute query
    const products = await Product.find(filter)
      .sort({ [sortBy]: sortOrder })
      .limit(parseInt(limit))
      .skip(skip);

    // Get total count for pagination
    const total = await Product.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: products
    });
  } catch (error) {
    console.error('Error in getAllProducts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
};

// ============================================
// @desc    Get single product by MongoDB ID
// @route   GET /api/products/:id
// @access  Public
// ============================================
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error in getProductById:', error);
    
    // Handle invalid MongoDB ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message
    });
  }
};

// ============================================
// @desc    Get single product by Product ID (PRD-XXX)
// @route   GET /api/products/product-id/:productId
// @access  Public
// ============================================
const getProductByProductId = async (req, res) => {
  try {
    const product = await Product.findOne({ productId: req.params.productId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error in getProductByProductId:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message
    });
  }
};

// ============================================
// @desc    Create new product
// @route   POST /api/products
// @access  Public
// ============================================
const createProduct = async (req, res) => {
  try {
    const { productId, name, category, price, stock, minStock, description, image } = req.body;

    // Validate required fields
    if (!productId || !name || !category || price === undefined || stock === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: productId, name, category, price, stock'
      });
    }

    // Check if product ID already exists
    const existingProduct = await Product.findOne({ productId });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: `Product with ID '${productId}' already exists`
      });
    }

    // Create new product
    const product = await Product.create({
      productId,
      name,
      category,
      price,
      stock,
      minStock: minStock || 5,
      description: description || '',
      image: image || ''
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    console.error('Error in createProduct:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Product with this ID already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating product',
      error: error.message
    });
  }
};

// ============================================
// @desc    Update product
// @route   PUT /api/products/:id
// @access  Public
// ============================================
const updateProduct = async (req, res) => {
  try {
    const { name, category, price, stock, minStock, description, image } = req.body;

    // Find product
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Update fields (only update if value is provided)
    if (name !== undefined) product.name = name;
    if (category !== undefined) product.category = category;
    if (price !== undefined) product.price = price;
    if (stock !== undefined) product.stock = stock;
    if (minStock !== undefined) product.minStock = minStock;
    if (description !== undefined) product.description = description;
    if (image !== undefined) product.image = image;

    // Save updated product
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Error in updateProduct:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    // Handle invalid MongoDB ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating product',
      error: error.message
    });
  }
};

// ============================================
// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Public
// ============================================
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await product.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: { id: req.params.id }
    });
  } catch (error) {
    console.error('Error in deleteProduct:', error);
    
    // Handle invalid MongoDB ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error deleting product',
      error: error.message
    });
  }
};

// ============================================
// @desc    Search products by keyword
// @route   GET /api/products/search?q=keyword
// @access  Public
// ============================================
const searchProducts = async (req, res) => {
  try {
    const keyword = req.query.q;

    if (!keyword || keyword.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search keyword is required'
      });
    }

    // Search in multiple fields using regex
    const products = await Product.find({
      $or: [
        { name: { $regex: keyword, $options: 'i' } },
        { category: { $regex: keyword, $options: 'i' } },
        { productId: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } }
      ]
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      keyword,
      data: products
    });
  } catch (error) {
    console.error('Error in searchProducts:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching products',
      error: error.message
    });
  }
};

// ============================================
// @desc    Get low stock products
// @route   GET /api/products/low-stock
// @access  Public
// ============================================
const getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.find({
      $expr: { 
        $and: [
          { $gt: ['$stock', 0] },
          { $lte: ['$stock', '$minStock'] }
        ]
      }
    }).sort({ stock: 1 });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Error in getLowStockProducts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching low stock products',
      error: error.message
    });
  }
};

// ============================================
// @desc    Get out of stock products
// @route   GET /api/products/out-of-stock
// @access  Public
// ============================================
const getOutOfStockProducts = async (req, res) => {
  try {
    const products = await Product.find({ 
      stock: { $lte: 0 } 
    }).sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Error in getOutOfStockProducts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching out of stock products',
      error: error.message
    });
  }
};

// ============================================
// @desc    Get products by category
// @route   GET /api/products/category/:category
// @access  Public
// ============================================
const getProductsByCategory = async (req, res) => {
  try {
    const category = req.params.category;
    
    const products = await Product.find({ 
      category: { $regex: new RegExp(category, 'i') }
    }).sort({ name: 1 });

    res.status(200).json({
      success: true,
      category,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Error in getProductsByCategory:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products by category',
      error: error.message
    });
  }
};

// ============================================
// @desc    Get product statistics
// @route   GET /api/products/stats
// @access  Public
// ============================================
const getProductStats = async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    
    const lowStockProducts = await Product.countDocuments({
      $expr: { 
        $and: [
          { $gt: ['$stock', 0] },
          { $lte: ['$stock', '$minStock'] }
        ]
      }
    });
    
    const outOfStockProducts = await Product.countDocuments({ 
      stock: { $lte: 0 } 
    });

    const inStockProducts = totalProducts - lowStockProducts - outOfStockProducts;

    // Get category distribution
    const categoryStats = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalValue: { $sum: { $multiply: ['$price', '$stock'] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get total inventory value
    const inventoryValue = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$price', '$stock'] } }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalProducts,
        inStockProducts,
        lowStockProducts,
        outOfStockProducts,
        totalInventoryValue: inventoryValue[0]?.totalValue || 0,
        categoryStats
      }
    });
  } catch (error) {
    console.error('Error in getProductStats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product statistics',
      error: error.message
    });
  }
};

// ============================================
// Export all controller functions
// ============================================
module.exports = {
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
};
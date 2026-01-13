const Product = require('../models/Product');
const Stock = require('../models/Stock');

// Get all products with stock info
exports.getAllProducts = async (req, res) => {
  try {
    const { search, status, category, sortBy = 'name', order = 'asc' } = req.query;
    
    let query = {};
    
    // Search by name, uniqueCode, or SKU
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { uniqueCode: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Filter by category
    if (category) {
      query.category = category;
    }
    
    const sortOrder = order === 'desc' ? -1 : 1;
    const products = await Product.find(query).sort({ [sortBy]: sortOrder });
    
    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
};

// Get single product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message
    });
  }
};

// Update stock (add/remove)
exports.updateStock = async (req, res) => {
  try {
    const { quantity, type, reason, notes, performedBy = 'system' } = req.body;
    
    // Validation
    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quantity. Must be greater than 0.'
      });
    }

    if (!type || !['add', 'remove'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction type. Must be "add" or "remove".'
      });
    }
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    const previousStock = product.currentStock;
    let newStock;
    
    if (type === 'add') {
      newStock = previousStock + parseInt(quantity);
      product.lastRestocked = new Date();
    } else if (type === 'remove') {
      newStock = Math.max(0, previousStock - parseInt(quantity));
      
      if (newStock === 0 && previousStock > 0) {
        console.log(`Warning: Product ${product.name} is now out of stock`);
      }
    }
    
    product.currentStock = newStock;
    await product.save();
    
    // Log transaction in Stock collection
    const stockTransaction = new Stock({
      productId: product._id,
      uniqueCode: product.uniqueCode,
      productName: product.name,
      transactionType: type,
      quantity: parseInt(quantity),
      previousStock,
      newStock,
      reason: reason || `Stock ${type}ed`,
      notes,
      performedBy
    });
    
    await stockTransaction.save();
    
    res.json({
      success: true,
      message: `Stock ${type === 'add' ? 'added' : 'removed'} successfully`,
      data: {
        product,
        transaction: stockTransaction
      }
    });
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating stock',
      error: error.message
    });
  }
};

// Get stock transaction history for a product
exports.getStockHistory = async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    
    const history = await Stock.find({ productId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Stock.countDocuments({ productId: req.params.id });
    
    res.json({
      success: true,
      data: history,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching stock history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching stock history',
      error: error.message
    });
  }
};

// Get stock statistics
exports.getStockStats = async (req, res) => {
  try {
    const total = await Product.countDocuments();
    const lowStock = await Product.countDocuments({ status: 'low' });
    const outOfStock = await Product.countDocuments({ status: 'out' });
    const normal = await Product.countDocuments({ status: 'normal' });
    
    const totalValue = await Product.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: { $multiply: ['$currentStock', '$price'] } }
        }
      }
    ]);
    
    const lowStockProducts = await Product.find({ status: 'low' })
      .select('name uniqueCode currentStock minStockLevel')
      .limit(10);
    
    const outOfStockProducts = await Product.find({ status: 'out' })
      .select('name uniqueCode lastRestocked')
      .limit(10);
    
    res.json({
      success: true,
      data: {
        summary: {
          total,
          lowStock,
          outOfStock,
          normal,
          totalInventoryValue: totalValue[0]?.total || 0
        },
        alerts: {
          lowStockProducts,
          outOfStockProducts
        }
      }
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
};

// Get low stock alerts
exports.getLowStockAlerts = async (req, res) => {
  try {
    const products = await Product.find({
      $or: [
        { status: 'low' },
        { status: 'out' }
      ]
    }).sort({ currentStock: 1 });
    
    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching alerts',
      error: error.message
    });
  }
};

// Sync existing products - useful for initial setup
exports.syncProductStatus = async (req, res) => {
  try {
    const products = await Product.find({});
    let updated = 0;
    
    for (let product of products) {
      const newStatus = Product.updateStatus(product);
      if (product.status !== newStatus) {
        product.status = newStatus;
        await product.save();
        updated++;
      }
    }
    
    res.json({
      success: true,
      message: `Synced ${updated} products`,
      data: {
        total: products.length,
        updated
      }
    });
  } catch (error) {
    console.error('Error syncing products:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing products',
      error: error.message
    });
  }
};

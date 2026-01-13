const express = require('express');
const router = express.Router();
const { TaxEntry, TaxSlab } = require('../models/Tax');
const mongoose = require('mongoose');
const csv = require('csv-parser');
const { Readable } = require('stream');

// ============== TAX SLAB ROUTES ==============

// Get all tax slabs
router.get('/slabs', async (req, res) => {
  try {
    const slabs = await TaxSlab.find()
      .sort({ rate: 1 })
      .lean();
    
    res.status(200).json({
      success: true,
      count: slabs.length,
      slabs
    });
  } catch (error) {
    console.error('Error fetching tax slabs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get single tax slab
router.get('/slabs/:id', async (req, res) => {
  try {
    const slab = await TaxSlab.findById(req.params.id);

    if (!slab) {
      return res.status(404).json({
        success: false,
        message: 'Tax slab not found'
      });
    }

    res.status(200).json({
      success: true,
      slab
    });
  } catch (error) {
    console.error('Error fetching tax slab:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Create tax slab
// Create tax slab ✅ ALLOW SAME NAME
router.post('/slabs', async (req, res) => {
  try {
    const slab = await TaxSlab.create(req.body);

    if (req.io) {
      req.io.emit('taxSlabAdded', slab);
    }

    res.status(201).json({
      success: true,
      slab
    });
  } catch (error) {
    console.error('Error creating tax slab:', error);

    // Handle duplicate HSN+rate+category (your real unique rule)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Same HSN, rate and category already exist'
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});


// Update tax slab
router.put('/slabs/:id', async (req, res) => {
  try {
    const slab = await TaxSlab.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!slab) {
      return res.status(404).json({
        success: false,
        message: 'Tax slab not found'
      });
    }

    // Emit socket event
    if (req.io) {
      req.io.emit('taxSlabUpdated', slab);
    }

    res.status(200).json({
      success: true,
      slab
    });
  } catch (error) {
    console.error('Error updating tax slab:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Delete tax slab
router.delete('/slabs/:id', async (req, res) => {
  try {
    const slab = await TaxSlab.findByIdAndDelete(req.params.id);

    if (!slab) {
      return res.status(404).json({
        success: false,
        message: 'Tax slab not found'
      });
    }

    // Check if any entries are using this slab
    const entriesUsingSlab = await TaxEntry.countDocuments({
      'items.taxSlabId': req.params.id
    });

    if (entriesUsingSlab > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete slab. It is being used in ${entriesUsingSlab} entries.`
      });
    }

    // Emit socket event
    if (req.io) {
      req.io.emit('taxSlabDeleted', { id: req.params.id });
    }

    res.status(200).json({
      success: true,
      message: 'Tax slab deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting tax slab:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Toggle tax slab status
router.patch('/slabs/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const slab = await TaxSlab.findByIdAndUpdate(
      req.params.id,
      { status },
      {
        new: true,
        runValidators: true
      }
    );

    if (!slab) {
      return res.status(404).json({
        success: false,
        message: 'Tax slab not found'
      });
    }

    // Emit socket event
    if (req.io) {
      req.io.emit('taxSlabUpdated', slab);
    }

    res.status(200).json({
      success: true,
      slab
    });
  } catch (error) {
    console.error('Error updating slab status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============== TAX ENTRY ROUTES ==============

// Get all tax entries with filters
router.get('/entries', async (req, res) => {
  try {
    const {
      search,
      startDate,
      endDate,
      status,
      isInterState,
      customer,
      sortBy = 'date',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { invoiceNo: { $regex: search, $options: 'i' } },
        { customer: { $regex: search, $options: 'i' } },
        { gstin: { $regex: search, $options: 'i' } }
      ];
    }

    // Date filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Other filters
    if (status) query.status = status;
    if (isInterState !== undefined) query.isInterState = isInterState === 'true';
    if (customer) query.customer = { $regex: customer, $options: 'i' };

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [entries, total] = await Promise.all([
      TaxEntry.find(query)
        .populate('items.taxSlabId', 'name rate')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      TaxEntry.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      count: entries.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      entries
    });
  } catch (error) {
    console.error('Error fetching tax entries:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get single tax entry
router.get('/entries/:id', async (req, res) => {
  try {
    const entry = await TaxEntry.findById(req.params.id)
      .populate('items.taxSlabId', 'name rate type');

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Tax entry not found'
      });
    }

    res.status(200).json({
      success: true,
      entry
    });
  } catch (error) {
    console.error('Error fetching tax entry:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Create tax entry
router.post('/entries', async (req, res) => {
  try {
    // Calculate totals
    const items = req.body.items || [];
    let taxableValue = 0;
    let totalTax = 0;

    // Get all tax slabs for rate lookup
    const slabIds = items.map(item => item.taxSlabId);
    const slabs = await TaxSlab.find({
      _id: { $in: slabIds }
    });

    const slabMap = {};
    slabs.forEach(slab => {
      slabMap[slab._id] = slab.rate;
    });

    // Calculate totals
    items.forEach(item => {
      const itemTotal = item.quantity * item.price;
      taxableValue += itemTotal;
      const taxRate = slabMap[item.taxSlabId] || 0;
      totalTax += itemTotal * (taxRate / 100);
    });

    const totalAmount = taxableValue + totalTax;

    const entryData = {
      ...req.body,
      taxableValue,
      totalTax,
      totalAmount
    };

    // Generate invoice number if not provided
    if (!entryData.invoiceNo) {
      const date = new Date();
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const count = await TaxEntry.countDocuments({
        date: {
          $gte: new Date(year, date.getMonth(), 1),
          $lt: new Date(year, date.getMonth() + 1, 1)
        }
      });
      entryData.invoiceNo = `INV-${year}${month}-${(count + 1).toString().padStart(3, '0')}`;
    }

    const entry = await TaxEntry.create(entryData);

    // Populate tax slab info
    await entry.populate('items.taxSlabId', 'name rate');

    // Emit socket event
    if (req.io) {
      req.io.emit('taxEntryAdded', entry);
    }

    res.status(201).json({
      success: true,
      entry
    });
  } catch (error) {
    console.error('Error creating tax entry:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Invoice number already exists'
      });
    }
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update tax entry
router.put('/entries/:id', async (req, res) => {
  try {
    const entry = await TaxEntry.findById(req.params.id);

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Tax entry not found'
      });
    }

    // Recalculate totals if items changed
    if (req.body.items) {
      const items = req.body.items;
      let taxableValue = 0;
      let totalTax = 0;

      const slabIds = items.map(item => item.taxSlabId);
      const slabs = await TaxSlab.find({
        _id: { $in: slabIds }
      });

      const slabMap = {};
      slabs.forEach(slab => {
        slabMap[slab._id] = slab.rate;
      });

      items.forEach(item => {
        const itemTotal = item.quantity * item.price;
        taxableValue += itemTotal;
        const taxRate = slabMap[item.taxSlabId] || 0;
        totalTax += itemTotal * (taxRate / 100);
      });

      req.body.taxableValue = taxableValue;
      req.body.totalTax = totalTax;
      req.body.totalAmount = taxableValue + totalTax;
    }

    // Update entry
    Object.assign(entry, req.body);
    await entry.save();
    await entry.populate('items.taxSlabId', 'name rate');

    // Emit socket event
    if (req.io) {
      req.io.emit('taxEntryUpdated', entry);
    }

    res.status(200).json({
      success: true,
      entry
    });
  } catch (error) {
    console.error('Error updating tax entry:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Invoice number already exists'
      });
    }
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Delete tax entry
router.delete('/entries/:id', async (req, res) => {
  try {
    const entry = await TaxEntry.findByIdAndDelete(req.params.id);

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Tax entry not found'
      });
    }

    // Emit socket event
    if (req.io) {
      req.io.emit('taxEntryDeleted', { id: req.params.id });
    }

    res.status(200).json({
      success: true,
      message: 'Tax entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting tax entry:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============== BULK OPERATIONS ==============

// Bulk import tax entries
router.post('/entries/bulk-import', async (req, res) => {
  try {
    const { csvData } = req.body;
    
    if (!csvData) {
      return res.status(400).json({
        success: false,
        message: 'CSV data is required'
      });
    }

    const entries = [];
    const errors = [];
    const rows = csvData.trim().split('\n');
    const headers = rows[0].split(',').map(h => h.trim());

    // Validate headers
    const requiredHeaders = ['Invoice No', 'Date', 'Customer', 'GSTIN', 'Item', 'Quantity', 'Price', 'Tax Slab ID', 'HSN', 'Inter-State'];
    for (const header of requiredHeaders) {
      if (!headers.includes(header)) {
        return res.status(400).json({
          success: false,
          message: `Missing required header: ${header}`
        });
      }
    }

    // Process rows
    for (let i = 1; i < rows.length; i++) {
      try {
        const values = rows[i].split(',').map(v => v.trim());
        const rowData = {};
        headers.forEach((header, index) => {
          rowData[header.toLowerCase().replace(/ /g, '_')] = values[index] || '';
        });

        // Convert data types
        const entry = {
          invoiceNo: rowData.invoice_no,
          date: new Date(rowData.date),
          customer: rowData.customer,
          gstin: rowData.gstin,
          items: [{
            name: rowData.item,
            quantity: parseInt(rowData.quantity) || 1,
            price: parseFloat(rowData.price) || 0,
            taxSlabId: rowData.tax_slab_id,
            hsn: rowData.hsn
          }],
          isInterState: rowData.inter_state.toLowerCase() === 'true',
          status: 'Imported'
        };

        // Calculate totals
        const slab = await TaxSlab.findById(entry.items[0].taxSlabId);

        const itemTotal = entry.items[0].quantity * entry.items[0].price;
        const taxRate = slab ? slab.rate : 0;
        const totalTax = itemTotal * (taxRate / 100);

        entry.taxableValue = itemTotal;
        entry.totalTax = totalTax;
        entry.totalAmount = itemTotal + totalTax;

        entries.push(entry);
      } catch (rowError) {
        errors.push(`Row ${i + 1}: ${rowError.message}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some rows have errors',
        errors
      });
    }

    // Save all entries
    const savedEntries = await TaxEntry.insertMany(entries);

    // Emit socket events for each entry
    savedEntries.forEach(entry => {
      if (req.io) {
        req.io.emit('taxEntryAdded', entry);
      }
    });

    res.status(201).json({
      success: true,
      message: `Successfully imported ${savedEntries.length} entries`,
      entries: savedEntries
    });
  } catch (error) {
    console.error('Error bulk importing tax entries:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Bulk export tax entries
router.post('/entries/bulk-export', async (req, res) => {
  try {
    const { entryIds } = req.body;
    
    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Entry IDs are required'
      });
    }

    const entries = await TaxEntry.find({
      _id: { $in: entryIds }
    }).populate('items.taxSlabId', 'rate');

    if (entries.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No entries found'
      });
    }

    // Generate CSV content
    const headers = [
      'Invoice No',
      'Date',
      'Customer',
      'GSTIN',
      'Item Name',
      'Quantity',
      'Price',
      'Tax Rate %',
      'HSN Code',
      'Inter-State',
      'Taxable Value',
      'Tax Amount',
      'Total Amount',
      'Status'
    ];

    const rows = entries.map(entry => {
      return entry.items.map(item => [
        entry.invoiceNo,
        entry.date.toISOString().split('T')[0],
        entry.customer,
        entry.gstin,
        item.name,
        item.quantity,
        item.price,
        item.taxSlabId?.rate || 0,
        item.hsn,
        entry.isInterState ? 'Yes' : 'No',
        entry.taxableValue,
        entry.totalTax,
        entry.totalAmount,
        entry.status
      ].join(','));
    }).flat();

    const csvContent = [headers.join(','), ...rows].join('\n');

    const filename = `tax-entries-export-${new Date().toISOString().split('T')[0]}.csv`;

    res.status(200).json({
      success: true,
      csvData: csvContent,
      filename,
      count: entries.length
    });
  } catch (error) {
    console.error('Error bulk exporting tax entries:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============== REPORTS & ANALYTICS ==============

// Get tax summary
router.get('/summary', async (req, res) => {
  try {
    const filters = req.query;

    // Get status distribution
    const statusDistribution = await TaxEntry.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Get monthly trend
    const monthlyTrend = await TaxEntry.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          totalTax: { $sum: '$totalTax' },
          totalAmount: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': -1, '_id.month': -1 }
      },
      {
        $limit: 12
      }
    ]);

    // Get overall totals
    const totals = await TaxEntry.aggregate([
      {
        $group: {
          _id: null,
          totalEntries: { $sum: 1 },
          totalTaxAmount: { $sum: '$totalTax' },
          totalInvoiceValue: { $sum: '$totalAmount' },
          totalTaxableValue: { $sum: '$taxableValue' }
        }
      }
    ]);

    const summary = totals[0] || {
      totalEntries: 0,
      totalTaxAmount: 0,
      totalInvoiceValue: 0,
      totalTaxableValue: 0,
      avgTaxRate: 0
    };

    // Calculate average tax rate
    summary.avgTaxRate = summary.totalTaxableValue > 0 
      ? (summary.totalTaxAmount / summary.totalTaxableValue) * 100 
      : 0;

    res.status(200).json({
      success: true,
      summary: {
        ...summary,
        statusDistribution,
        monthlyTrend
      }
    });
  } catch (error) {
    console.error('Error fetching tax summary:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get tax reports by type
router.get('/reports/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { date, year, month } = req.query;

    let matchStage = {};
    let groupStage = {};
    let sortStage = {};

    switch (type) {
      case 'monthly':
        matchStage.date = {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
        };
        break;

      case 'yearly':
        const targetYear = parseInt(year) || new Date().getFullYear();
        matchStage.date = {
          $gte: new Date(targetYear, 0, 1),
          $lt: new Date(targetYear + 1, 0, 1)
        };
        break;

      case 'customer-wise':
        groupStage = {
          _id: '$customer',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalTax: { $sum: '$totalTax' }
        };
        sortStage = { totalAmount: -1 };
        break;

      case 'tax-slab-wise':
        groupStage = {
          _id: '$items.taxSlabId',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalTax: { $sum: '$totalTax' }
        };
        sortStage = { totalTax: -1 };
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid report type'
        });
    }

    const pipeline = [{ $match: matchStage }];
    
    if (Object.keys(groupStage).length > 0) {
      pipeline.push({ $unwind: '$items' });
      pipeline.push({ $group: groupStage });
      pipeline.push({ $sort: sortStage });
      
      // Populate tax slab info for slab-wise report
      if (type === 'tax-slab-wise') {
        pipeline.push({
          $lookup: {
            from: 'taxslabs',
            localField: '_id',
            foreignField: '_id',
            as: 'slabInfo'
          }
        });
        pipeline.push({
          $unwind: {
            path: '$slabInfo',
            preserveNullAndEmptyArrays: true
          }
        });
      }
    }

    const report = await TaxEntry.aggregate(pipeline);

    res.status(200).json({
      success: true,
      type,
      report
    });
  } catch (error) {
    console.error('Error generating tax report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Test route
router.get('/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Tax API is working without authentication',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
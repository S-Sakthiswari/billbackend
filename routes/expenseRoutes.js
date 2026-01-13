// routes/expenses.js
const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');

/* ===================== GET ALL EXPENSES ===================== */
router.get('/', async (req, res) => {
  try {
    const { 
      search, 
      searchField,
      category, 
      paymentMode,
      startDate, 
      endDate,
      limit = 100,
      page = 1,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    let query = {};

    // Search functionality
    if (search && searchField) {
      if (searchField === 'description') {
        query.description = { $regex: search, $options: 'i' };
      } else if (searchField === 'category') {
        query.category = { $regex: search, $options: 'i' };
      } else if (searchField === 'receivedBy') {
        query.receivedBy = { $regex: search, $options: 'i' };
      }
    } else if (search) {
      // Search across all text fields
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { receivedBy: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by category
    if (category && category !== 'all') {
      query.category = category.toUpperCase();
    }

    // Filter by payment mode
    if (paymentMode && paymentMode !== 'all') {
      query.paymentMode = paymentMode.toUpperCase();
    }

    // Date range filtering
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      query.date = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.date = { $lte: new Date(endDate) };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Fetch expenses
    const expenses = await Expense.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Get total count
    const totalCount = await Expense.countDocuments(query);

    // Calculate totals
    const totalAmount = await Expense.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json({
      success: true,
      data: expenses,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / parseInt(limit))
      },
      summary: {
        totalAmount: totalAmount[0]?.total || 0,
        count: totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expenses',
      error: error.message
    });
  }
});

/* ===================== GET SINGLE EXPENSE BY ID ===================== */
router.get('/:id', async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      data: expense
    });
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense',
      error: error.message
    });
  }
});

/* ===================== CREATE NEW EXPENSE ===================== */
router.post('/', async (req, res) => {
  try {
    const { date, description, receivedBy, category, amount, paymentMode, notes } = req.body;

    // Validate required fields
    if (!description || !receivedBy || !category || !amount || !paymentMode) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: description, receivedBy, category, amount, paymentMode'
      });
    }

    // Validate amount
    if (isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    // Create expense
    const expense = new Expense({
      date: date || new Date(),
      description: description.trim(),
      receivedBy: receivedBy.trim(),
      category: category.toUpperCase(),
      amount: parseFloat(amount),
      paymentMode: paymentMode.toUpperCase(),
      notes: notes?.trim(),
      status: 'Paid'
    });

    await expense.save();

    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      data: expense
    });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create expense',
      error: error.message
    });
  }
});

/* ===================== UPDATE EXPENSE ===================== */
router.put('/:id', async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    // Update allowed fields
    const allowedUpdates = ['date', 'description', 'receivedBy', 'category', 'amount', 'paymentMode', 'notes', 'status'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'category' || field === 'paymentMode') {
          expense[field] = req.body[field].toUpperCase();
        } else if (field === 'amount') {
          expense[field] = parseFloat(req.body[field]);
        } else {
          expense[field] = req.body[field];
        }
      }
    });

    await expense.save();

    res.json({
      success: true,
      message: 'Expense updated successfully',
      data: expense
    });
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update expense',
      error: error.message
    });
  }
});

/* ===================== DELETE EXPENSE ===================== */
router.delete('/:id', async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    await Expense.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete expense',
      error: error.message
    });
  }
});

/* ===================== GET EXPENSE SUMMARY/TOTALS ===================== */
router.get('/stats/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateQuery = {};
    if (startDate && endDate) {
      dateQuery.date = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    }

    // Total expenses
    const totalExpenses = await Expense.countDocuments(dateQuery);
    
    // Total amount
    const totalAmount = await Expense.aggregate([
      { $match: dateQuery },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Category-wise totals
    const categoryTotals = await Expense.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Convert to object for easier access
    const categoryMap = {};
    categoryTotals.forEach(cat => {
      categoryMap[cat._id] = {
        total: cat.total,
        count: cat.count
      };
    });

    // Payment mode breakdown
    const paymentModeBreakdown = await Expense.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$paymentMode',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalExpenses,
        totalAmount: totalAmount[0]?.total || 0,
        categoryTotals: {
          STATIONERY: categoryMap.STATIONERY?.total || 0,
          SOFTWARE: categoryMap.SOFTWARE?.total || 0,
          UTILITY: categoryMap.UTILITY?.total || 0,
          RENT: categoryMap.RENT?.total || 0,
          SALARY: categoryMap.SALARY?.total || 0,
          TRANSPORT: categoryMap.TRANSPORT?.total || 0,
          MAINTENANCE: categoryMap.MAINTENANCE?.total || 0,
          GENERAL: categoryMap.GENERAL?.total || 0
        },
        categoryBreakdown: categoryTotals,
        paymentModeBreakdown
      }
    });
  } catch (error) {
    console.error('Error fetching expense summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense summary',
      error: error.message
    });
  }
});

/* ===================== GET DAILY EXPENSES ===================== */
router.get('/reports/daily', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    
    // Set to start and end of day
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const expenses = await Expense.find({
      date: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ date: -1 });

    const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    res.json({
      success: true,
      data: {
        date: targetDate.toISOString().split('T')[0],
        expenses,
        summary: {
          count: expenses.length,
          totalAmount
        }
      }
    });
  } catch (error) {
    console.error('Error fetching daily expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily expenses',
      error: error.message
    });
  }
});

/* ===================== GET MONTHLY EXPENSES ===================== */
router.get('/reports/monthly', async (req, res) => {
  try {
    const { year, month } = req.query;
    const targetDate = new Date();
    const targetYear = year ? parseInt(year) : targetDate.getFullYear();
    const targetMonth = month ? parseInt(month) - 1 : targetDate.getMonth();

    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    const expenses = await Expense.find({
      date: { $gte: startOfMonth, $lte: endOfMonth }
    }).sort({ date: -1 });

    const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    res.json({
      success: true,
      data: {
        year: targetYear,
        month: targetMonth + 1,
        expenses,
        summary: {
          count: expenses.length,
          totalAmount
        }
      }
    });
  } catch (error) {
    console.error('Error fetching monthly expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly expenses',
      error: error.message
    });
  }
});

/* ===================== GET CATEGORY-WISE REPORT ===================== */
router.get('/reports/category', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateQuery = {};
    if (startDate && endDate) {
      dateQuery.date = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    }

    const categoryReport = await Expense.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          expenses: { $push: '$$ROOT' }
        }
      },
      { $sort: { total: -1 } }
    ]);

    const totalAmount = categoryReport.reduce((sum, cat) => sum + cat.total, 0);

    // Add percentage
    const reportWithPercentage = categoryReport.map(cat => ({
      category: cat._id,
      total: cat.total,
      count: cat.count,
      percentage: totalAmount > 0 ? ((cat.total / totalAmount) * 100).toFixed(2) : 0,
      expenses: cat.expenses
    }));

    res.json({
      success: true,
      data: {
        categoryReport: reportWithPercentage,
        summary: {
          totalCategories: categoryReport.length,
          totalAmount,
          totalExpenses: categoryReport.reduce((sum, cat) => sum + cat.count, 0)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching category report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category report',
      error: error.message
    });
  }
});

/* ===================== GET HIGHEST SPENDING AREA ===================== */
router.get('/stats/highest-spending', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateQuery = {};
    if (startDate && endDate) {
      dateQuery.date = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    }

    const highestSpending = await Expense.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 1 }
    ]);

    if (highestSpending.length === 0) {
      return res.json({
        success: true,
        data: null
      });
    }

    res.json({
      success: true,
      data: {
        category: highestSpending[0]._id,
        amount: highestSpending[0].total,
        count: highestSpending[0].count
      }
    });
  } catch (error) {
    console.error('Error fetching highest spending:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch highest spending',
      error: error.message
    });
  }
});

/* ===================== EXPORT EXPENSES TO CSV ===================== */
router.get('/export/csv', async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ date: -1 }).lean();

    // Create CSV header
    const headers = ['Date', 'Description', 'Received By', 'Category', 'Payment Mode', 'Amount'];
    
    // Create CSV rows
    const rows = expenses.map(expense => [
      new Date(expense.date).toLocaleDateString('en-GB'),
      expense.description,
      expense.receivedBy,
      expense.category,
      expense.paymentMode,
      expense.amount.toFixed(2)
    ]);

    // Combine headers and rows
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=expenses_export.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export expenses',
      error: error.message
    });
  }
});

module.exports = router;
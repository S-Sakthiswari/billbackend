const Expense = require('../models/Expense');

/* ===============================
   CREATE EXPENSE
================================ */
exports.createExpense = async (req, res) => {
  try {
    const expense = await Expense.create(req.body);
    res.status(201).json(expense);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/* ===============================
   GET ALL EXPENSES (Search + Filter)
================================ */
exports.getExpenses = async (req, res) => {
  try {
    const { search, field } = req.query;
    let query = {};

    if (search && field) {
      query[field] = { $regex: search, $options: 'i' };
    }

    const expenses = await Expense.find(query).sort({ date: -1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ===============================
   DELETE EXPENSE
================================ */
exports.deleteExpense = async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ===============================
   DAILY REPORT
================================ */
exports.dailyReport = async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const expenses = await Expense.find({
    date: {
      $gte: new Date(today),
      $lt: new Date(today + 'T23:59:59')
    }
  });

  res.json(expenses);
};

/* ===============================
   MONTHLY REPORT
================================ */
exports.monthlyReport = async (req, res) => {
  const date = new Date();
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  const expenses = await Expense.find({
    date: { $gte: firstDay, $lte: lastDay }
  });

  res.json(expenses);
};

/* ===============================
   CATEGORY REPORT
================================ */
exports.categoryReport = async (req, res) => {
  const report = await Expense.aggregate([
    {
      $group: {
        _id: '$category',
        amount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { amount: -1 } }
  ]);

  res.json(report);
};

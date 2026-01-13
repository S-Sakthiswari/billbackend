const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// LOGIN API
router.post('/login', async (req, res) => {
  const { username, password, role } = req.body;

  // 1. Check user exists
  const user = await User.findOne({ username, role });
  if (!user) {
    return res.status(401).json({ message: 'User not found' });
  }

  // 2. Check password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: 'Invalid password' });
  }

  // 3. Create token
  const token = jwt.sign(
    { id: user._id, role: user.role },
    'LOCAL_SECRET_KEY',
    { expiresIn: '1d' }
  );

  // 4. Send response
  res.json({
    token,
    user: {
      name: user.username,
      role: user.role
    }
  });
});

module.exports = router;

const jwt = require('jsonwebtoken');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token with the same secret
      const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production';
      const decoded = jwt.verify(token, JWT_SECRET);

      // Add user from token to request
      req.user = { 
        id: decoded.id,
        username: decoded.username,
        email: decoded.email
      };
      
      next();
    } catch (error) {
      console.error('Token verification failed:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token'
    });
  }
};

// Temporary middleware for testing (remove in production)
const tempAuth = (req, res, next) => {
  // For testing, create a dummy user ID
  req.user = { 
    id: 'test_user_id',
    username: 'testuser',
    email: 'test@example.com'
  };
  next();
};

module.exports = { protect, tempAuth };
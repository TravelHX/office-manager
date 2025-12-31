const { executeQuery } = require('../database/connection');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      },
    });
  }

  const token = authHeader.substring(7);
  
  if (!token || token === '') {
    return res.status(401).json({
      error: {
        message: 'Invalid token',
        code: 'INVALID_TOKEN',
      },
    });
  }

  // Extract user ID from token
  // Simple approach: if token starts with "user_", extract numeric part
  // Otherwise use token as user ID
  // For admin, use "admin_" prefix
  let userId = 1; // Default user ID
  let isAdmin = false;
  
  if (token.startsWith('admin_')) {
    const tokenParts = token.split('_');
    if (tokenParts.length > 1) {
      userId = parseInt(tokenParts[1]) || 1;
    }
    isAdmin = true;
  } else if (token.startsWith('user_')) {
    const tokenParts = token.split('_');
    if (tokenParts.length > 1) {
      userId = parseInt(tokenParts[1]) || 1;
    }
  } else {
    userId = parseInt(token) || 1;
  }

  // Try to fetch user from database to get role
  try {
    const query = 'SELECT id, username, role FROM users WHERE id = ?';
    const results = await executeQuery(query, [userId]);
    
    if (results.length > 0) {
      req.user = {
        id: results[0].id,
        username: results[0].username,
        role: results[0].role || 'user',
        token: token,
      };
    } else {
      // User doesn't exist in DB, use defaults based on token prefix
      req.user = {
        id: userId,
        role: isAdmin ? 'admin' : 'user',
        token: token,
      };
    }
  } catch (error) {
    // If database query fails, use defaults based on token prefix
    req.user = {
      id: userId,
      role: isAdmin ? 'admin' : 'user',
      token: token,
    };
  }

  next();
}

function authorize(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        },
      });
    }

    if (roles.length > 0) {
      const userRole = req.user.role || 'user';
      if (!roles.includes(userRole)) {
        return res.status(403).json({
          error: {
            message: 'Insufficient permissions',
            code: 'FORBIDDEN',
          },
        });
      }
    }

    next();
  };
}

module.exports = {
  authenticate,
  authorize,
};


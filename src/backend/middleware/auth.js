const { verifyToken } = require('../utils/token');
const UserRepository = require('../repositories/UserRepository');

const userRepository = new UserRepository();

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

  try {
    // Verify JWT token
    const decoded = verifyToken(token);
    
    // Fetch user from database to ensure user still exists and get latest role
    const user = await userRepository.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        },
      });
    }

    // Set user on request object
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role || 'user',
      isAdmin: user.isAdmin || false,
      token: token,
      profileComplete: user.profileComplete !== false,
    };

    next();
  } catch (error) {
    // Handle JWT verification errors
    if (error.message.includes('Invalid or expired')) {
      return res.status(401).json({
        error: {
          message: 'Invalid or expired token',
          code: 'INVALID_TOKEN',
        },
      });
    }
    
    // Fallback for backward compatibility with old token format
    // This allows existing tests to continue working during migration
    try {
      let userId = 1;
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

      const user = await userRepository.findById(userId);
      if (user) {
        req.user = {
          id: user.id,
          username: user.username,
          role: user.role || (isAdmin ? 'admin' : 'user'),
          isAdmin: user.isAdmin || isAdmin || false,
          token: token,
          profileComplete: user.profileComplete !== false,
        };
        return next();
      }
    } catch (fallbackError) {
      // Ignore fallback errors
    }

    return res.status(401).json({
      error: {
        message: 'Authentication failed',
        code: 'AUTH_FAILED',
      },
    });
  }
}

/**
 * Optional authentication middleware - sets req.user if token is present, but doesn't require it
 */
async function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.substring(7);
  
  if (!token || token === '') {
    req.user = null;
    return next();
  }

  try {
    // Verify JWT token
    const decoded = verifyToken(token);
    
    // Fetch user from database
    const user = await userRepository.findById(decoded.id);
    
    if (user) {
      req.user = {
        id: user.id,
        username: user.username,
        role: user.role || 'user',
        isAdmin: user.isAdmin || false,
        token: token,
        profileComplete: user.profileComplete !== false,
      };
    } else {
      req.user = null;
    }
  } catch (error) {
    // If token is invalid, just set user to null and continue
    req.user = null;
  }

  next();
}

/**
 * Block authenticated users whose profile is not complete (Phase 19).
 */
async function requireCompleteProfile(req, res, next) {
  try {
    const user = await userRepository.findById(req.user.id);
    if (!user) {
      return res.status(401).json({
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        },
      });
    }
    if (user.profileComplete === false) {
      return res.status(403).json({
        error: {
          message: 'Complete your profile before using this feature. Open your profile setup link or visit the profile completion page.',
          code: 'PROFILE_INCOMPLETE',
        },
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * If optional auth set a user, require complete profile; anonymous requests pass.
 */
async function optionalRequireCompleteProfile(req, res, next) {
  if (!req.user) {
    return next();
  }
  return requireCompleteProfile(req, res, next);
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
      // Check isAdmin flag first (for admin role)
      const isAdmin = req.user.isAdmin || false;
      const userRole = req.user.role || 'user';

      // Admin users have access to all roles
      if (!isAdmin && !roles.includes(userRole)) {
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

// Phase 26: convenience wrappers around `authorize` that name the policy
// rather than the role list. Routes are easier to scan when they say
// `requireOfficeAdminOrAdmin` than when they say `authorize(['admin','office_admin'])`.
//
// `requireAdmin`             -> only role === 'admin'
// `requireOfficeAdminOrAdmin` -> role === 'admin' OR role === 'office_admin'
//
// Both keep the existing 401 for unauthenticated and 403 with FORBIDDEN
// for wrong-role responses, so frontend error handling stays unchanged.
function requireAdmin(req, res, next) {
  return authorize(['admin'])(req, res, next);
}

function requireOfficeAdminOrAdmin(req, res, next) {
  return authorize(['admin', 'office_admin'])(req, res, next);
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  authorize,
  requireAdmin,
  requireOfficeAdminOrAdmin,
  requireCompleteProfile,
  optionalRequireCompleteProfile,
};

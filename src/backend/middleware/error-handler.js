function errorHandler(err, req, res, next) {
  console.error('Error:', err);
  console.error('Error stack:', err.stack);
  console.error('Error code:', err.code);
  console.error('Error message:', err.message);
  console.error('Error errno:', err.errno);
  console.error('Error sqlState:', err.sqlState);
  console.error('Error sqlMessage:', err.sqlMessage);

  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code || 'ERROR',
      },
    });
  }

  // Handle MySQL duplicate entry errors
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      error: {
        message: 'Duplicate entry',
        code: 'DUPLICATE_ENTRY',
      },
    });
  }

  // Handle MySQL foreign key constraint violations
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || 
      err.code === 'ER_NO_REFERENCED_ROW' ||
      (err.code && err.code.startsWith('ER_') && err.message && err.message.includes('foreign key constraint'))) {
    const errorMessage = err.sqlMessage || err.message || '';
    return res.status(400).json({
      error: {
        message: errorMessage.includes('user_id') || errorMessage.includes('users')
          ? 'Invalid user ID. User does not exist in the database.'
          : errorMessage.includes('desk_id') || errorMessage.includes('desks')
          ? 'Invalid desk ID. Desk does not exist in the database.'
          : `Database constraint violation: ${errorMessage}`,
        code: 'FOREIGN_KEY_ERROR',
      },
    });
  }

  // Handle all other MySQL errors
  if (err.code && err.code.startsWith('ER_')) {
    return res.status(400).json({
      error: {
        message: err.sqlMessage || err.message || 'Database error',
        code: 'DATABASE_ERROR',
      },
    });
  }

  // Handle other database-related errors
  if (err.errno || err.sqlState) {
    return res.status(400).json({
      error: {
        message: err.sqlMessage || err.message || 'Database error',
        code: 'DATABASE_ERROR',
      },
    });
  }

  // Default to 500 for unhandled errors
  res.status(500).json({
    error: {
      message: err.message || 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND',
    },
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};


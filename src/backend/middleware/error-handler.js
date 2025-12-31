function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code || 'ERROR',
      },
    });
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      error: {
        message: 'Duplicate entry',
        code: 'DUPLICATE_ENTRY',
      },
    });
  }

  if (err.code && err.code.startsWith('ER_')) {
    return res.status(400).json({
      error: {
        message: 'Database error',
        code: 'DATABASE_ERROR',
      },
    });
  }

  res.status(500).json({
    error: {
      message: 'Internal server error',
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


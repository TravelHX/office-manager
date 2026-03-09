const express = require('express');
const router = express.Router();
const VersionService = require('../services/VersionService');
const { authenticate, authorize } = require('../middleware/auth');

const versionService = new VersionService();

// Get current version endpoint (public)
router.get('/', async (req, res, next) => {
  try {
    const version = await versionService.getCurrentVersion();
    res.json(version.toJSON());
  } catch (error) {
    next(error);
  }
});

// Update version endpoint (admin only - for internal use)
router.post('/', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const { versionNumber, deploymentInfo } = req.body;
    
    if (!versionNumber) {
      return res.status(400).json({
        error: {
          message: 'Version number is required',
          code: 'MISSING_VERSION',
        },
      });
    }

    const version = await versionService.updateVersion(versionNumber, deploymentInfo);
    res.json(version.toJSON());
  } catch (error) {
    if (error.message.includes('Invalid version format')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'INVALID_VERSION_FORMAT',
        },
      });
    }
    next(error);
  }
});

// Increment version endpoint (admin only - for internal use)
router.post('/increment', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const { incrementType = 'patch', deploymentInfo } = req.body;
    
    const validTypes = ['major', 'minor', 'patch'];
    if (!validTypes.includes(incrementType)) {
      return res.status(400).json({
        error: {
          message: `Invalid increment type: ${incrementType}. Must be one of: ${validTypes.join(', ')}`,
          code: 'INVALID_INCREMENT_TYPE',
        },
      });
    }

    const version = await versionService.incrementAndUpdateVersion(incrementType, deploymentInfo);
    res.json(version.toJSON());
  } catch (error) {
    if (error.message.includes('Invalid version format') || error.message.includes('Invalid increment type')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'INVALID_VERSION_FORMAT',
        },
      });
    }
    next(error);
  }
});

module.exports = router;

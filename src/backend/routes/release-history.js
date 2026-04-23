const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const releaseHistoryPath = path.resolve(__dirname, '../../../data/release_history.txt');

router.get('/', (req, res, next) => {
  try {
    let content = '';
    if (fs.existsSync(releaseHistoryPath)) {
      content = fs.readFileSync(releaseHistoryPath, 'utf8');
    }
    res.json({ content });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

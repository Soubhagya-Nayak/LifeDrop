const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const healthController = require('../controllers/healthController');

router.post('/submit', auth, healthController.submitHealth);

module.exports = router;

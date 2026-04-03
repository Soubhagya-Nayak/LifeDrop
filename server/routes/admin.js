const express = require('express');
const auth = require('../middleware/auth');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.get('/overview', auth, adminController.getOverview);
router.post('/donor-eligibility', auth, adminController.updateDonorEligibility);
router.post('/request-donor-review', auth, adminController.reviewRequestDonor);
router.post('/reset-data', auth, adminController.resetOperationalData);

module.exports = router;

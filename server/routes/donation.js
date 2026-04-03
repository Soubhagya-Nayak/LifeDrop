const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const donationController = require('../controllers/donationController');

router.post('/generate-qr', auth, donationController.generateQR);
router.post('/verify', auth, donationController.verifyQR);
router.post('/scan-patient-qr', auth, donationController.scanPatientQR);
router.get('/history', auth, donationController.getDonationHistory);

module.exports = router;

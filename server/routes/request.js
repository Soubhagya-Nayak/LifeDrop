const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requestController = require('../controllers/requestController');

router.post('/create', auth, requestController.createRequest);
router.get('/dashboard', auth, requestController.getDashboardRequests);
router.get('/nearby-donors/:requestId', auth, requestController.getNearbyDonors);
router.post('/accept', auth, requestController.acceptRequest);
router.post('/cancel', auth, requestController.cancelRequest);

module.exports = router;

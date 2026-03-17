const express = require('express');
const router = express.Router();
const achievementController = require('../controllers/achievementController');
const { isAuthenticated } = require('../middlewares/auth');

router.use(isAuthenticated);

router.get('/', achievementController.index);

router.get('/leaderboard', achievementController.leaderboard);

router.get('/api/progress', achievementController.getProgress);

router.get('/:id', achievementController.show);

module.exports = router;

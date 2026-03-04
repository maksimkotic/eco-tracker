const express = require('express');
const router = express.Router();
const achievementController = require('../controllers/achievementController');
const { isAuthenticated } = require('../middlewares/auth');

// Все маршруты требуют авторизации
router.use(isAuthenticated);

// Список достижений
router.get('/', achievementController.index);

// Лидерборд
router.get('/leaderboard', achievementController.leaderboard);

// API для прогресса (AJAX)
router.get('/api/progress', achievementController.getProgress);

// Детали достижения
router.get('/:id', achievementController.show);

module.exports = router;

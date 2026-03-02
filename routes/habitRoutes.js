const express = require('express');
const router = express.Router();
const habitController = require('../controllers/habitController');
const { isAuthenticated } = require('../middlewares/auth');

// Все маршруты требуют авторизации
router.use(isAuthenticated);

// Список привычек
router.get('/', habitController.index);

// Создание привычки
router.get('/new', habitController.create);
router.post('/', habitController.store);

// Детали привычки
router.get('/:id', habitController.show);

// Редактирование привычки
router.get('/:id/edit', habitController.edit);
router.put('/:id', habitController.update);

// Удаление привычки
router.delete('/:id', habitController.destroy);
router.post('/:id', habitController.destroy);   

// Отметить выполнение
router.get('/:id/check', habitController.showCheck);
router.post('/:id/check', habitController.check);

// Переключение активности
router.post('/:id/toggle-active', habitController.toggleActive);

// Сброс статистики
router.post('/:id/reset', habitController.resetStats);

module.exports = router;
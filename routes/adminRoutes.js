const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated } = require('../middlewares/auth');
const { hasRole } = require('../middlewares/role');

// Все маршруты требуют авторизации и роли admin
router.use(isAuthenticated);
router.use(hasRole('admin'));

// Панель администратора
router.get('/', adminController.dashboard);

// Управление пользователями
router.get('/users', adminController.usersIndex);
router.get('/users/:id', adminController.showUser);
router.post('/users/:id/role', adminController.updateUserRole);
router.post('/users/:id/ban', adminController.toggleBan);
router.post('/users/:id/reset-password', adminController.resetPassword);
router.delete('/users/:id', adminController.destroyUser);

// Управление ролями
router.get('/roles', adminController.rolesIndex);
router.post('/roles', adminController.createRole);

// Логи системы
router.get('/logs', adminController.showLogs);
router.post('/logs/clear', adminController.clearLogs);

// Системное обслуживание (API)
router.post('/system/maintenance', (req, res) => {
  console.log('Запущено системное обслуживание');
  res.json({ success: true, message: 'Обслуживание завершено' });
});

// Создание пользователя
router.post('/users/create', adminController.createUser);

// Редактирование пользователя
router.get('/users/:id/edit', adminController.editUser);
router.put('/users/:id', adminController.updateUser);

// Редактирование роли
router.get('/roles/:id/edit', adminController.editRole);
router.put('/roles/:id', adminController.updateRole);
router.delete('/roles/:id', adminController.deleteRole);

// Логи
// router.get('/logs/api', adminController.getLogsApi);
// router.get('/logs/export', adminController.exportLogs);

// Системные настройки 
// router.get('/settings', adminController.settings);
// router.put('/settings', adminController.updateSettings);

module.exports = router;
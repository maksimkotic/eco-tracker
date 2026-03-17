const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated } = require('../middlewares/auth');
const { hasRole } = require('../middlewares/role');

router.use(isAuthenticated);
router.use(hasRole('admin'));

router.get('/', adminController.dashboard);

router.get('/users', adminController.usersIndex);
router.get('/users/:id', adminController.showUser);
router.post('/users/:id/role', adminController.updateUserRole);
router.post('/users/:id/ban', adminController.toggleBan);
router.post('/users/:id/reset-password', adminController.resetPassword);
router.delete('/users/:id', adminController.destroyUser);

router.get('/roles', adminController.rolesIndex);
router.post('/roles', adminController.createRole);

router.get('/logs', adminController.showLogs);
router.post('/logs/clear', adminController.clearLogs);

router.post('/system/maintenance', (req, res) => {
  console.log('Запущено системное обслуживание');
  res.json({ success: true, message: 'Обслуживание завершено' });
});

router.post('/users/create', adminController.createUser);

router.get('/users/:id/edit', adminController.editUser);
router.put('/users/:id', adminController.updateUser);

router.get('/roles/:id/edit', adminController.editRole);
router.put('/roles/:id', adminController.updateRole);
router.delete('/roles/:id', adminController.deleteRole);









module.exports = router;
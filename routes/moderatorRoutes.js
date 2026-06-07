const express = require('express');
const router = express.Router();
const moderatorController = require('../controllers/moderatorController');
const { isAuthenticated } = require('../middlewares/auth');
const { hasAnyRole } = require('../middlewares/role');

router.use(isAuthenticated);
router.use(hasAnyRole('moderator', 'admin'));

router.get('/', moderatorController.dashboard);

router.get('/habits', moderatorController.habitsIndex);
router.get('/habits/:id/edit', moderatorController.editHabit);
router.put('/habits/:id', moderatorController.updateHabit);
router.delete('/habits/:id', moderatorController.destroyHabit);
router.post('/habits/:id/delete', moderatorController.destroyHabit);
router.post('/habits/:id/reset', moderatorController.resetHabitStats);

router.get('/achievements', moderatorController.achievementsIndex);
router.get('/achievements/api/list', moderatorController.listAchievementsApi);
router.get('/achievements/create', moderatorController.createAchievement);
router.get('/achievements/new', moderatorController.createAchievement);
router.post('/achievements', moderatorController.storeAchievement);
router.get('/achievements/assign', moderatorController.assignAchievement);
router.post('/achievements/assign', moderatorController.processAssignment);
router.put('/achievements/:id', moderatorController.updateAchievement);
router.delete('/achievements/:id', moderatorController.deleteAchievement);
router.post('/achievements/:id/delete', moderatorController.deleteAchievement);

module.exports = router;
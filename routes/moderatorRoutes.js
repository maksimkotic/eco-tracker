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


router.get('/achievements', moderatorController.achievementsIndex);
router.get('/achievements/create', moderatorController.createAchievement);
router.post('/achievements', moderatorController.storeAchievement);
router.get('/achievements/assign', moderatorController.assignAchievement);
router.post('/achievements/assign', moderatorController.processAssignment);

module.exports = router;
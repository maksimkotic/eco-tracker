const express = require('express');
const router = express.Router();
const habitController = require('../controllers/habitController');
const { isAuthenticated } = require('../middlewares/auth');


router.use(isAuthenticated);


router.get('/', habitController.index);


router.get('/new', habitController.create);
router.post('/', habitController.store);


router.get('/:id', habitController.show);


router.get('/:id/edit', habitController.edit);
router.put('/:id', habitController.update);


router.delete('/:id', habitController.destroy);
router.post('/:id', habitController.destroy);


router.get('/:id/check', habitController.showCheck);
router.post('/:id/check', habitController.check);


router.post('/:id/toggle-active', habitController.toggleActive);


router.post('/:id/reset', habitController.resetStats);

module.exports = router;
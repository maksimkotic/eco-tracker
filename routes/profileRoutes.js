const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const profileController = require('../controllers/profileController');
const { isAuthenticated } = require('../middlewares/auth');

// Настройка Multer для загрузки аватаров
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads/avatars'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.currentUser.id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения (jpeg, jpg, png, gif)'));
    }
  }
});

// Все маршруты требуют авторизации
router.use(isAuthenticated);

// Профиль пользователя
router.get('/', profileController.show);

// Редактирование профиля
router.get('/edit', profileController.edit);
router.put('/', profileController.update);

// Удаление аккаунта
router.delete('/', profileController.destroy);

// Загрузка аватара
router.post('/avatar', upload.single('avatar'), profileController.uploadAvatar);

module.exports = router;
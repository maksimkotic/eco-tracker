const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const profileController = require('../controllers/profileController');
const { isAuthenticated } = require('../middlewares/auth');

const avatarsDir = path.join(__dirname, '../public/uploads/avatars');
fs.mkdirSync(avatarsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(avatarsDir, { recursive: true });
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.currentUser.id + '-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
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


const handleAvatarUpload = (req, res, next) => {
  upload.single('avatar')(req, res, (error) => {
    if (!error) {
      return next();
    }

    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Размер аватара не должен превышать 5MB'
      : error.message;

    req.flash('error', message || 'Не удалось загрузить аватар');
    return res.redirect('/profile/edit');
  });
};

const profileUpdateValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Имя пользователя должно быть от 3 до 50 символов')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Имя пользователя может содержать только латинские буквы, цифры и подчеркивания'),

  body('email')
    .trim()
    .isEmail()
    .withMessage('Введите корректный email')
    .normalizeEmail(),

  body('currentPassword')
    .custom((value, { req }) => {
      const usernameChanged = req.body.username !== req.currentUser.username;
      const emailChanged = req.body.email !== req.currentUser.email;
      const passwordChangeRequested = Boolean(req.body.newPassword || req.body.confirmPassword);

      if ((usernameChanged || emailChanged || passwordChangeRequested) && !value) {
        throw new Error('Введите текущий пароль для подтверждения изменений');
      }

      return true;
    }),

  body('newPassword')
    .optional({ checkFalsy: true })
    .isLength({ min: 6, max: 255 })
    .withMessage('Новый пароль должен быть от 6 до 255 символов')
    .matches(/\d/)
    .withMessage('Новый пароль должен содержать хотя бы одну цифру'),

  body('confirmPassword')
    .custom((value, { req }) => {
      if ((req.body.newPassword || value) && value !== req.body.newPassword) {
        throw new Error('Подтверждение нового пароля не совпадает');
      }

      return true;
    })
];

router.use(isAuthenticated);

router.get('/', profileController.show);

router.get('/edit', profileController.edit);
router.put('/', profileUpdateValidation, profileController.update);

router.delete('/', profileController.destroy);

router.post('/avatar', handleAvatarUpload, profileController.uploadAvatar);

module.exports = router;
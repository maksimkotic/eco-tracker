const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { isNotAuthenticated } = require('../middlewares/auth');

const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Имя пользователя должно быть от 3 до 50 символов')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Имя пользователя может содержать только буквы, цифры и подчеркивания'),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('Введите корректный email')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Пароль должен быть не менее 6 символов')
    .matches(/\d/)
    .withMessage('Пароль должен содержать хотя бы одну цифру'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Пароли не совпадают');
      }
      return true;
    })
];

const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Введите корректный email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Введите пароль')
];

router.get('/register', isNotAuthenticated, authController.showRegisterForm);
router.post('/register', isNotAuthenticated, registerValidation, authController.register);

router.get('/login', isNotAuthenticated, authController.showLoginForm);
router.post('/login', isNotAuthenticated, loginValidation, authController.login);

router.get('/logout', authController.logout);

module.exports = router;
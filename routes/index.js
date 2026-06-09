const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { SUBJECT_LABELS, sendContactNotification } = require('../services/contactNotificationService');

router.get('/', (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === 'admin') {
      res.redirect('/admin');
    } else if (req.session.user.role === 'moderator') {
      res.redirect('/moderator');
    } else {
      res.redirect('/profile');
    }
  } else {
    res.render('index', {
      title: 'Эко-Трекер - Отслеживайте экологические привычки',
      totalUsers: 1254,
      totalHabits: 8920,
      savedWater: 24580,
      reducedCO2: 156.7,
      layout: 'layout'
    });
  }
});

router.get('/guide', (req, res) => {
  res.render('static/guide', {
    title: 'Как это работает'
  });
});

router.get('/contacts', (req, res) => {
  res.render('static/contacts', {
    title: 'Контакты'
  });
});

router.post(
  '/contacts/send',
  [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Укажите имя длиной от 2 до 100 символов'),
    body('email').trim().isEmail().withMessage('Укажите корректный email'),
    body('subject')
      .trim()
      .isIn(Object.keys(SUBJECT_LABELS))
      .withMessage('Выберите тему сообщения'),
    body('message')
      .trim()
      .isLength({ min: 10, max: 3000 })
      .withMessage('Сообщение должно содержать от 10 до 3000 символов'),
    body('copy').optional().toBoolean()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      req.flash('error', errors.array().map((error) => error.msg).join(' '));
      return res.redirect('/contacts');
    }

    const payload = {
      name: String(req.body.name || '').trim(),
      email: String(req.body.email || '').trim(),
      subject: String(req.body.subject || '').trim(),
      message: String(req.body.message || '').trim(),
      copyToSender: Boolean(req.body.copy)
    };

    try {
      await sendContactNotification(payload);
      req.flash('success', 'Сообщение отправлено. Спасибо за обратную связь!');
      return res.redirect('/contacts');
    } catch (error) {
      console.error('Ошибка отправки сообщения с контактов:', error);
      req.flash('error', 'Не удалось отправить сообщение. Проверьте настройки Resend и попробуйте еще раз.');
      return res.redirect('/contacts');
    }
  }
);

router.get('/privacy', (req, res) => {
  res.render('static/privacy', {
    title: 'Политика конфиденциальности'
  });
});

router.get('/terms', (req, res) => {
  res.render('static/terms', {
    title: 'Условия пользования'
  });
});


router.get('/404', (req, res) => {
  res.status(404).render('errors/404', {
    title: 'Страница не найдена'
  });
});

router.get('/500', (req, res) => {
  res.status(500).render('errors/500', {
    title: 'Ошибка сервера'
  });
});

module.exports = router;

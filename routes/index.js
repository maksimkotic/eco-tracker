const express = require('express');
const router = express.Router();

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
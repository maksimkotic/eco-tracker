const { User, Role } = require('../models');

// Проверка авторизации
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    req.flash('error', 'Для доступа к этой странице необходимо авторизоваться');
    res.redirect('/auth/login');
  }
};

// Проверка, что пользователь НЕ авторизован
const isNotAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    next();
  } else {
    res.redirect('/profile');
  }
};

// Загрузка данных пользователя из БД
const loadUser = async (req, res, next) => {
  if (req.session.user) {
    try {
      const user = await User.findByPk(req.session.user.id, {
        include: [{
          model: Role,
          as: 'Role'
        }],
        attributes: { exclude: ['passwordHash'] }
      });
      
      if (user) {
        if (user.isBanned) {
          req.session.destroy();
          req.flash('error', 'Ваш аккаунт заблокирован');
          return res.redirect('/auth/login');
        }
        
        req.currentUser = user;
        res.locals.currentUser = user;
        
        // Обновляем время последней активности
        if (Date.now() - new Date(user.lastActive).getTime() > 5 * 60 * 1000) { // 5 минут
          user.lastActive = new Date();
          await user.save();
        }
      } else {
        // Пользователь удален из БД
        req.session.destroy();
      }
    } catch (error) {
      console.error('Ошибка загрузки пользователя:', error);
    }
  }
  next();
};

// Проверка токена CSRF (упрощенная версия)
const csrfProtection = (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    const csrfToken = req.body._csrf || req.query._csrf;
    
    if (!csrfToken || csrfToken !== req.session.csrfToken) {
      return res.status(403).render('errors/403', {
        title: 'Доступ запрещен',
        message: 'Недействительный CSRF токен'
      });
    }
  }
  
  // Генерация нового токена для следующего запроса
  req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  
  next();
};

module.exports = {
  isAuthenticated,
  isNotAuthenticated,
  loadUser,
  csrfProtection
};
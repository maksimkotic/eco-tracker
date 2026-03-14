const { User, Role } = require('../models');

const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    req.flash('error', 'Для доступа к этой странице необходимо авторизоваться');
    res.redirect('/auth/login');
  }
};

const isNotAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    next();
  } else {
    res.redirect('/profile');
  }
};

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
        
        if (Date.now() - new Date(user.lastActive).getTime() > 5 * 60 * 1000) { 
          user.lastActive = new Date();
          await user.save();
        }
      } else {
        req.session.destroy();
      }
    } catch (error) {
      console.error('Ошибка загрузки пользователя:', error);
    }
  }
  next();
};

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
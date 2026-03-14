const { User, Role } = require('../models');

const hasRole = (roleName) => {
  return async (req, res, next) => {
    try {
      if (!req.session.user) {
        req.flash('error', 'Требуется авторизация');
        return res.redirect('/auth/login');
      }
      const user = await User.findByPk(req.session.user.id, {
        include: [{
          model: Role,
          as: 'Role'
        }]
      });
      if (!user) {
        req.session.destroy();
        req.flash('error', 'Пользователь не найден');
        return res.redirect('/auth/login');
      }
      if (user.Role.name === roleName) {
        req.currentUser = user;
        next();
      } else {
        res.status(403).render('errors/403', {
          title: 'Доступ запрещен',
          message: `Требуется роль "${roleName}"`
        });
      }
    } catch (error) {
      console.error('Ошибка проверки роли:', error);
      res.status(500).render('errors/500', {
        title: 'Ошибка сервера',
        message: 'Произошла ошибка при проверке прав доступа'
      });
    }
  };
};

const hasAnyRole = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.session.user) {
        req.flash('error', 'Требуется авторизация');
        return res.redirect('/auth/login');
      }
      const user = await User.findByPk(req.session.user.id, {
        include: [{
          model: Role,
          as: 'Role'
        }]
      });
      if (!user) {
        req.session.destroy();
        req.flash('error', 'Пользователь не найден');
        return res.redirect('/auth/login');
      }
      if (roles.includes(user.Role.name)) {
        req.currentUser = user;
        next();
      } else {
        res.status(403).render('errors/403', {
          title: 'Доступ запрещен',
          message: `Требуется одна из ролей: ${roles.join(', ')}`
        });
      }
    } catch (error) {
      console.error('Ошибка проверки ролей:', error);
      res.status(500).render('errors/500');
    }
  };
};
module.exports = {
  hasRole,
  hasAnyRole
}
const { User, Habit, UserAchievement, Achievement, Role, Checkin, sequelize } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { attachHabitsProgress } = require('../utils/habitProgress');

const profileController = {

  show: async (req, res) => {
    try {
      const user = await User.findByPk(req.currentUser.id, {
        include: [{
          model: Role,
          as: 'Role'
        }],
        attributes: { exclude: ['passwordHash'] }
      });


      const habits = await attachHabitsProgress(await Habit.findAll({
        where: { userId: req.currentUser.id },
        order: [['createdAt', 'DESC']],
        limit: 5
      }));


      const userAchievements = await UserAchievement.findAll({
        where: { userId: req.currentUser.id },
        include: [{
          model: Achievement,
          as: 'Achievement'
        }],
        order: [['earnedAt', 'DESC']],
        limit: 6
      });


      const totalHabits = await Habit.count({ where: { userId: req.currentUser.id } });
      const activeHabits = await Habit.count({
        where: {
          userId: req.currentUser.id,
          isActive: true
        }
      });
      const totalAchievements = await UserAchievement.count({
        where: { userId: req.currentUser.id }
      });


      const upcomingAchievements = await getUpcomingAchievements(req.currentUser.id);

      res.render('profile/index', {
        title: 'Мой профиль',
        user,
        habits,
        achievements: userAchievements,
        stats: {
          totalHabits,
          activeHabits,
          totalAchievements,
          totalPoints: user.ecoPoints,
          currentStreak: user.currentStreak
        },
        upcomingAchievements
      });
    } catch (error) {
      console.error('Ошибка загрузки профиля:', error);
      req.flash('error', 'Не удалось загрузить профиль');
      res.redirect('/');
    }
  },


  edit: (req, res) => {
    res.render('profile/edit', {
      title: 'Редактирование профиля',
      user: req.currentUser,
      oldInput: req.flash('oldInput')[0] || {},
      errors: req.flash('errors') || []
    });
  },


  update: async (req, res) => {
    try {
      const errors = validationResult(req);
      const safeOldInput = {
        username: req.body.username,
        email: req.body.email
      };

      if (!errors.isEmpty()) {
        req.flash('errors', errors.array());
        req.flash('oldInput', safeOldInput);
        return res.redirect('/profile/edit');
      }

      const { username, email, currentPassword, newPassword } = req.body;
      const user = await User.findByPk(req.currentUser.id);

      if (!user) {
        delete req.session.user;
        req.flash('error', 'Пользователь не найден. Войдите в систему снова');
        return res.redirect('/auth/login');
      }

      const profileChanged = username !== user.username || email !== user.email;
      const passwordChangeRequested = Boolean(newPassword && newPassword.trim() !== '');

      if (profileChanged || passwordChangeRequested) {
        const isValidPassword = await user.comparePassword(currentPassword || '');
        if (!isValidPassword) {
          req.flash('error', 'Неверный текущий пароль');
          req.flash('oldInput', safeOldInput);
          return res.redirect('/profile/edit');
        }
      }

      const existingUser = await User.findOne({
        where: {
          id: { [Op.ne]: user.id },
          [Op.or]: [{ username }, { email }]
        }
      });

      if (existingUser) {
        req.flash('error', 'Пользователь с таким email или именем уже существует');
        req.flash('oldInput', safeOldInput);
        return res.redirect('/profile/edit');
      }

      const updateData = { username, email };

      if (passwordChangeRequested) {
        updateData.password = newPassword;
      }

      await user.update(updateData);

      req.session.user.username = user.username;
      req.session.user.email = user.email;

      req.flash('success', 'Профиль успешно обновлен');
      res.redirect('/profile');
    } catch (error) {
      console.error('Ошибка обновления профиля:', error);

      if (error.name === 'SequelizeUniqueConstraintError') {
        req.flash('error', 'Пользователь с таким email или именем уже существует');
      } else {
        req.flash('error', 'Не удалось обновить профиль');
      }

      req.flash('oldInput', {
        username: req.body.username,
        email: req.body.email
      });
      res.redirect('/profile/edit');
    }
  },


  destroy: async (req, res) => {
    try {
      const { password } = req.body;
      const user = await User.findByPk(req.currentUser.id);

      if (!user) {
        delete req.session.user;
        req.flash('error', 'Пользователь не найден. Войдите в систему снова');
        return res.redirect('/auth/login');
      }

      const isValidPassword = await user.comparePassword(password || '');
      if (!isValidPassword) {
        req.flash('error', 'Неверный пароль');
        return res.redirect('/profile/edit');
      }


      await sequelize.transaction(async (transaction) => {
        await Checkin.destroy({
          where: { userId: user.id },
          transaction
        });

        await Habit.destroy({
          where: { userId: user.id },
          transaction
        });

        await UserAchievement.destroy({
          where: { userId: user.id },
          transaction
        });

        await user.destroy({ transaction });
      });

      req.session.destroy((err) => {
        if (err) {
          console.error('Ошибка при очистке сессии после удаления аккаунта:', err);
          return res.redirect('/');
        }

        res.redirect('/');
      });
    } catch (error) {
      console.error('Ошибка удаления аккаунта:', error);
      req.flash('error', 'Не удалось удалить аккаунт');
      res.redirect('/profile/edit');
    }
  },


  uploadAvatar: async (req, res) => {
    try {
      if (!req.file) {
        req.flash('error', 'Файл не выбран');
        return res.redirect('/profile/edit');
      }

      const user = req.currentUser;




      await user.update({ avatar: req.file.filename });

      if (req.session.user) {
        req.session.user.avatar = req.file.filename;
      }

      req.flash('success', 'Аватар успешно обновлен');
      res.redirect('/profile');
    } catch (error) {
      console.error('Ошибка загрузки аватара:', error);
      req.flash('error', 'Не удалось загрузить аватар');
      res.redirect('/profile/edit');
    }
  }
};


async function getUpcomingAchievements(userId) {
  try {
    const achievements = await Achievement.findAll({
      where: { isHidden: false },
      include: [{
        model: User,
        as: 'Users',
        where: { id: userId },
        required: false,
        through: { attributes: [] }
      }]
    });


    const notEarned = achievements.filter(achievement =>
      !achievement.Users || achievement.Users.length === 0
    );


    const user = await User.findByPk(userId);
    const userHabits = await Habit.findAll({ where: { userId } });

    const upcoming = await Promise.all(notEarned.map(async (achievement) => {
      let progress = 0;
      let currentValue = 0;

      switch (achievement.conditionType) {
        case 'streak':
          currentValue = user.currentStreak;
          progress = Math.min((currentValue / achievement.conditionValue) * 100, 100);
          break;

        case 'total_habits':
          currentValue = userHabits.length;
          progress = Math.min((currentValue / achievement.conditionValue) * 100, 100);
          break;

        case 'eco_points':
          currentValue = user.ecoPoints;
          progress = Math.min((currentValue / achievement.conditionValue) * 100, 100);
          break;

        case 'days_active':

          currentValue = user.currentStreak;
          progress = Math.min((currentValue / achievement.conditionValue) * 100, 100);
          break;

        default:
          progress = 0;
      }

      return {
        ...achievement.toJSON(),
        progress,
        currentValue
      };
    }));


    return upcoming.sort((a, b) => b.progress - a.progress).slice(0, 3);
  } catch (error) {
    console.error('Ошибка получения ближайших достижений:', error);
    return [];
  }
}

module.exports = profileController;
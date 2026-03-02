const { User, Habit, UserAchievement, Achievement, Role } = require('../models');
const { Op } = require('sequelize');

const profileController = {
  // Показать профиль пользователя
  show: async (req, res) => {
    try {
      const user = await User.findByPk(req.currentUser.id, {
        include: [{
          model: Role,
          as: 'Role'
        }],
        attributes: { exclude: ['passwordHash'] }
      });

      // Получаем привычки пользователя
      const habits = await Habit.findAll({
        where: { userId: req.currentUser.id },
        order: [['createdAt', 'DESC']],
        limit: 5
      });

      // Получаем достижения пользователя
      const userAchievements = await UserAchievement.findAll({
        where: { userId: req.currentUser.id },
        include: [{
          model: Achievement,
          as: 'Achievement'
        }],
        order: [['earnedAt', 'DESC']],
        limit: 6
      });

      // Статистика
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

      // Ближайшие достижения
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

  // Показать форму редактирования профиля
  edit: (req, res) => {
    res.render('profile/edit', {
      title: 'Редактирование профиля',
      user: req.currentUser
    });
  },

  // Обновление профиля
  update: async (req, res) => {
    try {
      const { username, email, currentPassword, newPassword } = req.body;
      const user = req.currentUser;

      // Проверяем текущий пароль при смене email/username
      if (username !== user.username || email !== user.email) {
        const isValidPassword = await user.comparePassword(currentPassword);
        if (!isValidPassword) {
          req.flash('error', 'Неверный текущий пароль');
          return res.redirect('/profile/edit');
        }
      }

      // Обновляем данные
      const updateData = { username, email };
      
      // Если указан новый пароль
      if (newPassword && newPassword.trim() !== '') {
        updateData.password = newPassword;
      }

      await user.update(updateData);

      // Обновляем данные в сессии
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
      
      res.redirect('/profile/edit');
    }
  },

  // Удаление аккаунта
  destroy: async (req, res) => {
    try {
      const { password } = req.body;
      const user = req.currentUser;

      // Проверяем пароль
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        req.flash('error', 'Неверный пароль');
        return res.redirect('/profile/edit');
      }

      // Удаляем пользователя (в реальном приложении - мягкое удаление)
      await user.destroy();

      // Завершаем сессию
      req.session.destroy((err) => {
        if (err) {
          console.error('Ошибка при выходе:', err);
        }
        req.flash('info', 'Ваш аккаунт успешно удален');
        res.redirect('/');
      });
    } catch (error) {
      console.error('Ошибка удаления аккаунта:', error);
      req.flash('error', 'Не удалось удалить аккаунт');
      res.redirect('/profile/edit');
    }
  },

  // Загрузка аватара
  uploadAvatar: async (req, res) => {
    try {
      if (!req.file) {
        req.flash('error', 'Файл не выбран');
        return res.redirect('/profile/edit');
      }

      const user = req.currentUser;
      
      // В реальном приложении здесь была бы обработка изображения
      // (сжатие, создание миниатюр и т.д.)
      
      await user.update({ avatar: req.file.filename });
      
      req.flash('success', 'Аватар успешно обновлен');
      res.redirect('/profile');
    } catch (error) {
      console.error('Ошибка загрузки аватара:', error);
      req.flash('error', 'Не удалось загрузить аватар');
      res.redirect('/profile/edit');
    }
  }
};

// Вспомогательная функция для получения ближайших достижений
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

    // Фильтруем еще не полученные достижения
    const notEarned = achievements.filter(achievement => 
      !achievement.Users || achievement.Users.length === 0
    );

    // Добавляем прогресс для каждого достижения
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
          // Упрощенная логика
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

    // Сортируем по прогрессу (от большего к меньшему)
    return upcoming.sort((a, b) => b.progress - a.progress).slice(0, 3);
  } catch (error) {
    console.error('Ошибка получения ближайших достижений:', error);
    return [];
  }
}

module.exports = profileController;
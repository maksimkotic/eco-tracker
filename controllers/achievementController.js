const { Achievement, UserAchievement, User } = require('../models');
const { Op } = require('sequelize');

const achievementController = {
  // Показать все достижения пользователя
  index: async (req, res) => {
    try {
      const user = req.currentUser;

      // Получаем все достижения с информацией о получении
      const achievements = await Achievement.findAll({
        include: [{
          model: User,
          as: 'Users',
          where: { id: user.id },
          required: false,
          through: { 
            attributes: ['earnedAt'],
            where: { userId: user.id }
          }
        }],
        order: [
          ['rarity', 'DESC'],
          ['points', 'DESC'],
          ['title', 'ASC']
        ]
      });

      // Группируем достижения
      const earnedAchievements = achievements.filter(a => a.Users && a.Users.length > 0);
      const availableAchievements = achievements.filter(a => 
        !a.Users || a.Users.length === 0
      ).filter(a => !a.isHidden);
      const lockedAchievements = achievements.filter(a => a.isHidden);

      // Статистика
      const earnedCount = earnedAchievements.length;
      const totalCount = achievements.filter(a => !a.isHidden).length;
      const progressPercentage = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;
      const totalPoints = earnedAchievements.reduce((sum, a) => sum + a.points, 0);

      res.render('achievements/index', {
        title: 'Мои достижения',
        earnedAchievements,
        availableAchievements,
        lockedAchievements,
        earnedCount,
        totalCount,
        availableCount: availableAchievements.length,
        lockedCount: lockedAchievements.length,
        progressPercentage,
        totalPoints
      });
    } catch (error) {
      console.error('Ошибка загрузки достижений:', error);
      req.flash('error', 'Не удалось загрузить достижения');
      res.redirect('/profile');
    }
  },

  // Показать детали достижения
  show: async (req, res) => {
    try {
      const achievement = await Achievement.findByPk(req.params.id, {
        include: [{
          model: User,
          as: 'Users',
          where: { id: req.currentUser.id },
          required: false,
          through: { 
            attributes: ['earnedAt'],
            where: { userId: req.currentUser.id }
          }
        }]
      });

      if (!achievement) {
        req.flash('error', 'Достижение не найдено');
        return res.redirect('/achievements');
      }

      // Статистика по достижению
      const totalEarned = await UserAchievement.count({
        where: { achievementId: achievement.id }
      });

      // Получаем пользователей, получивших это достижение
      const recentEarners = await UserAchievement.findAll({
        where: { achievementId: achievement.id },
        include: [{
          model: User,
          as: 'User',
          attributes: ['id', 'username', 'avatar']
        }],
        order: [['earnedAt', 'DESC']],
        limit: 10
      });

      const isEarned = achievement.Users && achievement.Users.length > 0;

      res.render('achievements/show', {
        title: achievement.title,
        achievement,
        isEarned,
        totalEarned,
        recentEarners,
        earnedDate: isEarned ? achievement.Users[0].UserAchievement.earnedAt : null
      });
    } catch (error) {
      console.error('Ошибка загрузки достижения:', error);
      req.flash('error', 'Не удалось загрузить достижение');
      res.redirect('/achievements');
    }
  },

  // Показать лидерборд по достижениям
  leaderboard: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 20;
      const offset = (page - 1) * limit;

      // Получаем пользователей с количеством достижений и очками
      const { count, rows: users } = await User.findAndCountAll({
        attributes: [
          'id', 'username', 'avatar', 'ecoPoints', 'level',
          [
            User.sequelize.literal('(SELECT COUNT(*) FROM user_achievements WHERE user_achievements.userId = User.id)'),
            'achievementsCount'
          ]
        ],
        where: { isBanned: false },
        order: [
          ['ecoPoints', 'DESC'],
          ['level', 'DESC']
        ],
        limit,
        offset
      });

      // Получаем топ-3 пользователя
      const topUsers = await User.findAll({
        attributes: ['id', 'username', 'avatar', 'ecoPoints', 'level'],
        where: { isBanned: false },
        order: [['ecoPoints', 'DESC']],
        limit: 3
      });

      res.render('achievements/leaderboard', {
        title: 'Лидерборд',
        users,
        topUsers,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalUsers: count
      });
    } catch (error) {
      console.error('Ошибка загрузки лидерборда:', error);
      req.flash('error', 'Не удалось загрузить лидерборд');
      res.redirect('/achievements');
    }
  },

  // API: Получить прогресс по достижениям (для AJAX)
  getProgress: async (req, res) => {
    try {
      const user = req.currentUser;
      
      const achievements = await Achievement.findAll({
        where: { isHidden: false },
        attributes: ['id', 'title', 'conditionType', 'conditionValue']
      });

      const progress = await Promise.all(achievements.map(async (achievement) => {
        let current = 0;
        let needed = achievement.conditionValue;

        switch (achievement.conditionType) {
          case 'streak':
            current = user.currentStreak;
            break;
          case 'total_habits':
            const habitCount = await user.countHabits();
            current = habitCount;
            break;
          case 'eco_points':
            current = user.ecoPoints;
            break;
          case 'days_active':
            current = user.currentStreak; // Упрощенная логика
            break;
        }

        return {
          id: achievement.id,
          title: achievement.title,
          current,
          needed,
          progress: Math.min((current / needed) * 100, 100)
        };
      }));

      res.json({ success: true, progress });
    } catch (error) {
      console.error('Ошибка получения прогресса:', error);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
  }
};

module.exports = achievementController;
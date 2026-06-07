const { Achievement, UserAchievement, User, Habit } = require('../models');
const { Op } = require('sequelize');

const achievementController = {
  index: async (req, res) => {
    try {
      const user = req.currentUser;

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

      const isAchievementEarned = (achievement) => achievement.Users && achievement.Users.length > 0;
      const earnedAchievements = achievements.filter(isAchievementEarned);
      const availableAchievements = achievements.filter(a => !isAchievementEarned(a) && !a.isHidden);
      const lockedAchievements = achievements.filter(a => !isAchievementEarned(a) && a.isHidden);

      const earnedCount = earnedAchievements.length;
      const visibleEarnedCount = earnedAchievements.filter(a => !a.isHidden).length;
      const totalCount = achievements.filter(a => !a.isHidden).length;
      const progressPercentage = totalCount > 0 ? Math.round((visibleEarnedCount / totalCount) * 100) : 0;
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

      const totalEarned = await UserAchievement.count({
        where: { achievementId: achievement.id }
      });

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

  leaderboard: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 20;
      const offset = (page - 1) * limit;

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

  getProgress: async (req, res) => {
    try {
      const user = req.currentUser;

      const achievements = await Achievement.findAll({
        where: { isHidden: false },
        attributes: ['id', 'title', 'conditionType', 'conditionValue', 'conditionExtra']
      });

      const progress = await Promise.all(achievements.map(async (achievement) => {
        let current = 0;
        let needed = achievement.conditionValue;

        switch (achievement.conditionType) {
          case 'streak':
            current = user.currentStreak;
            break;
          case 'total_habits':
            current = await user.countHabits();
            break;
          case 'eco_points':
            current = user.ecoPoints;
            break;
          case 'days_active':
            current = user.currentStreak;
            break;
          case 'category_master':
            current = await Habit.count({
              where: {
                userId: user.id,
                category: achievement.conditionExtraParsed?.category
              }
            });
            break;
          case 'specific_habit': {
            const habitName = achievement.conditionExtraParsed?.habitName;
            if (habitName) {
              const habit = await Habit.findOne({
                where: {
                  userId: user.id,
                  title: { [Op.iLike]: `%${habitName}%` }
                },
                order: [['currentStreak', 'DESC']]
              });

              current = habit ? habit.currentStreak : 0;
            }
            break;
          }
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
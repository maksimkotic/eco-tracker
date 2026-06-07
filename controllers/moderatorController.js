const { Habit, User, Achievement, UserAchievement, Role, Checkin, sequelize } = require('../models');
const { Op } = require('sequelize');


const wantsJson = (req) =>
  req.xhr || (typeof req.get === 'function' && (req.get('accept') || '').includes('json'));

function getUtcDayKey(date) {
  const parsedDate = new Date(date);
  const year = parsedDate.getUTCFullYear();
  const month = String(parsedDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsedDate.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getPreviousUtcDayKey(dayKey) {
  const [year, month, day] = dayKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);

  return getUtcDayKey(date);
}

function calculateUserStreakFromCheckins(checkins) {
  const dayKeys = [...new Set(checkins.map((checkin) => getUtcDayKey(checkin.date)))].sort();

  if (!dayKeys.length) {
    return 0;
  }

  const activeDays = new Set(dayKeys);
  let streak = 1;
  let previousDayKey = getPreviousUtcDayKey(dayKeys[dayKeys.length - 1]);

  while (activeDays.has(previousDayKey)) {
    streak += 1;
    previousDayKey = getPreviousUtcDayKey(previousDayKey);
  }

  return streak;
}

function getCheckinBasePoints(category) {
  switch (category) {
    case 'water':
    case 'energy':
      return 5;
    case 'waste':
      return 10;
    case 'transport':
      return 7;
    case 'food':
      return 8;
    default:
      return 3;
  }
}

function getCheckinEcoPoints(category, value) {
  return getCheckinBasePoints(category) * Number(value || 0);
}

async function recalculateUserAfterRemovedCheckins(userId, pointsToRevoke, transaction) {
  const [user, remainingCheckins] = await Promise.all([
    User.findByPk(userId, { transaction }),
    Checkin.findAll({
      where: { userId },
      attributes: ['date'],
      order: [['date', 'ASC']],
      transaction
    })
  ]);

  if (!user) {
    return null;
  }

  user.ecoPoints = Math.max(0, Math.round((user.ecoPoints || 0) - (pointsToRevoke || 0)));
  user.level = Math.max(1, Math.floor(user.ecoPoints / 100) + 1);
  user.currentStreak = calculateUserStreakFromCheckins(remainingCheckins);
  user.lastActive = remainingCheckins.length
    ? new Date(Math.max(...remainingCheckins.map((checkin) => new Date(checkin.date).getTime())))
    : new Date();

  await user.save({ transaction });
  return user;
}

const achievementConditionTypes = [
  { value: 'streak', label: 'Дней подряд' },
  { value: 'total_habits', label: 'Всего привычек' },
  { value: 'eco_points', label: 'Эко-очков' },
  { value: 'days_active', label: 'Активных дней' },
  { value: 'specific_habit', label: 'Конкретная привычка' },
  { value: 'category_master', label: 'Мастер категории' }
];

const achievementRarities = [
  { value: 'common', label: 'Обычное' },
  { value: 'rare', label: 'Редкое' },
  { value: 'epic', label: 'Эпическое' },
  { value: 'legendary', label: 'Легендарное' }
];

const achievementIcons = [
  'trophy', 'star', 'award', 'medal', 'crown',
  'gem', 'shield', 'heart', 'flower1', 'recycle',
  'tree', 'lightning-charge', 'droplet', 'bicycle', 'check-circle'
];

const achievementCategories = [
  { value: 'water', label: 'Вода' },
  { value: 'energy', label: 'Энергия' },
  { value: 'waste', label: 'Отходы' },
  { value: 'transport', label: 'Транспорт' },
  { value: 'food', label: 'Питание' },
  { value: 'other', label: 'Прочее' }
];

function normalizePositiveInt(value, fallback = 1) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseConditionExtra(conditionExtra) {
  if (!conditionExtra) {
    return {};
  }

  try {
    return JSON.parse(conditionExtra) || {};
  } catch (error) {
    return {};
  }
}

function buildConditionExtra(conditionType, body) {
  if (conditionType === 'specific_habit') {
    const habitName = (body.habitName || '').trim();
    return habitName ? JSON.stringify({ habitName }) : null;
  }

  if (conditionType === 'category_master') {
    const category = (body.category || '').trim();
    return category ? JSON.stringify({ category }) : null;
  }

  return null;
}

function getAchievementFormData(body = {}) {
  const conditionType = achievementConditionTypes.some((type) => type.value === body.conditionType)
    ? body.conditionType
    : 'streak';
  const rarity = achievementRarities.some((item) => item.value === body.rarity)
    ? body.rarity
    : 'common';
  const icon = achievementIcons.includes(body.icon) ? body.icon : 'trophy';

  return {
    title: (body.title || '').trim(),
    description: (body.description || '').trim(),
    icon,
    points: normalizePositiveInt(body.points, 10),
    conditionType,
    conditionValue: normalizePositiveInt(body.conditionValue, 1),
    conditionExtra: buildConditionExtra(conditionType, body),
    rarity,
    isHidden: body.isHidden === 'on',
    habitName: (body.habitName || '').trim(),
    category: (body.category || '').trim()
  };
}

function getAchievementFormOptions() {
  return {
    conditionTypes: achievementConditionTypes,
    rarities: achievementRarities,
    icons: achievementIcons,
    categories: achievementCategories
  };
}

async function adjustUsersEcoPoints(userIds, pointsDelta, transaction) {
  if (!userIds.length || !pointsDelta) {
    return;
  }

  const users = await User.findAll({
    where: { id: userIds },
    transaction
  });

  await Promise.all(users.map(async (user) => {
    user.ecoPoints = Math.max(0, Math.round((user.ecoPoints || 0) + pointsDelta));
    user.level = Math.max(1, Math.floor(user.ecoPoints / 100) + 1);
    await user.save({ transaction });
  }));
}

const moderatorController = {

  dashboard: async (req, res) => {
    try {

      const stats = {
        totalHabits: await Habit.count(),
        activeHabits: await Habit.count({ where: { isActive: true } }),
        totalUsers: await User.count(),
        totalAchievements: await Achievement.count(),
        todayHabits: await Habit.count({
          where: {
            createdAt: {
              [Op.gte]: new Date(new Date() - 24 * 60 * 60 * 1000)
            }
          }
        })
      };


      const recentHabits = await Habit.findAll({
        include: [{
          model: User,
          as: 'User',
          attributes: ['id', 'username', 'avatar', 'ecoPoints', 'level', 'createdAt']
        }],
        order: [['createdAt', 'DESC']],
        limit: 10
      });


      const todayStats = {
        editedHabits: 0,
        createdAchievements: 0,
        assignedAchievements: 0
      };

      res.render('moderator/dashboard', {
        title: 'Панель модератора',
        stats,
        recentHabits,
        todayStats
      });
    } catch (error) {
      console.error('Ошибка загрузки панели модератора:', error);
      req.flash('error', 'Не удалось загрузить панель модератора');
      res.redirect('/profile');
    }
  },


  habitsIndex: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 20;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';
      const category = req.query.category;
      const status = req.query.status;

      let whereCondition = {};


      if (search) {
        whereCondition[Op.or] = [
          { title: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } }
        ];
      }


      if (category && category !== 'all') {
        whereCondition.category = category;
      }


      if (status === 'active') {
        whereCondition.isActive = true;
      } else if (status === 'inactive') {
        whereCondition.isActive = false;
      }

      const { count, rows: habits } = await Habit.findAndCountAll({
        where: whereCondition,
        include: [{
          model: User,
          as: 'User',
          attributes: ['id', 'username', 'avatar', 'ecoPoints', 'level', 'createdAt']
        }],
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });


      const categories = await Habit.findAll({
        attributes: ['category'],
        group: ['category']
      });

      res.render('moderator/habits/index', {
        title: 'Управление привычками',
        habits,
        categories: categories.map(c => c.category),
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalHabits: count,
        filters: { search, category, status }
      });
    } catch (error) {
      console.error('Ошибка загрузки привычек:', error);
      req.flash('error', 'Не удалось загрузить привычки');
      res.redirect('/moderator');
    }
  },


  editHabit: async (req, res) => {
    try {
      const habit = await Habit.findByPk(req.params.id, {
        include: [{
          model: User,
          as: 'User',
          attributes: ['id', 'username', 'avatar', 'ecoPoints', 'level', 'createdAt']
        }]
      });

      if (!habit) {
        req.flash('error', 'Привычка не найдена');
        return res.redirect('/moderator/habits');
      }

      res.render('moderator/habits/edit', {
        title: `Редактирование привычки: ${habit.title}`,
        habit,
        categories: [
          { value: 'water', label: '💧 Экономия воды' },
          { value: 'energy', label: '⚡ Экономия энергии' },
          { value: 'waste', label: '🗑️ Сортировка отходов' },
          { value: 'transport', label: '🚗 Экотранспорт' },
          { value: 'food', label: '🍎 Экопитание' },
          { value: 'other', label: '🌱 Прочее' }
        ],
        frequencies: [
          { value: 'daily', label: 'Ежедневно' },
          { value: 'weekly', label: 'Еженедельно' },
          { value: 'monthly', label: 'Ежемесячно' }
        ]
      });
    } catch (error) {
      console.error('Ошибка загрузки привычки:', error);
      req.flash('error', 'Не удалось загрузить привычку для редактирования');
      res.redirect('/moderator/habits');
    }
  },


  updateHabit: async (req, res) => {
    try {
      const { title, description, category, frequency, targetValue, unit, isActive } = req.body;
      const habitId = req.params.id;

      const habit = await Habit.findByPk(habitId);
      if (!habit) {
        req.flash('error', 'Привычка не найдена');
        return res.redirect('/moderator/habits');
      }

      await habit.update({
        title,
        description: description || '',
        category,
        frequency,
        targetValue: parseFloat(targetValue),
        unit: unit || 'times',
        isActive: isActive === 'on'
      });


      console.log(`Модератор ${req.currentUser.username} отредактировал привычку ${habitId}`);

      req.flash('success', 'Привычка успешно обновлена');
      res.redirect('/moderator/habits');
    } catch (error) {
      console.error('Ошибка обновления привычки:', error);
      req.flash('error', 'Не удалось обновить привычку');
      res.redirect(`/moderator/habits/${req.params.id}/edit`);
    }
  },


  destroyHabit: async (req, res) => {
    try {
      const habit = await Habit.findByPk(req.params.id);

      if (!habit) {
        if (wantsJson(req)) {
          return res.status(404).json({ success: false, error: 'Привычка не найдена' });
        }
        req.flash('error', 'Привычка не найдена');
        return res.redirect('/moderator/habits');
      }

      const habitTitle = habit.title;
      const habitUserId = habit.userId;

      await sequelize.transaction(async (transaction) => {
        const checkinsToRemove = await Checkin.findAll({
          where: { habitId: habit.id },
          attributes: ['value'],
          transaction
        });
        const pointsToRevoke = checkinsToRemove.reduce((total, checkin) => (
          total + getCheckinEcoPoints(habit.category, checkin.value)
        ), 0);

        await Checkin.destroy({
          where: { habitId: habit.id },
          transaction
        });

        await habit.destroy({ transaction });
        await recalculateUserAfterRemovedCheckins(habitUserId, pointsToRevoke, transaction);
      });

      console.log(`Модератор ${req.currentUser.username} удалил привычку ${req.params.id}`);

      req.flash('success', `Привычка "${habitTitle}" успешно удалена, статистика владельца пересчитана`);
      if (wantsJson(req)) {
        return res.json({ success: true, message: 'Привычка удалена' });
      }
      res.redirect('/moderator/habits');
    } catch (error) {
      console.error('Ошибка удаления привычки:', error);
      if (wantsJson(req)) {
        return res.status(500).json({ success: false, error: 'Не удалось удалить привычку' });
      }
      req.flash('error', 'Не удалось удалить привычку');
      res.redirect('/moderator/habits');
    }
  },


  resetHabitStats: async (req, res) => {
    try {
      const habit = await Habit.findByPk(req.params.id);

      if (!habit) {
        if (wantsJson(req)) {
          return res.status(404).json({ success: false, error: 'Привычка не найдена' });
        }
        req.flash('error', 'Привычка не найдена');
        return res.redirect('/moderator/habits');
      }

      const habitTitle = habit.title;

      await sequelize.transaction(async (transaction) => {
        const checkinsToRemove = await Checkin.findAll({
          where: { habitId: habit.id },
          attributes: ['value'],
          transaction
        });
        const pointsToRevoke = checkinsToRemove.reduce((total, checkin) => (
          total + getCheckinEcoPoints(habit.category, checkin.value)
        ), 0);

        await Checkin.destroy({
          where: { habitId: habit.id },
          transaction
        });

        await habit.update({
          currentStreak: 0,
          bestStreak: 0,
          totalCompletions: 0,
          lastCompleted: null
        }, { transaction });

        await recalculateUserAfterRemovedCheckins(habit.userId, pointsToRevoke, transaction);
      });

      console.log(`Модератор ${req.currentUser.username} сбросил статистику привычки ${req.params.id}`);

      req.flash('success', `Статистика привычки "${habitTitle}" сброшена`);
      if (wantsJson(req)) {
        return res.json({ success: true, message: 'Статистика привычки сброшена' });
      }
      res.redirect('/moderator/habits');
    } catch (error) {
      console.error('Ошибка сброса статистики привычки:', error);
      if (wantsJson(req)) {
        return res.status(500).json({ success: false, error: 'Не удалось сбросить статистику привычки' });
      }
      req.flash('error', 'Не удалось сбросить статистику привычки');
      res.redirect('/moderator/habits');
    }
  },


  achievementsIndex: async (req, res) => {
    try {
      const achievements = await Achievement.findAll({
        order: [
          ['rarity', 'DESC'],
          ['createdAt', 'DESC']
        ]
      });


      const achievementsWithStats = await Promise.all(achievements.map(async (achievement) => {
        const earnedCount = await UserAchievement.count({
          where: { achievementId: achievement.id }
        });

        const totalUsers = await User.count();
        const percentage = totalUsers > 0 ? Math.round((earnedCount / totalUsers) * 100) : 0;

        const achievementData = achievement.toJSON();

        return {
          ...achievementData,
          conditionExtraParsed: parseConditionExtra(achievementData.conditionExtra),
          earnedCount,
          percentage
        };
      }));

      res.render('moderator/achievements/index', {
        title: 'Управление достижениями',
        achievements: achievementsWithStats,
        ...getAchievementFormOptions()
      });
    } catch (error) {
      console.error('Ошибка загрузки достижений:', error);
      req.flash('error', 'Не удалось загрузить достижения');
      res.redirect('/moderator');
    }
  },


  createAchievement: (req, res) => {
    res.render('moderator/achievements/create', {
      title: 'Создание достижения',
      ...getAchievementFormOptions(),
      formData: {}
    });
  },


  storeAchievement: async (req, res) => {
    const formData = getAchievementFormData(req.body);

    try {
      await Achievement.create(formData);

      console.log(`Модератор ${req.currentUser.username} создал достижение "${formData.title}"`);

      req.flash('success', 'Достижение успешно создано');
      res.redirect('/moderator/achievements');
    } catch (error) {
      console.error('Ошибка создания достижения:', error);
      req.flash('error', error.name === 'SequelizeValidationError'
        ? `Не удалось создать достижение: ${error.errors.map((item) => item.message).join(', ')}`
        : 'Не удалось создать достижение');
      res.render('moderator/achievements/create', {
        title: 'Создание достижения',
        ...getAchievementFormOptions(),
        formData
      });
    }
  },


  updateAchievement: async (req, res) => {
    const formData = getAchievementFormData(req.body);

    try {
      const achievement = await Achievement.findByPk(req.params.id);

      if (!achievement) {
        req.flash('error', 'Достижение не найдено');
        return res.redirect('/moderator/achievements');
      }

      const pointsDelta = formData.points - achievement.points;

      await sequelize.transaction(async (transaction) => {
        await achievement.update(formData, { transaction });

        if (pointsDelta) {
          const userAchievements = await UserAchievement.findAll({
            where: { achievementId: achievement.id },
            attributes: ['userId'],
            transaction
          });
          const userIds = userAchievements.map((item) => item.userId);
          await adjustUsersEcoPoints(userIds, pointsDelta, transaction);
        }
      });

      console.log(`Модератор ${req.currentUser.username} обновил достижение "${formData.title}"`);

      req.flash('success', 'Достижение успешно обновлено');
      res.redirect('/moderator/achievements');
    } catch (error) {
      console.error('Ошибка обновления достижения:', error);
      req.flash('error', 'Не удалось обновить достижение');
      res.redirect('/moderator/achievements');
    }
  },


  deleteAchievement: async (req, res) => {
    try {
      const achievement = await Achievement.findByPk(req.params.id);

      if (!achievement) {
        if (wantsJson(req)) {
          return res.status(404).json({ success: false, error: 'Достижение не найдено' });
        }
        req.flash('error', 'Достижение не найдено');
        return res.redirect('/moderator/achievements');
      }

      const achievementTitle = achievement.title;

      await sequelize.transaction(async (transaction) => {
        const userAchievements = await UserAchievement.findAll({
          where: { achievementId: achievement.id },
          attributes: ['userId'],
          transaction
        });
        const userIds = userAchievements.map((item) => item.userId);

        await UserAchievement.destroy({
          where: { achievementId: achievement.id },
          transaction
        });
        await achievement.destroy({ transaction });
        await adjustUsersEcoPoints(userIds, -achievement.points, transaction);
      });

      console.log(`Модератор ${req.currentUser.username} удалил достижение "${achievementTitle}"`);

      req.flash('success', `Достижение "${achievementTitle}" удалено, очки пользователей пересчитаны`);
      if (wantsJson(req)) {
        return res.json({ success: true, message: 'Достижение удалено' });
      }
      res.redirect('/moderator/achievements');
    } catch (error) {
      console.error('Ошибка удаления достижения:', error);
      if (wantsJson(req)) {
        return res.status(500).json({ success: false, error: 'Не удалось удалить достижение' });
      }
      req.flash('error', 'Не удалось удалить достижение');
      res.redirect('/moderator/achievements');
    }
  },


  assignAchievement: async (req, res) => {
    try {
      const userSearch = (req.query.userSearch || '').trim();
      const userWhere = { isBanned: false };

      if (userSearch) {
        userWhere[Op.or] = [
          { username: { [Op.iLike]: `%${userSearch}%` } },
          { email: { [Op.iLike]: `%${userSearch}%` } }
        ];
      }

      const users = await User.findAll({
        where: userWhere,
        attributes: ['id', 'username', 'email', 'avatar', 'ecoPoints', 'level'],
        order: [['username', 'ASC']],
        limit: 100
      });

      const achievements = await Achievement.findAll({
        order: [['title', 'ASC']]
      });

      res.render('moderator/achievements/assign', {
        title: 'Назначение достижения',
        users,
        achievements,
        filters: { userSearch },
        selectedAchievementId: req.query.achievementId || '',
        selectedUserId: req.query.userId || ''
      });
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      req.flash('error', 'Не удалось загрузить данные');
      res.redirect('/moderator');
    }
  },


  processAssignment: async (req, res) => {
    try {
      const { userId, achievementId } = req.body;


      const user = await User.findByPk(userId);
      const achievement = await Achievement.findByPk(achievementId);

      if (!user || !achievement) {
        req.flash('error', 'Пользователь или достижение не найдены');
        return res.redirect('/moderator/achievements/assign');
      }


      const existing = await UserAchievement.findOne({
        where: { userId, achievementId }
      });

      if (existing) {
        req.flash('error', 'У пользователя уже есть это достижение');
        return res.redirect(`/moderator/achievements/assign?userId=${userId}&achievementId=${achievementId}`);
      }


      await achievement.grantToUser(userId);


      console.log(`Модератор ${req.currentUser.username} назначил достижение "${achievement.title}" пользователю ${user.username}`);

      req.flash('success', `Достижение "${achievement.title}" успешно назначено пользователю ${user.username}`);
      res.redirect('/moderator/achievements');
    } catch (error) {
      console.error('Ошибка назначения достижения:', error);
      req.flash('error', 'Не удалось назначить достижение');
      res.redirect('/moderator/achievements/assign');
    }
  },


  listAchievementsApi: async (req, res) => {
    try {
      const achievements = await Achievement.findAll({
        attributes: ['id', 'title', 'points', 'rarity', 'icon'],
        order: [['title', 'ASC']]
      });

      res.json(achievements);
    } catch (error) {
      console.error('Ошибка загрузки списка достижений:', error);
      res.status(500).json({ success: false, error: 'Не удалось загрузить достижения' });
    }
  }
};

module.exports = moderatorController;
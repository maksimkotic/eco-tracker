const { Habit, User, Achievement, UserAchievement, Role, Checkin } = require('../models');
const { Op } = require('sequelize');

const moderatorController = {
  // Панель модератора
  dashboard: async (req, res) => {
    try {
      // Статистика
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

      // Последние привычки
      const recentHabits = await Habit.findAll({
        include: [{
          model: User,
          as: 'User',
          attributes: ['id', 'username', 'avatar']
        }],
        order: [['createdAt', 'DESC']],
        limit: 10
      });

      // Сегодняшняя статистика действий модератора
      const todayStats = {
        editedHabits: 0, // Здесь можно добавить логирование действий
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

  // Управление привычками
  habitsIndex: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 20;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';
      const category = req.query.category;
      const status = req.query.status;

      let whereCondition = {};

      // Поиск
      if (search) {
        whereCondition[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }

      // Фильтр по категории
      if (category && category !== 'all') {
        whereCondition.category = category;
      }

      // Фильтр по статусу
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
          attributes: ['id', 'username', 'avatar']
        }],
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });

      // Категории для фильтра
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

  // Редактирование чужой привычки
  editHabit: async (req, res) => {
    try {
      const habit = await Habit.findByPk(req.params.id, {
        include: [{
          model: User,
          as: 'User',
          attributes: ['id', 'username', 'avatar']
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

  // Обновление чужой привычки
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

      // Логируем действие
      console.log(`Модератор ${req.currentUser.username} отредактировал привычку ${habitId}`);

      req.flash('success', 'Привычка успешно обновлена');
      res.redirect('/moderator/habits');
    } catch (error) {
      console.error('Ошибка обновления привычки:', error);
      req.flash('error', 'Не удалось обновить привычку');
      res.redirect(`/moderator/habits/${req.params.id}/edit`);
    }
  },

  // Удаление чужой привычки
  destroyHabit: async (req, res) => {
    try {
      const habit = await Habit.findByPk(req.params.id);
      
      if (!habit) {
        req.flash('error', 'Привычка не найдена');
        return res.redirect('/moderator/habits');
      }

      const habitTitle = habit.title;

      await Checkin.destroy({
        where: { habitId: habit.id }
      });

      await habit.destroy();

      // Логируем действие
      console.log(`Модератор ${req.currentUser.username} удалил привычку ${req.params.id}`);

      req.flash('success', `Привычка "${habitTitle}" успешно удалена`);
      res.redirect('/moderator/habits');
    } catch (error) {
      console.error('Ошибка удаления привычки:', error);
      req.flash('error', 'Не удалось удалить привычку');
      res.redirect('/moderator/habits');
    }
  },

  // Управление достижениями
  achievementsIndex: async (req, res) => {
    try {
      const achievements = await Achievement.findAll({
        order: [
          ['rarity', 'DESC'],
          ['createdAt', 'DESC']
        ]
      });

      // Статистика по каждому достижению
      const achievementsWithStats = await Promise.all(achievements.map(async (achievement) => {
        const earnedCount = await UserAchievement.count({
          where: { achievementId: achievement.id }
        });
        
        const totalUsers = await User.count();
        const percentage = totalUsers > 0 ? Math.round((earnedCount / totalUsers) * 100) : 0;

        return {
          ...achievement.toJSON(),
          earnedCount,
          percentage
        };
      }));

      res.render('moderator/achievements/index', {
        title: 'Управление достижениями',
        achievements: achievementsWithStats
      });
    } catch (error) {
      console.error('Ошибка загрузки достижений:', error);
      req.flash('error', 'Не удалось загрузить достижения');
      res.redirect('/moderator');
    }
  },

  // Создание достижения
  createAchievement: (req, res) => {
    res.render('moderator/achievements/create', {
      title: 'Создание достижения',
      conditionTypes: [
        { value: 'streak', label: 'Дней подряд' },
        { value: 'total_habits', label: 'Всего привычек' },
        { value: 'eco_points', label: 'Эко-очков' },
        { value: 'days_active', label: 'Активных дней' },
        { value: 'specific_habit', label: 'Конкретная привычка' },
        { value: 'category_master', label: 'Мастер категории' }
      ],
      rarities: [
        { value: 'common', label: 'Обычное' },
        { value: 'rare', label: 'Редкое' },
        { value: 'epic', label: 'Эпическое' },
        { value: 'legendary', label: 'Легендарное' }
      ],
      icons: [
        'trophy', 'star', 'award', 'medal', 'crown', 
        'gem', 'shield', 'heart', 'seedling', 'recycle'
      ]
    });
  },

  // Сохранение достижения
  storeAchievement: async (req, res) => {
    try {
      const { 
        title, 
        description, 
        icon, 
        points, 
        conditionType, 
        conditionValue, 
        conditionExtra,
        rarity,
        isHidden 
      } = req.body;

      const achievement = await Achievement.create({
        title,
        description,
        icon: icon || 'trophy',
        points: parseInt(points),
        conditionType,
        conditionValue: parseInt(conditionValue),
        conditionExtra: conditionExtra || null,
        rarity: rarity || 'common',
        isHidden: isHidden === 'on'
      });

      // Логируем действие
      console.log(`Модератор ${req.currentUser.username} создал достижение "${title}"`);

      req.flash('success', 'Достижение успешно создано');
      res.redirect('/moderator/achievements');
    } catch (error) {
      console.error('Ошибка создания достижения:', error);
      req.flash('error', 'Не удалось создать достижение');
      res.redirect('/moderator/achievements/create');
    }
  },

  // Назначение достижения пользователю
  assignAchievement: async (req, res) => {
    try {
      const users = await User.findAll({
        where: { isBanned: false },
        attributes: ['id', 'username', 'avatar', 'ecoPoints'],
        order: [['username', 'ASC']],
        limit: 50
      });

      const achievements = await Achievement.findAll({
        order: [['title', 'ASC']]
      });

      res.render('moderator/achievements/assign', {
        title: 'Назначение достижения',
        users,
        achievements
      });
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      req.flash('error', 'Не удалось загрузить данные');
      res.redirect('/moderator');
    }
  },

  // Обработка назначения достижения
  processAssignment: async (req, res) => {
    try {
      const { userId, achievementId } = req.body;

      // Проверяем существование
      const user = await User.findByPk(userId);
      const achievement = await Achievement.findByPk(achievementId);

      if (!user || !achievement) {
        req.flash('error', 'Пользователь или достижение не найдены');
        return res.redirect('/moderator/achievements/assign');
      }

      // Проверяем, нет ли уже такого достижения
      const existing = await UserAchievement.findOne({
        where: { userId, achievementId }
      });

      if (existing) {
        req.flash('error', 'У пользователя уже есть это достижение');
        return res.redirect('/moderator/achievements/assign');
      }

      // Назначаем достижение
      await achievement.grantToUser(userId);

      // Логируем действие
      console.log(`Модератор ${req.currentUser.username} назначил достижение "${achievement.title}" пользователю ${user.username}`);

      req.flash('success', `Достижение "${achievement.title}" успешно назначено пользователю ${user.username}`);
      res.redirect('/moderator/achievements');
    } catch (error) {
      console.error('Ошибка назначения достижения:', error);
      req.flash('error', 'Не удалось назначить достижение');
      res.redirect('/moderator/achievements/assign');
    }
  }
};

module.exports = moderatorController;
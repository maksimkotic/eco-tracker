const {
  Habit,
  User,
  UserAchievement,
  Achievement,
  Checkin,
} = require("../models");
const { Op } = require("sequelize");

const habitController = {
  // Показать все привычки пользователя
  index: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;
      const category = req.query.category;
      const status = req.query.status;
      const search = req.query.search;

      let whereCondition = { userId: req.currentUser.id };

      // Фильтр по категории
      if (category && category !== "all") {
        whereCondition.category = category;
      }

      // Фильтр по статусу
      if (status === "active") {
        whereCondition.isActive = true;
      } else if (status === "inactive") {
        whereCondition.isActive = false;
      } else if (status === "completed") {
        whereCondition.currentStreak = {
          [Op.gte]: Habit.sequelize.col("targetValue"),
        };
      }

      // Поиск по названию
      if (search) {
        whereCondition.title = { [Op.like]: `%${search}%` };
      }

      const { count, rows: habits } = await Habit.findAndCountAll({
        where: whereCondition,
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });

      // Статистика для фильтров
      const totalActive = await Habit.count({
        where: { userId: req.currentUser.id, isActive: true },
      });

      const totalInactive = await Habit.count({
        where: { userId: req.currentUser.id, isActive: false },
      });

      const categories = await Habit.findAll({
        where: { userId: req.currentUser.id },
        attributes: ["category"],
        group: ["category"],
      });

      res.render("habits/index", {
        title: "Мои привычки",
        habits,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalHabits: count,
        totalActive,
        totalInactive,
        categories: categories.map((c) => c.category),
        currentFilter: { category, status, search },
      });
    } catch (error) {
      console.error("Ошибка загрузки привычек:", error);
      req.flash("error", "Не удалось загрузить привычки");
      res.redirect("/profile");
    }
  },

  // Показать форму создания привычки
  create: (req, res) => {
    res.render("habits/new", {
      title: "Создание новой привычки",
      categories: [
        { value: "water", label: "💧 Экономия воды" },
        { value: "energy", label: "⚡ Экономия энергии" },
        { value: "waste", label: "🗑️ Сортировка отходов" },
        { value: "transport", label: "🚗 Экотранспорт" },
        { value: "food", label: "🍎 Экопитание" },
        { value: "other", label: "🌱 Прочее" },
      ],
      frequencies: [
        { value: "daily", label: "Ежедневно" },
        { value: "weekly", label: "Еженедельно" },
        { value: "monthly", label: "Ежемесячно" },
      ],
      colors: [
        "#28a745",
        "#17a2b8",
        "#007bff",
        "#6f42c1",
        "#fd7e14",
        "#e83e8c",
        "#20c997",
        "#ffc107",
      ],
    });
  },

  // Сохранение новой привычки
  store: async (req, res) => {
    try {
      const {
        title,
        description,
        category,
        frequency,
        targetValue,
        unit,
        color,
      } = req.body;

      const habit = await Habit.create({
        userId: req.currentUser.id,
        title,
        description: description || "",
        category,
        frequency,
        targetValue: parseFloat(targetValue),
        unit: unit || "times",
        color: color || "#28a745",
        isActive: true,
      });

      // Проверяем достижения
      await checkAchievements(req.currentUser.id);

      req.flash("success", `Привычка "${habit.title}" успешно создана!`);
      res.redirect(`/habits/${habit.id}`);
    } catch (error) {
      console.error("Ошибка создания привычки:", error);
      req.flash("error", "Не удалось создать привычку");
      res.redirect("/habits/new");
    }
  },

  // Показать детали привычки
  show: async (req, res) => {
    try {
      const habit = await Habit.findOne({
        where: {
          id: req.params.id,
          userId: req.currentUser.id,
        },
        include: [
          {
            model: User,
            as: "User",
            attributes: ["id", "username", "avatar"],
          },
        ],
      });

      if (!habit) {
        req.flash("error", "Привычка не найдена");
        return res.redirect("/habits");
      }

      // Получаем историю выполнений
      const checkins = await Checkin.findAll({
        where: { habitId: habit.id },
        order: [["date", "DESC"]],
        limit: 10,
      });

      res.render("habits/show", {
        title: habit.title,
        habit,
        checkins,
        progressPercentage: Math.min(
          (habit.currentStreak / habit.targetValue) * 100,
          100
        ),
      });
    } catch (error) {
      console.error("Ошибка загрузки привычки:", error);
      req.flash("error", "Не удалось загрузить привычку");
      res.redirect("/habits");
    }
  },

  // Показать форму редактирования привычки
  edit: async (req, res) => {
    try {
      const habit = await Habit.findOne({
        where: {
          id: req.params.id,
          userId: req.currentUser.id,
        },
      });

      if (!habit) {
        req.flash("error", "Привычка не найдена");
        return res.redirect("/habits");
      }

      res.render("habits/edit", {
        title: `Редактирование: ${habit.title}`,
        habit,
        categories: [
          { value: "water", label: "💧 Экономия воды" },
          { value: "energy", label: "⚡ Экономия энергии" },
          { value: "waste", label: "🗑️ Сортировка отходов" },
          { value: "transport", label: "🚗 Экотранспорт" },
          { value: "food", label: "🍎 Экопитание" },
          { value: "other", label: "🌱 Прочее" },
        ],
        frequencies: [
          { value: "daily", label: "Ежедневно" },
          { value: "weekly", label: "Еженедельно" },
          { value: "monthly", label: "Ежемесячно" },
        ],
        colors: [
          "#28a745",
          "#17a2b8",
          "#007bff",
          "#6f42c1",
          "#fd7e14",
          "#e83e8c",
          "#20c997",
          "#ffc107",
        ],
      });
    } catch (error) {
      console.error("Ошибка загрузки привычки:", error);
      req.flash("error", "Не удалось загрузить привычку для редактирования");
      res.redirect("/habits");
    }
  },

  // Обновление привычки
  update: async (req, res) => {
    try {
      const {
        title,
        description,
        category,
        frequency,
        targetValue,
        unit,
        color,
        isActive
      } = req.body;

      const habit = await Habit.findOne({
        where: {
          id: req.params.id,
          userId: req.currentUser.id
        }
      });

      if (!habit) {
        req.flash('error', 'Привычка не найдена');
        return res.redirect('/habits');
      }

      await habit.update({
        title,
        description: description || '',
        category,
        frequency,
        targetValue: parseFloat(targetValue),
        unit: unit || 'times',
        color: color || '#28a745',
        isActive: isActive === 'on'
      });

      req.flash('success', 'Привычка успешно обновлена');
      res.redirect(`/habits/${habit.id}`);
    } catch (error) {
      console.error('Ошибка обновления привычки:', error);
      req.flash('error', 'Не удалось обновить привычку');
      res.redirect(`/habits/${req.params.id}/edit`);
    }
  },

  // Удаление привычки
  destroy: async (req, res) => {
    try {
      const habit = await Habit.findOne({
        where: {
          id: req.params.id,
          userId: req.currentUser.id
        }
      });

      if (!habit) {
        req.flash('error', 'Привычка не найдена');
        return res.redirect('/habits');
      }

      // УДАЛЯЕМ ВСЕ СВЯЗАННЫЕ CHECKINS ВРУЧНУЮ
      await Checkin.destroy({
        where: { habitId: habit.id }
      });
      
      console.log('Удалены связанные checkins для привычки:', habit.id);

      // Теперь удаляем привычку
      await habit.destroy();
      
      console.log('Привычка удалена:', habit.id);
      
      req.flash('success', `Привычка "${habit.title}" успешно удалена`);
      
      // Для AJAX запросов
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.json({ success: true, message: 'Привычка удалена' });
      }
      
      // Для обычных запросов
      res.redirect('/habits');
    } catch (error) {
      console.error('Ошибка удаления привычки:', error);
      console.error('Полная ошибка:', error.stack);
      
      // Попробуем альтернативный способ - удалить через SQL
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        try {
          // Удаляем через raw SQL
          await sequelize.query(`
            PRAGMA foreign_keys = OFF;
            DELETE FROM habits WHERE id = :habitId AND userId = :userId;
            PRAGMA foreign_keys = ON;
          `, {
            replacements: { 
              habitId: req.params.id, 
              userId: req.currentUser.id 
            }
          });
          
          req.flash('success', `Привычка удалена`);
          return res.redirect('/habits');
        } catch (sqlError) {
          console.error('SQL ошибка удаления:', sqlError);
        }
      }
      
      // Для AJAX
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(500).json({ 
          success: false, 
          error: 'Не удалось удалить привычку' 
        });
      }
      
      // Для обычных
      req.flash('error', 'Не удалось удалить привычку. У привычки есть связанные записи.');
      res.redirect('/habits');
    }
  },

  // Показать форму отметки выполнения
  showCheck: async (req, res) => {
    try {
      const habit = await Habit.findOne({
        where: {
          id: req.params.id,
          userId: req.currentUser.id,
        },
      });

      if (!habit) {
        req.flash("error", "Привычка не найдена");
        return res.redirect("/habits");
      }

      res.render("habits/check", {
        title: `Отметить выполнение: ${habit.title}`,
        habit,
      });
    } catch (error) {
      console.error("Ошибка загрузки привычки:", error);
      req.flash("error", "Не удалось загрузить привычку");
      res.redirect("/habits");
    }
  },

  // Обработка отметки выполнения
  check: async (req, res) => {
    try {
      const { value, date, notes } = req.body;
      const habitId = req.params.id;

      const habit = await Habit.findOne({
        where: {
          id: habitId,
          userId: req.currentUser.id,
        },
      });

      if (!habit) {
        req.flash("error", "Привычка не найдена");
        return res.redirect("/habits");
      }

      // Создаем запись о выполнении
      const checkin = await Checkin.create({
        habitId: habit.id,
        userId: req.currentUser.id,
        value: parseFloat(value),
        date: date ? new Date(date) : new Date(),
        notes: notes || "",
      });

      // Отмечаем выполнение
      await habit.markCompleted(
        parseFloat(value),
        date ? new Date(date) : new Date()
      );

      // Начисляем эко-очки в зависимости от категории
      let pointsEarned = 0;
      switch (habit.category) {
        case "water":
          pointsEarned = 5;
          break;
        case "energy":
          pointsEarned = 5;
          break;
        case "waste":
          pointsEarned = 10;
          break;
        case "transport":
          pointsEarned = 7;
          break;
        case "food":
          pointsEarned = 8;
          break;
        default:
          pointsEarned = 3;
      }

      // Умножаем на значение выполнения
      pointsEarned *= parseFloat(value);

      // Добавляем очки пользователю
      await req.currentUser.addEcoPoints(pointsEarned);

      // Проверяем достижения
      await checkAchievements(req.currentUser.id);

      req.flash("success", `Выполнение отмечено! +${pointsEarned} эко-очков`);
      res.redirect(`/habits/${habit.id}`);
    } catch (error) {
      console.error("Ошибка отметки выполнения:", error);
      req.flash("error", "Не удалось отметить выполнение");
      res.redirect(`/habits/${req.params.id}/check`);
    }
  },

  // Переключение активности привычки
  toggleActive: async (req, res) => {
    try {
      const habit = await Habit.findOne({
        where: {
          id: req.params.id,
          userId: req.currentUser.id,
        },
      });

      if (!habit) {
        req.flash("error", "Привычка не найдена");
        return res.redirect("/habits");
      }

      await habit.update({ isActive: !habit.isActive });

      const status = habit.isActive ? "активирована" : "деактивирована";
      req.flash("success", `Привычка "${habit.title}" ${status}`);
      res.redirect("back");
    } catch (error) {
      console.error("Ошибка переключения активности:", error);
      req.flash("error", "Не удалось изменить статус привычки");
      res.redirect("/habits");
    }
  },

  // Сброс статистики привычки
resetStats: async (req, res) => {
  try {
    const habit = await Habit.findOne({
      where: {
        id: req.params.id,
        userId: req.currentUser.id
      }
    });

    if (!habit) {
      return res.status(404).json({ error: 'Привычка не найдена' });
    }

    await habit.update({
      currentStreak: 0,
      totalCompletions: 0,
      lastCompleted: null
    });

    res.json({ success: true, message: 'Статистика сброшена' });
  } catch (error) {
    console.error('Ошибка сброса статистики:', error);
    res.status(500).json({ error: 'Не удалось сбросить статистику' });
  }
}

};


// Вспомогательная функция для проверки достижений
async function checkAchievements(userId) {
  try {
    console.log(`🔍 Проверяем достижения для пользователя ${userId}...`);
    
    const achievements = await Achievement.findAll();
    const user = await User.findByPk(userId);
    
    if (!user) {
      console.error('Пользователь не найден для проверки достижений');
      return;
    }
    
    console.log(`👤 Пользователь: ${user.username}, Очки: ${user.ecoPoints}, Серия: ${user.currentStreak}`);
    
    // Получаем уже полученные достижения
    const earnedAchievements = await UserAchievement.findAll({
      where: { userId },
      attributes: ['achievementId']
    });
    const earnedIds = earnedAchievements.map(a => a.achievementId);
    
    for (const achievement of achievements) {
      try {
        // Пропускаем уже полученные
        if (earnedIds.includes(achievement.id)) {
          continue;
        }
        
        let earned = false;
        
        console.log(`📊 Проверяем достижение: ${achievement.title} (${achievement.conditionType})`);
        
        switch (achievement.conditionType) {
          case 'streak':
            earned = user.currentStreak >= achievement.conditionValue;
            console.log(`   Серия: ${user.currentStreak} >= ${achievement.conditionValue} = ${earned}`);
            break;
            
          case 'total_habits':
            const habitCount = await Habit.count({ where: { userId } });
            earned = habitCount >= achievement.conditionValue;
            console.log(`   Привычек: ${habitCount} >= ${achievement.conditionValue} = ${earned}`);
            break;
            
          case 'eco_points':
            earned = user.ecoPoints >= achievement.conditionValue;
            console.log(`   Очков: ${user.ecoPoints} >= ${achievement.conditionValue} = ${earned}`);
            break;
            
          case 'days_active':
            // Используем currentStreak как дни активности
            earned = user.currentStreak >= achievement.conditionValue;
            console.log(`   Активных дней: ${user.currentStreak} >= ${achievement.conditionValue} = ${earned}`);
            break;
            
          case 'specific_habit':
          case 'category_master':
            // Пропускаем сложные достижения для начала
            console.log(`   Пропускаем сложное достижение: ${achievement.conditionType}`);
            continue;
        }
        
        if (earned) {
          console.log(`🎉 Пользователь ${user.username} заработал достижение: ${achievement.title} (+${achievement.points} очков)`);
          
          // Выдаем достижение
          await UserAchievement.create({
            userId,
            achievementId: achievement.id,
            earnedAt: new Date()
          });
          
          // Начисляем очки
          await user.addEcoPoints(achievement.points);
          
          console.log(`   ✅ Достижение выдано, очки начислены`);
        }
      } catch (achievementError) {
        console.error(`❌ Ошибка проверки достижения ${achievement.id}:`, achievementError);
      }
    }
    
    console.log('✅ Проверка достижений завершена');
  } catch (error) {
    console.error('❌ Ошибка проверки достижений:', error);
  }
}

module.exports = habitController;

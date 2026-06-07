const {
  Habit,
  User,
  Achievement,
  Checkin,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");
const { CATEGORY_LABELS, generateHabitSuggestions } = require("../services/aiHabitService");
const { attachHabitProgress, attachHabitsProgress } = require("../utils/habitProgress");

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


function getCheckinBasePoints(category) {
  switch (category) {
    case "water":
    case "energy":
      return 5;
    case "waste":
      return 10;
    case "transport":
      return 7;
    case "food":
      return 8;
    default:
      return 3;
  }
}

function getCheckinEcoPoints(category, value) {
  return getCheckinBasePoints(category) * Number(value || 0);
}

async function subtractUserEcoPoints(userId, points) {
  if (!points) {
    return null;
  }

  const user = await User.findByPk(userId);

  if (!user) {
    return null;
  }

  user.ecoPoints = Math.max(0, Math.round((user.ecoPoints || 0) - points));
  user.level = Math.max(1, Math.floor(user.ecoPoints / 100) + 1);
  await user.save();

  return user;
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

const habitController = {

  index: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;
      const category = req.query.category;
      const status = req.query.status;
      const search = req.query.search;

      let whereCondition = { userId: req.currentUser.id };


      if (category && category !== "all") {
        whereCondition.category = category;
      }


      if (status === "active") {
        whereCondition.isActive = true;
      } else if (status === "inactive") {
        whereCondition.isActive = false;
      }


      if (search) {
        whereCondition.title = { [Op.iLike]: `%${search}%` };
      }

      let count;
      let habits;

      if (status === "completed") {
        const allHabits = await Habit.findAll({
          where: whereCondition,
          order: [["createdAt", "DESC"]],
        });
        const habitsWithProgress = await attachHabitsProgress(allHabits);
        const completedHabits = habitsWithProgress.filter((habit) => (
          Number(habit.getDataValue('periodValue')) >= Number(habit.targetValue)
        ));

        count = completedHabits.length;
        habits = completedHabits.slice(offset, offset + limit);
      } else {
        const result = await Habit.findAndCountAll({
          where: whereCondition,
          order: [["createdAt", "DESC"]],
          limit,
          offset,
        });

        count = result.count;
        habits = await attachHabitsProgress(result.rows);
      }


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


  aiAssistant: async (req, res) => {
    try {
      const habits = await Habit.findAll({
        where: { userId: req.currentUser.id },
        attributes: ["title", "category"],
        order: [["createdAt", "DESC"]],
        limit: 10,
      });

      res.render("habits/ai", {
        title: "ИИ-помощник привычек",
        categories: CATEGORY_LABELS,
        selectedCategory: req.body?.category || "other",
        goal: req.body?.goal || "",
        habits,
        result: null,
      });
    } catch (error) {
      console.error("Ошибка загрузки ИИ-помощника:", error);
      req.flash("error", "Не удалось открыть ИИ-помощник");
      res.redirect("/habits");
    }
  },


  generateAiSuggestions: async (req, res) => {
    try {
      const { category = "other", goal = "" } = req.body;
      const habits = await Habit.findAll({
        where: { userId: req.currentUser.id },
        attributes: ["title", "category"],
        order: [["createdAt", "DESC"]],
        limit: 10,
      });

      const result = await generateHabitSuggestions({
        category,
        goal,
        currentHabits: habits.map((habit) => habit.title),
      });

      res.render("habits/ai", {
        title: "ИИ-помощник привычек",
        categories: CATEGORY_LABELS,
        selectedCategory: category,
        goal,
        habits,
        result,
      });
    } catch (error) {
      console.error("Ошибка генерации ИИ-рекомендаций:", error);
      req.flash("error", "Не удалось сгенерировать рекомендации");
      res.redirect("/habits/ai");
    }
  },


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
      suggestedHabit: {
        title: req.query.title || "",
        category: req.query.category || "",
      },
    });
  },


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


      await checkAchievements(req.currentUser.id);

      req.flash("success", `Привычка "${habit.title}" успешно создана!`);
      res.redirect(`/habits/${habit.id}`);
    } catch (error) {
      console.error("Ошибка создания привычки:", error);
      req.flash("error", "Не удалось создать привычку");
      res.redirect("/habits/new");
    }
  },


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


      const checkins = await Checkin.findAll({
        where: { habitId: habit.id },
        order: [["date", "DESC"]],
        limit: 10,
      });
      await attachHabitProgress(habit);

      res.render("habits/show", {
        title: habit.title,
        habit,
        checkins,
        progressPercentage: habit.getDataValue('progressPercentage'),
        periodValue: habit.getDataValue('periodValue'),
      });
    } catch (error) {
      console.error("Ошибка загрузки привычки:", error);
      req.flash("error", "Не удалось загрузить привычку");
      res.redirect("/habits");
    }
  },


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


      await sequelize.transaction(async (transaction) => {
        await Checkin.destroy({
          where: { habitId: habit.id },
          transaction
        });

        await habit.destroy({ transaction });
      });

      console.log('Привычка и связанные checkins удалены:', habit.id);

      req.flash('success', `Привычка "${habit.title}" успешно удалена`);


      if (wantsJson(req)) {
        return res.json({ success: true, message: 'Привычка удалена' });
      }


      res.redirect('/habits');
    } catch (error) {
      console.error('Ошибка удаления привычки:', error);
      console.error('Полная ошибка:', error.stack);


      if (wantsJson(req)) {
        return res.status(500).json({
          success: false,
          error: 'Не удалось удалить привычку'
        });
      }


      req.flash('error', 'Не удалось удалить привычку. У привычки есть связанные записи.');
      res.redirect('/habits');
    }
  },


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

      await attachHabitProgress(habit);

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


      await Checkin.create({
        habitId: habit.id,
        userId: req.currentUser.id,
        value: parseFloat(value),
        date: date ? new Date(date) : new Date(),
        notes: notes || "",
      });


      await habit.markCompleted();


      const pointsEarned = getCheckinEcoPoints(habit.category, value);


      await req.currentUser.addEcoPoints(pointsEarned);


      await checkAchievements(req.currentUser.id);

      req.flash("success", `Выполнение отмечено! +${pointsEarned} эко-очков`);
      res.redirect(`/habits/${habit.id}`);
    } catch (error) {
      console.error("Ошибка отметки выполнения:", error);
      req.flash("error", "Не удалось отметить выполнение");
      res.redirect(`/habits/${req.params.id}/check`);
    }
  },


  undoCheckin: async (req, res) => {
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

      const checkin = await Checkin.findOne({
        where: {
          id: req.params.checkinId,
          habitId: habit.id,
          userId: req.currentUser.id,
        },
      });

      if (!checkin) {
        req.flash("error", "Выполнение не найдено или уже отменено");
        return res.redirect(`/habits/${habit.id}`);
      }

      const pointsToRevoke = getCheckinEcoPoints(habit.category, checkin.value);
      await checkin.destroy();
      await habit.recalculateStats();
      await subtractUserEcoPoints(req.currentUser.id, pointsToRevoke);

      req.flash("success", `Выполнение отменено. Списано ${pointsToRevoke} эко-очков`);
      res.redirect(`/habits/${habit.id}`);
    } catch (error) {
      console.error("Ошибка отмены выполнения:", error);
      req.flash("error", "Не удалось отменить выполнение");
      res.redirect(`/habits/${req.params.id}`);
    }
  },


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

    const checkinsToRemove = await Checkin.findAll({
      where: {
        habitId: habit.id,
        userId: req.currentUser.id
      },
      attributes: ['value']
    });
    const pointsToRevoke = checkinsToRemove.reduce((total, checkin) => (
      total + getCheckinEcoPoints(habit.category, checkin.value)
    ), 0);

    await Checkin.destroy({
      where: {
        habitId: habit.id,
        userId: req.currentUser.id
      }
    });

    await subtractUserEcoPoints(req.currentUser.id, pointsToRevoke);

    await habit.update({
      currentStreak: 0,
      bestStreak: 0,
      totalCompletions: 0,
      lastCompleted: null
    });

    const remainingCheckins = await Checkin.findAll({
      where: { userId: req.currentUser.id },
      attributes: ['date'],
      order: [['date', 'ASC']]
    });

    const user = await User.findByPk(req.currentUser.id);
    if (user) {
      user.currentStreak = calculateUserStreakFromCheckins(remainingCheckins);
      user.lastActive = remainingCheckins.length
        ? new Date(Math.max(...remainingCheckins.map((checkin) => new Date(checkin.date).getTime())))
        : new Date();
      await user.save();
    }

    res.json({ success: true, message: 'Статистика сброшена' });
  } catch (error) {
    console.error('Ошибка сброса статистики:', error);
    res.status(500).json({ error: 'Не удалось сбросить статистику' });
  }
}

};



async function checkAchievements(userId) {
  try {
    console.log(`🔍 Проверяем достижения для пользователя ${userId}...`);

    const achievements = await Achievement.findAll({
      order: [
        ['points', 'ASC'],
        ['id', 'ASC']
      ]
    });
    const user = await User.findByPk(userId);

    if (!user) {
      console.error('Пользователь не найден для проверки достижений');
      return;
    }

    console.log(`👤 Пользователь: ${user.username}, Очки: ${user.ecoPoints}, Серия: ${user.currentStreak}`);

    for (const achievement of achievements) {
      try {
        console.log(`📊 Проверяем достижение: ${achievement.title} (${achievement.conditionType})`);

        const earned = await achievement.checkEarned(userId);
        console.log(`   Условие выполнено: ${earned}`);

        if (!earned) {
          continue;
        }

        console.log(`🎉 Пользователь ${user.username} заработал достижение: ${achievement.title} (+${achievement.points} очков)`);

        await achievement.grantToUser(userId);

        console.log('   ✅ Достижение выдано, очки начислены');
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

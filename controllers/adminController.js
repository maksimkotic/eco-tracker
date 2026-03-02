const {
  User,
  Role,
  Habit,
  UserAchievement,
  Achievement,
  Checkin,
  sequelize // Добавьте это
} = require("../models");
const { Op } = require("sequelize");
const bcrypt = require("bcrypt");
const logger = require('../utils/logger');

const adminController = {
  // Панель администратора
  dashboard: async (req, res) => {
    try {
      // Основная статистика
      const stats = {
        totalUsers: await User.count(),
        newUsersToday: await User.count({
          where: {
            createdAt: {
              [Op.gte]: new Date(new Date() - 24 * 60 * 60 * 1000),
            },
          },
        }),
        activeUsers: await User.count({
          where: {
            lastActive: {
              [Op.gte]: new Date(new Date() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        totalHabits: await Habit.count(),
        usersByRole: {},
      };

      // Статистика по ролям
      const roles = await Role.findAll();
      for (const role of roles) {
        stats.usersByRole[role.name] = await User.count({
          where: { roleId: role.id },
        });
      }

      // Последние пользователи
      const recentUsers = await User.findAll({
        include: [
          {
            model: Role,
            as: "Role",
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: 10,
      });

      // Информация о системе
      const systemInfo = {
        startDate: "2024-01-01",
        dbSize: "~5 MB",
        uptime: "24 дня",
      };

      res.render("admin/dashboard", {
        title: "Панель администратора",
        stats,
        recentUsers,
        roles,
        systemInfo,
      });
    } catch (error) {
      console.error("Ошибка загрузки панели администратора:", error);
      req.flash("error", "Не удалось загрузить панель администратора");
      res.redirect("/profile");
    }
  },

  // Управление пользователями
  usersIndex: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 20;
      const offset = (page - 1) * limit;
      const search = req.query.search || "";
      const roleFilter = req.query.role;
      const statusFilter = req.query.status;

      let whereCondition = {};

      // Поиск
      if (search) {
        whereCondition[Op.or] = [
          { username: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
        ];
      }

      // Фильтр по роли
      if (roleFilter && roleFilter !== "all") {
        const role = await Role.findOne({ where: { name: roleFilter } });
        if (role) {
          whereCondition.roleId = role.id;
        }
      }

      // Фильтр по статусу
      if (statusFilter === "active") {
        whereCondition.lastActive = {
          [Op.gte]: new Date(new Date() - 7 * 24 * 60 * 60 * 1000),
        };
      } else if (statusFilter === "inactive") {
        whereCondition.lastActive = {
          [Op.lt]: new Date(new Date() - 30 * 24 * 60 * 60 * 1000),
        };
      } else if (statusFilter === "banned") {
        whereCondition.isBanned = true;
      }

      const { count, rows: users } = await User.findAndCountAll({
        where: whereCondition,
        include: [
          {
            model: Role,
            as: "Role",
          },
        ],
        attributes: { exclude: ["passwordHash"] },
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });

      const roles = await Role.findAll();

      res.render("admin/users/index", {
        title: "Управление пользователями",
        users,
        roles,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalUsers: count,
        filters: { search, role: roleFilter, status: statusFilter },
      });
    } catch (error) {
      console.error("Ошибка загрузки пользователей:", error);
      req.flash("error", "Не удалось загрузить пользователей");
      res.redirect("/admin");
    }
  },

  // Детали пользователя
  showUser: async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id, {
        include: [
          {
            model: Role,
            as: "Role",
          },
          {
            model: Habit,
            as: "Habits",
            limit: 10,
            order: [["createdAt", "DESC"]],
          },
          {
            model: UserAchievement,
            as: "UserAchievements",
            include: [
              {
                model: Achievement,
                as: "Achievement",
              },
            ],
            limit: 10,
            order: [["earnedAt", "DESC"]],
          },
        ],
        attributes: { exclude: ["passwordHash"] },
      });

      if (!user) {
        req.flash("error", "Пользователь не найден");
        return res.redirect("/admin/users");
      }

      // Статистика пользователя
      const stats = {
        totalHabits: await Habit.count({ where: { userId: user.id } }),
        activeHabits: await Habit.count({
          where: { userId: user.id, isActive: true },
        }),
        totalAchievements: await UserAchievement.count({
          where: { userId: user.id },
        }),
        totalCheckins: 0, // Здесь можно добавить подсчет отметок выполнения
      };

      const roles = await Role.findAll();

      res.render("admin/users/show", {
        title: `Пользователь: ${user.username}`,
        user,
        stats,
        roles,
      });
    } catch (error) {
      console.error("Ошибка загрузки пользователя:", error);
      req.flash("error", "Не удалось загрузить данные пользователя");
      res.redirect("/admin/users");
    }
  },

  // Изменение роли пользователя
  updateUserRole: async (req, res) => {
    try {
      const { roleId } = req.body;
      const userId = req.params.id;

      const user = await User.findByPk(userId);
      const role = await Role.findByPk(roleId);

      if (!user || !role) {
        req.flash("error", "Пользователь или роль не найдены");
        return res.redirect("/admin/users");
      }

      // Нельзя изменить роль самого себя
      if (user.id === req.currentUser.id) {
        req.flash("error", "Нельзя изменить свою собственную роль");
        return res.redirect("/admin/users");
      }

      await user.update({ roleId });

      // Обновляем сессию пользователя, если он онлайн
      // В реальном приложении здесь была бы система уведомлений

      console.log(
        `Администратор ${req.currentUser.username} изменил роль пользователя ${user.username} на ${role.name}`
      );

      req.flash(
        "success",
        `Роль пользователя ${user.username} изменена на "${role.name}"`
      );
      res.redirect(`/admin/users/${userId}`);
    } catch (error) {
      console.error("Ошибка изменения роли:", error);
      req.flash("error", "Не удалось изменить роль пользователя");
      res.redirect("/admin/users");
    }
  },

  // Блокировка/разблокировка пользователя
  toggleBan: async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id);

      if (!user) {
        req.flash("error", "Пользователь не найден");
        return res.redirect("/admin/users");
      }

      // Нельзя заблокировать самого себя
      if (user.id === req.currentUser.id) {
        req.flash("error", "Нельзя заблокировать свой собственный аккаунт");
        return res.redirect("/admin/users");
      }

      const newStatus = !user.isBanned;
      await user.update({ isBanned: newStatus });

      // Если пользователь заблокирован, завершаем его сессии
      if (newStatus) {
        // В реальном приложении здесь была бы очистка активных сессий
      }

      console.log(
        `Администратор ${req.currentUser.username} ${
          newStatus ? "заблокировал" : "разблокировал"
        } пользователя ${user.username}`
      );

      req.flash(
        "success",
        `Пользователь ${user.username} успешно ${
          newStatus ? "заблокирован" : "разблокирован"
        }`
      );
      res.redirect(`/admin/users/${user.id}`);
    } catch (error) {
      console.error("Ошибка блокировки пользователя:", error);
      req.flash("error", "Не удалось изменить статус пользователя");
      res.redirect("/admin/users");
    }
  },

  // Сброс пароля пользователя
  resetPassword: async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id);

      if (!user) {
        req.flash("error", "Пользователь не найден");
        return res.redirect("/admin/users");
      }

      // Генерируем временный пароль
      const tempPassword = Math.random().toString(36).slice(-8);

      // Устанавливаем новый пароль
      user.password = tempPassword;
      await user.save();

      console.log(
        `Администратор ${req.currentUser.username} сбросил пароль пользователя ${user.username}`
      );

      // В реальном приложении здесь была бы отправка email с временным паролем

      req.flash(
        "success",
        `Пароль пользователя ${user.username} сброшен. Временный пароль: ${tempPassword}`
      );
      res.redirect(`/admin/users/${user.id}`);
    } catch (error) {
      console.error("Ошибка сброса пароля:", error);
      req.flash("error", "Не удалось сбросить пароль");
      res.redirect("/admin/users");
    }
  },

  // Удаление пользователя
  destroyUser: async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id);

      if (!user) {
        req.flash("error", "Пользователь не найден");
        return res.redirect("/admin/users");
      }

      // Нельзя удалить самого себя
      if (user.id === req.currentUser.id) {
        req.flash("error", "Нельзя удалить свой собственный аккаунт");
        return res.redirect("/admin/users");
      }

      const username = user.username;

      // Временное отключение проверки внешних ключей
      await sequelize.query("PRAGMA foreign_keys = OFF");

      try {
        // 1. Удаляем все checkins пользователя
        await Checkin.destroy({
          where: { userId: user.id },
        });

        // 2. Получаем все привычки пользователя и удаляем их checkins
        const userHabits = await Habit.findAll({
          where: { userId: user.id },
        });

        for (const habit of userHabits) {
          await Checkin.destroy({
            where: { habitId: habit.id },
          });
        }

        // 3. Удаляем привычки пользователя
        await Habit.destroy({
          where: { userId: user.id },
        });

        // 4. Удаляем достижения пользователя
        await UserAchievement.destroy({
          where: { userId: user.id },
        });

        // 5. Удаляем самого пользователя
        await user.destroy();
      } finally {
        // Включаем проверку внешних ключей обратно
        await sequelize.query("PRAGMA foreign_keys = ON");
      }

      console.log(
        `Администратор ${req.currentUser.username} удалил пользователя ${username}`
      );

      req.flash(
        "success",
        `Пользователь ${username} и все его данные успешно удалены`
      );

      // Для AJAX запросов
      if (req.xhr || req.headers.accept.indexOf("json") > -1) {
        return res.json({ success: true, message: "Пользователь удален" });
      }

      // Для обычных запросов
      res.redirect("/admin/users");
    } catch (error) {
      console.error("Ошибка удаления пользователя:", error);

      // Убедимся, что проверка внешних ключей включена
      try {
        await sequelize.query("PRAGMA foreign_keys = ON");
      } catch (e) {}

      let errorMessage = "Не удалось удалить пользователя";

      if (error.name === "SequelizeForeignKeyConstraintError") {
        errorMessage =
          "Ошибка удаления: есть связанные данные. Попробуйте использовать очистку данных перед удалением.";
      }

      // Для AJAX
      if (req.xhr || req.headers.accept.indexOf("json") > -1) {
        return res.status(500).json({
          success: false,
          error: errorMessage,
        });
      }

      // Для обычных запросов
      req.flash("error", errorMessage);
      res.redirect("/admin/users");
    }
  },

  // Управление ролями
  rolesIndex: async (req, res) => {
    try {
      const roles = await Role.findAll({
        order: [["name", "ASC"]],
      });

      // Права доступа для отображения
      const permissions = {
        user: [
          "view_profile",
          "edit_own_profile",
          "create_habit",
          "edit_own_habit",
          "delete_own_habit",
          "view_achievements",
        ],
        moderator: [
          "view_all_habits",
          "edit_any_habit",
          "delete_any_habit",
          "create_achievement",
          "edit_achievement",
          "delete_achievement",
          "assign_achievement",
        ],
        admin: [
          "view_all_users",
          "edit_user_role",
          "delete_user",
          "ban_user",
          "view_system_logs",
        ],
      };

      res.render("admin/roles/index", {
        title: "Управление ролями",
        roles,
        permissions,
      });
    } catch (error) {
      console.error("Ошибка загрузки ролей:", error);
      req.flash("error", "Не удалось загрузить роли");
      res.redirect("/admin");
    }
  },

  // Создание роли
  createRole: async (req, res) => {
    try {
      const { name, description, permissions } = req.body;

      // Проверяем, существует ли роль с таким именем
      const existingRole = await Role.findOne({ where: { name } });
      if (existingRole) {
        req.flash("error", "Роль с таким именем уже существует");
        return res.redirect("/admin/roles");
      }

      // Парсим разрешения
      const permissionsObj = {};
      if (permissions && Array.isArray(permissions)) {
        permissions.forEach((perm) => {
          permissionsObj[perm] = true;
        });
      }

      await Role.create({
        name,
        description: description || "",
        permissions: permissionsObj,
      });

      console.log(
        `Администратор ${req.currentUser.username} создал новую роль "${name}"`
      );

      req.flash("success", `Роль "${name}" успешно создана`);
      res.redirect("/admin/roles");
    } catch (error) {
      console.error("Ошибка создания роли:", error);
      req.flash("error", "Не удалось создать роль");
      res.redirect("/admin/roles");
    }
  },

  // Логи системы
  showLogs: async (req, res) => {
    try {
      const logs = await logger.getLogs(req.query);

      res.render("admin/logs", {
        title: "Системные логи",
        logs,
        filters: req.query,
      });
    } catch (error) {
      console.error("Ошибка загрузки логов:", error);
      req.flash("error", "Не удалось загрузить логи");
      res.redirect("/admin");
    }
  },

  clearLogs: async (req, res) => {
    try {
      await logger.clearLogs();

      req.flash("success", "Логи успешно очищены");
      res.redirect("/admin/logs");
    } catch (error) {
      console.error("Ошибка очистки логов:", error);
      req.flash("error", "Не удалось очистить логи");
      res.redirect("/admin/logs");
    }
  },

  // Создание пользователя (админом)
  createUser: async (req, res) => {
    try {
      const { username, email, password, roleId } = req.body;

      // Проверяем существование пользователя
      const existingUser = await User.findOne({
        where: { [Op.or]: [{ username }, { email }] },
      });

      if (existingUser) {
        req.flash(
          "error",
          "Пользователь с таким именем или email уже существует"
        );
        return res.redirect("/admin/users");
      }

      // Хешируем пароль перед созданием
      const passwordHash = await bcrypt.hash(password, 10);

      // Создаем пользователя с хешированным паролем
      const user = await User.create({
        username,
        email,
        passwordHash, // Используем хешированный пароль
        roleId: parseInt(roleId),
        avatar: "default-avatar.png",
      });

      console.log(
        `Администратор ${req.currentUser.username} создал пользователя ${username}`
      );

      req.flash("success", `Пользователь ${username} успешно создан`);
      res.redirect(`/admin/users/${user.id}`);
    } catch (error) {
      console.error("Ошибка создания пользователя:", error);
      
      // Более информативное сообщение об ошибке
      let errorMessage = "Не удалось создать пользователя";
      
      if (error.name === 'SequelizeValidationError') {
        const messages = error.errors.map(err => err.message);
        errorMessage = `Ошибка валидации: ${messages.join(', ')}`;
      }
      
      req.flash("error", errorMessage);
      res.redirect("/admin/users");
    }
  },
  // Редактирование пользователя
  editUser: async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id, {
        include: [{ model: Role, as: "Role" }],
        attributes: { exclude: ["passwordHash"] },
      });

      if (!user) {
        req.flash("error", "Пользователь не найден");
        return res.redirect("/admin/users");
      }

      const roles = await Role.findAll();

      res.render("admin/users/edit", {
        title: `Редактирование: ${user.username}`,
        user,
        roles,
      });
    } catch (error) {
      console.error("Ошибка загрузки пользователя:", error);
      req.flash("error", "Не удалось загрузить пользователя");
      res.redirect("/admin/users");
    }
  },

  // Обновление пользователя
  updateUser: async (req, res) => {
    try {
      const { username, email, roleId, ecoPoints, level, isBanned } = req.body;
      const userId = req.params.id;

      const user = await User.findByPk(userId);

      if (!user) {
        req.flash("error", "Пользователь не найден");
        return res.redirect("/admin/users");
      }

      // Нельзя редактировать самого себя (кроме некоторых полей)
      if (user.id === req.currentUser.id) {
        req.flash(
          "error",
          "Нельзя редактировать свой собственный аккаунт через админку"
        );
        return res.redirect(`/admin/users/${userId}`);
      }

      await user.update({
        username,
        email,
        roleId: parseInt(roleId),
        ecoPoints: parseInt(ecoPoints),
        level: parseInt(level),
        isBanned: isBanned === "on",
      });

      console.log(
        `Администратор ${req.currentUser.username} отредактировал пользователя ${username}`
      );

      req.flash("success", "Данные пользователя обновлены");
      res.redirect(`/admin/users/${userId}`);
    } catch (error) {
      console.error("Ошибка обновления пользователя:", error);
      req.flash("error", "Не удалось обновить пользователя");
      res.redirect(`/admin/users/${req.params.id}/edit`);
    }
  },

  // Редактирование роли
  editRole: async (req, res) => {
    try {
      const role = await Role.findByPk(req.params.id);

      if (!role) {
        req.flash("error", "Роль не найдена");
        return res.redirect("/admin/roles");
      }

      res.render("admin/roles/edit", {
        title: `Редактирование роли: ${role.name}`,
        role,
      });
    } catch (error) {
      console.error("Ошибка загрузки роли:", error);
      req.flash("error", "Не удалось загрузить роль");
      res.redirect("/admin/roles");
    }
  },

  // Обновление роли
  updateRole: async (req, res) => {
    try {
      const { name, description, permissions } = req.body;
      const roleId = req.params.id;

      const role = await Role.findByPk(roleId);

      if (!role) {
        req.flash("error", "Роль не найдена");
        return res.redirect("/admin/roles");
      }

      // Парсим разрешения
      const permissionsObj = {};
      if (permissions && Array.isArray(permissions)) {
        permissions.forEach((perm) => {
          permissionsObj[perm] = true;
        });
      }

      await role.update({
        name,
        description: description || "",
        permissions: permissionsObj,
      });

      console.log(
        `Администратор ${req.currentUser.username} обновил роль "${name}"`
      );

      req.flash("success", "Роль успешно обновлена");
      res.redirect("/admin/roles");
    } catch (error) {
      console.error("Ошибка обновления роли:", error);
      req.flash("error", "Не удалось обновить роль");
      res.redirect(`/admin/roles/${req.params.id}/edit`);
    }
  },

  // Удаление роли
  deleteRole: async (req, res) => {
    try {
      const role = await Role.findByPk(req.params.id);

      if (!role) {
        req.flash("error", "Роль не найдена");
        return res.redirect("/admin/roles");
      }

      // Нельзя удалить стандартные роли
      if (["user", "moderator", "admin"].includes(role.name)) {
        req.flash("error", "Нельзя удалить стандартную роль");
        return res.redirect("/admin/roles");
      }

      // Переводим всех пользователей с этой ролью в роль "user"
      const userRole = await Role.findOne({ where: { name: "user" } });
      await User.update(
        { roleId: userRole.id },
        { where: { roleId: role.id } }
      );

      await role.destroy();

      console.log(
        `Администратор ${req.currentUser.username} удалил роль "${role.name}"`
      );

      req.flash(
        "success",
        `Роль "${role.name}" удалена. Все пользователи переведены в роль "user".`
      );
      res.redirect("/admin/roles");
    } catch (error) {
      console.error("Ошибка удаления роли:", error);
      req.flash("error", "Не удалось удалить роль");
      res.redirect("/admin/roles");
    }
  },

  // API для получения логов (реальная реализация)
  getLogsApi: async (req, res) => {
    try {
      // В реальном приложении здесь была бы загрузка логов из БД или файлов
      const logs = await getSystemLogs(req.query); // Предполагаемая функция

      res.json({
        success: true,
        logs,
        total: logs.length,
      });
    } catch (error) {
      console.error("Ошибка получения логов:", error);
      res.status(500).json({
        success: false,
        error: "Ошибка получения логов",
      });
    }
  },

  // Экспорт логов
  exportLogs: async (req, res) => {
    try {
      const logs = await getSystemLogs(req.query); // Предполагаемая функция

      // Формируем CSV
      const csv = convertToCSV(logs); // Предполагаемая функция

      res.header("Content-Type", "text/csv");
      res.attachment(`logs-${new Date().toISOString().split("T")[0]}.csv`);
      res.send(csv);
    } catch (error) {
      console.error("Ошибка экспорта логов:", error);
      req.flash("error", "Ошибка экспорта логов");
      res.redirect("/admin/logs");
    }
  },
};

module.exports = adminController;

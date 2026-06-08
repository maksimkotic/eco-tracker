const {
  User,
  Role,
  Habit,
  UserAchievement,
  Achievement,
  Checkin,
  sequelize
} = require("../models");
const { Op } = require("sequelize");
const bcrypt = require("../utils/passwordHash");
const logger = require('../utils/logger');
const packageJson = require('../package.json');
const { getSettings, updateSettingsFromBody, HABIT_CATEGORIES, calculateLevel } = require('../services/settingsService');

const appStartedAt = new Date();

const formatUptime = (totalSeconds) => {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days} дн.`);
  if (hours > 0) parts.push(`${hours} ч.`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} мин.`);

  return parts.join(' ');
};

const getDatabaseSize = async () => {
  if (sequelize.getDialect() !== 'postgres') {
    return 'Недоступно для текущей БД';
  }

  try {
    const [rows] = await sequelize.query(
      'SELECT pg_size_pretty(pg_database_size(current_database())) AS size'
    );
    return rows?.[0]?.size || 'Недоступно';
  } catch (error) {
    console.error('Ошибка получения размера базы данных:', error);
    return 'Недоступно';
  }
};

const wantsJson = (req) =>
  req.xhr || (typeof req.get === 'function' && (req.get('accept') || '').includes('json'));

const adminController = {

  dashboard: async (req, res) => {
    try {

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


      const roles = await Role.findAll();
      for (const role of roles) {
        stats.usersByRole[role.name] = await User.count({
          where: { roleId: role.id },
        });
      }


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


      const systemInfo = {
        version: packageJson.version,
        startDate: appStartedAt.toLocaleDateString('ru-RU'),
        dbSize: await getDatabaseSize(),
        uptime: formatUptime(process.uptime()),
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


  usersIndex: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 20;
      const offset = (page - 1) * limit;
      const search = req.query.search || "";
      const roleFilter = req.query.role;
      const statusFilter = req.query.status;

      let whereCondition = {};


      if (search) {
        whereCondition[Op.or] = [
          { username: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
        ];
      }


      if (roleFilter && roleFilter !== "all") {
        const role = await Role.findOne({ where: { name: roleFilter } });
        if (role) {
          whereCondition.roleId = role.id;
        }
      }


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


      const stats = {
        totalHabits: await Habit.count({ where: { userId: user.id } }),
        activeHabits: await Habit.count({
          where: { userId: user.id, isActive: true },
        }),
        totalAchievements: await UserAchievement.count({
          where: { userId: user.id },
        }),
        totalCheckins: 0,
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


      if (user.id === req.currentUser.id) {
        req.flash("error", "Нельзя изменить свою собственную роль");
        return res.redirect("/admin/users");
      }

      const settings = await getSettings();
      if (settings.security.preventLastAdminRemoval && user.roleId !== role.id) {
        const currentRole = await Role.findByPk(user.roleId);
        if (currentRole && currentRole.name === "admin") {
          const adminCount = await User.count({ where: { roleId: currentRole.id, isBanned: false } });
          if (adminCount <= 1) {
            req.flash("error", "Нельзя снять роль у последнего активного администратора");
            return res.redirect("/admin/users");
          }
        }
      }

      await user.update({ roleId });




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


  toggleBan: async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id);

      if (!user) {
        req.flash("error", "Пользователь не найден");
        return res.redirect("/admin/users");
      }


      if (user.id === req.currentUser.id) {
        req.flash("error", "Нельзя заблокировать свой собственный аккаунт");
        return res.redirect("/admin/users");
      }

      const newStatus = !user.isBanned;
      await user.update({ isBanned: newStatus });


      if (newStatus) {

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


  resetPassword: async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id);

      if (!user) {
        if (wantsJson(req)) {
          return res.status(404).json({ success: false, error: "Пользователь не найден" });
        }
        req.flash("error", "Пользователь не найден");
        return res.redirect("/admin/users");
      }


      const settings = await getSettings();
      if (settings.users.passwordResetMode === "manual_admin") {
        req.flash("info", "Сброс пароля переведен в ручной режим. Свяжитесь с пользователем и задайте новый пароль через защищенный процесс.");
        return res.redirect(`/admin/users/${user.id}`);
      }

      const tempPassword = Math.random().toString(36).slice(-8);


      user.password = tempPassword;
      await user.save();

      console.log(
        `Администратор ${req.currentUser.username} сбросил пароль пользователя ${user.username}`
      );



      req.flash(
        "success",
        `Пароль пользователя ${user.username} сброшен. Временный пароль: ${tempPassword}`
      );

      if (wantsJson(req)) {
        return res.json({
          success: true,
          message: "Пароль сброшен",
          password: tempPassword,
        });
      }

      res.redirect(`/admin/users/${user.id}`);
    } catch (error) {
      console.error("Ошибка сброса пароля:", error);
      if (wantsJson(req)) {
        return res.status(500).json({ success: false, error: "Не удалось сбросить пароль" });
      }
      req.flash("error", "Не удалось сбросить пароль");
      res.redirect("/admin/users");
    }
  },


  destroyUser: async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id);

      if (!user) {
        req.flash("error", "Пользователь не найден");
        return res.redirect("/admin/users");
      }


      if (user.id === req.currentUser.id) {
        req.flash("error", "Нельзя удалить свой собственный аккаунт");
        return res.redirect("/admin/users");
      }

      const username = user.username;
      const settings = await getSettings();

      if (settings.security.preventLastAdminRemoval) {
        const adminRole = await Role.findOne({ where: { name: "admin" } });
        if (adminRole && user.roleId === adminRole.id) {
          const adminCount = await User.count({ where: { roleId: adminRole.id, isBanned: false } });
          if (adminCount <= 1) {
            req.flash("error", "Нельзя удалить последнего активного администратора");
            return res.redirect("/admin/users");
          }
        }
      }

      if (settings.users.deletionPolicy === "ban_only") {
        await user.update({ isBanned: true });
        req.flash("success", `Пользователь ${username} заблокирован согласно политике удаления`);
        return res.redirect("/admin/users");
      }

      if (settings.users.deletionPolicy === "anonymize") {
        await user.update({
          username: `deleted_user_${user.id}`,
          email: `deleted_${user.id}@anonymized.local`,
          avatar: "default-avatar.png",
          isBanned: true
        });
        req.flash("success", `Пользователь ${username} анонимизирован согласно политике удаления`);
        return res.redirect("/admin/users");
      }


      await sequelize.transaction(async (transaction) => {
        await Checkin.destroy({
          where: { userId: user.id },
          transaction,
        });

        await Habit.destroy({
          where: { userId: user.id },
          transaction,
        });

        await UserAchievement.destroy({
          where: { userId: user.id },
          transaction,
        });

        await user.destroy({ transaction });
      });

      console.log(
        `Администратор ${req.currentUser.username} удалил пользователя ${username}`
      );

      req.flash(
        "success",
        `Пользователь ${username} и все его данные успешно удалены`
      );


      if (wantsJson(req)) {
        return res.json({ success: true, message: "Пользователь удален" });
      }


      res.redirect("/admin/users");
    } catch (error) {
      console.error("Ошибка удаления пользователя:", error);

      let errorMessage = "Не удалось удалить пользователя";

      if (error.name === "SequelizeForeignKeyConstraintError") {
        errorMessage =
          "Ошибка удаления: есть связанные данные. Попробуйте использовать очистку данных перед удалением.";
      }


      if (wantsJson(req)) {
        return res.status(500).json({
          success: false,
          error: errorMessage,
        });
      }


      req.flash("error", errorMessage);
      res.redirect("/admin/users");
    }
  },


  rolesIndex: async (req, res) => {
    try {
      const roles = await Role.findAll({
        order: [["name", "ASC"]],
      });


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


  createRole: async (req, res) => {
    try {
      const { name, description, permissions } = req.body;
      const settings = await getSettings();

      if (!settings.users.allowCustomRoles) {
        req.flash("error", "Создание кастомных ролей отключено в настройках");
        return res.redirect("/admin/roles");
      }


      const existingRole = await Role.findOne({ where: { name } });
      if (existingRole) {
        req.flash("error", "Роль с таким именем уже существует");
        return res.redirect("/admin/roles");
      }


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



  settings: async (req, res) => {
    try {
      const settings = await getSettings();
      const roles = await Role.findAll({ order: [["name", "ASC"]] });

      res.render("admin/settings", {
        title: "Настройки системы",
        settings,
        roles,
        habitCategories: HABIT_CATEGORIES,
      });
    } catch (error) {
      console.error("Ошибка загрузки настроек:", error);
      req.flash("error", "Не удалось загрузить настройки");
      res.redirect("/admin");
    }
  },

  updateSettings: async (req, res) => {
    try {
      await updateSettingsFromBody(req.body);

      console.log(`Администратор ${req.currentUser.username} обновил системные настройки`);
      req.flash("success", "Настройки успешно сохранены");
      res.redirect("/admin/settings");
    } catch (error) {
      console.error("Ошибка сохранения настроек:", error);
      req.flash("error", "Не удалось сохранить настройки");
      res.redirect("/admin/settings");
    }
  },

  runMaintenance: async (req, res) => {
    try {
      const { action } = req.body;
      const settings = await getSettings();
      let message = "Обслуживание завершено";

      if (action === "recalculate_habits") {
        const habits = await Habit.findAll();
        for (const habit of habits) {
          await habit.recalculateStats();
        }
        message = `Пересчитана статистика привычек: ${habits.length}`;
      } else if (action === "recalculate_levels") {
        const users = await User.findAll();
        for (const user of users) {
          await user.update({
            level: calculateLevel(user.ecoPoints, settings.gamification.pointsPerLevel)
          });
        }
        message = `Пересчитаны уровни пользователей: ${users.length}`;
      } else if (action === "check_achievements") {
        if (!settings.gamification.achievementsEnabled) {
          message = "Автопроверка достижений отключена в настройках геймификации";
        } else {
          const users = await User.findAll({ attributes: ["id"] });
          const achievements = await Achievement.findAll({
            where: settings.gamification.hiddenAchievementsEnabled ? {} : { isHidden: false },
            order: [["points", "ASC"], ["id", "ASC"]]
          });
          let grantedCount = 0;

          for (const user of users) {
            for (const achievement of achievements) {
              const earned = await achievement.checkEarned(user.id);
              if (earned) {
                const granted = await achievement.grantToUser(user.id);
                if (granted) grantedCount += 1;
              }
            }
          }

          message = `Проверка достижений завершена. Обработано пользователей: ${users.length}, достижений выдано/найдено: ${grantedCount}`;
        }
      } else if (action === "health_check") {
        await sequelize.authenticate();
        message = "Проверка здоровья пройдена: база данных доступна";
      } else {
        message = "Выберите действие обслуживания";
      }

      console.log(`Администратор ${req.currentUser.username} запустил обслуживание: ${action}`);

      if (wantsJson(req)) {
        return res.json({ success: true, message });
      }

      req.flash("success", message);
      return res.redirect("/admin/settings#system");
    } catch (error) {
      console.error("Ошибка обслуживания системы:", error);
      if (wantsJson(req)) {
        return res.status(500).json({ success: false, error: "Не удалось выполнить обслуживание" });
      }
      req.flash("error", "Не удалось выполнить обслуживание");
      return res.redirect("/admin/settings#system");
    }
  },

  showLogs: (req, res) => {
    res.render("admin/logs", {
      title: "Системные логи",
    });
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


  createUser: async (req, res) => {
    try {
      const { username, email, password, roleId } = req.body;


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


      const passwordHash = await bcrypt.hash(password, 10);


      const user = await User.create({
        username,
        email,
        passwordHash,
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


      let errorMessage = "Не удалось создать пользователя";

      if (error.name === 'SequelizeValidationError') {
        const messages = error.errors.map(err => err.message);
        errorMessage = `Ошибка валидации: ${messages.join(', ')}`;
      }

      req.flash("error", errorMessage);
      res.redirect("/admin/users");
    }
  },

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


  updateUser: async (req, res) => {
    try {
      const { username, email, roleId, ecoPoints, level, isBanned } = req.body;
      const userId = req.params.id;

      const user = await User.findByPk(userId);

      if (!user) {
        req.flash("error", "Пользователь не найден");
        return res.redirect("/admin/users");
      }


      if (user.id === req.currentUser.id) {
        req.flash(
          "error",
          "Нельзя редактировать свой собственный аккаунт через админку"
        );
        return res.redirect(`/admin/users/${userId}`);
      }

      const settings = await getSettings();
      const nextRoleId = parseInt(roleId);
      if (settings.security.preventLastAdminRemoval && user.roleId !== nextRoleId) {
        const currentRole = await Role.findByPk(user.roleId);
        if (currentRole && currentRole.name === "admin") {
          const adminCount = await User.count({ where: { roleId: currentRole.id, isBanned: false } });
          if (adminCount <= 1) {
            req.flash("error", "Нельзя снять роль у последнего активного администратора");
            return res.redirect(`/admin/users/${userId}/edit`);
          }
        }
      }

      await user.update({
        username,
        email,
        roleId: nextRoleId,
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


  updateRole: async (req, res) => {
    try {
      const { name, description, permissions } = req.body;
      const roleId = req.params.id;

      const role = await Role.findByPk(roleId);

      if (!role) {
        req.flash("error", "Роль не найдена");
        return res.redirect("/admin/roles");
      }


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


  deleteRole: async (req, res) => {
    try {
      const role = await Role.findByPk(req.params.id);

      if (!role) {
        if (wantsJson(req)) {
          return res.status(404).json({ success: false, error: "Роль не найдена" });
        }
        req.flash("error", "Роль не найдена");
        return res.redirect("/admin/roles");
      }


      const settings = await getSettings();
      const protectedRoles = settings.users.protectedRoles || ["user", "moderator", "admin"];
      if (protectedRoles.includes(role.name)) {
        if (wantsJson(req)) {
          return res.status(400).json({ success: false, error: "Нельзя удалить стандартную роль" });
        }
        req.flash("error", "Нельзя удалить стандартную роль");
        return res.redirect("/admin/roles");
      }


      const roleName = role.name;
      const userRole = await Role.findOne({ where: { name: "user" } });
      await User.update(
        { roleId: userRole.id },
        { where: { roleId: role.id } }
      );

      await role.destroy();

      console.log(
        `Администратор ${req.currentUser.username} удалил роль "${roleName}"`
      );

      req.flash(
        "success",
        `Роль "${roleName}" удалена. Все пользователи переведены в роль "user".`
      );

      if (wantsJson(req)) {
        return res.json({
          success: true,
          message: `Роль "${roleName}" удалена`,
        });
      }

      res.redirect("/admin/roles");
    } catch (error) {
      console.error("Ошибка удаления роли:", error);
      if (wantsJson(req)) {
        return res.status(500).json({
          success: false,
          error: "Не удалось удалить роль",
        });
      }
      req.flash("error", "Не удалось удалить роль");
      res.redirect("/admin/roles");
    }
  },


  getLogsApi: async (req, res) => {
    try {

      const logs = await getSystemLogs(req.query);

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


  exportLogs: async (req, res) => {
    try {
      const logs = await getSystemLogs(req.query);


      const csv = convertToCSV(logs);

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

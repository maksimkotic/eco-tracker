const { User, Role } = require("../models");
const { validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");

const authController = {
  // Показать форму регистрации
  showRegisterForm: (req, res) => {
    res.render("auth/register", {
      title: "Регистрация",
      oldInput: req.flash("oldInput")[0] || {},
      errors: req.flash("errors") || [],
    });
  },

  // Обработка регистрации
  register: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash("errors", errors.array());
        req.flash("oldInput", req.body);
        return res.redirect("/auth/register");
      }

      const { username, email, password } = req.body;

      // Проверяем, существует ли пользователь
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [{ email: email }, { username: username }],
        },
      });

      if (existingUser) {
        req.flash(
          "error",
          "Пользователь с таким email или именем уже существует"
        );
        req.flash("oldInput", req.body);
        return res.redirect("/auth/register");
      }

      // Получаем роль "user" по умолчанию
      const userRole = await Role.findOne({ where: { name: "user" } });
      if (!userRole) {
        throw new Error("Роль пользователя не найдена в системе");
      }

      // Создаем пользователя
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const user = await User.create({
        username,
        email,
        passwordHash,
        roleId: userRole.id,
        lastActive: new Date(),
      });

      // Создаем сессию
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: "user",
      };

      req.flash(
        "success",
        "Регистрация успешна! Добро пожаловать в Эко-Трекер!"
      );
      res.redirect("/profile");
    } catch (error) {
      console.error("Ошибка регистрации:", error);
      req.flash("error", "Произошла ошибка при регистрации");
      req.flash("oldInput", req.body);
      res.redirect("/auth/register");
    }
  },

  // Показать форму входа
  showLoginForm: (req, res) => {
    res.render("auth/login", {
      title: "Вход в систему",
      error: req.flash("error")[0],
      oldInput: req.flash("oldInput")[0] || {},
    });
  },

  // Обработка входа
  login: async (req, res) => {
    try {
      const { email, password, remember } = req.body;

      // Ищем пользователя
      const user = await User.findOne({
        where: { email },
        include: [
          {
            model: Role,
            as: "Role",
          },
        ],
      });

      if (!user) {
        req.flash("error", "Неверный email или пароль");
        req.flash("oldInput", { email });
        return res.redirect("/auth/login");
      }

      // Проверяем пароль
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        req.flash("error", "Неверный email или пароль");
        req.flash("oldInput", { email });
        return res.redirect("/auth/login");
      }

      // Проверяем, не заблокирован ли пользователь
      if (user.isBanned) {
        req.flash("error", "Ваш аккаунт заблокирован");
        return res.redirect("/auth/login");
      }

      // Создаем сессию
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.Role.name,
      };

      // Настройка куки для "запомнить меня"
      if (remember) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 дней
      }

      // Обновляем время последней активности
      user.lastActive = new Date();
      await user.save();

      req.flash("success", `Добро пожаловать, ${user.username}!`);

      // Перенаправляем в зависимости от роли
      if (user.Role.name === "admin") {
        res.redirect("/admin");
      } else if (user.Role.name === "moderator") {
        res.redirect("/moderator");
      } else {
        res.redirect("/profile");
      }
    } catch (error) {
      console.error("Ошибка входа:", error);
      req.flash("error", "Произошла ошибка при входе в систему");
      res.redirect("/auth/login");
    }
  },

  // Выход из системы
  logout: (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Ошибка при выходе:", err);
        return res.redirect("/profile");
      }
      res.redirect("/");
    });
  },
};

module.exports = authController;

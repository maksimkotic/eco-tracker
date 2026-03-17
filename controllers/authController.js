const { User, Role } = require("../models");
const { validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");

const authController = {

  showRegisterForm: (req, res) => {
    res.render("auth/register", {
      title: "Регистрация",
      oldInput: req.flash("oldInput")[0] || {},
      errors: req.flash("errors") || [],
    });
  },


  register: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash("errors", errors.array());
        req.flash("oldInput", req.body);
        return res.redirect("/auth/register");
      }

      const { username, email, password } = req.body;


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


      const userRole = await Role.findOne({ where: { name: "user" } });
      if (!userRole) {
        throw new Error("Роль пользователя не найдена в системе");
      }


      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const user = await User.create({
        username,
        email,
        passwordHash,
        roleId: userRole.id,
        lastActive: new Date(),
      });


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


  showLoginForm: (req, res) => {
    res.render("auth/login", {
      title: "Вход в систему",
      error: req.flash("error")[0],
      oldInput: req.flash("oldInput")[0] || {},
    });
  },


  login: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash("error", errors.array()[0].msg);
        req.flash("oldInput", { email: req.body.email });
        return res.redirect("/auth/login");
      }

      const { email, password, remember } = req.body;


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


      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        req.flash("error", "Неверный email или пароль");
        req.flash("oldInput", { email });
        return res.redirect("/auth/login");
      }


      if (user.isBanned) {
        req.flash("error", "Ваш аккаунт заблокирован");
        return res.redirect("/auth/login");
      }


      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.Role.name,
      };


      if (remember) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      }


      user.lastActive = new Date();
      await user.save();

      req.flash("success", `Добро пожаловать, ${user.username}!`);


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

const express = require('express');
const session = require('express-session');
const path = require('path');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const rateLimit = require('express-rate-limit');
const expressLayouts = require('express-ejs-layouts');

require('dotenv').config();

const { sequelize } = require('./models');
const { ensureDefaultRoles } = require('./database/bootstrap');
const { loadUser } = require('./middlewares/auth');

// Импорт маршрутов
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/authRoutes');
const habitRoutes = require('./routes/habitRoutes');
const achievementRoutes = require('./routes/achievementRoutes');
const profileRoutes = require('./routes/profileRoutes');
const moderatorRoutes = require('./routes/moderatorRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3001;
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'Слишком много запросов с этого IP, попробуйте позже.'
});

const securityHeaders = (req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' 'unsafe-inline' localhost:*; " +
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
      "font-src 'self' data: https://cdn.jsdelivr.net; " +
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
      "img-src 'self' data: https:;" +
      "connect-src 'self' https://cdn.jsdelivr.net"
  );
  next();
};

const templateLocals = (req, res, next) => {
  res.locals.user = req.session.user;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.info = req.flash('info');
  res.locals.warning = req.flash('warning');
  next();
};

function configureApp() {
  app.use(limiter);

  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'eco-tracker-secret-key-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000
      },
      name: 'eco-tracker.sid'
    })
  );

  app.use(flash());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(methodOverride('_method'));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(securityHeaders);

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(expressLayouts);
  app.set('layout', 'layout');
  app.set('layout extractScripts', true);
  app.set('layout extractStyles', true);

  app.use(templateLocals);
  app.use(loadUser);

  app.use('/', indexRoutes);
  app.use('/auth', authRoutes);
  app.use('/habits', habitRoutes);
  app.use('/achievements', achievementRoutes);
  app.use('/profile', profileRoutes);
  app.use('/moderator', moderatorRoutes);
  app.use('/admin', adminRoutes);

  app.use((req, res) => {
    res.status(404).render('errors/404', {
      title: 'Страница не найдена',
      message: 'Запрашиваемая страница не существует.'
    });
  });

  app.use((err, req, res, next) => {
    console.error('Ошибка сервера:', err.stack);

    const statusCode = err.status || 500;
    const message = err.message || 'Внутренняя ошибка сервера';

    res.status(statusCode).render('errors/500', {
      title: 'Ошибка сервера',
      message: process.env.NODE_ENV === 'development' ? message : 'Произошла ошибка на сервере'
    });
  });
}

async function ensureDatabase() {
  await sequelize.authenticate();
}

async function startServer() {
  try {
    await ensureDatabase();
    configureApp();

    await sequelize.sync({ force: false });
    await ensureDefaultRoles();
    console.log('База данных подключена, синхронизирована и базовые роли подготовлены');

    app.listen(PORT, () => {
      console.log(`Сервер запущен на http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Ошибка запуска сервера:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
module.exports.startServer = startServer;

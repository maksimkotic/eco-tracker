const express = require('express');
const session = require('express-session');
const path = require('path');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const rateLimit = require('express-rate-limit');
const expressLayouts = require('express-ejs-layouts');

require('dotenv').config();

const { sequelize } = require('./models');
const initializeDatabase = require('./database/init');
const { loadUser, csrfProtection } = require('./middlewares/auth');
const { getPublicSettings } = require('./services/settingsService');
const { getAvatarSrc, getInitial, hasCustomAvatar } = require('./utils/avatar');


const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/authRoutes');
const habitRoutes = require('./routes/habitRoutes');
const achievementRoutes = require('./routes/achievementRoutes');
const profileRoutes = require('./routes/profileRoutes');
const moderatorRoutes = require('./routes/moderatorRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';
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


const settingsLocals = async (req, res, next) => {
  try {
    const appSettings = await getPublicSettings();
    res.locals.appSettings = appSettings;

    const isAdminRequest = req.path.startsWith('/admin');
    const isAuthRequest = req.path.startsWith('/auth') || req.path === '/logout';
    const isStaticAsset = req.path.startsWith('/uploads') || req.path.startsWith('/css') || req.path.startsWith('/js');

    const publicInfoPagePaths = new Set(['/', '/contacts', '/guide', '/terms', '/privacy']);
    const isPublicInfoPage = publicInfoPagePaths.has(req.path);

    if (appSettings.maintenanceMode && !isPublicInfoPage && !isAdminRequest && !isAuthRequest && !isStaticAsset) {
      return res.status(503).render('shared/under-construction', {
        title: 'Техническое обслуживание',
        heading: 'Сервис временно на обслуживании',
        description: appSettings.maintenanceMessage || 'Мы скоро вернемся.',
        details: [
          'администраторы могут войти и отключить режим обслуживания',
          'пользовательские страницы временно недоступны',
          'данные привычек и достижений сохранены'
        ],
        backUrl: '/auth/login',
        backLabel: 'Войти как администратор'
      });
    }

    return next();
  } catch (error) {
    console.error('Ошибка загрузки публичных настроек:', error);
    res.locals.appSettings = {};
    return next();
  }
};

const templateLocals = (req, res, next) => {
  res.locals.user = req.session.user;
  res.locals.getAvatarSrc = getAvatarSrc;
  res.locals.getAvatarInitial = getInitial;
  res.locals.hasCustomAvatar = hasCustomAvatar;
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
      secret: process.env.SESSION_SECRET,
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
  app.get('/uploads/avatars/:filename', (req, res) => {
    const requestedInitial = String(req.query.initial || '').trim();
    const initial = (requestedInitial.charAt(0) || path.basename(req.params.filename || '').charAt(0) || 'Э').toUpperCase();
    const safeInitial = initial.replace(/[<>&"']/g, '');
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="Аватар пользователя">
        <rect width="160" height="160" rx="80" fill="#198754"/>
        <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="72" font-weight="700">${safeInitial}</text>
      </svg>
    `.trim();

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(svg);
  });
  app.use(securityHeaders);

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(expressLayouts);
  app.set('layout', 'layout');
  app.set('layout extractScripts', true);
  app.set('layout extractStyles', true);

  app.use(templateLocals);
  app.use(loadUser);
  app.use(settingsLocals);
  app.use(csrfProtection);

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
  configureApp();

  const server = app.listen(PORT, HOST, async () => {
    console.log(`Сервер запущен на http://${HOST}:${PORT}`);

    try {
      await ensureDatabase();
      await initializeDatabase({ force: false });
      console.log('База данных подключена и инициализирована');
    } catch (error) {
      console.error('Ошибка запуска сервера:', error);
      server.close(() => process.exit(1));
    }
  });
}

if (require.main === module) {
  startServer();
}

module.exports = app;
module.exports.startServer = startServer;

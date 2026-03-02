const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const rateLimit = require('express-rate-limit');
const { sequelize } = require('./models');
const expressLayouts = require('express-ejs-layouts');

// Импорт маршрутов
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/authRoutes');
const habitRoutes = require('./routes/habitRoutes');
const achievementRoutes = require('./routes/achievementRoutes');
const profileRoutes = require('./routes/profileRoutes');
const moderatorRoutes = require('./routes/moderatorRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Middleware
const { loadUser } = require('./middlewares/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Проверка существования базы данных
const fs = require('fs');
const dbPath = path.join(__dirname, 'database.sqlite');

// Если база данных не существует, создаем начальные данные
if (!fs.existsSync(dbPath)) {
  console.log('📦 База данных не найдена. Создание новой...');
  const initDB = require('./database/init');
  initDB().then(() => {
    console.log('✅ База данных создана. Запуск сервера...');
    startServer();
  }).catch(err => {
    console.error('❌ Ошибка создания базы данных:', err);
    process.exit(1);
  });
} else {
  startServer();
}

function startServer() {
  // Настройка лимита запросов
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: 'Слишком много запросов с этого IP, попробуйте позже.'
  });

  // Применяем лимитер ко всем запросам
  app.use(limiter);

  // Настройка сессий
  app.use(session({
    store: new SQLiteStore({
      db: 'sessions.db',
      dir: path.join(__dirname, 'sessions'),
      table: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || 'eco-tracker-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000
    },
    name: 'eco-tracker.sid'
  }));

  // Middleware
  app.use(flash());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(methodOverride('_method'));
  app.use(express.static(path.join(__dirname, 'public')));
  
  // Enhanced Content Security Policy
  app.use((req, res, next) => {
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
  });

  // Шаблонизатор EJS
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  
  app.use(expressLayouts);
  app.set('layout', 'layout');
  app.set("layout extractScripts", true);
  app.set("layout extractStyles", true);

  // Глобальные переменные для шаблонов
  app.use((req, res, next) => {
    res.locals.user = req.session.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.info = req.flash('info');
    res.locals.warning = req.flash('warning');
    next();
  });

  // Загрузка пользователя из БД
  app.use(loadUser);

  // Маршруты
  app.use('/', indexRoutes);
  app.use('/auth', authRoutes);
  app.use('/habits', habitRoutes);
  app.use('/achievements', achievementRoutes);
  app.use('/profile', profileRoutes);
  app.use('/moderator', moderatorRoutes);
  app.use('/admin', adminRoutes);

  // Обработка 404
  app.use((req, res) => {
    res.status(404).render('errors/404', { 
      title: 'Страница не найдена',
      message: 'Запрашиваемая страница не существует.'
    });
  });

  // Обработка ошибок
  app.use((err, req, res, next) => {
    console.error('Ошибка сервера:', err.stack);
    
    const statusCode = err.status || 500;
    const message = err.message || 'Внутренняя ошибка сервера';
    
    res.status(statusCode).render('errors/500', { 
      title: 'Ошибка сервера',
      message: process.env.NODE_ENV === 'development' ? message : 'Произошла ошибка на сервере'
    });
  });

  // Подключение к БД и запуск сервера
  sequelize.sync({ force: false })
    .then(() => {
      console.log(' База данных подключена и синхронизирована');
      
      app.listen(PORT, () => {
        console.log(`Сервер запущен на http://localhost:${PORT}`);
      });
    })
    .catch(err => {
      console.error(' Ошибка подключения к БД:', err);
      process.exit(1);
    });
}

module.exports = app;
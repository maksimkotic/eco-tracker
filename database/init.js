require('dotenv').config();

const { Op } = require('sequelize');
const { sequelize, User, Role, Habit, Achievement, UserAchievement } = require('../models');
const { ensureDefaultRoles } = require('./roleobj');
const { ensureDefaultAchievements } = require('./achievementSeeds');
const bcrypt = require('bcrypt');

async function initializeDatabase(options = {}) {
  const shouldForceSync = Boolean(options.force);

  console.log('🚀 Начало инициализации базы данных...');

  try {
    await sequelize.sync({ force: shouldForceSync });
    console.log(shouldForceSync ? '✅ Таблицы пересозданы успешно' : '✅ Таблицы синхронизированы успешно');

    console.log('👥 Подготовка ролей...');
    await ensureDefaultRoles();
    const roles = await Role.findAll({
      where: {
        name: {
          [Op.in]: ['user', 'moderator', 'admin']
        }
      }
    });
    console.log('✅ Роли подготовлены');

    console.log('🏆 Подготовка достижений...');
    const achievements = await ensureDefaultAchievements(Achievement);
    console.log('✅ Достижения подготовлены');

    if (!shouldForceSync) {
      const existingUsers = await User.count();
      if (existingUsers > 0) {
        console.log('ℹ️ В базе уже есть пользователи. Справочники обновлены. Для полной пересборки запустите: npm run reset-db');
        return;
      }
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const allowDemoSeed = process.env.ALLOW_DEMO_SEED === 'true';

    if (isProduction && !allowDemoSeed) {
      console.log('ℹ️ Прод-режим: demo-пользователи и тестовые данные отключены. Установите ALLOW_DEMO_SEED=true для явного включения.');
      return;
    }

    console.log('👤 Создание тестовых пользователей...');

    const adminHash = await bcrypt.hash('admin123', 10);
    const moderatorHash = await bcrypt.hash('moderator123', 10);
    const userHash = await bcrypt.hash('user123', 10);
    const testUserHash = await bcrypt.hash('test123', 10);

    const users = await User.bulkCreate([
      {
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: adminHash,
        roleId: roles.find(r => r.name === 'admin').id,
        avatar: 'admin-avatar.png',
        ecoPoints: 1000,
        level: 10
      },
      {
        username: 'moderator',
        email: 'moderator@example.com',
        passwordHash: moderatorHash,
        roleId: roles.find(r => r.name === 'moderator').id,
        avatar: 'moderator-avatar.png',
        ecoPoints: 500,
        level: 5
      },
      {
        username: 'user',
        email: 'user@example.com',
        passwordHash: userHash,
        roleId: roles.find(r => r.name === 'user').id,
        avatar: 'user-avatar.png',
        ecoPoints: 250,
        level: 3
      },
      {
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: testUserHash,
        roleId: roles.find(r => r.name === 'user').id,
        avatar: 'default-avatar.png',
        ecoPoints: 100,
        level: 2
      },
      {
        username: 'ecofriend',
        email: 'eco@example.com',
        passwordHash: testUserHash,
        roleId: roles.find(r => r.name === 'user').id,
        avatar: 'eco-avatar.png',
        ecoPoints: 750,
        level: 8
      }
    ]);
    console.log('✅ Пользователи созданы');

    console.log(`🏆 Достижения готовы: ${achievements.length}`);


    console.log('🌱 Создание тестовых привычек...');

    const usersByName = Object.fromEntries(users.map(user => [user.username, user]));

    await Habit.bulkCreate([
      {
        userId: usersByName.user.id,
        title: 'Экономить воду при чистке зубов',
        description: 'Выключать воду, когда чищу зубы',
        category: 'water',
        frequency: 'daily',
        targetValue: 1,
        unit: 'times',
        currentStreak: 7,
        bestStreak: 14,
        totalCompletions: 45,
        isActive: true,
        color: '#007bff',
        lastCompleted: new Date(Date.now() - 24 * 60 * 60 * 1000)
      },
      {
        userId: usersByName.user.id,
        title: 'Выключать свет',
        description: 'Выключать свет, выходя из комнаты',
        category: 'energy',
        frequency: 'daily',
        targetValue: 5,
        unit: 'times',
        currentStreak: 3,
        bestStreak: 10,
        totalCompletions: 78,
        isActive: true,
        color: '#ffc107',
        lastCompleted: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        userId: usersByName.user.id,
        title: 'Сортировать пластик',
        description: 'Собирать пластиковые отходы отдельно',
        category: 'waste',
        frequency: 'weekly',
        targetValue: 1,
        unit: 'kg',
        currentStreak: 2,
        bestStreak: 4,
        totalCompletions: 12,
        isActive: true,
        color: '#28a745',
        lastCompleted: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      },
      {
        userId: usersByName.ecofriend.id,
        title: 'Ездить на велосипеде',
        description: 'Ездить на велосипеде на работу',
        category: 'transport',
        frequency: 'weekly',
        targetValue: 3,
        unit: 'times',
        currentStreak: 8,
        bestStreak: 12,
        totalCompletions: 36,
        isActive: true,
        color: '#17a2b8',
        lastCompleted: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        userId: usersByName.ecofriend.id,
        title: 'Покупать местные продукты',
        description: 'Покупать продукты местного производства',
        category: 'food',
        frequency: 'weekly',
        targetValue: 2,
        unit: 'times',
        currentStreak: 5,
        bestStreak: 8,
        totalCompletions: 24,
        isActive: true,
        color: '#fd7e14',
        lastCompleted: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        userId: usersByName.testuser.id,
        title: 'Использовать многоразовые сумки',
        description: 'Не брать пластиковые пакеты в магазине',
        category: 'waste',
        frequency: 'daily',
        targetValue: 1,
        unit: 'times',
        currentStreak: 15,
        bestStreak: 15,
        totalCompletions: 60,
        isActive: true,
        color: '#6f42c1',
        lastCompleted: new Date()
      },
      {
        userId: usersByName.testuser.id,
        title: 'Пить из многоразовой бутылки',
        description: 'Не покупать воду в пластиковых бутылках',
        category: 'waste',
        frequency: 'daily',
        targetValue: 1,
        unit: 'liters',
        currentStreak: 10,
        bestStreak: 21,
        totalCompletions: 120,
        isActive: true,
        color: '#e83e8c',
        lastCompleted: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    ]);
    console.log('✅ Привычки созданы');


    console.log('🎖 Назначение достижений...');

    const achievementByTitle = Object.fromEntries(achievements.map(item => [item.title, item]));

    await UserAchievement.bulkCreate([
      {
        userId: usersByName.user.id,
        achievementId: achievementByTitle['Начало пути'].id,
        earnedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        notified: true
      },
      {
        userId: usersByName.user.id,
        achievementId: achievementByTitle['Стремительный старт'].id,
        earnedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        notified: true
      },
      {
        userId: usersByName.user.id,
        achievementId: achievementByTitle['Зеленый новичок'].id,
        earnedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        notified: true
      },
      {
        userId: usersByName.ecofriend.id,
        achievementId: achievementByTitle['Начало пути'].id,
        earnedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        notified: true
      },
      {
        userId: usersByName.ecofriend.id,
        achievementId: achievementByTitle['Эко-энтузиаст'].id,
        earnedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        notified: true
      },
      {
        userId: usersByName.ecofriend.id,
        achievementId: achievementByTitle['Стремительный старт'].id,
        earnedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        notified: true
      },
      {
        userId: usersByName.ecofriend.id,
        achievementId: achievementByTitle['Эко-воин'].id,
        earnedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        notified: true
      },
      {
        userId: usersByName.ecofriend.id,
        achievementId: achievementByTitle['Эко-герой'].id,
        earnedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        notified: true
      },
      {
        userId: usersByName.testuser.id,
        achievementId: achievementByTitle['Начало пути'].id,
        earnedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        notified: true
      },
      {
        userId: usersByName.testuser.id,
        achievementId: achievementByTitle['Стремительный старт'].id,
        earnedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        notified: true
      }
    ]);
    console.log('✅ Достижения назначены');

    console.log('🎉 База данных успешно инициализирована!');
    console.log('\n📋 Тестовые аккаунты:');
    console.log('────────────────────────────────────────────');
    console.log('👑 Администратор:');
    console.log('   Email: admin@example.com');
    console.log('   Пароль: admin123');
    console.log('\n🛡️ Модератор:');
    console.log('   Email: moderator@example.com');
    console.log('   Пароль: moderator123');
    console.log('\n👤 Пользователи:');
    console.log('   Email: user@example.com      (Пароль: user123)');
    console.log('   Email: test@example.com      (Пароль: test123)');
    console.log('   Email: eco@example.com       (Пароль: test123)');
    console.log('────────────────────────────────────────────');
  } catch (error) {
    console.error('❌ Ошибка инициализации базы данных:', error);
    throw error;
  }
}


if (require.main === module) {
  initializeDatabase({ force: process.argv.includes('--force') })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = initializeDatabase;

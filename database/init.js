const { sequelize, User, Role, Habit, Achievement, UserAchievement } = require('../models');
const bcrypt = require('bcrypt');

async function initializeDatabase() {
  console.log('🚀 Начало инициализации базы данных...');
  
  try {
    // Синхронизация моделей (создание таблиц)
    await sequelize.sync({ force: true });
    console.log('✅ Таблицы созданы успешно');
    
    // Создание ролей
    console.log('👥 Создание ролей...');
    const roles = await Role.bulkCreate([
      {
        name: 'user',
        description: 'Обычный пользователь',
        permissions: JSON.stringify({
          view_profile: true,
          edit_own_profile: true,
          create_habit: true,
          edit_own_habit: true,
          delete_own_habit: true,
          view_achievements: true
        })
      },
      {
        name: 'moderator',
        description: 'Модератор привычек и достижений',
        permissions: JSON.stringify({
          view_profile: true,
          edit_own_profile: true,
          create_habit: true,
          edit_own_habit: true,
          delete_own_habit: true,
          view_achievements: true,
          view_all_habits: true,
          edit_any_habit: true,
          delete_any_habit: true,
          create_achievement: true,
          edit_achievement: true,
          delete_achievement: true,
          assign_achievement: true
        })
      },
      {
        name: 'admin',
        description: 'Администратор системы',
        permissions: JSON.stringify({
          view_profile: true,
          edit_own_profile: true,
          create_habit: true,
          edit_own_habit: true,
          delete_own_habit: true,
          view_achievements: true,
          view_all_habits: true,
          edit_any_habit: true,
          delete_any_habit: true,
          create_achievement: true,
          edit_achievement: true,
          delete_achievement: true,
          assign_achievement: true,
          view_all_users: true,
          edit_user_role: true,
          delete_user: true,
          ban_user: true,
          view_system_logs: true,
          manage_roles: true,
          manage_settings: true
        })
      }
    ]);
    console.log('✅ Роли созданы');
    
    // Создание тестовых пользователей
    console.log('👤 Создание тестовых пользователей...');
    
    // Хеширование паролей
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
    
    // Создание достижений
    console.log('🏆 Создание достижений...');
    const achievements = await Achievement.bulkCreate([
      {
        title: 'Начало пути',
        description: 'Создал первую эко-привычку',
        icon: 'seedling',
        points: 10,
        conditionType: 'total_habits',
        conditionValue: 1,
        rarity: 'common',
        isHidden: false
      },
      {
        title: 'Эко-энтузиаст',
        description: 'Создал 5 эко-привычек',
        icon: 'leaf',
        points: 25,
        conditionType: 'total_habits',
        conditionValue: 5,
        rarity: 'common',
        isHidden: false
      },
      {
        title: 'Мастер привычек',
        description: 'Создал 10 эко-привычек',
        icon: 'award',
        points: 50,
        conditionType: 'total_habits',
        conditionValue: 10,
        rarity: 'rare',
        isHidden: false
      },
      {
        title: 'Стремительный старт',
        description: 'Выполнял привычки 3 дня подряд',
        icon: 'fire',
        points: 15,
        conditionType: 'streak',
        conditionValue: 3,
        rarity: 'common',
        isHidden: false
      },
      {
        title: 'Эко-воин',
        description: 'Выполнял привычки 7 дней подряд',
        icon: 'shield',
        points: 30,
        conditionType: 'streak',
        conditionValue: 7,
        rarity: 'rare',
        isHidden: false
      },
      {
        title: 'Непрерывный рост',
        description: 'Выполнял привычки 30 дней подряд',
        icon: 'trophy',
        points: 100,
        conditionType: 'streak',
        conditionValue: 30,
        rarity: 'epic',
        isHidden: false
      },
      {
        title: 'Зеленый новичок',
        description: 'Заработал 50 эко-очков',
        icon: 'star',
        points: 20,
        conditionType: 'eco_points',
        conditionValue: 50,
        rarity: 'common',
        isHidden: false
      },
      {
        title: 'Эко-герой',
        description: 'Заработал 500 эко-очков',
        icon: 'gem',
        points: 75,
        conditionType: 'eco_points',
        conditionValue: 500,
        rarity: 'rare',
        isHidden: false
      },
      {
        title: 'Зеленый титан',
        description: 'Заработал 1000 эко-очков',
        icon: 'crown',
        points: 150,
        conditionType: 'eco_points',
        conditionValue: 1000,
        rarity: 'legendary',
        isHidden: false
      },
      {
        title: 'Хранитель воды',
        description: 'Создал 3 привычки по экономии воды',
        icon: 'droplet',
        points: 40,
        conditionType: 'category_master',
        conditionValue: 3,
        conditionExtra: JSON.stringify({ category: 'water' }),
        rarity: 'rare',
        isHidden: false
      },
      {
        title: 'Энергосберегатель',
        description: 'Создал 3 привычки по экономии энергии',
        icon: 'lightning',
        points: 40,
        conditionType: 'category_master',
        conditionValue: 3,
        conditionExtra: JSON.stringify({ category: 'energy' }),
        rarity: 'rare',
        isHidden: false
      },
      {
        title: 'Секретное достижение',
        description: 'Найдите секретное достижение',
        icon: 'question',
        points: 200,
        conditionType: 'specific_habit',
        conditionValue: 1,
        conditionExtra: JSON.stringify({ habitName: 'секрет' }),
        rarity: 'legendary',
        isHidden: true
      }
    ]);
    console.log('✅ Достижения созданы');
    
    // Создание привычек для тестовых пользователей
    console.log('🌱 Создание тестовых привычек...');
    
    const habits = await Habit.bulkCreate([
      // Привычки для пользователя 'user'
      {
        userId: users.find(u => u.username === 'user').id,
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
        userId: users.find(u => u.username === 'user').id,
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
        userId: users.find(u => u.username === 'user').id,
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
      
      // Привычки для пользователя 'ecofriend'
      {
        userId: users.find(u => u.username === 'ecofriend').id,
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
        userId: users.find(u => u.username === 'ecofriend').id,
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
      
      // Привычки для пользователя 'testuser'
      {
        userId: users.find(u => u.username === 'testuser').id,
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
        userId: users.find(u => u.username === 'testuser').id,
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
    
    // Назначение достижений пользователям
    console.log('🎖 Назначение достижений...');
    
    await UserAchievement.bulkCreate([
      {
        userId: users.find(u => u.username === 'user').id,
        achievementId: achievements.find(a => a.title === 'Начало пути').id,
        earnedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        notified: true
      },
      {
        userId: users.find(u => u.username === 'user').id,
        achievementId: achievements.find(a => a.title === 'Стремительный старт').id,
        earnedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        notified: true
      },
      {
        userId: users.find(u => u.username === 'user').id,
        achievementId: achievements.find(a => a.title === 'Зеленый новичок').id,
        earnedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        notified: true
      },
      {
        userId: users.find(u => u.username === 'ecofriend').id,
        achievementId: achievements.find(a => a.title === 'Начало пути').id,
        earnedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        notified: true
      },
      {
        userId: users.find(u => u.username === 'ecofriend').id,
        achievementId: achievements.find(a => a.title === 'Эко-энтузиаст').id,
        earnedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        notified: true
      },
      {
        userId: users.find(u => u.username === 'ecofriend').id,
        achievementId: achievements.find(a => a.title === 'Стремительный старт').id,
        earnedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        notified: true
      },
      {
        userId: users.find(u => u.username === 'ecofriend').id,
        achievementId: achievements.find(a => a.title === 'Эко-воин').id,
        earnedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        notified: true
      },
      {
        userId: users.find(u => u.username === 'ecofriend').id,
        achievementId: achievements.find(a => a.title === 'Эко-герой').id,
        earnedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        notified: true
      },
      {
        userId: users.find(u => u.username === 'testuser').id,
        achievementId: achievements.find(a => a.title === 'Начало пути').id,
        earnedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        notified: true
      },
      {
        userId: users.find(u => u.username === 'testuser').id,
        achievementId: achievements.find(a => a.title === 'Стремительный старт').id,
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
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка инициализации базы данных:', error);
    process.exit(1);
  }
}

// Запуск инициализации
if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;
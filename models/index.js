const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Создание экземпляра Sequelize для SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', 'database.sqlite'),
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: false,
    paranoid: false
  }
});

// Импорт моделей
const User = require('./User')(sequelize, DataTypes);
const Role = require('./Role')(sequelize, DataTypes);
const Habit = require('./Habit')(sequelize, DataTypes);
const Achievement = require('./Achievement')(sequelize, DataTypes);
const UserAchievement = require('./UserAchievement')(sequelize, DataTypes);
const Checkin = require('./Checkin')(sequelize, DataTypes);

// Определение связей

User.belongsTo(Role, { foreignKey: 'roleId', as: 'Role' });
Role.hasMany(User, { foreignKey: 'roleId', as: 'Users' });

User.hasMany(Habit, { foreignKey: 'userId', as: 'Habits' });
Habit.belongsTo(User, { foreignKey: 'userId', as: 'User' });

User.belongsToMany(Achievement, {
  through: UserAchievement,
  foreignKey: 'userId',
  otherKey: 'achievementId',
  as: 'Achievements'
});

Achievement.belongsToMany(User, {
  through: UserAchievement,
  foreignKey: 'achievementId',
  otherKey: 'userId',
  as: 'Users'
});

User.hasMany(UserAchievement, { foreignKey: 'userId', as: 'UserAchievements' });
UserAchievement.belongsTo(User, { foreignKey: 'userId', as: 'User' });

Achievement.hasMany(UserAchievement, { foreignKey: 'achievementId', as: 'UserAchievements' });
UserAchievement.belongsTo(Achievement, { foreignKey: 'achievementId', as: 'Achievement' });

Habit.hasMany(Checkin, { foreignKey: 'habitId' });
Checkin.belongsTo(Habit, { foreignKey: 'habitId' });
User.hasMany(Checkin, { foreignKey: 'userId' });
Checkin.belongsTo(User, { foreignKey: 'userId' });

module.exports = {
  sequelize,
  User,
  Role,
  Habit,
  Achievement,
  UserAchievement,
  Checkin
};
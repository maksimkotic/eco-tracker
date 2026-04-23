const { Sequelize, DataTypes } = require('sequelize');

const DB_NAME = process.env.DB_NAME || 'eco_tracker';
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 5432);
const DB_LOGGING = process.env.DB_LOGGING === 'true';


if (!DB_USER || !DB_PASSWORD) {
  throw new Error('DB_USER и DB_PASSWORD должны быть заданы в переменных окружения');
}

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  logging: DB_LOGGING ? console.log : false,
  define: {
    timestamps: true,
    underscored: false,
    paranoid: false
  },
  dialectOptions: process.env.DB_SSL === 'true'
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    : undefined
});

const User = require('./User')(sequelize, DataTypes);
const Role = require('./Role')(sequelize, DataTypes);
const Habit = require('./Habit')(sequelize, DataTypes);
const Achievement = require('./Achievement')(sequelize, DataTypes);
const UserAchievement = require('./UserAchievement')(sequelize, DataTypes);
const Checkin = require('./Checkin')(sequelize, DataTypes);

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

Habit.hasMany(Checkin, { foreignKey: 'habitId', onDelete: 'CASCADE', hooks: true });
Checkin.belongsTo(Habit, { foreignKey: 'habitId', onDelete: 'CASCADE' });
User.hasMany(Checkin, { foreignKey: 'userId', onDelete: 'CASCADE', hooks: true });
Checkin.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });

module.exports = {
  sequelize,
  User,
  Role,
  Habit,
  Achievement,
  UserAchievement,
  Checkin
};

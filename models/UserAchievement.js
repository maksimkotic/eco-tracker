module.exports = (sequelize, DataTypes) => {
  const UserAchievement = sequelize.define('UserAchievement', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    achievementId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'achievements',
        key: 'id'
      }
    },
    earnedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    notified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'user_achievements',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['userId', 'achievementId']
      },
      {
        fields: ['userId']
      },
      {
        fields: ['achievementId']
      },
      {
        fields: ['earnedAt']
      }
    ]
  });

  return UserAchievement;
};
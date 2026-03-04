// models/Checkin.js
module.exports = (sequelize, DataTypes) => {
  const Checkin = sequelize.define('Checkin', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    habitId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'habits',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    value: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 1
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    notes: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'checkins',
    timestamps: true
  });

  return Checkin;
};
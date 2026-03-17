module.exports = (sequelize, DataTypes) => {
  const Habit = sequelize.define('Habit', {
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
    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [3, 100],
        notEmpty: true
      }
    },
    description: {
      type: DataTypes.TEXT,
      defaultValue: ''
    },
    category: {
      type: DataTypes.ENUM('water', 'energy', 'waste', 'transport', 'food', 'other'),
      allowNull: false,
      defaultValue: 'other'
    },
    frequency: {
      type: DataTypes.ENUM('daily', 'weekly', 'monthly'),
      defaultValue: 'daily'
    },
    targetValue: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 0.1
      }
    },
    unit: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'times'
    },
    currentStreak: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    bestStreak: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    totalCompletions: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    lastCompleted: {
      type: DataTypes.DATE
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    color: {
      type: DataTypes.STRING(7),
      defaultValue: '#28a745',
      validate: {
        is: /^#[0-9A-F]{6}$/i
      }
    }
  }, {
    tableName: 'habits',
    timestamps: true,
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['category']
      },
      {
        fields: ['isActive']
      }
    ]
  });


  Habit.prototype.markCompleted = async function (value = 1, date = new Date()) {
    console.log(`📝 Отмечаем выполнение привычки ${this.id}: ${this.title}`);

    const currentStreak = this.currentStreak || 0;
    const totalCompletions = this.totalCompletions || 0;

    this.currentStreak = currentStreak + 1;
    this.totalCompletions = totalCompletions + 1;
    this.lastCompleted = date;


    if (this.currentStreak > (this.bestStreak || 0)) {
      this.bestStreak = this.currentStreak;
    }

    await this.save();

    console.log(`   📈 Серия: ${currentStreak} → ${this.currentStreak}`);


    const { User } = require('./index');
    const user = await User.findByPk(this.userId);
    if (user) {
      const userCurrentStreak = user.currentStreak || 0;
      user.currentStreak = userCurrentStreak + 1;
      user.lastActive = new Date();
      await user.save();

      console.log(`   👤 Серия пользователя: ${userCurrentStreak} → ${user.currentStreak}`);
    }

    return this;
  };


  Habit.prototype.resetStreak = async function () {
    this.currentStreak = 0;
    await this.save();
    return this;
  };


  Habit.prototype.getProgress = function () {
    const progress = (this.currentStreak / this.targetValue) * 100;
    return Math.min(progress, 100);
  };


  Habit.associate = function (models) {
    Habit.belongsTo(models.User, {
      foreignKey: 'userId',
      onDelete: 'CASCADE'
    });

    Habit.hasMany(models.Checkin, {
      foreignKey: 'habitId',
      onDelete: 'CASCADE'
    });
  };

  return Habit;
};
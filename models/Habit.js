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


  const getUtcDateParts = (date) => {
    const parsedDate = new Date(date);

    return {
      year: parsedDate.getUTCFullYear(),
      month: parsedDate.getUTCMonth() + 1,
      day: parsedDate.getUTCDate()
    };
  };

  const getPeriodKey = (date, frequency) => {
    const { year, month, day } = getUtcDateParts(date);

    if (frequency === 'monthly') {
      return `${year}-${String(month).padStart(2, '0')}`;
    }

    if (frequency === 'weekly') {
      const utcDate = new Date(Date.UTC(year, month - 1, day));
      const dayOfWeek = utcDate.getUTCDay() || 7;
      utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayOfWeek);
      const weekYear = utcDate.getUTCFullYear();
      const yearStart = new Date(Date.UTC(weekYear, 0, 1));
      const week = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);

      return `${weekYear}-W${String(week).padStart(2, '0')}`;
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const getPreviousPeriodKey = (periodKey, frequency) => {
    if (frequency === 'monthly') {
      const [year, month] = periodKey.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, 1));
      date.setUTCMonth(date.getUTCMonth() - 1);

      return getPeriodKey(date, frequency);
    }

    if (frequency === 'weekly') {
      const [year, week] = periodKey.split('-W').map(Number);
      const date = new Date(Date.UTC(year, 0, 4));
      const dayOfWeek = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() - dayOfWeek + 1 + ((week - 1) * 7) - 7);

      return getPeriodKey(date, frequency);
    }

    const [year, month, day] = periodKey.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() - 1);

    return getPeriodKey(date, frequency);
  };

  const calculateStreakFromCheckins = (checkins, frequency, targetValue) => {
    const totalsByPeriod = checkins.reduce((totals, checkin) => {
      const periodKey = getPeriodKey(checkin.date, frequency);
      totals.set(periodKey, (totals.get(periodKey) || 0) + Number(checkin.value || 0));
      return totals;
    }, new Map());
    const completedPeriodKeys = [...totalsByPeriod.entries()]
      .filter(([, value]) => value >= targetValue)
      .map(([periodKey]) => periodKey)
      .sort();

    if (!completedPeriodKeys.length) {
      return 0;
    }

    const completedPeriods = new Set(completedPeriodKeys);
    let streak = 1;
    let previousPeriodKey = getPreviousPeriodKey(completedPeriodKeys[completedPeriodKeys.length - 1], frequency);

    while (completedPeriods.has(previousPeriodKey)) {
      streak += 1;
      previousPeriodKey = getPreviousPeriodKey(previousPeriodKey, frequency);
    }

    return streak;
  };

  const calculateUserStreakFromCheckins = (checkins) => {
    const dayKeys = [...new Set(checkins.map((checkin) => getPeriodKey(checkin.date, 'daily')))].sort();

    if (!dayKeys.length) {
      return 0;
    }

    const activeDays = new Set(dayKeys);
    let streak = 1;
    let previousDayKey = getPreviousPeriodKey(dayKeys[dayKeys.length - 1], 'daily');

    while (activeDays.has(previousDayKey)) {
      streak += 1;
      previousDayKey = getPreviousPeriodKey(previousDayKey, 'daily');
    }

    return streak;
  };


  Habit.prototype.markCompleted = async function (value = 1, date = new Date()) {
    console.log(`📝 Отмечаем выполнение привычки ${this.id}: ${this.title}`);

    const { Checkin, User } = require('./index');
    const habitCheckins = await Checkin.findAll({
      where: { habitId: this.id },
      attributes: ['date', 'value'],
      order: [['date', 'ASC']]
    });
    const completionDates = habitCheckins.map((checkin) => checkin.date);
    const recalculatedStreak = calculateStreakFromCheckins(
      habitCheckins,
      this.frequency,
      Number(this.targetValue) || 1
    );
    const totalCompletions = habitCheckins.length;
    const previousStreak = this.currentStreak || 0;

    this.currentStreak = recalculatedStreak;
    this.totalCompletions = totalCompletions;
    this.lastCompleted = completionDates.length
      ? new Date(Math.max(...completionDates.map((completionDate) => new Date(completionDate).getTime())))
      : date;

    if (this.currentStreak > (this.bestStreak || 0)) {
      this.bestStreak = this.currentStreak;
    }

    await this.save();

    console.log(`   📈 Серия: ${previousStreak} → ${this.currentStreak}`);

    const user = await User.findByPk(this.userId);
    if (user) {
      const userCheckins = await Checkin.findAll({
        where: { userId: this.userId },
        attributes: ['date'],
        order: [['date', 'ASC']]
      });
      const userCurrentStreak = user.currentStreak || 0;
      user.currentStreak = calculateUserStreakFromCheckins(userCheckins);
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
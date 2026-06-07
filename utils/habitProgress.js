const { Op } = require('sequelize');
const { Checkin } = require('../models');

function getUtcPeriodRange(frequency, referenceDate = new Date()) {
  const date = new Date(referenceDate);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  let start;
  let end;

  if (frequency === 'monthly') {
    start = new Date(Date.UTC(year, month, 1));
    end = new Date(Date.UTC(year, month + 1, 1));
  } else if (frequency === 'weekly') {
    start = new Date(Date.UTC(year, month, day));
    const dayOfWeek = start.getUTCDay() || 7;
    start.setUTCDate(start.getUTCDate() - dayOfWeek + 1);
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
  } else {
    start = new Date(Date.UTC(year, month, day));
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
  }

  return { start, end };
}

async function getHabitPeriodValue(habit, referenceDate = new Date()) {
  const { start, end } = getUtcPeriodRange(habit.frequency, referenceDate);
  const value = await Checkin.sum('value', {
    where: {
      habitId: habit.id,
      userId: habit.userId,
      date: {
        [Op.gte]: start,
        [Op.lt]: end,
      },
    },
  });

  return value || 0;
}

async function attachHabitProgress(habit, referenceDate = new Date()) {
  const periodValue = await getHabitPeriodValue(habit, referenceDate);
  const targetValue = Number(habit.targetValue) || 1;
  const progressPercentage = Math.min((periodValue / targetValue) * 100, 100);

  if (typeof habit.setDataValue === 'function') {
    habit.setDataValue('periodValue', periodValue);
    habit.setDataValue('progressPercentage', progressPercentage);
  } else {
    habit.periodValue = periodValue;
    habit.progressPercentage = progressPercentage;
  }

  return habit;
}

function attachHabitsProgress(habits, referenceDate = new Date()) {
  return Promise.all(habits.map((habit) => attachHabitProgress(habit, referenceDate)));
}

module.exports = {
  attachHabitProgress,
  attachHabitsProgress,
  getHabitPeriodValue,
  getUtcPeriodRange,
};

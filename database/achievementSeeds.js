const DEFAULT_ACHIEVEMENTS = [
  {
    title: 'Начало пути',
    description: 'Создал первую эко-привычку',
    icon: 'flower1',
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
    title: 'Архитектор привычек',
    description: 'Создал 20 эко-привычек',
    icon: 'grid-3x3-gap',
    points: 120,
    conditionType: 'total_habits',
    conditionValue: 20,
    rarity: 'epic',
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
    title: 'Две зеленые недели',
    description: 'Выполнял привычки 14 дней подряд',
    icon: 'calendar2-week',
    points: 60,
    conditionType: 'streak',
    conditionValue: 14,
    rarity: 'rare',
    isHidden: false
  },
  {
    title: 'Непрерывный рост',
    description: 'Выполнял привычки 30 дней подряд',
    icon: 'sun',
    points: 100,
    conditionType: 'streak',
    conditionValue: 30,
    rarity: 'epic',
    isHidden: false
  },
  {
    title: 'Сезон без срывов',
    description: 'Выполнял привычки 60 дней подряд',
    icon: 'calendar2-check',
    points: 160,
    conditionType: 'streak',
    conditionValue: 60,
    rarity: 'epic',
    isHidden: false
  },
  {
    title: 'Легенда устойчивости',
    description: 'Выполнял привычки 100 дней подряд',
    icon: 'yin-yang',
    points: 250,
    conditionType: 'streak',
    conditionValue: 100,
    rarity: 'legendary',
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
    icon: 'trophy',
    points: 150,
    conditionType: 'eco_points',
    conditionValue: 1000,
    rarity: 'legendary',
    isHidden: false
  },
  {
    title: 'Планетарный инвестор',
    description: 'Заработал 2000 эко-очков',
    icon: 'globe2',
    points: 300,
    conditionType: 'eco_points',
    conditionValue: 2000,
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
    title: 'Мастер переработки',
    description: 'Создал 3 привычки по сортировке и сокращению отходов',
    icon: 'recycle',
    points: 40,
    conditionType: 'category_master',
    conditionValue: 3,
    conditionExtra: JSON.stringify({ category: 'waste' }),
    rarity: 'rare',
    isHidden: false
  },
  {
    title: 'Зеленый маршрут',
    description: 'Создал 3 привычки про экологичный транспорт',
    icon: 'bicycle',
    points: 40,
    conditionType: 'category_master',
    conditionValue: 3,
    conditionExtra: JSON.stringify({ category: 'transport' }),
    rarity: 'rare',
    isHidden: false
  },
  {
    title: 'Осознанное питание',
    description: 'Создал 3 привычки про экологичное питание',
    icon: 'basket',
    points: 40,
    conditionType: 'category_master',
    conditionValue: 3,
    conditionExtra: JSON.stringify({ category: 'food' }),
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
];

async function ensureDefaultAchievements(Achievement) {
  const achievements = [];

  for (const achievementData of DEFAULT_ACHIEVEMENTS) {
    const [achievement, created] = await Achievement.findOrCreate({
      where: { title: achievementData.title },
      defaults: achievementData
    });

    if (!created) {
      await achievement.update(achievementData);
    }

    achievements.push(achievement);
  }

  return achievements;
}

module.exports = {
  DEFAULT_ACHIEVEMENTS,
  ensureDefaultAchievements
};

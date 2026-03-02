const { Achievement } = require('../models');

async function seedAchievements() {
  console.log('🌱 Начало заполнения достижений...');

  const achievements = [
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
  ];

  try {
    for (const achievementData of achievements) {
      const [achievement, created] = await Achievement.findOrCreate({
        where: { title: achievementData.title },
        defaults: achievementData
      });

      if (created) {
        console.log(`✅ Достижение "${achievementData.title}" создано`);
      } else {
        console.log(`⚠️ Достижение "${achievementData.title}" уже существует`);
      }
    }

    console.log('✅ Заполнение достижений завершено');
  } catch (error) {
    console.error('❌ Ошибка при заполнении достижений:', error);
  }
}

module.exports = seedAchievements;
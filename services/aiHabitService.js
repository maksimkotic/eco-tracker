const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

const CATEGORY_LABELS = {
  water: 'Экономия воды',
  energy: 'Экономия энергии',
  waste: 'Сортировка отходов',
  transport: 'Экотранспорт',
  food: 'Экопитание',
  other: 'Прочее'
};

const FALLBACK_SUGGESTIONS = {
  water: [
    'Выключать воду во время чистки зубов',
    'Принимать душ на 2 минуты короче',
    'Собирать дождевую воду для полива растений'
  ],
  energy: [
    'Выключать свет при выходе из комнаты',
    'Отключать зарядные устройства из розетки',
    'Использовать энергосберегающий режим на технике'
  ],
  waste: [
    'Сортировать пластиковые отходы',
    'Использовать многоразовую сумку для покупок',
    'Отказаться от одноразовой посуды'
  ],
  transport: [
    'Ходить пешком на короткие расстояния',
    'Использовать велосипед вместо автомобиля',
    'Планировать совместные поездки'
  ],
  food: [
    'Покупать местные сезонные продукты',
    'Готовить еду дома вместо доставки',
    'Планировать меню, чтобы не выбрасывать продукты'
  ],
  other: [
    'Проводить один день в неделю без лишних покупок',
    'Сдавать батарейки в пункт переработки',
    'Делиться ненужными вещами вместо выбрасывания'
  ]
};

function getFallbackSuggestions(category, goal) {
  const categorySuggestions = FALLBACK_SUGGESTIONS[category] || FALLBACK_SUGGESTIONS.other;
  const goalText = goal ? ` с учётом цели: ${goal}` : '';

  return categorySuggestions.map((title, index) => ({
    title,
    description: `ИИ-режим недоступен, поэтому показана локальная рекомендация${goalText}. Начните с малого и отмечайте выполнение регулярно.`,
    frequency: index === 2 ? 'weekly' : 'daily',
    targetValue: 1,
    unit: 'times'
  }));
}

function normalizeSuggestions(rawSuggestions, category) {
  if (!Array.isArray(rawSuggestions)) return [];

  return rawSuggestions.slice(0, 5).map((item) => ({
    title: String(item.title || '').trim().slice(0, 100),
    description: String(item.description || '').trim().slice(0, 500),
    category,
    frequency: ['daily', 'weekly', 'monthly'].includes(item.frequency) ? item.frequency : 'daily',
    targetValue: Number.isFinite(Number(item.targetValue)) ? Math.max(Number(item.targetValue), 1) : 1,
    unit: ['times', 'liters', 'kwh', 'kg', 'items'].includes(item.unit) ? item.unit : 'times'
  })).filter((item) => item.title);
}

function extractOutputText(responseBody) {
  if (responseBody.output_text) return responseBody.output_text;

  const textParts = [];
  for (const outputItem of responseBody.output || []) {
    for (const contentItem of outputItem.content || []) {
      if (contentItem.text) textParts.push(contentItem.text);
    }
  }

  return textParts.join('\n');
}

async function requestOpenAiSuggestions({ category, goal, currentHabits }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-5.4-mini';

  if (!apiKey) {
    return {
      provider: 'local',
      model: 'fallback',
      suggestions: getFallbackSuggestions(category, goal),
      note: 'OPENAI_API_KEY не задан, поэтому показаны локальные рекомендации без обращения к OpenAI.'
    };
  }

  const prompt = [
    'Ты помощник приложения Eco Tracker.',
    'Сгенерируй экологичные привычки для пользователя на русском языке.',
    'Верни только JSON-массив без markdown и пояснений.',
    'Каждый элемент должен иметь поля: title, description, frequency, targetValue, unit.',
    'frequency: daily, weekly или monthly.',
    'unit: times, liters, kwh, kg или items.',
    `Категория: ${CATEGORY_LABELS[category] || CATEGORY_LABELS.other}.`,
    `Цель пользователя: ${goal || 'не указана'}.`,
    `Текущие привычки пользователя: ${currentHabits.length ? currentHabits.join(', ') : 'нет'}.`,
    'Не предлагай опасные действия, медицинские советы или незаконные действия.'
  ].join('\n');

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 900
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API вернул ошибку ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const responseBody = await response.json();
  const outputText = extractOutputText(responseBody);
  const parsed = JSON.parse(outputText);
  const suggestions = normalizeSuggestions(parsed, category);

  if (suggestions.length === 0) {
    throw new Error('OpenAI API вернул пустой список рекомендаций');
  }

  return {
    provider: 'openai',
    model,
    suggestions,
    note: 'Рекомендации сгенерированы через OpenAI Responses API.'
  };
}

async function generateHabitSuggestions({ category = 'other', goal = '', currentHabits = [] }) {
  const safeCategory = CATEGORY_LABELS[category] ? category : 'other';

  try {
    return await requestOpenAiSuggestions({
      category: safeCategory,
      goal: goal.trim(),
      currentHabits
    });
  } catch (error) {
    console.error('Ошибка генерации ИИ-рекомендаций:', error.message);
    return {
      provider: 'local',
      model: 'fallback',
      suggestions: getFallbackSuggestions(safeCategory, goal),
      note: `OpenAI API недоступен: ${error.message}. Показаны локальные рекомендации.`
    };
  }
}

module.exports = {
  CATEGORY_LABELS,
  generateHabitSuggestions
};

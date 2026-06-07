const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

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
    description: `OpenRouter недоступен, поэтому показана локальная рекомендация${goalText}. Начните с малого и отмечайте выполнение регулярно.`,
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

function getOpenRouterApiKey() {
  return String(process.env.OPENROUTER_API_KEY || '').trim();
}

function getOpenRouterHeaders(apiKey) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-OpenRouter-Title': process.env.OPENROUTER_APP_TITLE || 'Eco Tracker'
  };

  if (process.env.OPENROUTER_SITE_URL) {
    headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL;
  }

  return headers;
}

function extractOpenRouterErrorMessage(errorBody) {
  if (!errorBody) return '';

  try {
    const parsed = JSON.parse(errorBody);
    return String(parsed?.error?.message || parsed?.message || '').trim();
  } catch (parseError) {
    return String(errorBody).trim();
  }
}

function createOpenRouterError(response, errorBody) {
  const providerMessage = extractOpenRouterErrorMessage(errorBody);
  const error = new Error(providerMessage || `OpenRouter API вернул ошибку ${response.status}`);

  error.status = response.status;
  error.providerMessage = providerMessage;

  return error;
}

function getFriendlyOpenRouterError(error) {
  if (error.status === 401 || error.status === 403) {
    return 'ключ OpenRouter недействителен или не имеет доступа. Проверьте переменную OPENROUTER_API_KEY в окружении и укажите новый ключ из личного кабинета OpenRouter';
  }

  if (error.status === 402) {
    return 'на балансе OpenRouter недостаточно средств или превышен лимит аккаунта';
  }

  if (error.status === 429) {
    return 'OpenRouter временно ограничил количество запросов. Попробуйте ещё раз позже';
  }

  if (error.status >= 500) {
    return 'на стороне OpenRouter временная ошибка. Попробуйте ещё раз позже';
  }

  if (error.name === 'SyntaxError') {
    return 'OpenRouter вернул ответ в неожиданном формате';
  }

  return error.message || 'неизвестная ошибка OpenRouter';
}

function extractChoiceText(responseBody) {
  return responseBody?.choices?.[0]?.message?.content || '';
}

function parseJsonSuggestions(outputText) {
  const trimmed = outputText.trim();

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const jsonStart = trimmed.indexOf('[');
    const jsonEnd = trimmed.lastIndexOf(']');

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      throw error;
    }

    return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
  }
}

async function requestOpenRouterSuggestions({ category, goal, currentHabits }) {
  const apiKey = getOpenRouterApiKey();
  const model = process.env.OPENROUTER_MODEL || 'openrouter/auto';

  if (!apiKey) {
    return {
      provider: 'local',
      model: 'fallback',
      suggestions: getFallbackSuggestions(category, goal),
      note: 'OPENROUTER_API_KEY не задан, поэтому показаны локальные рекомендации без обращения к OpenRouter.'
    };
  }

  const systemPrompt = [
    'Ты помощник приложения Eco Tracker.',
    'Генерируй только безопасные экологичные привычки на русском языке.',
    'Не предлагай опасные действия, медицинские советы или незаконные действия.',
    'Верни только JSON-массив без markdown и пояснений.',
    'Каждый элемент должен иметь поля: title, description, frequency, targetValue, unit.',
    'frequency: daily, weekly или monthly.',
    'unit: times, liters, kwh, kg или items.'
  ].join('\n');

  const userPrompt = [
    `Категория: ${CATEGORY_LABELS[category] || CATEGORY_LABELS.other}.`,
    `Цель пользователя: ${goal || 'не указана'}.`,
    `Текущие привычки пользователя: ${currentHabits.length ? currentHabits.join(', ') : 'нет'}.`,
    'Сгенерируй 3-5 новых привычек, которые не дублируют текущие.'
  ].join('\n');

  const response = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: getOpenRouterHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 900,
      temperature: 0.4
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw createOpenRouterError(response, errorText);
  }

  const responseBody = await response.json();
  const outputText = extractChoiceText(responseBody);
  const parsed = parseJsonSuggestions(outputText);
  const suggestions = normalizeSuggestions(parsed, category);

  if (suggestions.length === 0) {
    throw new Error('OpenRouter API вернул пустой список рекомендаций');
  }

  return {
    provider: 'openrouter',
    model: responseBody.model || model,
    suggestions,
    note: 'Рекомендации сгенерированы через OpenRouter Chat Completions API.'
  };
}

async function generateHabitSuggestions({ category = 'other', goal = '', currentHabits = [] }) {
  const safeCategory = CATEGORY_LABELS[category] ? category : 'other';
  const safeGoal = String(goal || '').trim();

  try {
    return await requestOpenRouterSuggestions({
      category: safeCategory,
      goal: safeGoal,
      currentHabits
    });
  } catch (error) {
    const friendlyMessage = getFriendlyOpenRouterError(error);

    console.error('Ошибка генерации ИИ-рекомендаций:', friendlyMessage);
    return {
      provider: 'local',
      model: 'fallback',
      suggestions: getFallbackSuggestions(safeCategory, safeGoal),
      note: `OpenRouter API недоступен: ${friendlyMessage}. Показаны локальные рекомендации.`
    };
  }
}

module.exports = {
  CATEGORY_LABELS,
  generateHabitSuggestions,
  getFriendlyOpenRouterError
};

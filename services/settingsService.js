const { Op } = require('sequelize');
const { AppSetting, Role } = require('../models');

const HABIT_CATEGORIES = [
  { value: 'water', label: '💧 Экономия воды' },
  { value: 'energy', label: '⚡ Экономия энергии' },
  { value: 'waste', label: '🗑️ Сортировка отходов' },
  { value: 'transport', label: '🚗 Экотранспорт' },
  { value: 'food', label: '🍎 Экопитание' },
  { value: 'other', label: '🌱 Прочее' }
];

const DEFAULT_SETTINGS = {
  general: {
    category: 'general',
    description: 'Общие настройки приложения',
    value: {
      appName: 'Eco Tracker',
      appTagline: 'Система отслеживания экологических привычек',
      supportEmail: 'support@example.com',
      adminEmail: 'admin@example.com',
      publicPagesEnabled: true,
      footerText: 'Eco Tracker помогает формировать полезные экопривычки.'
    }
  },
  registration: {
    category: 'access',
    description: 'Регистрация и базовый доступ',
    value: {
      registrationEnabled: true,
      defaultRoleName: 'user',
      allowedEmailDomains: '',
      autoBanNewUsers: false,
      minPasswordLength: 6
    }
  },
  users: {
    category: 'access',
    description: 'Пользователи и роли',
    value: {
      allowCustomRoles: true,
      protectedRoles: ['user', 'moderator', 'admin'],
      deletionPolicy: 'hard_delete',
      passwordResetMode: 'temporary_password'
    }
  },
  habits: {
    category: 'habits',
    description: 'Правила привычек',
    value: {
      enabledCategories: HABIT_CATEGORIES.map((category) => category.value),
      categoryLabels: Object.fromEntries(HABIT_CATEGORIES.map((category) => [category.value, category.label])),
      defaultFrequency: 'daily',
      defaultTargetValue: 1,
      defaultUnit: 'times',
      minTargetValue: 1,
      maxTargetValue: 1000,
      allowCustomCategories: false
    }
  },
  gamification: {
    category: 'gamification',
    description: 'Баллы, уровни и достижения',
    value: {
      enabled: true,
      achievementsEnabled: true,
      pointsPerLevel: 100,
      checkinPointMultiplier: 1,
      firstHabitBonus: 0,
      streakBonusEnabled: false,
      hiddenAchievementsEnabled: true
    }
  },
  security: {
    category: 'security',
    description: 'Безопасность админских операций',
    value: {
      preventLastAdminRemoval: true,
      requirePasswordForDangerousActions: false,
      sessionLifetimeDays: 7,
      rememberMeDays: 30,
      blockedEmailDomains: ''
    }
  },
  system: {
    category: 'system',
    description: 'Техническое обслуживание',
    value: {
      maintenanceMode: false,
      maintenanceMessage: 'Сервис временно на техническом обслуживании.',
      staleSessionCleanupEnabled: false,
      backupReminderDays: 7
    }
  }
};

function cloneDefaultValue(key) {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS[key].value));
}

function normalizeBoolean(value) {
  return value === true || value === 'on' || value === 'true' || value === '1';
}

function normalizeNumber(value, fallback, min = null, max = null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  let result = parsed;
  if (min !== null) result = Math.max(min, result);
  if (max !== null) result = Math.min(max, result);
  return result;
}

function parseCsv(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function ensureDefaultSettings() {
  for (const [key, config] of Object.entries(DEFAULT_SETTINGS)) {
    const [setting] = await AppSetting.findOrCreate({
      where: { key },
      defaults: {
        key,
        category: config.category,
        value: cloneDefaultValue(key),
        description: config.description
      }
    });

    const mergedValue = {
      ...cloneDefaultValue(key),
      ...(setting.value || {})
    };

    await setting.update({
      category: config.category,
      description: config.description,
      value: mergedValue
    });
  }
}

async function getSettings() {
  const settings = Object.fromEntries(
    Object.keys(DEFAULT_SETTINGS).map((key) => [key, cloneDefaultValue(key)])
  );

  if (!AppSetting) {
    return settings;
  }

  const rows = await AppSetting.findAll({
    where: {
      key: { [Op.in]: Object.keys(DEFAULT_SETTINGS) }
    }
  });

  rows.forEach((row) => {
    settings[row.key] = {
      ...settings[row.key],
      ...(row.value || {})
    };
  });

  return settings;
}

async function updateSettingsFromBody(body) {
  const settings = {
    general: {
      appName: String(body.appName || 'Eco Tracker').trim().slice(0, 100),
      appTagline: String(body.appTagline || '').trim().slice(0, 255),
      supportEmail: String(body.supportEmail || '').trim().slice(0, 100),
      adminEmail: String(body.adminEmail || '').trim().slice(0, 100),
      publicPagesEnabled: normalizeBoolean(body.publicPagesEnabled),
      footerText: String(body.footerText || '').trim().slice(0, 255)
    },
    registration: {
      registrationEnabled: normalizeBoolean(body.registrationEnabled),
      defaultRoleName: String(body.defaultRoleName || 'user').trim(),
      allowedEmailDomains: parseCsv(body.allowedEmailDomains).join(', '),
      autoBanNewUsers: normalizeBoolean(body.autoBanNewUsers),
      minPasswordLength: normalizeNumber(body.minPasswordLength, 6, 6, 128)
    },
    users: {
      allowCustomRoles: normalizeBoolean(body.allowCustomRoles),
      protectedRoles: parseCsv(body.protectedRoles || 'user, moderator, admin'),
      deletionPolicy: ['hard_delete', 'ban_only', 'anonymize'].includes(body.deletionPolicy) ? body.deletionPolicy : 'hard_delete',
      passwordResetMode: ['temporary_password', 'manual_admin'].includes(body.passwordResetMode) ? body.passwordResetMode : 'temporary_password'
    },
    habits: {
      enabledCategories: Array.isArray(body.enabledCategories)
        ? body.enabledCategories
        : parseCsv(body.enabledCategories || HABIT_CATEGORIES.map((category) => category.value).join(',')),
      categoryLabels: Object.fromEntries(HABIT_CATEGORIES.map((category) => [
        category.value,
        String(body[`categoryLabel_${category.value}`] || category.label).trim().slice(0, 80)
      ])),
      defaultFrequency: ['daily', 'weekly', 'monthly'].includes(body.defaultFrequency) ? body.defaultFrequency : 'daily',
      defaultTargetValue: normalizeNumber(body.defaultTargetValue, 1, 0.1, 100000),
      defaultUnit: String(body.defaultUnit || 'times').trim().slice(0, 20),
      minTargetValue: normalizeNumber(body.minTargetValue, 1, 0.1, 100000),
      maxTargetValue: normalizeNumber(body.maxTargetValue, 1000, 0.1, 100000),
      allowCustomCategories: false
    },
    gamification: {
      enabled: normalizeBoolean(body.gamificationEnabled),
      achievementsEnabled: normalizeBoolean(body.achievementsEnabled),
      pointsPerLevel: normalizeNumber(body.pointsPerLevel, 100, 1, 100000),
      checkinPointMultiplier: normalizeNumber(body.checkinPointMultiplier, 1, 0, 100),
      firstHabitBonus: normalizeNumber(body.firstHabitBonus, 0, 0, 100000),
      streakBonusEnabled: normalizeBoolean(body.streakBonusEnabled),
      hiddenAchievementsEnabled: normalizeBoolean(body.hiddenAchievementsEnabled)
    },
    security: {
      preventLastAdminRemoval: normalizeBoolean(body.preventLastAdminRemoval),
      requirePasswordForDangerousActions: normalizeBoolean(body.requirePasswordForDangerousActions),
      sessionLifetimeDays: normalizeNumber(body.sessionLifetimeDays, 7, 1, 365),
      rememberMeDays: normalizeNumber(body.rememberMeDays, 30, 1, 365),
      blockedEmailDomains: parseCsv(body.blockedEmailDomains).join(', ')
    },
    system: {
      maintenanceMode: normalizeBoolean(body.maintenanceMode),
      maintenanceMessage: String(body.maintenanceMessage || '').trim().slice(0, 255),
      staleSessionCleanupEnabled: normalizeBoolean(body.staleSessionCleanupEnabled),
      backupReminderDays: normalizeNumber(body.backupReminderDays, 7, 1, 365)
    }
  };

  if (settings.habits.minTargetValue > settings.habits.maxTargetValue) {
    const previousMin = settings.habits.minTargetValue;
    settings.habits.minTargetValue = settings.habits.maxTargetValue;
    settings.habits.maxTargetValue = previousMin;
  }

  for (const [key, value] of Object.entries(settings)) {
    const config = DEFAULT_SETTINGS[key];
    await AppSetting.upsert({
      key,
      category: config.category,
      description: config.description,
      value
    });
  }

  return settings;
}

async function getPublicSettings() {
  const settings = await getSettings();
  return {
    appName: settings.general.appName,
    appTagline: settings.general.appTagline,
    supportEmail: settings.general.supportEmail,
    footerText: settings.general.footerText,
    registrationEnabled: settings.registration.registrationEnabled,
    maintenanceMode: settings.system.maintenanceMode,
    maintenanceMessage: settings.system.maintenanceMessage
  };
}

async function getHabitCategories() {
  const settings = await getSettings();
  const enabled = new Set(settings.habits.enabledCategories || []);
  const labels = settings.habits.categoryLabels || {};
  const categories = HABIT_CATEGORIES
    .filter((category) => enabled.has(category.value))
    .map((category) => ({
      value: category.value,
      label: labels[category.value] || category.label
    }));

  return categories.length ? categories : HABIT_CATEGORIES;
}

async function getDefaultRole() {
  const settings = await getSettings();
  const configuredRole = await Role.findOne({ where: { name: settings.registration.defaultRoleName || 'user' } });
  if (configuredRole) return configuredRole;
  return Role.findOne({ where: { name: 'user' } });
}

function calculateLevel(ecoPoints, pointsPerLevel = 100) {
  const safePointsPerLevel = Math.max(1, Number(pointsPerLevel) || 100);
  return Math.max(1, Math.floor(Number(ecoPoints || 0) / safePointsPerLevel) + 1);
}

function HABIT_CATEGORIES_LIST() {
  return HABIT_CATEGORIES;
}

module.exports = {
  DEFAULT_SETTINGS,
  ensureDefaultSettings,
  getSettings,
  updateSettingsFromBody,
  getPublicSettings,
  getHabitCategories,
  getDefaultRole,
  calculateLevel,
  HABIT_CATEGORIES: HABIT_CATEGORIES_LIST()
};

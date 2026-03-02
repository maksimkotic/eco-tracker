module.exports = {
  // Общие права
  VIEW_PROFILE: 'view_profile',
  EDIT_OWN_PROFILE: 'edit_own_profile',
  
  // Права на привычки
  CREATE_HABIT: 'create_habit',
  EDIT_OWN_HABIT: 'edit_own_habit',
  DELETE_OWN_HABIT: 'delete_own_habit',
  VIEW_ALL_HABITS: 'view_all_habits', // Модератор
  EDIT_ANY_HABIT: 'edit_any_habit', // Модератор
  DELETE_ANY_HABIT: 'delete_any_habit', // Модератор
  
  // Права на достижения
  VIEW_ACHIEVEMENTS: 'view_achievements',
  CREATE_ACHIEVEMENT: 'create_achievement', // Модератор
  EDIT_ACHIEVEMENT: 'edit_achievement', // Модератор
  DELETE_ACHIEVEMENT: 'delete_achievement', // Модератор
  ASSIGN_ACHIEVEMENT: 'assign_achievement', // Модератор
  
  // Права на пользователей (Админ)
  VIEW_ALL_USERS: 'view_all_users',
  EDIT_USER_ROLE: 'edit_user_role',
  DELETE_USER: 'delete_user',
  BAN_USER: 'ban_user',
  
  // Права на систему (Супер-админ)
  MANAGE_ROLES: 'manage_roles',
  VIEW_SYSTEM_LOGS: 'view_system_logs',
  MANAGE_SETTINGS: 'manage_settings'
};
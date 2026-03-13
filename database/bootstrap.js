const { Role } = require('../models');

const DEFAULT_ROLES = [
  {
    name: 'user',
    description: 'Обычный пользователь',
    permissions: {
      view_profile: true,
      edit_own_profile: true,
      create_habit: true,
      edit_own_habit: true,
      delete_own_habit: true,
      view_achievements: true
    }
  },
  {
    name: 'moderator',
    description: 'Модератор привычек и достижений',
    permissions: {
      view_profile: true,
      edit_own_profile: true,
      create_habit: true,
      edit_own_habit: true,
      delete_own_habit: true,
      view_achievements: true,
      view_all_habits: true,
      edit_any_habit: true,
      delete_any_habit: true,
      create_achievement: true,
      edit_achievement: true,
      delete_achievement: true,
      assign_achievement: true
    }
  },
  {
    name: 'admin',
    description: 'Администратор системы',
    permissions: {
      view_profile: true,
      edit_own_profile: true,
      create_habit: true,
      edit_own_habit: true,
      delete_own_habit: true,
      view_achievements: true,
      view_all_habits: true,
      edit_any_habit: true,
      delete_any_habit: true,
      create_achievement: true,
      edit_achievement: true,
      delete_achievement: true,
      assign_achievement: true,
      view_all_users: true,
      edit_user_role: true,
      delete_user: true,
      ban_user: true,
      view_system_logs: true,
      manage_roles: true,
      manage_settings: true
    }
  }
];

async function ensureDefaultRoles() {
  for (const roleData of DEFAULT_ROLES) {
    const [role, wasCreated] = await Role.findOrCreate({
      where: { name: roleData.name },
      defaults: roleData
    });

    if (!wasCreated) {
      const needsUpdate =
        role.description !== roleData.description ||
        JSON.stringify(role.permissions) !== JSON.stringify(roleData.permissions);

      if (needsUpdate) {
        role.description = roleData.description;
        role.permissions = roleData.permissions;
        await role.save();
      }
    }
  }
}

module.exports = {
  ensureDefaultRoles
};

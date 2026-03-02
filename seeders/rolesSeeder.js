const { Role } = require('../models');

async function seedRoles() {
  console.log('🌱 Начало заполнения ролей...');

  const roles = [
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

  try {
    for (const roleData of roles) {
      const [role, created] = await Role.findOrCreate({
        where: { name: roleData.name },
        defaults: roleData
      });

      if (created) {
        console.log(`✅ Роль "${roleData.name}" создана`);
      } else {
        console.log(`⚠️ Роль "${roleData.name}" уже существует`);
      }
    }

    console.log('✅ Заполнение ролей завершено');
  } catch (error) {
    console.error('❌ Ошибка при заполнении ролей:', error);
  }
}

module.exports = seedRoles;
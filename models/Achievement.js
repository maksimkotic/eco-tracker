module.exports = (sequelize, DataTypes) => {
  const Achievement = sequelize.define('Achievement', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
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
      allowNull: false
    },
    icon: {
      type: DataTypes.STRING(50),
      defaultValue: 'trophy',
      validate: {
        isIn: [['trophy', 'star', 'award', 'medal', 'crown', 'gem', 'shield', 'heart', 'seedling', 'recycle']]
      }
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      validate: {
        min: 1
      }
    },
    conditionType: {
      type: DataTypes.ENUM('streak', 'total_habits', 'eco_points', 'days_active', 'specific_habit', 'category_master'),
      allowNull: false
    },
    conditionValue: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1
      }
    },
    conditionExtra: {
      type: DataTypes.STRING, 
      defaultValue: null
    },
    rarity: {
      type: DataTypes.ENUM('common', 'rare', 'epic', 'legendary'),
      defaultValue: 'common'
    },
    isHidden: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'achievements',
    timestamps: true,
    getterMethods: {
      conditionExtraParsed() {
        if (!this.conditionExtra) return null;
        try {
          return JSON.parse(this.conditionExtra);
        } catch (e) {
          return null;
        }
      }
    },
    setterMethods: {
      conditionExtraParsed(value) {
        this.setDataValue('conditionExtra', JSON.stringify(value));
      }
    }
  });

  // Метод для проверки, заработал ли пользователь достижение
  Achievement.prototype.checkEarned = async function(userId) {
    const { User, Habit, UserAchievement } = require('./index');
    
    // Проверяем, есть ли уже это достижение
    const existing = await UserAchievement.findOne({
      where: { userId, achievementId: this.id }
    });
    
    if (existing) return false;
    
    let earned = false;
    const user = await User.findByPk(userId);
    
    if (!user) return false;
    
    switch (this.conditionType) {
      case 'streak':
        earned = user.currentStreak >= this.conditionValue;
        break;
        
      case 'total_habits':
        const habitCount = await Habit.count({ where: { userId } });
        earned = habitCount >= this.conditionValue;
        break;
        
      case 'eco_points':
        earned = user.ecoPoints >= this.conditionValue;
        break;
        
      case 'days_active':
        // Здесь нужна логика подсчета активных дней
        // Для простоты считаем по количеству привычек
        earned = user.currentStreak >= this.conditionValue;
        break;
        
      case 'specific_habit':
        const habit = await Habit.findOne({ 
          where: { 
            userId, 
            title: { [sequelize.Op.like]: `%${this.conditionExtraParsed?.habitName || ''}%` } 
          } 
        });
        earned = habit && habit.currentStreak >= this.conditionValue;
        break;
        
      case 'category_master':
        const categoryHabits = await Habit.count({ 
          where: { 
            userId, 
            category: this.conditionExtraParsed?.category 
          } 
        });
        earned = categoryHabits >= this.conditionValue;
        break;
    }
    
    return earned;
  };

  // Метод для выдачи достижения пользователю
  Achievement.prototype.grantToUser = async function(userId) {
    const { User, UserAchievement } = require('./index');
    
    const user = await User.findByPk(userId);
    if (!user) return null;
    
    // Проверяем, нет ли уже такого достижения
    const existing = await UserAchievement.findOne({
      where: { userId, achievementId: this.id }
    });
    
    if (existing) return existing;
    
    // Создаем запись
    const userAchievement = await UserAchievement.create({
      userId,
      achievementId: this.id,
      earnedAt: new Date()
    });
    
    // Начисляем очки пользователю
    await user.addEcoPoints(this.points);
    
    return userAchievement;
  };

  return Achievement;
};
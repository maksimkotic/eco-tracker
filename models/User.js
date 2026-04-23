const bcrypt = require("bcrypt");

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
          len: [3, 50],
          notEmpty: true,
        },
      },
      email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
          notEmpty: true,
        },
      },
      password: {
        type: DataTypes.VIRTUAL,
        allowNull: true,
        validate: {
          len: [6, 255],
        },
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      avatar: {
        type: DataTypes.STRING,
        defaultValue: "default-avatar.png",
      },
      ecoPoints: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },
      level: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
          min: 1,
        },
      },
      currentStreak: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      lastActive: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      isBanned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      roleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2,
        references: {
          model: "roles",
          key: "id",
        },
      },
    },
    {
      tableName: "users",
      timestamps: true,
      hooks: {
        beforeCreate: async (user) => {
          if (user.password) {
            user.passwordHash = await bcrypt.hash(user.password, 10);
          }
        },
        beforeUpdate: async (user) => {
          if (user.changed("password") && user.password) {
            user.passwordHash = await bcrypt.hash(user.password, 10);
          }
        },
      },
    }
  );

  User.associate = function (models) {
    User.hasMany(models.Habit, {
      foreignKey: "userId",
      onDelete: "CASCADE",
    });

    User.hasMany(models.UserAchievement, {
      foreignKey: "userId",
      onDelete: "CASCADE",
    });

    User.hasMany(models.Checkin, {
      foreignKey: "userId",
      onDelete: "CASCADE",
    });

    User.belongsTo(models.Role, {
      foreignKey: "roleId",
      as: "Role",
    });
  };


  User.prototype.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.passwordHash);
  };


  User.prototype.getSafeData = function () {
    const { passwordHash, ...safeData } = this.toJSON();
    return safeData;
  };


  User.prototype.addEcoPoints = async function (points) {
    this.ecoPoints += points;


    const newLevel = Math.floor(this.ecoPoints / 100) + 1;
    if (newLevel > this.level) {
      this.level = newLevel;
    }

    await this.save();
    return this;
  };

  return User;
};

module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define('Role', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [2, 50],
        notEmpty: true
      }
    },
    description: {
      type: DataTypes.STRING(200),
      defaultValue: ''
    },
    permissions: {
      type: DataTypes.TEXT,
      defaultValue: '{}',
      get() {
        const rawValue = this.getDataValue('permissions');
        try {
          return rawValue ? JSON.parse(rawValue) : {};
        } catch (e) {
          return {};
        }
      },
      set(value) {
        this.setDataValue('permissions', JSON.stringify(value));
      }
    }
  }, {
    tableName: 'roles',
    timestamps: true
  });


  Role.getUserRole = async function() {
    return await this.findOne({ where: { name: 'user' } });
  };

  Role.getModeratorRole = async function() {
    return await this.findOne({ where: { name: 'moderator' } });
  };

  Role.getAdminRole = async function() {
    return await this.findOne({ where: { name: 'admin' } });
  };


  Role.prototype.hasPermission = function(permission) {
    return this.permissions[permission] === true;
  };

  return Role;
};
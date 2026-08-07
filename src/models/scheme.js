'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Scheme extends Model {
    static associate(models) {
      Scheme.hasMany(models.SchemePhase, { foreignKey: 'scheme_id', as: 'phases' });
    }
  }

  Scheme.init(
    {
      name: { type: DataTypes.STRING, allowNull: false },
      funding_agency: DataTypes.STRING,
      description: DataTypes.TEXT,
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      // Official long-form institute name used as the top heading on the
      // government joining-data report, e.g. "Mahatma Jyotiba Phule
      // Research And Training Institute,(MAHAJYOTI), Nagpur".
      report_heading: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'Scheme',
      tableName: 'schemes',
      underscored: true,
    }
  );

  return Scheme;
};

'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Expense extends Model {
    static associate(models) {
      Expense.belongsTo(models.TrainingCenter, { foreignKey: 'training_center_id', as: 'trainingCenter' });
      Expense.belongsTo(models.User, { foreignKey: 'recorded_by', as: 'recordedByUser' });
    }
  }

  Expense.init(
    {
      training_center_id: DataTypes.INTEGER,
      category: {
        type: DataTypes.ENUM(
          'utilities',
          'marketing',
          'maintenance',
          'supplies',
          'travel',
          'salaries_admin',
          'misc'
        ),
        allowNull: false,
        defaultValue: 'misc',
      },
      description: DataTypes.STRING,
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      expense_date: { type: DataTypes.DATEONLY, allowNull: false },
      receipt_file_url: DataTypes.STRING,
      recorded_by: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: 'Expense',
      tableName: 'expenses',
      underscored: true,
    }
  );

  return Expense;
};

'use strict';
const { Model, DataTypes } = require('sequelize');
const { DOCUMENT_TYPE_KEYS } = require('../utils/documentTypes');

module.exports = (sequelize) => {
  class StudentDocument extends Model {
    static associate(models) {
      StudentDocument.belongsTo(models.Student, { foreignKey: 'student_id', as: 'student' });
      StudentDocument.belongsTo(models.User, { foreignKey: 'verified_by', as: 'verifier' });
    }
  }

  StudentDocument.init(
    {
      student_id: { type: DataTypes.INTEGER, allowNull: false },
      document_type: { type: DataTypes.ENUM(...DOCUMENT_TYPE_KEYS), allowNull: false },
      status: {
        type: DataTypes.ENUM('submitted', 'not_submitted'),
        allowNull: false,
        defaultValue: 'not_submitted',
      },
      remarks: DataTypes.STRING,
      verified_by: DataTypes.INTEGER,
      verified_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'StudentDocument',
      tableName: 'student_documents',
      underscored: true,
    }
  );

  return StudentDocument;
};

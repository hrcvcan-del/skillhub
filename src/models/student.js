'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Student extends Model {
    static associate(models) {
      Student.hasMany(models.Enrollment, { foreignKey: 'student_id', as: 'enrollments' });
    }
  }

  Student.init(
    {
      name: { type: DataTypes.STRING, allowNull: false },
      middle_name: DataTypes.STRING,
      full_name: DataTypes.STRING,
      email: { type: DataTypes.STRING, validate: { isEmail: true } },
      phone: DataTypes.STRING,
      address: DataTypes.STRING,
      date_of_birth: DataTypes.DATEONLY,
      gender: DataTypes.STRING,
      education: DataTypes.STRING,
      caste_category: DataTypes.ENUM('General', 'OBC', 'SC', 'ST', 'EWS', 'Other'),
      guardian_name: DataTypes.STRING,
      guardian_phone: DataTypes.STRING,
      id_proof_number: DataTypes.STRING,
      aadhaar_number: DataTypes.STRING,
      taluka: DataTypes.STRING,
      district: DataTypes.STRING,
      photo_url: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'Student',
      tableName: 'students',
      underscored: true,
    }
  );

  return Student;
};

'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Student extends Model {
    static associate(models) {
      Student.hasMany(models.Enrollment, { foreignKey: 'student_id', as: 'enrollments' });
      Student.hasMany(models.StudentDocument, { foreignKey: 'student_id', as: 'documents' });
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
      // Free text (not an enum) since government report categories vary by
      // scheme/state — e.g. General/OBC/SC/ST/EWS/VJ/NT-B/NT-C/NT-D/SBC/Other.
      caste_category: DataTypes.STRING,
      // The specific caste as named on the candidate's caste certificate
      // (e.g. "KUNBI", "NATH JOGI") — distinct from the broader category
      // above. Required for the government joining-data report.
      caste_name: DataTypes.STRING,
      non_creamy_layer: DataTypes.STRING,
      pwd: DataTypes.STRING,
      orphan: DataTypes.STRING,
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

'use strict';

// Adds:
// - directors: a simple name-only ledger Finance Director maintains for
//   tagging "Director Expense" suspense assignments — deliberately NOT
//   tied to any login.
// - training_partners: an external vendor/subcontractor the institute
//   pays to help deliver training. Gets its own login via
//   users.training_partner_id (added below) + the new 'training_partner'
//   role.
// - training_partner_candidates: itemized candidate+cost entries a
//   partner logs themselves (institute-wide, not tied to a specific
//   batch — see src/models/trainingPartnerCandidate.js).
// - training_partner_bills: a bill a partner generates from their own
//   unbilled candidate entries; Finance Director reviews, sets the
//   deduction %, and approves before it can be paid.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'training_partner';`);

    await queryInterface.createTable('directors', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, allowNull: false },
      notes: { type: Sequelize.TEXT, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.createTable('training_partners', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, allowNull: false },
      account_number: { type: Sequelize.STRING, allowNull: true },
      bank_name: { type: Sequelize.STRING, allowNull: true },
      ifsc_code: { type: Sequelize.STRING, allowNull: true },
      address: { type: Sequelize.TEXT, allowNull: true },
      contact_person: { type: Sequelize.STRING, allowNull: true },
      contact_phone: { type: Sequelize.STRING, allowNull: true },
      contact_email: { type: Sequelize.STRING, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addColumn('users', 'training_partner_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'training_partners', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.createTable('training_partner_bills', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      training_partner_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'training_partners', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      period_from: { type: Sequelize.DATEONLY, allowNull: false },
      period_to: { type: Sequelize.DATEONLY, allowNull: false },
      candidate_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      gross_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      deduction_percent: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      deduction_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      net_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      amount_paid: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      status: {
        type: Sequelize.ENUM('pending_review', 'approved', 'paid', 'rejected'),
        allowNull: false,
        defaultValue: 'pending_review',
      },
      generated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      reviewed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      reviewed_at: { type: Sequelize.DATE, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.createTable('training_partner_candidates', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      training_partner_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'training_partners', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      candidate_name: { type: Sequelize.STRING, allowNull: false },
      training_cost: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      trained_date: { type: Sequelize.DATEONLY, allowNull: false },
      notes: { type: Sequelize.TEXT, allowNull: true },
      bill_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'training_partner_bills', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('training_partner_candidates', ['training_partner_id']);
    await queryInterface.addIndex('training_partner_candidates', ['bill_id']);
    await queryInterface.addIndex('training_partner_bills', ['training_partner_id']);
    await queryInterface.addIndex('users', ['training_partner_id']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('training_partner_candidates');
    await queryInterface.dropTable('training_partner_bills');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_training_partner_bills_status";').catch(() => {});
    await queryInterface.removeColumn('users', 'training_partner_id');
    await queryInterface.dropTable('training_partners');
    await queryInterface.dropTable('directors');
  },
};

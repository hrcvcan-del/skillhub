'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('bank_accounts', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      bank_name: { type: Sequelize.STRING, allowNull: false },
      account_name: { type: Sequelize.STRING, allowNull: false },
      account_number: { type: Sequelize.STRING, allowNull: false },
      ifsc_code: { type: Sequelize.STRING, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.createTable('bank_statement_imports', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      bank_account_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'bank_accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      statement_from_date: { type: Sequelize.DATEONLY, allowNull: true },
      statement_to_date: { type: Sequelize.DATEONLY, allowNull: true },
      file_name: { type: Sequelize.STRING, allowNull: true },
      file_type: { type: Sequelize.ENUM('csv', 'xls', 'xlsx', 'pdf'), allowNull: false },
      uploaded_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      transaction_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      duplicate_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.createTable('bank_transactions', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      bank_account_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'bank_accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      import_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'bank_statement_imports', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      transaction_date: { type: Sequelize.DATEONLY, allowNull: false },
      value_date: { type: Sequelize.DATEONLY, allowNull: true },
      narration: { type: Sequelize.TEXT, allowNull: true },
      party_name: { type: Sequelize.STRING, allowNull: true },
      reference_number: { type: Sequelize.STRING, allowNull: true },
      utr_number: { type: Sequelize.STRING, allowNull: true },
      cheque_number: { type: Sequelize.STRING, allowNull: true },
      payment_mode: {
        type: Sequelize.ENUM('neft', 'rtgs', 'imps', 'upi', 'cheque', 'cash', 'bank_charges', 'auto_debit', 'other'),
        allowNull: true,
      },
      debit_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      credit_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      closing_balance: { type: Sequelize.DECIMAL(14, 2), allowNull: true },
      status: {
        type: Sequelize.ENUM(
          'unassigned',
          'suggested',
          'partially_assigned',
          'assigned',
          'verified',
          'ignored',
          'duplicate'
        ),
        allowNull: false,
        defaultValue: 'unassigned',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('bank_transactions', ['bank_account_id', 'transaction_date']);
    await queryInterface.addIndex('bank_transactions', ['status']);
    await queryInterface.addIndex('bank_transactions', ['utr_number']);
    await queryInterface.addIndex('bank_transactions', ['reference_number']);

    await queryInterface.createTable('bank_transaction_assignments', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      bank_transaction_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'bank_transactions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      category: { type: Sequelize.STRING, allowNull: false },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      expense_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'expenses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      trainer_salary_payment_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'trainer_salary_payments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      rent_payment_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'rent_payments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      notes: { type: Sequelize.TEXT, allowNull: true },
      assigned_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      assigned_at: { type: Sequelize.DATE, allowNull: true },
      verified_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      verified_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('bank_transaction_assignments', ['bank_transaction_id']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('bank_transaction_assignments');
    await queryInterface.dropTable('bank_transactions');
    await queryInterface.dropTable('bank_statement_imports');
    await queryInterface.dropTable('bank_accounts');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_bank_statement_imports_file_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_bank_transactions_payment_mode";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_bank_transactions_status";');
  },
};

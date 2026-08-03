'use strict';

const {
  User,
  TrainingCenter,
  Course,
  Trainer,
  Batch,
  Student,
  Enrollment,
} = require('../models');

module.exports = {
  up: async () => {
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@skillhub.local',
      password_hash: 'Admin@123',
      role: 'admin',
      phone: '9000000001',
    });

    await User.create({
      name: 'Front Desk Staff',
      email: 'staff@skillhub.local',
      password_hash: 'Staff@123',
      role: 'staff',
      phone: '9000000002',
    });

    const [centerA, centerB] = await Promise.all([
      TrainingCenter.create({
        name: 'SkillHub Downtown',
        address: '12 MG Road',
        city: 'Bengaluru',
        phone: '08012345678',
        email: 'downtown@skillhub.local',
        capacity: 60,
        monthly_rent_amount: 45000,
        landlord_name: 'R. Gupta',
        landlord_contact: '9876500001',
        lease_start_date: '2025-01-01',
        lease_end_date: '2027-12-31',
      }),
      TrainingCenter.create({
        name: 'SkillHub Whitefield',
        address: '88 ITPL Main Road',
        city: 'Bengaluru',
        phone: '08087654321',
        email: 'whitefield@skillhub.local',
        capacity: 40,
        monthly_rent_amount: 35000,
        landlord_name: 'S. Rao',
        landlord_contact: '9876500002',
        lease_start_date: '2025-03-01',
        lease_end_date: '2027-02-28',
      }),
    ]);

    const [webCourse, dataCourse] = await Promise.all([
      Course.create({
        name: 'Full Stack Web Development',
        description: 'HTML, CSS, JavaScript, Node.js and PostgreSQL',
        category: 'Web Development',
        duration_weeks: 12,
        fee_amount: 35000,
      }),
      Course.create({
        name: 'Data Analytics with Python',
        description: 'Pandas, visualization, and SQL for analytics',
        category: 'Data',
        duration_weeks: 8,
        fee_amount: 28000,
      }),
      Course.create({
        name: 'UI/UX Design Fundamentals',
        description: 'Design thinking, wireframing, and prototyping',
        category: 'Design',
        duration_weeks: 6,
        fee_amount: 20000,
      }),
    ]);

    const [trainer1, trainer2] = await Promise.all([
      Trainer.create({
        name: 'Ananya Sharma',
        email: 'ananya.trainer@skillhub.local',
        phone: '9123456780',
        specialization: 'Full Stack Development',
        qualification: 'M.Tech CSE',
        joining_date: '2024-06-01',
        salary_type: 'monthly',
        salary_amount: 55000,
        bank_account_number: '000111222333',
      }),
      Trainer.create({
        name: 'Rahul Verma',
        email: 'rahul.trainer@skillhub.local',
        phone: '9123456781',
        specialization: 'Data Analytics',
        qualification: 'M.Sc Statistics',
        joining_date: '2024-09-15',
        salary_type: 'monthly',
        salary_amount: 50000,
        bank_account_number: '000111222334',
      }),
      Trainer.create({
        name: 'Priya Nair',
        email: 'priya.trainer@skillhub.local',
        phone: '9123456782',
        specialization: 'UI/UX Design',
        qualification: 'B.Des',
        joining_date: '2025-01-10',
        salary_type: 'per_batch',
        salary_amount: 20000,
        bank_account_number: '000111222335',
      }),
    ]);

    const batchOne = await Batch.create({
      course_id: webCourse.id,
      training_center_id: centerA.id,
      trainer_id: trainer1.id,
      batch_code: 'FSWD-2026-A1',
      start_date: '2026-07-01',
      end_date: '2026-09-23',
      schedule_days: 'Mon/Wed/Fri',
      start_time: '18:00',
      end_time: '20:00',
      capacity: 25,
      status: 'ongoing',
    });

    const batchTwo = await Batch.create({
      course_id: dataCourse.id,
      training_center_id: centerB.id,
      trainer_id: trainer2.id,
      batch_code: 'DAP-2026-A1',
      start_date: '2026-09-01',
      end_date: '2026-10-27',
      schedule_days: 'Tue/Thu',
      start_time: '17:00',
      end_time: '19:00',
      capacity: 20,
      status: 'upcoming',
    });

    const students = await Promise.all([
      Student.create({
        name: 'Karthik Iyer',
        email: 'karthik.student@example.com',
        phone: '9988776601',
        guardian_name: 'Suresh Iyer',
        guardian_phone: '9988776602',
        gender: 'Male',
      }),
      Student.create({
        name: 'Meera Pillai',
        email: 'meera.student@example.com',
        phone: '9988776603',
        guardian_name: 'Lakshmi Pillai',
        guardian_phone: '9988776604',
        gender: 'Female',
      }),
      Student.create({
        name: 'Arjun Reddy',
        email: 'arjun.student@example.com',
        phone: '9988776605',
        gender: 'Male',
      }),
    ]);

    await Enrollment.create({
      student_id: students[0].id,
      batch_id: batchOne.id,
      enrollment_date: '2026-06-25',
      total_fee: 35000,
      discount_amount: 0,
      fee_paid: 15000,
      fee_due: 20000,
      status: 'active',
    });

    await Enrollment.create({
      student_id: students[1].id,
      batch_id: batchOne.id,
      enrollment_date: '2026-06-28',
      total_fee: 35000,
      discount_amount: 2000,
      fee_paid: 33000,
      fee_due: 0,
      status: 'active',
    });

    await Enrollment.create({
      student_id: students[2].id,
      batch_id: batchTwo.id,
      enrollment_date: '2026-08-01',
      total_fee: 28000,
      discount_amount: 0,
      fee_paid: 10000,
      fee_due: 18000,
      status: 'active',
    });

    console.log(`Seeded admin login: admin@skillhub.local / Admin@123 (user id ${admin.id})`);
    console.log('Seeded staff login: staff@skillhub.local / Staff@123');
  },

  down: async () => {
    await Enrollment.destroy({ where: {} });
    await Student.destroy({ where: {} });
    await Batch.destroy({ where: {} });
    await Trainer.destroy({ where: {} });
    await Course.destroy({ where: {} });
    await TrainingCenter.destroy({ where: {} });
    await User.destroy({ where: {} });
  },
};

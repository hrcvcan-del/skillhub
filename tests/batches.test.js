const { loginAsAdmin, getCsrfToken } = require('./helpers/auth');
const sequelize = require('../src/config/db');
const sessionMiddleware = require('../src/config/session');
const { Course, TrainingCenter, Batch } = require('../src/models');

let agent;
let course;
let center;
const createdBatchIds = [];

beforeAll(async () => {
  agent = await loginAsAdmin();
  course = await Course.findOne();
  center = await TrainingCenter.findOne();
});

afterAll(async () => {
  if (createdBatchIds.length > 0) {
    await Batch.destroy({ where: { id: createdBatchIds } });
  }
  await sequelize.close();
  await sessionMiddleware.pool.end();
});

describe('GET /batches', () => {
  it('lists batches for an authenticated user', async () => {
    const res = await agent.get('/batches');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Batches/);
    expect(res.text).toMatch(/New batch/);
  });
});

describe('POST /batches', () => {
  it('rejects a batch missing required fields with a validation error', async () => {
    const csrfToken = await getCsrfToken(agent, '/batches/new');

    const res = await agent
      .post('/batches')
      .type('form')
      .send({ _csrf: csrfToken, capacity: 10 });

    expect(res.status).toBe(422);
    expect(res.text).toMatch(/is required/);
  });

  it('creates a batch with a valid payload and auto-generates a batch code', async () => {
    const csrfToken = await getCsrfToken(agent, '/batches/new');

    const res = await agent
      .post('/batches')
      .type('form')
      .send({
        _csrf: csrfToken,
        course_id: course.id,
        training_center_id: center.id,
        trainer_id: '',
        start_date: '2027-01-01',
        end_date: '2027-03-01',
        capacity: 15,
      });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/batches');

    const created = await Batch.findOne({
      where: { course_id: course.id, training_center_id: center.id, start_date: '2027-01-01' },
      order: [['id', 'DESC']],
    });
    expect(created).not.toBeNull();
    expect(created.batch_code).toMatch(/-\d{4}-[A-Z]\d+$/);
    createdBatchIds.push(created.id);
  });
});

const request = require('supertest');
const app = require('../src/app');
const { getCsrfToken } = require('./helpers/auth');
const sequelize = require('../src/config/db');
const sessionMiddleware = require('../src/config/session');

afterAll(async () => {
  await sequelize.close();
  await sessionMiddleware.pool.end();
});

describe('POST /auth/login', () => {
  it('rejects invalid credentials', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent, '/auth/login');

    const res = await agent
      .post('/auth/login')
      .type('form')
      .send({ _csrf: csrfToken, email: 'admin@skillhub.local', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.text).toMatch(/Invalid email or password/);
  });

  it('logs in with valid credentials and redirects to the dashboard', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent, '/auth/login');

    const res = await agent
      .post('/auth/login')
      .type('form')
      .send({ _csrf: csrfToken, email: 'admin@skillhub.local', password: 'Admin@123' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard');

    const dashboardRes = await agent.get('/dashboard');
    expect(dashboardRes.status).toBe(200);
    expect(dashboardRes.text).toMatch(/Dashboard/);
  });

  it('rate limits repeated login attempts from the same client', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent, '/auth/login');

    const statuses = [];
    for (let i = 0; i < 15; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await agent
        .post('/auth/login')
        .type('form')
        .send({ _csrf: csrfToken, email: 'admin@skillhub.local', password: 'wrong-password' });
      statuses.push(res.status);
    }

    expect(statuses).toContain(429);
  }, 20000);
});

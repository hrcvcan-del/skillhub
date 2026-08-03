const request = require('supertest');
const app = require('../../src/app');

function extractCsrfToken(html) {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  if (!match) throw new Error('CSRF token not found in response HTML');
  return match[1];
}

async function getCsrfToken(agent, path) {
  const res = await agent.get(path);
  return extractCsrfToken(res.text);
}

async function loginAsAdmin() {
  const agent = request.agent(app);
  const csrfToken = await getCsrfToken(agent, '/auth/login');
  await agent
    .post('/auth/login')
    .type('form')
    .send({ _csrf: csrfToken, email: 'admin@skillhub.local', password: 'Admin@123' })
    .expect(302);
  return agent;
}

module.exports = { extractCsrfToken, getCsrfToken, loginAsAdmin };

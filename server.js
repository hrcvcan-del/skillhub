const app = require('./src/app');
const env = require('./src/config/env');

app.listen(env.port, () => {
  console.log(`SkillHub running on http://localhost:${env.port}`);
});

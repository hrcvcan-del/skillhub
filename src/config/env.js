require('dotenv').config();

// Some networks have flaky/broken IPv6 routing to hosted Postgres providers
// (e.g. Neon) that manifests as ETIMEDOUT on every connection attempt even
// though IPv4 works fine. Preferring IPv4 first avoids that without disabling
// IPv6 entirely.
require('dns').setDefaultResultOrder('ipv4first');

const required = ['DATABASE_URL', 'SESSION_SECRET'];

function validateEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length && process.env.NODE_ENV !== 'test') {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateEnv();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === 'true',
  sessionSecret: process.env.SESSION_SECRET,
  emailApiKey: process.env.EMAIL_API_KEY || null,
  emailFrom: process.env.EMAIL_FROM || 'no-reply@skillhub.example',
  uploadDir: process.env.UPLOAD_DIR || 'src/public/uploads',
  maxUploadMb: parseInt(process.env.MAX_UPLOAD_MB, 10) || 5,
};

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const methodOverride = require('method-override');
const csurf = require('csurf');

const sessionMiddleware = require('./config/session');
const flash = require('./middleware/flash');
const loadCurrentUser = require('./middleware/loadCurrentUser');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const userRoutes = require('./routes/users');
const schemeRoutes = require('./routes/schemes');
const centerRoutes = require('./routes/centers');
const courseRoutes = require('./routes/courses');
const trainerRoutes = require('./routes/trainers');
const batchRoutes = require('./routes/batches');
const studentRoutes = require('./routes/students');
const enrollmentRoutes = require('./routes/enrollments');
const transferRoutes = require('./routes/transfers');
const expenseRoutes = require('./routes/expenses');
const rentPaymentRoutes = require('./routes/rentPayments');
const salaryPaymentRoutes = require('./routes/salaryPayments');
const inventoryRoutes = require('./routes/inventory');

const app = express();

// Required behind a reverse proxy (Nginx) so Express recognizes the original
// request as HTTPS via X-Forwarded-Proto — without this, secure session
// cookies are silently never set, breaking login/CSRF in production.
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'cdn.jsdelivr.net'],
        styleSrc: ["'self'", 'cdn.jsdelivr.net', "'unsafe-inline'"],
        fontSrc: ["'self'", 'cdn.jsdelivr.net'],
        imgSrc: ["'self'", 'data:'],
      },
    },
  })
);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  methodOverride((req) => {
    if (req.body && typeof req.body === 'object' && '_method' in req.body) {
      const method = req.body._method;
      delete req.body._method;
      return method;
    }
    if (req.query && '_method' in req.query) {
      return req.query._method;
    }
  })
);
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

app.use(sessionMiddleware);
app.use(flash);
app.use(loadCurrentUser);

app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok' }));

app.use(
  csurf({
    value: (req) => (req.body && req.body._csrf) || req.query._csrf,
  })
);
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/users', userRoutes);
app.use('/schemes', schemeRoutes);
app.use('/centers', centerRoutes);
app.use('/courses', courseRoutes);
app.use('/trainers', trainerRoutes);
app.use('/batches', batchRoutes);
app.use('/students', studentRoutes);
app.use('/enrollments', enrollmentRoutes);
app.use('/transfers', transferRoutes);
app.use('/expenses', expenseRoutes);
app.use('/rent-payments', rentPaymentRoutes);
app.use('/salary-payments', salaryPaymentRoutes);
app.use('/inventory', inventoryRoutes);

app.get('/', (req, res) => res.redirect(req.session.userId ? '/dashboard' : '/auth/login'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

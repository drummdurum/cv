require('dotenv').config();
const express = require('express');
const path = require('path');
const ejs = require('ejs');
const { translateHtml } = require('./translations');
const { sendContactEmails } = require('./services/mailService');

const app = express();
const PORT = process.env.PORT || 3010;
const CONTACT_WINDOW_MS = 15 * 60 * 1000;
const CONTACT_MAX_REQUESTS = 5;
const contactRequests = new Map();

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

// Helper function to render with layout
const renderWithLayout = async (viewName, options, req, res) => {
  const language = req.language;
  const body = await ejs.renderFile(
    path.join(__dirname, 'views', `${viewName}.ejs`),
    {
      ...options,
      language,
      cvDownloadUrl: language === 'en'
        ? '/filer/cv/Sebastian_Drumm_CV_EN.pdf'
        : '/filer/cv/Sebastian_Drumm_CV.pdf'
    }
  );

  const html = await ejs.renderFile(path.join(__dirname, 'views', 'layout.ejs'), {
    ...options,
    body,
    language,
    cvDownloadUrl: language === 'en'
      ? '/filer/cv/Sebastian_Drumm_CV_EN.pdf'
      : '/filer/cv/Sebastian_Drumm_CV.pdf',
    languageSwitchUrl: `/language/${language === 'da' ? 'en' : 'da'}?returnTo=${encodeURIComponent(req.path)}`
  });

  res.send(language === 'en' ? translateHtml(html) : html);
};

const getCookies = (req) => Object.fromEntries(
  (req.headers.cookie || '')
    .split(';')
    .filter(Boolean)
    .map(cookie => {
      const separator = cookie.indexOf('=');
      return [cookie.slice(0, separator).trim(), decodeURIComponent(cookie.slice(separator + 1))];
    })
);

app.use((req, res, next) => {
  const requestedLanguage = ['da', 'en'].includes(req.query.lang) ? req.query.lang : null;
  req.language = requestedLanguage || getCookies(req).language || 'da';

  if (!['da', 'en'].includes(req.language)) req.language = 'da';
  if (requestedLanguage) {
    res.cookie('language', requestedLanguage, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });
  }
  next();
});

app.get('/language/:language', (req, res) => {
  const language = ['da', 'en'].includes(req.params.language) ? req.params.language : 'da';
  const returnTo = typeof req.query.returnTo === 'string' && req.query.returnTo.startsWith('/') && !req.query.returnTo.startsWith('//')
    ? req.query.returnTo
    : '/';

  res.cookie('language', language, {
    maxAge: 365 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  });
  res.redirect(returnTo);
});

// Routes
app.get('/', async (req, res) => {
  await renderWithLayout('index', { 
    page: 'forside', 
    title: 'Sebastian Drumm - Full Stack Developer | CV & Portfolio',
    canonicalPath: '/'
  }, req, res);
});

app.get('/jobs', async (req, res) => {
  await renderWithLayout('jobs', { 
    page: 'jobs', 
    title: 'Sebastian Drumm - Erhvervserfaring & Uddannelse',
    canonicalPath: '/jobs'
  }, req, res);
});

app.get('/fritid', async (req, res) => {
  await renderWithLayout('fritid', { 
    page: 'fritid', 
    title: 'Sebastian Drumm - Fritid & Interesser',
    canonicalPath: '/fritid'
  }, req, res);
});

const contactRateLimit = (req, res, next) => {
  const now = Date.now();
  const recentRequests = (contactRequests.get(req.ip) || [])
    .filter(timestamp => now - timestamp < CONTACT_WINDOW_MS);
  if (recentRequests.length >= CONTACT_MAX_REQUESTS) {
    return res.status(429).json({ error: 'For mange forsøg. Vent venligst lidt og prøv igen.' });
  }
  recentRequests.push(now);
  contactRequests.set(req.ip, recentRequests);
  next();
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

app.post('/api/contact', contactRateLimit, async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  const language = req.body.language === 'en' ? 'en' : 'da';

  if (name.length < 2 || name.length > 100 || !isValidEmail(email) || email.length > 254 || message.length < 10 || message.length > 5000) {
    return res.status(400).json({ error: 'Kontrollér venligst navn, e-mail og besked.' });
  }

  try {
    const mailJob = await sendContactEmails({ name, email, message, language });
    console.log('Contact email queued:', mailJob.jobId || 'job id not returned', mailJob.status || 'accepted');
    return res.json({ success: true, status: mailJob.status || 'QUEUED' });
  } catch (error) {
    console.error('Contact form email failed:', error.message);
    return res.status(502).json({ error: 'Beskeden kunne ikke sendes lige nu. Prøv venligst igen senere.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server kører på http://localhost:${PORT}`);
  console.log(`Åbn din browser på http://localhost:${PORT}`);
});

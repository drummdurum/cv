const express = require('express');
const path = require('path');
const ejs = require('ejs');
const { translateHtml } = require('./translations');

const app = express();
const PORT = process.env.PORT || 3010;

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to render with layout
const renderWithLayout = async (viewName, options, req, res) => {
  const language = req.language;
  const body = await ejs.renderFile(
    path.join(__dirname, 'views', `${viewName}.ejs`),
    options
  );

  const html = await ejs.renderFile(path.join(__dirname, 'views', 'layout.ejs'), {
    ...options,
    body,
    language,
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

app.listen(PORT, () => {
  console.log(`Server kører på http://localhost:${PORT}`);
  console.log(`Åbn din browser på http://localhost:${PORT}`);
});

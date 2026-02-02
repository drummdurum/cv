const express = require('express');
const path = require('path');
const ejs = require('ejs');

const app = express();
const PORT = process.env.PORT || 3010;

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to render with layout
const renderWithLayout = async (viewName, options, res) => {
  const body = await ejs.renderFile(
    path.join(__dirname, 'views', `${viewName}.ejs`),
    options
  );
  
  res.render('layout', { ...options, body });
};

// Routes
app.get('/', async (req, res) => {
  await renderWithLayout('index', { 
    page: 'forside', 
    title: 'Sebastian Drumm - Full Stack Developer | CV & Portfolio',
    canonicalPath: '/'
  }, res);
});

app.get('/jobs', async (req, res) => {
  await renderWithLayout('jobs', { 
    page: 'jobs', 
    title: 'Sebastian Drumm - Erhvervserfaring & Uddannelse',
    canonicalPath: '/jobs'
  }, res);
});

app.get('/fritid', async (req, res) => {
  await renderWithLayout('fritid', { 
    page: 'fritid', 
    title: 'Sebastian Drumm - Fritid & Interesser',
    canonicalPath: '/fritid'
  }, res);
});

app.listen(PORT, () => {
  console.log(`Server kører på http://localhost:${PORT}`);
  console.log(`Åbn din browser på http://localhost:${PORT}`);
});

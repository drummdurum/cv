require('dotenv').config();
const express = require('express');
const path = require('path');
const ejs = require('ejs');
const { translateHtml } = require('./translations');
const { sendContactEmails } = require('./services/mailService');
const http = require('http');
const events = require('./event/data');
const { invitationStatus, ensureInvitation, refreshInvitation, removeGuestWithCancellation } = require('./event/invitations');
const { syncCalendarReplies, getCalendarInvitationStatus } = require('./services/mailService');
const googleCalendar = require('./services/googleCalendar');
const { attachVoting } = require('./event/voting');
const { startGrpcServer, createEchoClient } = require('./event/grpc');
const { COOKIE, readParticipant, createParticipant } = require('./event/participant');
const { connectDatabase, getDatabase } = require('./event/database');
const { notifyAttendees, subscribeAttendees } = require('./event/attendeeUpdates');
const crypto = require('crypto');
const helmet = require('helmet');
const { isAllowedOrigin, issueCsrf, requireCsrf } = require('./event/security');
const quizzes = require('./event/questions.json');
const { createSession, getSession } = require('./event/quizSessions');
const QUIZ_GAME_ID = 'quiz-hub';
const isJoinableGame = id => id === QUIZ_GAME_ID || events.some(event => event.id === id);
const quizSummaries = quizzes.map(quiz => ({ id: quiz.id, title: quiz.title,
  description: quiz.description, count: quiz.questions.length }));

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3010;
const CONTACT_WINDOW_MS = 15 * 60 * 1000;
const CONTACT_MAX_REQUESTS = 5;
const contactRequests = new Map();

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  req.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req) => `'nonce-${req.cspNonce}'`],
      styleSrc: ["'self'", (req) => `'nonce-${req.cspNonce}'`, 'https://fonts.googleapis.com'],
      styleSrcAttr: ["'unsafe-inline'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      frameSrc: ["'self'", 'https://www.youtube-nocookie.com'],
      mediaSrc: ["'self'"],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: null
    }
  },
  hsts: false,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
app.use((req, res, next) => req.secure ? helmet.hsts()(req, res, next) : next());

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use((req, res, next) => {
  if (req.method === 'POST' && !isAllowedOrigin(req.get('origin'))) {
    return res.status(403).json({ error: 'Forespørgslen kommer ikke fra en tilladt side.' });
  }
  next();
});

// Helper function to render with layout
const renderWithLayout = async (viewName, options, req, res) => {
  const language = req.language;
  const body = await ejs.renderFile(
    path.join(__dirname, 'views', `${viewName}.ejs`),
    {
      ...options,
      cspNonce: req.cspNonce,
      language,
      cvDownloadUrl: language === 'en'
        ? '/filer/cv/Sebastian_Drumm_CV_EN.pdf'
        : '/filer/cv/Sebastian_Drumm_CV.pdf'
    }
  );

  const html = await ejs.renderFile(path.join(__dirname, 'views', 'layout.ejs'), {
    ...options,
    cspNonce: req.cspNonce,
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

// Eventdelen har sit eget layout og er ikke koblet til CV-navigationen.
const eventAdminKey = process.env.EVENT_ADMIN_KEY;
const guestRemovalEnabled = Boolean(eventAdminKey && eventAdminKey.length >= 32);
const guestRemovalStatus = {
  removed: 'Gæsten er fjernet. En eventuel kalenderaflysning er lagt i mailkøen.',
  missing: 'Der blev ikke fundet en tilmelding med den mailadresse.',
  denied: 'Adminnøglen er forkert.',
  unavailable: 'Gæsten er ikke fjernet: kalenderaflysningen kunne ikke lægges i kø. Prøv igen.'
};

const renderEventOverview = async (req, res, invitationReport = null) => {
  let cancelled = new Set();
  try { cancelled = new Set((await getDatabase()?.collection('eventCancellations').find({}).toArray() || []).map(item => item._id)); } catch {}
  return res.render('event/index', {
  events: events.map(event => ({ ...event, cancelled: cancelled.has(event.id) })),
  quizzes: quizSummaries,
  guestRemovalEnabled,
  invitationReport,
  googleCalendarEnabled: googleCalendar.enabled(),
  guestNotice: Object.hasOwn(guestRemovalStatus, req.query.guest)
    ? guestRemovalStatus[req.query.guest]
    : ''
});
};
app.get('/event', (req, res) => renderEventOverview(req, res));

app.post('/event/admin/invitations', async (req, res) => {
  if (!guestRemovalEnabled) return res.sendStatus(404);
  res.set('Cache-Control', 'no-store');
  const event = events.find(item => item.id === req.body.eventId);
  if (!event) return res.sendStatus(404);
  const report = { eventId: event.id, rows: [], cancellations: [], total: 0, error: '', notice: '' };
  const key = typeof req.body.adminKey === 'string' ? req.body.adminKey : '';
  const digest = value => crypto.createHash('sha256').update(value).digest();
  if (!crypto.timingSafeEqual(digest(key), digest(eventAdminKey))) {
    report.error = 'Adminnøglen er forkert.';
    res.status(403);
    return renderEventOverview(req, res, report);
  }
  const db = getDatabase();
  if (!db) {
    report.error = 'Eventdatabasen er ikke tilgængelig. Prøv igen.';
    res.status(503);
    return renderEventOverview(req, res, report);
  }
  try {
    const operation = req.body.operation || 'check';
    if (!['check', 'send_missing', 'send_google', 'cancel_event'].includes(operation)) return res.sendStatus(400);
    if (operation === 'send_google' && !googleCalendar.enabled()) {
      report.error = 'Google Kalender skal først tilsluttes på CV-servicen.';
      return renderEventOverview(req, res, report);
    }
    const cancelled = await db.collection('eventCancellations').findOne({ _id: event.id });
    if (['send_missing', 'send_google'].includes(operation) && cancelled) {
      report.error = 'Eventet er aflyst. Der sendes ikke nye invitationer.';
      return renderEventOverview(req, res, report);
    }
    if (operation === 'cancel_event') {
      await db.collection('eventCancellations').updateOne({ _id: event.id }, { $setOnInsert: { cancelledAt: new Date() } }, { upsert: true });
      if (googleCalendar.enabled()) await googleCalendar.cancelEvent(event);
      const enrollments = await db.collection('enrollments').find({ eventId: event.id }).toArray();
      let removed = 0, failed = 0;
      for (const enrollment of enrollments) {
        const person = await db.collection('participants').findOne({ id: enrollment.participantId });
        try {
          if (person && await removeGuestWithCancellation(db, event, person)) removed++;
          else failed++;
        } catch { failed++; }
      }
      notifyAttendees(event.id);
      report.notice = `Eventet er aflyst. ${removed} tilmeldinger er fjernet med eventuelle kalenderaflysninger i kø. ${failed} kunne ikke behandles; tryk Aflys event igen for at prøve dem igen.`;
    } else if (!googleCalendar.enabled()) {
      try {
        const sync = await syncCalendarReplies();
        if (sync.status === 'not_configured') report.notice = 'Kalendersvar kræver Gmail OAuth-opsætning. Mailstatus kan stadig tjekkes.';
        if (sync.status === 'partial') report.notice = 'Gmail blev delvist kontrolleret. Tryk Tjek igen om lidt for at fortsætte.';
      } catch { report.notice = 'Gmail-svar kunne ikke opdateres. Viser senest kendte svar.'; }
    }
    const filter = { eventId: event.id };
    report.total = await db.collection('enrollments').countDocuments(filter);
    const enrollments = await db.collection('enrollments').find(filter).sort({ createdAt: 1 }).limit(100).toArray();
    const people = await db.collection('participants').find({ id: { $in: enrollments.map(item => item.participantId) } }).toArray();
    const participants = new Map(people.map(person => [person.id, person]));
    let submitted = 0;
    // Read status only: opening this overview never sends invitations.
    for (let offset = 0; offset < enrollments.length; offset += 5) {
      const rows = await Promise.all(enrollments.slice(offset, offset + 5).map(async enrollment => {
        const participant = participants.get(enrollment.participantId);
        if (!participant) return { name: 'Ukendt deltager', status: 'unknown', sentAt: null };
        const invitation = await refreshInvitation(db, event, participant);
        if (((operation === 'send_missing' && ['not_sent', 'failed'].includes(invitation.status)) || operation === 'send_google') && !enrollment.cancelling) {
          const sent = await ensureInvitation(db, event, participant);
          if (['sent', 'queued', 'sending'].includes(sent.status)) submitted++;
          return { name: participant.name, ...sent };
        }
        return { name: participant.name, ...invitation };
      }));
      report.rows.push(...rows);
    }
    if (operation === 'send_missing') report.notice += ` ${submitted} manglende invitationer er sendt eller lagt i kø. Allerede sendte og uafklarede invitationer er sprunget over.`;
    if (operation === 'send_google') report.notice = `${submitted} deltagere er inviteret eller allerede registreret i Google Kalender. Gamle mailinvitationer er aflyst ved overflytning. Eventuelle fejl vises nedenfor.`;
    const cancellations = await db.collection('calendarCancellations').find({ eventId: event.id }).sort({ createdAt: -1 }).limit(100).toArray();
    for (const item of cancellations) {
      if (item.provider === 'google') { report.cancellations.push({ name: item.name, status: item.status }); continue; }
      try {
        const state = await getCalendarInvitationStatus(item.requestId);
        report.cancellations.push({ name: item.name, status: state.status });
      } catch { report.cancellations.push({ name: item.name, status: 'UNKNOWN' }); }
    }
  } catch (error) {
    console.error('Invitation overview failed:', error.message);
    report.error = 'Invitationernes status kunne ikke hentes. Prøv igen.';
    res.status(503);
  }
  return renderEventOverview(req, res, report);
});

app.post('/event/admin/remove-guest', async (req, res) => {
  if (!guestRemovalEnabled) return res.sendStatus(404);
  const key = typeof req.body.adminKey === 'string' ? req.body.adminKey : '';
  const digest = value => crypto.createHash('sha256').update(value).digest();
  if (!crypto.timingSafeEqual(digest(key), digest(eventAdminKey))) {
    return res.redirect(303, '/event?guest=denied#events');
  }
  const { eventId } = req.body;
  if (!events.some(event => event.id === eventId)) return res.sendStatus(404);
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const db = getDatabase();
  if (!db) return res.redirect(303, '/event?guest=unavailable#events');

  try {
    const participant = await db.collection('participants').findOne({ email });
    if (!participant) return res.redirect(303, '/event?guest=missing#events');
    const removed = await removeGuestWithCancellation(db, events.find(event => event.id === eventId), participant);
    if (!removed) return res.redirect(303, '/event?guest=missing#events');
    notifyAttendees(eventId);
    return res.redirect(303, '/event?guest=removed#events');
  } catch {
    return res.redirect(303, '/event?guest=unavailable#events');
  }
});
app.get('/event/api/csrf', issueCsrf);

app.get('/event/api/participant', async (req, res) => {
  const db = getDatabase();
  if (!db) return res.status(503).json({ error: 'Eventdatabasen er ikke tilgængelig.' });
  const cookie = readParticipant(req.headers.cookie);
  try {
    const participant = cookie ? await db.collection('participants').findOne({ id: cookie.id }) : null;
    const eventId = typeof req.query.event === 'string' ? req.query.event : '';
    const enrolled = participant && isJoinableGame(eventId)
      ? await db.collection('enrollments').findOne({ eventId, participantId: participant.id })
      : false;
    res.json({ participant: participant ? { name: participant.name, email: participant.email } : null,
      enrolled: Boolean(enrolled), invitation: enrolled
        ? await refreshInvitation(db, events.find(event => event.id === eventId), participant)
        : invitationStatus(null, events.find(event => event.id === eventId)) });
  } catch (error) {
    console.error('Participant lookup failed:', error);
    res.status(503).json({ error: 'Deltageren kunne ikke hentes.' });
  }
});

app.get('/event/api/attendees', async (req, res) => {
  const eventId = typeof req.query.event === 'string' ? req.query.event : '';
  if (!events.some(item => item.id === eventId)) return res.status(404).json({ error: 'Eventet blev ikke fundet.' });
  const db = getDatabase();
  if (!db) return res.status(503).json({ error: 'Eventdatabasen er ikke tilgængelig.' });
  try {
    const collection = db.collection('enrollments');
    const [total, enrollments] = await Promise.all([
      collection.countDocuments({ eventId }),
      collection.find({ eventId }).sort({ createdAt: 1 }).limit(100).toArray()
    ]);
    const people = await db.collection('participants').find(
      { id: { $in: enrollments.map(enrollment => enrollment.participantId) } },
      { projection: { id: 1, name: 1 } }
    ).toArray();
    const names = new Map(people.map(person => [person.id, person.name]));
    res.json({ total, attendees: enrollments.map(enrollment => names.get(enrollment.participantId)).filter(Boolean) });
  } catch (error) {
    console.error('Attendee lookup failed:', error);
    res.status(503).json({ error: 'Deltagerlisten kunne ikke hentes.' });
  }
});

app.get('/event/api/attendees/live', (req, res) => {
  const eventId = typeof req.query.event === 'string' ? req.query.event : '';
  if (!events.some(item => item.id === eventId)) return res.status(404).end();
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  res.write(': connected\n\n');
  const unsubscribe = subscribeAttendees(eventId, () => res.write('data: updated\n\n'));
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(heartbeat); unsubscribe(); });
});

app.post('/event/api/participant', requireCsrf, async (req, res) => {
  const db = getDatabase();
  if (!db) return res.status(503).json({ error: 'Eventdatabasen er ikke tilgængelig.' });
  const eventId = typeof req.body.eventId === 'string' ? req.body.eventId : '';
  if (!isJoinableGame(eventId)) return res.status(404).json({ error: 'Eventet blev ikke fundet.' });
  const cookie = readParticipant(req.headers.cookie);
  try {
    if (await db.collection('eventCancellations').findOne({ _id: eventId })) return res.status(409).json({ error: 'Eventet er aflyst.' });
    const existing = cookie ? await db.collection('participants').findOne({ id: cookie.id }) : null;
    if (existing) {
      await db.collection('enrollments').updateOne(
        { eventId, participantId: existing.id },
        { $setOnInsert: { eventId, participantId: existing.id, createdAt: new Date(), calendarUid: `${eventId}-${crypto.randomUUID()}@sebastiandrumm.dk` } },
        { upsert: true }
      );
      if (await db.collection('eventCancellations').findOne({ _id: eventId })) {
        await removeGuestWithCancellation(db, events.find(event => event.id === eventId), existing);
        return res.status(409).json({ error: 'Eventet er aflyst.' });
      }
      notifyAttendees(eventId);
      const invitation = await ensureInvitation(db, events.find(event => event.id === eventId), existing).catch(() => ({ status: 'unknown' }));
      return res.json({ participant: { name: existing.name, email: existing.email }, enrolled: true, invitation });
    }
  } catch (error) {
    console.error('Event enrollment failed:', error);
    return res.status(503).json({ error: 'Tilmeldingen kunne ikke gemmes.' });
  }
  const name = typeof req.body.name === 'string' ? req.body.name.trim().replace(/\s+/g, ' ') : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (name.length < 2 || name.length > 40 || /[<>\x00-\x1f]/.test(name)) {
    return res.status(400).json({ error: 'Skriv et navn på 2–40 tegn.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Skriv en gyldig mailadresse.' });
  const { participant, token } = createParticipant(name);
  try {
    await db.collection('participants').insertOne({ ...participant, email, createdAt: new Date() });
    res.cookie(COOKIE, token, { httpOnly: true, secure: req.secure, sameSite: 'lax', maxAge: 365 * 24 * 60 * 60 * 1000, path: '/event' });
    if (await db.collection('eventCancellations').findOne({ _id: eventId })) return res.status(409).json({ error: 'Eventet er aflyst.' });
    await db.collection('enrollments').insertOne({ eventId, participantId: participant.id, createdAt: new Date(), calendarUid: `${eventId}-${crypto.randomUUID()}@sebastiandrumm.dk` });
    if (await db.collection('eventCancellations').findOne({ _id: eventId })) {
      await removeGuestWithCancellation(db, events.find(event => event.id === eventId), { ...participant, email });
      return res.status(409).json({ error: 'Eventet er aflyst.' });
    }
    notifyAttendees(eventId);
    const invitation = await ensureInvitation(db, events.find(event => event.id === eventId), { ...participant, email }).catch(() => ({ status: 'unknown' }));
    res.status(201).json({ participant: { name, email }, enrolled: true, invitation });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Mailadressen findes allerede. Åbn siden i den browser, hvor du først tilmeldte dig.' });
    console.error('Participant registration failed:', error);
    res.status(503).json({ error: 'Tilmeldingen kunne ikke gemmes.' });
  }
});

app.post('/event/api/invitation', requireCsrf, async (req, res) => {
  const db = getDatabase();
  const cookie = readParticipant(req.headers.cookie);
  if (!db) return res.status(503).json({ error: 'Eventdatabasen er ikke tilgængelig.' });
  if (!cookie) return res.status(401).json({ error: 'Tilmeld dig først.' });
  const event = events.find(item => item.id === req.body.eventId);
  if (!event) return res.sendStatus(404);
  try {
    const participant = await db.collection('participants').findOne({ id: cookie.id });
    const enrollment = await db.collection('enrollments').findOne({ eventId: event.id, participantId: cookie.id });
    if (!participant || !enrollment) return res.status(403).json({ error: 'Tilmeld dig dette event først.' });
    res.json({ invitation: await ensureInvitation(db, event, participant) });
  } catch {
    res.status(503).json({ error: 'Invitationens status kunne ikke hentes. Prøv at tjekke igen.' });
  }
});

async function quizParticipant(req, res, next) {
  const eventId = typeof req.body.eventId === 'string' ? req.body.eventId : '';
  if (!isJoinableGame(eventId)) return res.status(404).json({ error: 'Eventet blev ikke fundet.' });
  const cookie = readParticipant(req.headers.cookie);
  const db = getDatabase();
  if (!cookie || !db) return res.status(401).json({ error: 'Tilmeld dig eventet for at spille quiz.' });
  try {
    const enrollment = await db.collection('enrollments').findOne({ eventId, participantId: cookie.id });
    if (!enrollment) return res.status(403).json({ error: 'Tilmeld dig dette event for at spille quiz.' });
    req.quizParticipant = cookie;
    next();
  } catch (error) {
    console.error('Quiz enrollment lookup failed:', error);
    res.status(503).json({ error: 'Quizzen er ikke tilgængelig lige nu.' });
  }
}

app.post('/event/api/quiz/start', requireCsrf, quizParticipant, async (req, res) => {
  const quiz = quizzes.find(item => item.id === req.body.quizId);
  if (!quiz) return res.status(404).json({ error: 'Quizzen blev ikke fundet.' });
  const session = createSession(req.body.eventId, req.quizParticipant.id, quiz.id);
  try {
    const updates = await session.request({ type: 'Start', game_id: req.body.eventId,
      player_id: req.quizParticipant.id, quiz_id: quiz.id }, ['Question']);
    res.json({ quiz: { id: quiz.id, title: quiz.title }, question: updates[0] });
  } catch (error) {
    session.close();
    res.status(502).json({ error: error.message });
  }
});

app.post('/event/api/quiz/answer', requireCsrf, quizParticipant, async (req, res) => {
  const answerIndex = req.body.answerIndex;
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 2) return res.status(400).json({ error: 'Vælg svar A, B eller C.' });
  const session = getSession(req.body.eventId, req.quizParticipant.id);
  if (!session) return res.status(409).json({ error: 'Start quizzen igen.' });
  try {
    const updates = await session.request({ type: 'Answer', answer_index: answerIndex }, ['Question', 'RoundEnd']);
    const score = updates.find(update => update.type === 'Score');
    const next = updates.at(-1);
    if (next.type === 'RoundEnd') {
      await getDatabase().collection('quizResults').updateOne(
        { eventId: req.body.eventId, participantId: req.quizParticipant.id, quizId: session.quizId },
        { $set: { score: next.score, total: next.total_questions, completedAt: new Date() } },
        { upsert: true }
      );
    }
    res.json({ result: score, next });
  } catch (error) {
    session.close();
    res.status(502).json({ error: error.message });
  }
});

app.get('/event/quiz/:id', (req, res) => {
  const quiz = quizSummaries.find(item => item.id === req.params.id);
  if (!quiz) return res.status(404).send('Quizzen blev ikke fundet.');
  res.render('event/quiz', { quiz });
});

app.get('/event/:id', async (req, res) => {
  const event = events.find(item => item.id === req.params.id);
  if (!event) return res.status(404).send('Eventet blev ikke fundet.');
  try {
    const cancelled = await getDatabase()?.collection('eventCancellations').findOne({ _id: event.id });
    res.render('event/detail', { event: { ...event, cancelled: Boolean(cancelled) } });
  } catch { res.status(503).send('Eventet kunne ikke hentes lige nu.'); }
});

app.post('/event/api/echo', requireCsrf, async (req, res) => {
  const participant = readParticipant(req.headers.cookie);
  if (!participant) return res.status(401).json({ error: 'Skriv dit navn først.' });
  const db = getDatabase();
  if (!db || !await db.collection('participants').findOne({ id: participant.id })) return res.status(401).json({ error: 'Tilmeld dig eventdelen først.' });
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  if (!message || message.length > 500) return res.status(400).json({ error: 'Skriv en besked på højst 500 tegn.' });
  const client = createEchoClient();
  client.Echo({ message, name: participant.name }, { deadline: Date.now() + 5000 }, (error, response) => {
    client.close();
    if (error) return res.status(error.code === 3 ? 400 : 502).json({ error: error.details || 'Echo svarer ikke lige nu.' });
    res.json(response);
  });
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

attachVoting(httpServer, events);
httpServer.listen(PORT, () => {
  console.log(`Server kører på http://localhost:${PORT}`);
  console.log(`Åbn din browser på http://localhost:${PORT}`);
});
startGrpcServer().then(({ port }) => console.log(`Echo gRPC kører på port ${port}`))
  .catch(error => console.error('Echo gRPC kunne ikke starte:', error));
connectDatabase().then(db => { if (db) console.log('Eventdatabasen er forbundet.'); })
  .catch(error => console.error('Eventdatabasen kunne ikke forbindes:', error.message));

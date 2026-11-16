const crypto = require('crypto');
const { readParticipant } = require('./participant');

const cookieName = 'event_csrf';
const secret = process.env.EVENT_COOKIE_SECRET || crypto.randomBytes(32).toString('hex');
const allowedOrigins = new Set([
  'http://localhost:3010',
  'http://127.0.0.1:3010',
  'https://www.sebastiandrumm.dk',
  'https://sebastiandrumm.dk',
  ...(process.env.EVENT_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean)
]);

function isAllowedOrigin(origin) {
  if (!origin || origin === 'null') return false;
  try { return allowedOrigins.has(new URL(origin).origin) && new URL(origin).origin === origin; }
  catch { return false; }
}

function cookieValue(header = '', name) {
  const entry = header.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : null;
}

function sign(nonce, participantId) {
  return crypto.createHmac('sha256', secret).update(`${nonce}:${participantId || 'anonymous'}`).digest('base64url');
}

function issueCsrf(req, res) {
  const nonce = crypto.randomBytes(32).toString('base64url');
  const participantId = readParticipant(req.headers.cookie)?.id;
  const token = `${nonce}.${sign(nonce, participantId)}`;
  res.cookie(cookieName, token, { httpOnly: true, secure: req.secure, sameSite: 'strict', path: '/event', maxAge: 2 * 60 * 60 * 1000 });
  res.json({ csrfToken: token });
}

function requireCsrf(req, res, next) {
  const token = req.get('x-csrf-token');
  const cookie = cookieValue(req.headers.cookie, cookieName);
  if (!token || !cookie || token !== cookie) return res.status(403).json({ error: 'Sikkerhedstoken mangler eller er ugyldig. Genindlæs siden.' });
  const [nonce, supplied, extra] = token.split('.');
  if (!nonce || !supplied || extra || !/^[A-Za-z0-9_-]{43}$/.test(nonce)) return res.status(403).json({ error: 'Ugyldigt sikkerhedstoken.' });
  const expected = sign(nonce, readParticipant(req.headers.cookie)?.id);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return res.status(403).json({ error: 'Ugyldigt sikkerhedstoken.' });
  }
  next();
}

module.exports = { isAllowedOrigin, issueCsrf, requireCsrf };

const crypto = require('crypto');

const COOKIE = 'event_participant';
const secret = process.env.EVENT_COOKIE_SECRET || crypto.randomBytes(32).toString('hex');

function signature(payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function readParticipant(cookieHeader = '') {
  const token = cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token) return null;
  const separator = token.lastIndexOf('.');
  if (separator < 1) return null;
  const payload = token.slice(0, separator);
  const supplied = token.slice(separator + 1);
  const expected = signature(payload);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;
  try {
    const participant = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!/^[a-f0-9-]{36}$/.test(participant.id) || typeof participant.name !== 'string' || participant.name.length < 2 || participant.name.length > 40) return null;
    return participant;
  } catch { return null; }
}

function createParticipant(name) {
  const participant = { id: crypto.randomUUID(), name };
  const payload = Buffer.from(JSON.stringify(participant)).toString('base64url');
  return { participant, token: `${payload}.${signature(payload)}` };
}

module.exports = { COOKIE, readParticipant, createParticipant };

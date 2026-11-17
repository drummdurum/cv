const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { OAuth2Client } = require('google-auth-library');

let calendar, originalRequest, current, calls, version, identity;
const savedEnv = { ...process.env };
const event = { id: 'gloegg-og-hygge', title: 'Gløgg & hygge', place: 'København', description: 'Hygge', startsAt: '2026-12-04T18:30:00+01:00', endsAt: '2026-12-04T23:30:00+01:00' };
const guest = { name: 'Ven', email: 'friend@example.test' };
const copy = value => JSON.parse(JSON.stringify(value));
function fail(status) { const error = new Error('test'); error.response = { status }; throw error; }

beforeEach(() => {
  Object.assign(process.env, { GOOGLE_CALENDAR_CLIENT_ID: 'test', GOOGLE_CALENDAR_CLIENT_SECRET: 'test', GOOGLE_CALENDAR_REFRESH_TOKEN: 'test', GOOGLE_CALENDAR_ACCOUNT: 'sedrumm@gmail.com', EVENT_CALENDAR_PROVIDER: 'google' });
  delete require.cache[require.resolve('../services/googleCalendar')];
  calendar = require('../services/googleCalendar');
  current = null; calls = []; version = 0; identity = 'sedrumm@gmail.com';
  originalRequest = OAuth2Client.prototype.request;
  OAuth2Client.prototype.request = async options => {
    if (options.url.includes('/userinfo')) return { data: { email: identity, email_verified: true } };
    calls.push(copy(options));
    if (options.method === 'GET') { if (!current) fail(404); return { data: copy(current) }; }
    if (options.method === 'POST') {
      if (current) fail(409);
      current = { ...copy(options.data), organizer: { email: identity }, etag: String(++version), htmlLink: 'https://calendar.google.com/calendar/event?eid=test' };
      return { data: copy(current) };
    }
    if (!current) fail(404);
    if (options.headers['If-Match'] !== current.etag) fail(412);
    if (options.method === 'PATCH') { current = { ...current, ...copy(options.data), etag: String(++version) }; return { data: copy(current) }; }
    if (options.method === 'DELETE') { current = null; return { data: '' }; }
    throw new Error('Unexpected request');
  };
});
afterEach(() => { OAuth2Client.prototype.request = originalRequest; for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key]; Object.assign(process.env, savedEnv); });

test('creates one shared event with correct dates, guest privacy and no duplicate invitations', async () => {
  const first = await calendar.addGuest(event, guest);
  assert.equal(first.provider, 'google'); assert.equal(first.status, 'sent');
  await calendar.addGuest(event, guest);
  await calendar.addGuest(event, { name: 'Anden ven', email: 'second@example.test' });
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
  assert.equal(calls.filter(call => call.method === 'PATCH').length, 1);
  assert.equal(current.attendees.length, 2);
  assert.equal(current.start.dateTime, event.startsAt); assert.equal(current.end.dateTime, event.endsAt);
  assert.equal(current.guestsCanSeeOtherGuests, false);
  assert.match(current.id, /^[0-9a-v]+$/);
  assert(calls.filter(call => call.method !== 'GET').every(call => call.url.includes('sendUpdates=all')));
});

test('concurrent signups preserve both guests using etags and conflict retries', async () => {
  await Promise.all([calendar.addGuest(event, guest), calendar.addGuest(event, { name: 'Anden', email: 'other@example.test' })]);
  assert.deepEqual(current.attendees.map(person => person.email).sort(), ['friend@example.test', 'other@example.test']);
});

test('reads accept and decline from Google instead of the mail inbox', async () => {
  await calendar.addGuest(event, guest);
  current.attendees[0].responseStatus = 'accepted';
  assert.equal((await calendar.guestStatus(event, guest)).calendarResponse, 'accepted');
  current.attendees[0].responseStatus = 'declined';
  assert.equal((await calendar.guestStatus(event, guest)).calendarResponse, 'declined');
});

test('organizer gets the event in their own calendar without inviting themselves', async () => {
  const state = await calendar.addGuest(event, { name: 'Sebastian', email: 'sedrumm@gmail.com' });
  assert.equal(state.owner, true); assert.equal(state.calendarResponse, 'accepted'); assert.equal(current.attendees.length, 0);
});

test('guest removal preserves other guests and whole-event cancellation is idempotent', async () => {
  await calendar.addGuest(event, guest);
  await calendar.addGuest(event, { name: 'Anden', email: 'other@example.test' });
  await calendar.removeGuest(event, guest);
  assert.deepEqual(current.attendees.map(person => person.email), ['other@example.test']);
  await calendar.cancelEvent(event); await calendar.cancelEvent(event);
  assert.equal(calls.filter(call => call.method === 'DELETE').length, 1);
});

test('refuses a different Google account before changing any calendar', async () => {
  identity = 'other@example.test';
  await assert.rejects(calendar.addGuest(event, guest), /matcher ikke/);
  assert.equal(calls.length, 0);
});

test('requires a valid end time and refuses unrelated existing calendar events', async () => {
  await assert.rejects(calendar.addGuest({ ...event, endsAt: undefined }, guest), /sluttidspunkt/);
  await calendar.addGuest(event, guest);
  current.extendedProperties.private.cvEventId = 'unrelated';
  await assert.rejects(calendar.removeGuest(event, guest), /tilhører ikke/);
});

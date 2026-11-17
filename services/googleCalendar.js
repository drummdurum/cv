const { createHash } = require('crypto');
const { OAuth2Client } = require('google-auth-library');

const enabled = () => process.env.EVENT_CALENDAR_PROVIDER === 'google';
const owner = () => (process.env.GOOGLE_CALENDAR_ACCOUNT || 'sedrumm@gmail.com').toLowerCase();
const calendarId = () => process.env.GOOGLE_CALENDAR_ID || 'primary';
let client;
let identityChecked = false;

function oauthClient() {
  if (!process.env.GOOGLE_CALENDAR_CLIENT_ID || !process.env.GOOGLE_CALENDAR_CLIENT_SECRET || !process.env.GOOGLE_CALENDAR_REFRESH_TOKEN) {
    throw new Error('Google Kalender mangler OAuth-opsætning på CV-servicen.');
  }
  if (!client) {
    client = new OAuth2Client(process.env.GOOGLE_CALENDAR_CLIENT_ID, process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
    client.setCredentials({ refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN });
  }
  return client;
}

async function checkConnection() {
  const auth = oauthClient();
  if (!identityChecked) {
    let profile;
    try { profile = await auth.request({ url: 'https://openidconnect.googleapis.com/v1/userinfo', timeout: 10000, retry: false }); }
    catch { throw new Error('Google OAuth kunne ikke valideres. Tilslut kalenderen igen.'); }
    if (profile.data.email?.toLowerCase() !== owner() || !profile.data.email_verified) throw new Error('Google-kontoen matcher ikke kalenderarrangøren.');
    identityChecked = true;
  }
  return owner();
}

async function request(path, method = 'GET', data, etag) {
  await checkConnection();
  const auth = oauthClient();
  try {
    return (await auth.request({ url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId())}/${path}`,
      method, data, timeout: 10000, retry: false, headers: etag ? { 'If-Match': etag } : {} })).data;
  } catch (error) {
    // Do not expose OAuth tokens or Google's request configuration in logs.
    const failure = new Error(`Google Kalender svarede med HTTP ${error.response?.status || 'ukendt'}.`);
    failure.status = error.response?.status;
    throw failure;
  }
}

function eventId(event) {
  // Google accepts base32hex IDs; a deterministic ID also survives a lost response.
  return 'cv' + createHash('sha256').update(`sebastiandrumm.dk:${owner()}:${event.id}`).digest('hex');
}

async function getEvent(event) {
  try { return await request(`events/${eventId(event)}`); }
  catch (error) { if ([404, 410].includes(error.status)) return null; throw error; }
}

function eventBody(event, attendees) {
  if (!Number.isFinite(Date.parse(event.startsAt)) || !Number.isFinite(Date.parse(event.endsAt)) || Date.parse(event.endsAt) <= Date.parse(event.startsAt)) {
    throw new Error('Google-invitationen kræver et gyldigt start- og sluttidspunkt.');
  }
  const publicUrl = event.publicUrl || `https://sebastiandrumm.dk/event/${encodeURIComponent(event.id)}`;
  if (new URL(publicUrl).origin !== 'https://sebastiandrumm.dk') throw new Error('Eventlinket skal tilhøre sebastiandrumm.dk.');
  return { id: eventId(event), summary: event.title, location: event.place,
    description: `${event.description}\n\n${event.details || ''}\n\n${publicUrl}`,
    start: { dateTime: event.startsAt, timeZone: 'Europe/Copenhagen' },
    end: { dateTime: event.endsAt, timeZone: 'Europe/Copenhagen' }, attendees,
    guestsCanInviteOthers: false, guestsCanModify: false, guestsCanSeeOtherGuests: false,
    extendedProperties: { private: { cvEventId: event.id, cvSite: 'sebastiandrumm.dk' } } };
}

function verifyEvent(calendarEvent, event) {
  if (calendarEvent.status === 'cancelled') throw new Error('Google-eventet er aflyst og kan ikke genbruges.');
  if (calendarEvent.organizer?.email?.toLowerCase() !== owner() || calendarEvent.extendedProperties?.private?.cvEventId !== event.id) {
    throw new Error('Google-eventet tilhører ikke dette event på sebastiandrumm.dk.');
  }
}

async function addGuest(event, participant) {
  const email = participant.email.toLowerCase();
  const isOwner = email === owner();
  for (let attempt = 0; attempt < 6; attempt++) {
    let current = await getEvent(event);
    if (!current) {
      try {
        current = await request('events?sendUpdates=all', 'POST', eventBody(event, isOwner ? [] : [{ email, displayName: participant.name }]));
      } catch (error) { if (error.status === 409) continue; throw error; }
    }
    verifyEvent(current, event);
    if (isOwner || current.attendees?.some(guest => guest.email.toLowerCase() === email)) return statusFor(current, participant);
    try {
      const updated = await request(`events/${current.id}?sendUpdates=all`, 'PATCH', {
        attendees: [...(current.attendees || []), { email, displayName: participant.name }]
      }, current.etag);
      return statusFor(updated, participant);
    } catch (error) { if (error.status === 412) continue; throw error; }
  }
  throw new Error('Kalenderen blev ændret samtidig. Prøv igen.');
}

function statusFor(calendarEvent, participant) {
  const isOwner = participant.email.toLowerCase() === owner();
  const attendee = calendarEvent.attendees?.find(guest => guest.email.toLowerCase() === participant.email.toLowerCase());
  return { provider: 'google', status: isOwner || attendee ? 'sent' : 'not_sent',
    deliveryStatus: 'google_calendar', calendarResponse: isOwner ? 'accepted' : ({ needsAction: 'needs_action' })[attendee?.responseStatus] || attendee?.responseStatus || 'needs_action',
    calendarUrl: calendarEvent.htmlLink || null, owner: isOwner, googleEventId: calendarEvent.id };
}

async function guestStatus(event, participant) {
  const current = await getEvent(event);
  if (!current || current.status === 'cancelled') return { provider: 'google', status: 'not_sent', deliveryStatus: 'google_calendar', calendarResponse: 'needs_action' };
  verifyEvent(current, event);
  return statusFor(current, participant);
}

async function removeGuest(event, participant) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await getEvent(event);
    if (!current || current.status === 'cancelled') return;
    verifyEvent(current, event);
    const attendees = current.attendees || [];
    const remaining = attendees.filter(guest => guest.email.toLowerCase() !== participant.email.toLowerCase());
    if (remaining.length === attendees.length) return;
    try { await request(`events/${current.id}?sendUpdates=all`, 'PATCH', { attendees: remaining }, current.etag); return; }
    catch (error) { if (error.status === 412) continue; throw error; }
  }
  throw new Error('Kalenderen blev ændret samtidig. Prøv igen.');
}

async function cancelEvent(event) {
  const current = await getEvent(event);
  if (!current || current.status === 'cancelled') return;
  verifyEvent(current, event);
  try { await request(`events/${current.id}?sendUpdates=all`, 'DELETE', undefined, current.etag); }
  catch (error) { if (![404, 410].includes(error.status)) throw error; }
}

module.exports = { enabled, checkConnection, addGuest, guestStatus, removeGuest, cancelEvent, eventId, eventBody };

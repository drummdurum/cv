const { test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const google = require('../services/googleCalendar');
const mail = require('../services/mailService');

let invitations, enrollment, db, cancellations, added, connected;
const event = require('../event/data').find(item => item.id === 'gloegg-og-hygge');
const participant = { id: 'test-person', name: 'Ven', email: 'friend@example.test' };
beforeEach(() => {
  connected = true; cancellations = 0; added = 0;
  enrollment = { _id: 'enrollment', participantId: participant.id, eventId: event.id,
    invitation: { status: 'sent', sentAt: new Date() }, calendarSnapshot: { uid: 'old-invite@sebastiandrumm.dk', organizer: 'sedrumm@gmail.com', recipient: participant.email, event } };
  mock.method(google, 'enabled', () => true);
  mock.method(google, 'checkConnection', async () => { if (!connected) throw new Error('Test: not connected'); });
  mock.method(google, 'addGuest', async () => { added++; return { provider: 'google', status: 'sent', calendarResponse: 'needs_action' }; });
  mock.method(google, 'guestStatus', async () => ({ provider: 'google', status: 'not_sent', calendarResponse: 'needs_action' }));
  mock.method(mail, 'sendCalendarInvitation', async payload => { assert.equal(payload.calendar.method, 'CANCEL'); assert.equal(payload.previousRequestId, 'old-invite@sebastiandrumm.dk'); cancellations++; return { status: 'QUEUED' }; });
  db = { collection(name) {
    if (name === 'eventCancellations') return { findOne: async () => null };
    if (name === 'calendarCancellations') return { updateOne: async () => ({}) };
    assert.equal(name, 'enrollments');
    return { findOne: async () => enrollment, updateOne: async (filter, update) => {
      if (filter['invitation.status']?.$ne === enrollment.invitation.status) return {};
      Object.assign(enrollment, update.$set || {}); return {};
    } };
  } };
  delete require.cache[require.resolve('../event/invitations')];
  invitations = require('../event/invitations');
});
afterEach(() => mock.restoreAll());

test('migration cancels an old mail invitation before adding the guest to Google', async () => {
  const result = await invitations.ensureInvitation(db, event, participant);
  assert.equal(result.provider, 'google'); assert.equal(result.status, 'sent');
  assert.equal(cancellations, 1); assert.equal(added, 1);
  assert.equal(enrollment.googleMigration.legacyCancelled, true);
  await invitations.ensureInvitation(db, event, participant);
  assert.equal(cancellations, 1);
});

test('invalid OAuth never cancels the existing invitation', async () => {
  connected = false;
  mock.method(console, 'error', () => {});
  const result = await invitations.ensureInvitation(db, event, participant);
  assert.equal(result.status, 'unknown'); assert.equal(cancellations, 0); assert.equal(added, 0);
  assert.equal(enrollment.invitation.status, 'sent'); assert.equal(enrollment.googleMigration, undefined);
});

test('interrupted migration can resume from Google status without sending the old cancellation again', async () => {
  enrollment.googleMigration = { legacyCancelled: true };
  const status = await invitations.refreshInvitation(db, event, participant);
  assert.equal(status.provider, 'google'); assert.equal(status.status, 'not_sent');
  await invitations.ensureInvitation(db, event, participant);
  assert.equal(cancellations, 0); assert.equal(added, 1);
});

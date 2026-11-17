const { createCalendarInvitation } = require('./calendar');
const { sendCalendarInvitation, getCalendarInvitationStatus } = require('../services/mailService');

function invitationStatus(enrollment, event) {
  if (!event?.startsAt) return { status: 'unavailable' };
  const invitation = enrollment?.invitation;
  return { status: invitation?.status || 'not_sent', sentAt: invitation?.sentAt || null };
}

async function ensureInvitation(db, event, participant) {
  const collection = db.collection('enrollments');
  const key = { eventId: event?.id, participantId: participant.id };
  if (!event?.startsAt) return { status: 'unavailable' };
  // Atomic claim prevents double-clicks and concurrent requests from sending twice.
  // Ambiguous timeouts stay unknown: do not automatically risk a duplicate.
  const claimed = await collection.findOneAndUpdate({ ...key, $or: [
    { 'invitation.status': { $exists: false } }, { 'invitation.status': 'not_sent' }
  ] }, { $set: { 'invitation.status': 'sending', 'invitation.attemptedAt': new Date() } }, { returnDocument: 'after' });
  if (!claimed) return refreshInvitation(db, event, participant);
  let state;
  let submitting = false;
  try {
    const calendar = createCalendarInvitation(event, participant);
    if (!process.env.MAIL_SERVICE_URL || !process.env.MAIL_SERVICE_API_KEY) {
      throw new Error('Kalendermail er endnu ikke konfigureret.');
    }
    submitting = true;
    const result = await sendCalendarInvitation({
      requestId: calendar.uid, recipient: participant.email, name: participant.name,
      subject: event.title, calendar: { method: 'REQUEST', filename: 'invitation.ics', content: calendar.content }
    });
    const status = String(result.status || '').toUpperCase();
    state = { status: status === 'SENT' ? 'sent' : status === 'QUEUED' ? 'queued' : 'unknown',
      jobId: typeof result.jobId === 'string' ? result.jobId : null,
      ...(status === 'SENT' ? { sentAt: new Date() } : {}) };
  } catch (error) {
    console.error('Calendar invitation failed:', error.message);
    state = { status: submitting ? 'unknown' : 'not_sent' };
  }
  await collection.updateOne({ ...key, 'invitation.status': { $ne: 'sent' } }, { $set: { invitation: { ...state, attemptedAt: new Date() } } });
  return invitationStatus(await collection.findOne(key), event);
}

async function refreshInvitation(db, event, participant) {
  if (!event?.startsAt) return { status: 'unavailable' };
  const collection = db.collection('enrollments');
  const key = { eventId: event?.id, participantId: participant.id };
  const enrollment = await collection.findOne(key);
  if (!enrollment || !event?.startsAt || !enrollment.invitation || enrollment.invitation.status === 'sent') {
    return invitationStatus(enrollment, event);
  }
  try {
    const result = await getCalendarInvitationStatus(`${event.id}-${participant.id}@sebastiandrumm.dk`);
    const statuses = { SENT: 'sent', QUEUED: 'queued', PROCESSING: 'sending', FAILED: 'failed', UNKNOWN: 'unknown' };
    const status = statuses[result.status];
    if (status) {
      const state = { status, jobId: result.jobId || null,
        ...(status === 'sent' && result.sentAt ? { sentAt: new Date(result.sentAt) } : {}) };
      // Do not overwrite a completed send with an older concurrent status lookup.
      await collection.updateOne({ ...key, 'invitation.status': { $ne: 'sent' } }, { $set: { invitation: state } });
      return invitationStatus(await collection.findOne(key), event);
    }
  } catch (error) {
    console.error('Calendar status lookup failed:', error.message);
    return { ...invitationStatus(enrollment, event), checkFailed: true };
  }
  return invitationStatus(enrollment, event);
}

module.exports = { invitationStatus, ensureInvitation, refreshInvitation };

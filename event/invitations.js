const { createCalendarInvitation } = require('./calendar');
const { sendCalendarInvitation, getCalendarInvitationStatus } = require('../services/mailService');

function invitationStatus(enrollment, event) {
  if (!event?.startsAt) return { status: 'unavailable' };
  const invitation = enrollment?.invitation;
  return { status: invitation?.status || 'not_sent', sentAt: invitation?.sentAt || null,
    deliveryStatus: invitation?.deliveryStatus || 'unknown', calendarResponse: invitation?.calendarResponse || 'needs_action' };
}

async function ensureInvitation(db, event, participant) {
  const collection = db.collection('enrollments');
  const key = { eventId: event?.id, participantId: participant.id };
  if (!event?.startsAt) return { status: 'unavailable' };
  if (await db.collection('eventCancellations').findOne({ _id: event.id })) return { status: 'unavailable' };
  // Atomic claim prevents double-clicks and concurrent requests from sending twice.
  // Ambiguous timeouts stay unknown: do not automatically risk a duplicate.
  const claimed = await collection.findOneAndUpdate({ ...key, cancelling: { $ne: true }, $or: [
    { 'invitation.status': { $exists: false } }, { 'invitation.status': { $in: ['not_sent', 'failed'] } }
  ] }, { $set: { 'invitation.status': 'sending', 'invitation.attemptedAt': new Date() } }, { returnDocument: 'after' });
  if (!claimed) return refreshInvitation(db, event, participant);
  let state;
  let submitting = false;
  try {
    const previous = claimed.calendarSnapshot;
    const calendar = previous?.content ? { uid: previous.uid, organizer: previous.organizer, content: previous.content }
      : createCalendarInvitation(previous?.event || event, participant, { uid: previous?.uid || claimed.calendarUid, organizer: previous?.organizer });
    const snapshot = { event: previous?.event || event, organizer: calendar.organizer, uid: calendar.uid, content: calendar.content, recipient: participant.email };
    // Persist the original organizer and event details before the network call.
    await collection.updateOne(key, { $set: { calendarSnapshot: snapshot } });
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
  if (!enrollment || !event?.startsAt || !enrollment.invitation) {
    return invitationStatus(enrollment, event);
  }
  try {
    const result = await getCalendarInvitationStatus(enrollment.calendarSnapshot?.uid || enrollment.calendarUid || `${event.id}-${participant.id}@sebastiandrumm.dk`);
    const statuses = { SENT: 'sent', QUEUED: 'queued', PROCESSING: 'sending', FAILED: 'failed', UNKNOWN: 'unknown' };
    if (result.status === 'NOT_FOUND' && enrollment.invitation.status !== 'sent' && Date.now() - new Date(enrollment.invitation.attemptedAt || 0).getTime() > 60_000) {
      await collection.updateOne({ ...key, 'invitation.status': enrollment.invitation.status }, { $set: { 'invitation.status': 'not_sent' } });
      return invitationStatus(await collection.findOne(key), event);
    }
    const status = statuses[result.status];
    if (status) {
      const state = { status, jobId: result.jobId || null,
        deliveryStatus: result.deliveryStatus || enrollment.invitation.deliveryStatus || 'unknown',
        calendarResponse: result.calendarResponse || enrollment.invitation.calendarResponse || 'needs_action',
        ...(status === 'sent' && result.sentAt ? { sentAt: new Date(result.sentAt) } : {}) };
      // Do not overwrite a completed send with an older concurrent status lookup.
      if (enrollment.invitation.status === 'sent' && status !== 'sent') return { ...invitationStatus(enrollment, event), checkFailed: true };
      await collection.updateOne(key, { $set: { invitation: state } });
      return invitationStatus(await collection.findOne(key), event);
    }
  } catch (error) {
    console.error('Calendar status lookup failed:', error.message);
    return { ...invitationStatus(enrollment, event), checkFailed: true };
  }
  return invitationStatus(enrollment, event);
}

async function removeGuestWithCancellation(db, event, participant) {
  const key = { eventId: event.id, participantId: participant.id };
  const enrollment = await db.collection('enrollments').findOneAndUpdate(key, { $set: { cancelling: true } }, { returnDocument: 'after' });
  if (!enrollment) return false;
  const status = enrollment.invitation?.status;
  if (status === 'sending' && !enrollment.calendarSnapshot) throw new Error('Invitationen behandles stadig. Prøv igen om lidt.');
  if (event.startsAt && status && status !== 'not_sent') {
    const snapshot = enrollment.calendarSnapshot;
    const calendar = createCalendarInvitation(snapshot?.event || event, participant, {
      cancelled: true, uid: snapshot?.uid || enrollment.calendarUid,
      organizer: snapshot?.organizer || process.env.EVENT_LEGACY_ORGANIZER_EMAIL || 'no-reply@sebastiandrumm.dk'
    });
    const requestId = `${calendar.uid}-cancel`;
    const result = await sendCalendarInvitation({ requestId, previousRequestId: calendar.uid,
      recipient: snapshot?.recipient || participant.email, name: participant.name, subject: `Aflyst: ${event.title}`,
      calendar: { method: 'CANCEL', filename: 'invitation.ics', content: calendar.content } });
    if (!['QUEUED', 'SENT'].includes(String(result.status))) throw new Error('Kalenderaflysningen blev ikke accepteret.');
    await db.collection('calendarCancellations').updateOne({ _id: requestId }, { $set: {
      eventId: event.id, participantId: participant.id, name: participant.name, requestId,
      status: result.status, createdAt: new Date()
    } }, { upsert: true });
  }
  await db.collection('enrollments').deleteOne({ _id: enrollment._id });
  return true;
}

module.exports = { invitationStatus, ensureInvitation, refreshInvitation, removeGuestWithCancellation };

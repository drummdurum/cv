const stamp = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const escapeText = value => String(value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');

// RFC 5545 folds content lines at 75 octets, without splitting UTF-8 characters.
function fold(line) {
  let result = '', bytes = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character);
    if (bytes + size > 75) { result += '\r\n '; bytes = 1; }
    result += character;
    bytes += size;
  }
  return result;
}

function createCalendarInvitation(event, participant, options = {}) {
  if (!event.startsAt || !Number.isFinite(Date.parse(event.startsAt))) throw new Error('Eventet mangler et starttidspunkt.');
  const organizer = options.organizer || process.env.EVENT_ORGANIZER_EMAIL || 'sedrumm@gmail.com';
  if (!organizer || !/^[^\s@<>:;,]+@[^\s@<>:;,]+\.[^\s@<>:;,]+$/.test(organizer)) throw new Error('EVENT_ORGANIZER_EMAIL mangler eller er ugyldig.');
  const uid = options.uid || `${event.id}-${participant.id}@sebastiandrumm.dk`;
  const method = options.cancelled ? 'CANCEL' : 'REQUEST';
  const url = `https://sebastiandrumm.dk/event/${encodeURIComponent(event.id)}`;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sebastian Drumm//Events//DA',
    'CALSCALE:GREGORIAN', `METHOD:${method}`, 'BEGIN:VEVENT',
    `UID:${uid}`, `DTSTAMP:${stamp(new Date())}`, `SEQUENCE:${options.cancelled ? 1 : 0}`,
    `DTSTART:${stamp(event.startsAt)}`,
    ...(event.endsAt ? [`DTEND:${stamp(event.endsAt)}`] : []),
    `SUMMARY:${escapeText(event.title)}`, `LOCATION:${escapeText(event.place)}`,
    `DESCRIPTION:${escapeText(`${event.description}\n${event.details || ''}\n${url}`)}`,
    `URL:${url}`, `ORGANIZER;CN=Sebastian Drumm:mailto:${organizer}`,
    `ATTENDEE;RSVP=TRUE;PARTSTAT=NEEDS-ACTION:mailto:${participant.email}`,
    `STATUS:${options.cancelled ? 'CANCELLED' : 'CONFIRMED'}`, 'END:VEVENT', 'END:VCALENDAR'
  ];
  return { uid, organizer, method, content: lines.map(fold).join('\r\n') + '\r\n' };
}

module.exports = { createCalendarInvitation };

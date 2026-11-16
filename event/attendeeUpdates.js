const { EventEmitter } = require('events');

const updates = new EventEmitter();
updates.setMaxListeners(0);

function notifyAttendees(eventId) {
  updates.emit(eventId);
}

function subscribeAttendees(eventId, callback) {
  updates.on(eventId, callback);
  return () => updates.off(eventId, callback);
}

module.exports = { notifyAttendees, subscribeAttendees };

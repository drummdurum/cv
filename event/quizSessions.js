const { createQuizClient } = require('./quizGrpc');

const sessions = new Map();

function keyFor(eventId, participantId) { return `${eventId}:${participantId}`; }

function createSession(eventId, participantId, quizId) {
  const key = keyFor(eventId, participantId);
  sessions.get(key)?.close();
  const client = createQuizClient();
  const stream = client.Play();
  const session = {
    eventId, participantId, quizId, client, stream, pending: null, busy: false,
    lastUsed: Date.now(), closed: false,
    close() {
      if (this.closed) return;
      this.closed = true;
      if (sessions.get(key) === this) sessions.delete(key);
      if (this.pending) this.pending.reject(new Error('Quizforbindelsen blev lukket.'));
      stream.cancel();
      client.close();
    },
    request(action, finishTypes) {
      if (this.closed || this.busy) return Promise.reject(new Error('Quizzen er optaget eller lukket.'));
      this.busy = true;
      this.lastUsed = Date.now();
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { this.close(); reject(new Error('Quizserveren svarede ikke.')); }, 5000);
        this.pending = {
          updates: [],
          reject: error => { clearTimeout(timeout); this.pending = null; this.busy = false; reject(error); },
          resolve: updates => { clearTimeout(timeout); this.pending = null; this.busy = false; resolve(updates); },
          finishTypes
        };
        stream.write(action);
      });
    }
  };
  stream.on('data', update => {
    const pending = session.pending;
    if (!pending) return;
    if (update.type === 'Error') { pending.reject(new Error(update.error)); session.close(); return; }
    pending.updates.push(update);
    if (pending.finishTypes.includes(update.type)) pending.resolve(pending.updates);
  });
  stream.on('error', error => { if (session.pending) session.pending.reject(error); session.close(); });
  stream.on('end', () => { if (session.pending) session.pending.reject(new Error('Quizstreamen sluttede uventet.')); session.close(); });
  sessions.set(key, session);
  return session;
}

function getSession(eventId, participantId) { return sessions.get(keyFor(eventId, participantId)); }

const sweep = setInterval(() => {
  for (const session of sessions.values()) if (Date.now() - session.lastUsed > 30 * 60 * 1000) session.close();
}, 60 * 1000);
sweep.unref();

module.exports = { createSession, getSession };

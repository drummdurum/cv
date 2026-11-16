const { WebSocketServer } = require('ws');
const { readParticipant } = require('./participant');
const { getDatabase } = require('./database');
const { isAllowedOrigin } = require('./security');

function attachVoting(server, events) {
  const rooms = new Map(events.map(event => [event.id, {
    clients: new Set()
  }]));
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024, perMessageDeflate: false });
  const activeByParticipant = new Map();
  const recentByParticipant = new Map();

  server.on('upgrade', (request, socket, head) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    const forwardedProto = request.headers['x-forwarded-proto']?.split(',')[0].trim();
    const protocol = forwardedProto || (request.socket.encrypted ? 'https' : 'http');
    const expectedOrigin = `${protocol}://${request.headers.host}`;
    if (path !== '/event/ws' || !isAllowedOrigin(request.headers.origin) || request.headers.origin !== expectedOrigin || wss.clients.size >= 500) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, client => wss.emit('connection', client, request));
  });

  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.isAlive) { socket.terminate(); continue; }
      socket.isAlive = false;
      socket.ping();
    }
    const cutoff = Date.now() - 60000;
    for (const [id, timestamps] of recentByParticipant) {
      const recent = timestamps.filter(time => time > cutoff);
      if (recent.length) recentByParticipant.set(id, recent);
      else recentByParticipant.delete(id);
    }
  }, 30000);
  wss.on('close', () => clearInterval(heartbeat));

  async function snapshot(event, db) {
    const votes = await db.collection('votes').aggregate([
      { $match: { eventId: event.id, pollId: event.pollId ?? null } },
      { $group: { _id: '$option', count: { $sum: 1 } } }
    ]).toArray();
    const counts = event.options.map((_, index) => votes.find(vote => vote._id === index)?.count || 0);
    return JSON.stringify({ type: 'results', counts, total: counts.reduce((sum, count) => sum + count, 0) });
  }

  wss.on('connection', async (socket, request) => {
    const url = new URL(request.url, 'http://localhost');
    const event = events.find(item => item.id === url.searchParams.get('event'));
    const participant = readParticipant(request.headers.cookie);
    const db = getDatabase();
    if (!event || !participant || !db) {
      socket.close(1008, 'Ugyldigt event eller deltager');
      return;
    }
    let registered;
    try { registered = await db.collection('participants').findOne({ id: participant.id }); }
    catch { socket.close(1011, 'Databasefejl'); return; }
    if (!registered) { socket.close(1008, 'Tilmelding kræves'); return; }
    try {
      const enrollment = await db.collection('enrollments').findOne({ eventId: event.id, participantId: participant.id });
      if (!enrollment) { socket.close(1008, 'Tilmeld dig dette event først'); return; }
    } catch { socket.close(1011, 'Databasefejl'); return; }
    const connections = activeByParticipant.get(participant.id) || new Set();
    if (connections.size >= 5) { socket.close(1008, 'For mange forbindelser'); return; }
    connections.add(socket);
    activeByParticipant.set(participant.id, connections);
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });
    socket.on('error', () => {});
    const room = rooms.get(event.id);
    room.clients.add(socket);
    try { socket.send(await snapshot(event, db)); }
    catch { socket.close(1011, 'Afstemningen kunne ikke hentes'); return; }
    try {
      const history = await db.collection('messages').find({ eventId: event.id }).sort({ createdAt: -1 }).limit(50).toArray();
      socket.send(JSON.stringify({ type: 'history', messages: history.reverse().map(serializeMessage) }));
    } catch { socket.send(JSON.stringify({ type: 'error', error: 'Beskedhistorikken kunne ikke hentes.' })); }
    let lastMessageAt = 0;
    socket.on('message', async raw => {
      const now = Date.now();
      const recent = (recentByParticipant.get(participant.id) || []).filter(time => now - time < 60000);
      if (recent.length >= 60) { socket.close(1008, 'For mange beskeder'); return; }
      recent.push(now);
      recentByParticipant.set(participant.id, recent);
      let message;
      try { message = JSON.parse(raw.toString()); } catch { return; }
      if (message.type === 'chat') {
        const text = typeof message.text === 'string' ? message.text.trim() : '';
        if (!text || text.length > 500 || Date.now() - lastMessageAt < 1000) return;
        lastMessageAt = Date.now();
        try {
          const doc = { eventId: event.id, participantId: participant.id, name: registered.name, text, createdAt: new Date() };
          const result = await db.collection('messages').insertOne(doc);
          doc._id = result.insertedId;
          const update = JSON.stringify({ type: 'chat', message: serializeMessage(doc) });
          for (const client of room.clients) if (client.readyState === client.OPEN) client.send(update);
        } catch { socket.send(JSON.stringify({ type: 'error', error: 'Beskeden kunne ikke gemmes.' })); }
        return;
      }
      if (message.type !== 'vote' || !Number.isInteger(message.option) ||
          message.option < 0 || message.option >= event.options.length) return;
      try {
        await db.collection('votes').updateOne(
          { eventId: event.id, participantId: participant.id },
          { $set: { option: message.option, pollId: event.pollId ?? null, updatedAt: new Date() } },
          { upsert: true }
        );
        const update = await snapshot(event, db);
        for (const client of room.clients) if (client.readyState === client.OPEN) client.send(update);
      } catch { socket.send(JSON.stringify({ type: 'error', error: 'Stemmen kunne ikke gemmes.' })); }
    });
    socket.on('close', () => {
      room.clients.delete(socket);
      connections.delete(socket);
      if (!connections.size) activeByParticipant.delete(participant.id);
    });
  });
}

function serializeMessage(message) {
  return { id: String(message._id), name: message.name, text: message.text, createdAt: message.createdAt.toISOString() };
}

module.exports = { attachVoting };

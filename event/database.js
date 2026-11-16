const { MongoClient } = require('mongodb');

let client;
let database;

async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    console.warn('MONGODB_URI mangler. Tilmelding og eventchat er ikke tilgængelige.');
    return null;
  }
  client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  database = client.db(process.env.MONGODB_DB || 'sebastian_event');
  await Promise.all([
    database.collection('participants').createIndex({ email: 1 }, { unique: true }),
    database.collection('enrollments').createIndex({ eventId: 1, participantId: 1 }, { unique: true }),
    database.collection('votes').createIndex({ eventId: 1, participantId: 1 }, { unique: true }),
    database.collection('quizResults').createIndex({ eventId: 1, participantId: 1, quizId: 1 }, { unique: true }),
    database.collection('messages').createIndex({ eventId: 1, createdAt: -1 })
  ]);
  return database;
}

function getDatabase() { return database; }

module.exports = { connectDatabase, getDatabase };

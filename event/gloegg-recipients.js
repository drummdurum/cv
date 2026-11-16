const { MongoClient } = require('mongodb');

async function printRecipients() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI mangler på CV-servicen.');

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    const db = client.db(process.env.MONGODB_DB || 'sebastian_event');
    const recipients = await db.collection('enrollments').aggregate([
      { $match: { eventId: 'gloegg-og-hygge' } },
      {
        $lookup: {
          from: 'participants',
          localField: 'participantId',
          foreignField: 'id',
          as: 'participant'
        }
      },
      { $unwind: '$participant' },
      { $group: { _id: '$participant.email' } },
      { $sort: { _id: 1 } }
    ]).toArray();

    const emails = recipients.map(recipient => recipient._id)
      .filter(email => typeof email === 'string' && email.trim());
    if (emails.length === 0) {
      console.error('Ingen tilmeldte med mailadresse.');
      return;
    }
    console.log(emails.join('; '));
  } finally {
    await client.close();
  }
}

printRecipients().catch(error => {
  console.error(error.message === 'MONGODB_URI mangler på CV-servicen.'
    ? error.message
    : 'Kunne ikke hente mailadresserne fra MongoDB.');
  process.exitCode = 1;
});

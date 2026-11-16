const readline = require('readline');
const crypto = require('crypto');
const { createQuizClient } = require('./quizGrpc');

const quizId = process.argv[2] || 'rpa';
const client = createQuizClient();
const stream = client.Play();
const input = readline.createInterface({ input: process.stdin, output: process.stdout });

stream.on('data', update => {
  if (update.type === 'Question') {
    console.log(`\n${update.question_number}/${update.total_questions}: ${update.question}`);
    update.options.forEach((option, index) => console.log(`${String.fromCharCode(65 + index)}) ${option}`));
    input.question('Dit svar (A, B eller C): ', answer => {
      const index = answer.trim().toUpperCase().charCodeAt(0) - 65;
      stream.write({ type: 'Answer', answer_index: index });
    });
  } else if (update.type === 'Score') {
    console.log(`${update.correct ? 'Korrekt' : 'Forkert'} — score: ${update.score}/${update.total_questions}`);
  } else if (update.type === 'RoundEnd') {
    console.log(`RoundEnd — slutscore: ${update.score}/${update.total_questions}`);
    input.close();
    client.close();
  } else if (update.type === 'Error') {
    console.error(update.error);
    input.close();
    client.close();
    process.exitCode = 1;
  }
});
stream.on('error', error => { console.error(error.message); input.close(); client.close(); process.exitCode = 1; });
stream.write({ type: 'Start', quiz_id: quizId, game_id: 'cli-demo', player_id: crypto.randomUUID() });

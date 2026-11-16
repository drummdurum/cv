const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const quizzes = require('../../event/questions.json');
const { createQuizClient } = require('../../event/quizGrpc');

for (const quiz of quizzes) {
  test(`gRPC ${quiz.title}: 20 spørgsmål, løbende score og RoundEnd`, async () => {
    expect(quiz.questions).toHaveLength(20);
    const client = createQuizClient();
    const stream = client.Play();
    let questions = 0;
    let scores = 0;
    try {
      const end = await new Promise((resolve, reject) => {
        stream.on('data', update => {
          try {
            if (update.type === 'Question') {
              expect(update.question_number).toBe(++questions);
              expect(update.options).toHaveLength(3);
              stream.write({ type: 'Answer', answer_index: quiz.questions[questions - 1].answer });
            } else if (update.type === 'Score') {
              expect(update.score).toBe(++scores);
              expect(update.correct).toBe(true);
            } else if (update.type === 'RoundEnd') resolve(update);
            else if (update.type === 'Error') reject(new Error(update.error));
          } catch (error) { reject(error); }
        });
        stream.on('error', reject);
        stream.write({ type: 'Start', game_id: 'test-event', player_id: crypto.randomUUID(), quiz_id: quiz.id });
      });
      expect(questions).toBe(20);
      expect(scores).toBe(20);
      expect(end.score).toBe(20);
      expect(end.total_questions).toBe(20);
    } finally {
      stream.cancel();
      client.close();
    }
  });
}

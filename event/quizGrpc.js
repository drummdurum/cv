const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const quizzes = require('./questions.json');

const definition = protoLoader.loadSync(path.join(__dirname, 'quiz.proto'), {
  keepCase: true, defaults: true, oneofs: true
});
const QuizService = grpc.loadPackageDefinition(definition).event.QuizService;

function play(call) {
  let quiz;
  let gameId;
  let playerId;
  let index = 0;
  let score = 0;
  let finished = false;

  function update(type, extra = {}) {
    call.write({ type, game_id: gameId, player_id: playerId, quiz_id: quiz.id,
      question_number: index + 1, total_questions: quiz.questions.length, score, ...extra });
  }

  function question() {
    const current = quiz.questions[index];
    update('Question', { question: current.text, options: current.options });
  }

  call.on('data', action => {
    if (finished) return;
    if (!quiz) {
      if (action.type !== 'Start' || !action.game_id || !action.player_id) {
        call.write({ type: 'Error', error: 'Start med game_id og player_id.' });
        call.end();
        finished = true;
        return;
      }
      quiz = quizzes.find(item => item.id === action.quiz_id);
      if (!quiz) {
        call.write({ type: 'Error', error: 'Quizzen blev ikke fundet.' });
        call.end();
        finished = true;
        return;
      }
      gameId = action.game_id;
      playerId = action.player_id;
      question();
      return;
    }
    if (action.type !== 'Answer' || !Number.isInteger(action.answer_index) || action.answer_index < 0 || action.answer_index > 2) {
      update('Error', { error: 'Vælg svar A, B eller C.' });
      return;
    }
    const correctOption = quiz.questions[index].answer;
    const correct = action.answer_index === correctOption;
    if (correct) score += 1;
    update('Score', { correct, correct_option: correctOption });
    index += 1;
    if (index === quiz.questions.length) {
      update('RoundEnd', { question_number: quiz.questions.length });
      finished = true;
      call.end();
    } else question();
  });
  call.on('end', () => { if (!finished) call.end(); });
}

function registerQuizService(server) {
  server.addService(QuizService.service, { Play: play });
}

function createQuizClient(address = `127.0.0.1:${process.env.GRPC_PORT || 50051}`) {
  return new QuizService(address, grpc.credentials.createInsecure());
}

module.exports = { registerQuizService, createQuizClient };

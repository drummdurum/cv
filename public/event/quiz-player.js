(() => {
const eventId = document.body.dataset.eventId;
let csrfToken;
async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch('/event/api/csrf');
  if (!response.ok) throw new Error('Sikkerhedstoken kunne ikke hentes.');
  csrfToken = (await response.json()).csrfToken;
  return csrfToken;
}
const quizLibrary = document.getElementById('quiz-library');
const quizPlay = document.getElementById('quiz-play');
const quizFeedback = document.getElementById('quiz-feedback');
const quizNext = document.getElementById('quiz-next');
let nextQuestion = null;
let quizBusy = false;

function showQuestion(question) {
  nextQuestion = null;
  quizNext.hidden = true;
  quizFeedback.textContent = '';
  document.getElementById('quiz-progress-label').textContent = `Spørgsmål ${question.question_number} af ${question.total_questions}`;
  document.getElementById('quiz-progress-bar').style.width = `${(question.question_number - 1) / question.total_questions * 100}%`;
  document.getElementById('quiz-question').textContent = question.question;
  const answers = document.getElementById('quiz-answers');
  answers.replaceChildren();
  question.options.forEach((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quiz-answer';
    button.dataset.answer = String(index);
    const letter = document.createElement('strong');
    letter.textContent = String.fromCharCode(65 + index);
    const label = document.createElement('span');
    label.textContent = option;
    button.append(letter, label);
    button.addEventListener('click', () => submitQuizAnswer(index));
    answers.append(button);
  });
}

async function quizPost(path, body) {
  const token = await getCsrfToken();
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ eventId, ...body }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Quizzen svarede ikke.');
  return data;
}

document.querySelectorAll('.quiz-start').forEach(button => button.addEventListener('click', async () => {
  if (quizBusy) return;
  quizBusy = true;
  const notice = document.getElementById('quiz-notice');
  notice.hidden = false;
  notice.textContent = 'Starter quizzen…';
  try {
    const data = await quizPost('/event/api/quiz/start', { quizId: button.dataset.quizId });
    quizLibrary.hidden = true;
    quizPlay.hidden = false;
    notice.hidden = true;
    document.getElementById('quiz-topic').textContent = data.quiz.title;
    document.getElementById('quiz-score').textContent = `0 / ${data.question.total_questions} point`;
    showQuestion(data.question);
  } catch (error) {
    notice.textContent = error.message;
  } finally { quizBusy = false; }
}));

async function submitQuizAnswer(index) {
  if (quizBusy) return;
  quizBusy = true;
  const answers = [...document.querySelectorAll('.quiz-answer')];
  answers.forEach(button => { button.disabled = true; });
  quizFeedback.textContent = 'Tjekker svaret…';
  try {
    const data = await quizPost('/event/api/quiz/answer', { answerIndex: index });
    answers[index].classList.add(data.result.correct ? 'correct' : 'incorrect');
    if (!data.result.correct) answers[data.result.correct_option].classList.add('correct');
    document.getElementById('quiz-score').textContent = `${data.result.score} / ${data.result.total_questions} point`;
    quizFeedback.textContent = data.result.correct ? 'Korrekt svar!' : `Forkert svar. Det rigtige var ${String.fromCharCode(65 + data.result.correct_option)}.`;
    if (data.next.type === 'RoundEnd') {
      document.getElementById('quiz-progress-bar').style.width = '100%';
      document.getElementById('quiz-progress-label').textContent = 'Runden er afsluttet';
      document.getElementById('quiz-question').textContent = `Du fik ${data.next.score} ud af ${data.next.total_questions} rigtige.`;
      document.getElementById('quiz-answers').replaceChildren();
      quizFeedback.textContent = 'RoundEnd · Din score er gemt.';
    } else {
      nextQuestion = data.next;
      quizNext.hidden = false;
    }
  } catch (error) {
    quizFeedback.textContent = error.message;
    answers.forEach(button => { button.disabled = false; });
  } finally { quizBusy = false; }
}

quizNext.addEventListener('click', () => { if (nextQuestion) showQuestion(nextQuestion); });
document.getElementById('quiz-back').addEventListener('click', () => {
  quizPlay.hidden = true;
  quizLibrary.hidden = false;
  document.getElementById('quiz-notice').hidden = true;
});

})();

(() => {
  const gameId = 'quiz-hub';
  const form = document.getElementById('quiz-name-form');
  const status = document.getElementById('quiz-register-status');

  function ready(participant) {
    form.hidden = true;
    document.getElementById('quiz-known').hidden = true;
    document.getElementById('quiz-register-intro').hidden = true;
    document.getElementById('quiz-register-title').textContent = 'Du er med.';
    document.getElementById('quiz-registered').hidden = false;
    document.getElementById('quiz-player-name').textContent = participant.name;
    document.querySelectorAll('.quiz-start').forEach(button => { button.disabled = false; });
    document.getElementById('quiz-notice').hidden = true;
    status.textContent = '';
  }

  async function getToken() {
    const response = await fetch('/event/api/csrf');
    if (!response.ok) throw new Error('Sikkerhedstoken kunne ikke hentes.');
    return (await response.json()).csrfToken;
  }

  async function register(body) {
    const token = await getToken();
    const response = await fetch('/event/api/participant', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify({ eventId: gameId, ...body })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    ready(data.participant);
  }

  async function loadParticipant() {
    try {
      const response = await fetch(`/event/api/participant?event=${gameId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.participant && data.enrolled) ready(data.participant);
      else if (data.participant) {
        form.hidden = true;
        document.getElementById('quiz-register-intro').hidden = true;
        document.getElementById('quiz-known').hidden = false;
        document.getElementById('quiz-known-name').textContent = data.participant.name;
      }
    } catch (error) { status.textContent = error.message; }
  }
  loadParticipant();

  form.addEventListener('submit', async event => {
    event.preventDefault();
    status.textContent = 'Gemmer…';
    try { await register({ name: document.getElementById('quiz-name').value,
      email: document.getElementById('quiz-email').value }); }
    catch (error) { status.textContent = error.message; }
  });

  document.getElementById('quiz-join').addEventListener('click', async () => {
    status.textContent = 'Tilmelder…';
    try { await register({}); }
    catch (error) { status.textContent = error.message; }
  });
})();

const eventId = document.body.dataset.eventId;
const eventTitle = document.body.dataset.eventTitle;
let csrfToken;
async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch('/event/api/csrf');
  if (!response.ok) throw new Error('Sikkerhedstoken kunne ikke hentes. Genindlæs siden.');
  csrfToken = (await response.json()).csrfToken;
  return csrfToken;
}
const tabs = [...document.querySelectorAll('[data-tab]')];
function showTab(name) {
  for (const tab of tabs) {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  }
  document.getElementById('info-panel').hidden = name !== 'info';
  document.getElementById('vote-panel').hidden = name !== 'vote';
}
tabs.forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.tab)));
document.querySelector('[data-open-vote]').addEventListener('click', () => showTab('vote'));

const nameForm = document.getElementById('name-form');
const echoForm = document.getElementById('echo-form');
const echoDetails = document.getElementById('echo-details');
const chatForm = document.getElementById('chat-form');
const chatSection = document.getElementById('chat-section');
const chatLauncher = document.createElement('button');
chatLauncher.type = 'button';
chatLauncher.className = 'chat-launcher';
chatLauncher.hidden = true;
chatLauncher.setAttribute('aria-controls', 'chat-panel');
chatLauncher.setAttribute('aria-expanded', 'false');
chatLauncher.innerHTML = '<span class="chat-launcher-icon" aria-hidden="true">✦</span><span class="chat-launcher-label"></span><span class="chat-unread" hidden>0</span>';
chatLauncher.querySelector('.chat-launcher-label').textContent = `Chat: ${eventTitle}`;
const chatPanel = document.createElement('section');
chatPanel.id = 'chat-panel';
chatPanel.className = 'chat-panel';
chatPanel.hidden = true;
chatPanel.setAttribute('aria-label', 'Eventchat');
const chatHeader = document.createElement('div');
chatHeader.className = 'chat-panel-header';
const chatTitle = document.createElement('div');
chatTitle.innerHTML = '<small>SAMTALEN ER LIVE</small><strong></strong>';
chatTitle.querySelector('strong').textContent = eventTitle;
const chatClose = document.createElement('button');
chatClose.type = 'button';
chatClose.className = 'chat-close';
chatClose.textContent = '−';
chatClose.setAttribute('aria-label', 'Minimer chat');
chatHeader.append(chatTitle, chatClose);
chatPanel.append(chatHeader, chatSection);
document.body.append(chatLauncher, chatPanel);
let unread = 0;
function toggleChat(open) {
  chatPanel.hidden = !open;
  chatLauncher.hidden = open || chatSection.hidden;
  chatLauncher.setAttribute('aria-expanded', String(open));
  if (open) {
    unread = 0;
    chatLauncher.querySelector('.chat-unread').hidden = true;
    document.getElementById('chat-message').focus();
  }
}
chatLauncher.addEventListener('click', () => toggleChat(true));
chatClose.addEventListener('click', () => toggleChat(false));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !chatPanel.hidden) toggleChat(false); });
const options = [...document.querySelectorAll('[data-option]')];
let socket;
let reconnectTimer;

async function loadAttendees() {
  try {
    const response = await fetch(`/event/api/attendees?event=${encodeURIComponent(eventId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    document.getElementById('attendee-count').textContent = String(data.total);
    document.getElementById('attendee-empty').hidden = data.total > 0;
    const list = document.getElementById('attendee-list');
    list.replaceChildren();
    for (const name of data.attendees) {
      const item = document.createElement('li');
      const avatar = document.createElement('span');
      avatar.className = 'attendee-avatar';
      avatar.textContent = name.trim().charAt(0).toUpperCase();
      const label = document.createElement('span');
      label.textContent = name;
      item.append(avatar, label);
      list.append(item);
    }
    const more = document.getElementById('attendee-more');
    more.hidden = data.total <= data.attendees.length;
    more.textContent = `Og ${data.total - data.attendees.length} flere deltagere.`;
  } catch (error) {
    document.getElementById('attendee-empty').hidden = false;
    document.getElementById('attendee-empty').textContent = error.message || 'Deltagerlisten kunne ikke hentes.';
  }
}
loadAttendees();
const attendeeStream = new EventSource(`/event/api/attendees/live?event=${encodeURIComponent(eventId)}`);
attendeeStream.addEventListener('message', () => loadAttendees());

function showInvitation(invitation) {
  const status = invitation?.status || 'not_sent';
  document.getElementById('calendar-invitation').hidden = status === 'unavailable';
  const messages = {
    not_sent: 'Kalenderinvitationen er ikke sendt endnu. Du er stadig tilmeldt.',
    sending: 'Invitationen behandles. Tjek igen om lidt.',
    queued: 'Invitationen er i kø hos mailservicen. Afsendelse er endnu ikke bekræftet.',
    sent: 'Kalenderinvitationen er sendt til din mail.',
    failed: 'Kalenderinvitationen kunne ikke sendes. Du er stadig tilmeldt.',
    unknown: 'Afsendelsen er ikke bekræftet. Tjek din indbakke og spammappe.',
    unavailable: ''
  };
  document.getElementById('invitation-status').textContent = messages[status] || messages.unknown;
  if (invitation?.checkFailed) document.getElementById('invitation-status').textContent += ' Status kunne ikke opdateres lige nu. Prøv at tjekke igen.';
  document.getElementById('check-invitation').textContent = status === 'not_sent' ? 'Prøv at sende invitation' : 'Tjek invitation';
}

document.getElementById('check-invitation').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const token = await getCsrfToken();
    const response = await fetch('/event/api/invitation', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify({ eventId })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    showInvitation(data.invitation);
  } catch (error) {
    document.getElementById('invitation-status').textContent = error.message;
  } finally { button.disabled = false; }
});

function showParticipant(participant, invitation) {
  showInvitation(invitation);
  nameForm.hidden = true;
  document.getElementById('known-participant').hidden = true;
  document.getElementById('participant-display').hidden = false;
  document.getElementById('participant-name-display').textContent = participant.name;
  document.getElementById('registration-intro').hidden = true;
  document.getElementById('side-title').textContent = 'Du er med.';
  document.getElementById('participate-button').textContent = 'Du deltager ✓';
  document.getElementById('chat-section').hidden = false;
  chatLauncher.hidden = false;
  if (echoDetails) echoDetails.hidden = false;
  document.getElementById('name-result').textContent = '';
  loadAttendees();
  connect();
}

function showKnownParticipant(participant) {
  nameForm.hidden = true;
  document.getElementById('registration-intro').hidden = true;
  document.getElementById('known-participant').hidden = false;
  document.getElementById('known-name').textContent = participant.name;
  document.getElementById('known-email').textContent = participant.email;
  document.getElementById('side-title').textContent = 'Tilmeld dig';
  document.getElementById('connection-status').textContent = 'Tilmeld dig dette event for at stemme';
}

async function loadParticipant() {
  try {
    const response = await fetch(`/event/api/participant?event=${encodeURIComponent(eventId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const { participant, enrolled } = data;
    if (participant && enrolled) showParticipant(participant, data.invitation);
    else if (participant) showKnownParticipant(participant);
    else document.getElementById('connection-status').textContent = 'Skriv dit navn for at stemme';
  } catch (error) {
    document.getElementById('connection-status').textContent = 'Forbindelsen er ikke klar';
    document.getElementById('name-result').textContent = error.message;
  }
}
loadParticipant();

nameForm.addEventListener('submit', async event => {
  event.preventDefault();
  const result = document.getElementById('name-result');
  result.classList.remove('error');
  result.textContent = 'Gemmer…';
  try {
    const token = await getCsrfToken();
    const response = await fetch('/event/api/participant', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify({ eventId, name: document.getElementById('participant-name').value, email: document.getElementById('participant-email').value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    csrfToken = null;
    showParticipant(data.participant, data.invitation);
  } catch (error) {
    result.classList.add('error');
    result.textContent = error.message || 'Navnet kunne ikke gemmes.';
  }
});

document.getElementById('join-event').addEventListener('click', async () => {
  const result = document.getElementById('name-result');
  result.classList.remove('error');
  result.textContent = 'Tilmelder…';
  try {
    const token = await getCsrfToken();
    const response = await fetch('/event/api/participant', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token }, body: JSON.stringify({ eventId })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    csrfToken = null;
    showParticipant(data.participant, data.invitation);
  } catch (error) {
    result.classList.add('error');
    result.textContent = error.message || 'Tilmeldingen kunne ikke gemmes.';
  }
});

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  clearTimeout(reconnectTimer);
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${location.host}/event/ws?event=${encodeURIComponent(eventId)}`);
  socket.addEventListener('open', () => { document.getElementById('connection-status').textContent = '● Live'; });
  socket.addEventListener('close', event => {
    document.getElementById('connection-status').textContent = 'Forbinder igen…';
    if (event.code !== 1008) reconnectTimer = setTimeout(connect, 2000);
  });
  socket.addEventListener('message', event => {
    const update = JSON.parse(event.data);
    if (update.type === 'history') { document.getElementById('chat-messages').replaceChildren(); update.messages.forEach(addChatMessage); return; }
    if (update.type === 'chat') {
      addChatMessage(update.message);
      if (chatPanel.hidden) {
        unread += 1;
        const badge = chatLauncher.querySelector('.chat-unread');
        badge.textContent = unread > 9 ? '9+' : String(unread);
        badge.hidden = false;
      }
      return;
    }
    if (update.type === 'error') { document.getElementById('chat-result').textContent = update.error; return; }
    if (update.type !== 'results') return;
    update.counts.forEach((count, index) => {
      document.querySelector(`[data-count="${index}"]`).textContent = count;
      document.querySelector(`[data-bar="${index}"]`).style.width = `${update.total ? count / update.total * 100 : 0}%`;
    });
    document.getElementById('vote-total').textContent = `${update.total} ${update.total === 1 ? 'stemme' : 'stemmer'}`;
  });
}

options.forEach(option => option.addEventListener('click', () => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    document.getElementById('vote-feedback').textContent = 'Gem dit navn og vent på forbindelsen.';
    return;
  }
  options.forEach(item => item.classList.toggle('selected', item === option));
  socket.send(JSON.stringify({ type: 'vote', option: Number(option.dataset.option) }));
  document.getElementById('vote-feedback').textContent = 'Din stemme er registreret. Du kan ændre den.';
}));

echoForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const result = document.getElementById('echo-result');
  result.classList.remove('error');
  result.textContent = 'Sender…';
  try {
    const token = await getCsrfToken();
    const response = await fetch('/event/api/echo', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify({ message: document.getElementById('echo-message').value.trim() })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    result.textContent = `${data.name}: ${data.message} · ${new Date(data.timestamp).toLocaleString('da-DK')}`;
  } catch (error) {
    result.classList.add('error');
    result.textContent = error.message || 'Beskeden kunne ikke sendes.';
  }
});

document.getElementById('participate-button').addEventListener('click', () => {
  document.getElementById('participation').scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (!nameForm.hidden) document.getElementById('participant-name').focus({ preventScroll: true });
});

function addChatMessage(message) {
  const list = document.getElementById('chat-messages');
  if (list.querySelector(`[data-message-id="${message.id}"]`)) return;
  const item = document.createElement('div');
  item.className = 'chat-message';
  item.dataset.messageId = message.id;
  const meta = document.createElement('div');
  meta.className = 'chat-meta';
  const name = document.createElement('strong');
  name.textContent = message.name;
  const time = document.createElement('time');
  time.dateTime = message.createdAt;
  time.textContent = new Date(message.createdAt).toLocaleString('da-DK', { dateStyle: 'short', timeStyle: 'short' });
  meta.append(name, time);
  const body = document.createElement('p');
  body.textContent = message.text;
  item.append(meta, body);
  list.append(item);
  while (list.children.length > 50) list.firstElementChild.remove();
  list.scrollTop = list.scrollHeight;
}

chatForm.addEventListener('submit', event => {
  event.preventDefault();
  const input = document.getElementById('chat-message');
  const text = input.value.trim();
  const result = document.getElementById('chat-result');
  if (!text) return;
  if (!socket || socket.readyState !== WebSocket.OPEN) { result.textContent = 'Forbindelsen er ikke klar endnu.'; return; }
  socket.send(JSON.stringify({ type: 'chat', text }));
  input.value = '';
  result.textContent = '';
});

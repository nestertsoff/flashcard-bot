const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const API_BASE = '/api';
const initData = tg.initData;

async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      'X-Telegram-Init-Data': initData,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API_BASE + path, opts);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// State
let currentSet = null;
let cards = [];
let cardIndex = 0;
let direction = 'word'; // 'word' = word->translation, 'translation' = translation->word
let results = [];
let mode = null; // 'flashcard' | 'test'

// Screens
const screens = {
  set: document.getElementById('screen-set'),
  flashcard: document.getElementById('screen-flashcard'),
  test: document.getElementById('screen-test'),
  results: document.getElementById('screen-results'),
  loading: document.getElementById('screen-loading'),
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}

// Back button
tg.BackButton.onClick(() => {
  if (mode) {
    mode = null;
    showScreen('set');
    tg.BackButton.hide();
  }
});

// --- SET SCREEN ---

async function loadSet() {
  const params = new URLSearchParams(window.location.search);
  const setId = params.get('setId');
  if (!setId) return;

  showScreen('loading');
  currentSet = await api('GET', `/sets/${setId}`);
  renderSet();
  showScreen('set');
}

function renderSet() {
  document.getElementById('set-title').textContent = currentSet.title;

  const known = currentSet.cards.filter(c => c.status === 'known').length;
  const learning = currentSet.cards.filter(c => c.status === 'learning').length;
  const newCount = currentSet.cards.length - known - learning;
  const total = currentSet.cards.length || 1;

  const bar = document.getElementById('set-progress');
  bar.querySelector('.known').style.flex = known / total;
  bar.querySelector('.learning').style.flex = learning / total;
  bar.querySelector('.new').style.flex = newCount / total;

  document.getElementById('set-stats').textContent =
    `${known} known · ${learning} learning · ${newCount} new · ${currentSet.cards.length} total`;

  const list = document.getElementById('word-list');
  list.innerHTML = currentSet.cards.map(c =>
    `<div class="word-item">
      <span class="word">${esc(c.word)}</span>
      <span class="translation">${esc(c.translations.join(', '))}</span>
    </div>`
  ).join('');
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Direction toggle
const btnDir = document.getElementById('btn-dir');
btnDir.addEventListener('click', () => {
  direction = direction === 'word' ? 'translation' : 'word';
  btnDir.textContent = direction === 'word' ? 'Word → Translation' : 'Translation → Word';
});

// Share
document.getElementById('btn-share').addEventListener('click', async () => {
  const codeEl = document.getElementById('share-code');
  if (!codeEl.classList.contains('hidden')) {
    codeEl.classList.add('hidden');
    return;
  }
  const { code } = await api('POST', `/sets/${currentSet.id}/share`);
  codeEl.textContent = code;
  codeEl.classList.remove('hidden');
});

// --- FLASHCARD MODE ---

document.getElementById('btn-cards').addEventListener('click', () => {
  mode = 'flashcard';
  cards = sortCards(currentSet.cards);
  cardIndex = 0;
  results = [];
  showScreen('flashcard');
  tg.BackButton.show();
  renderFlashcard();
});

function sortCards(cardList) {
  const order = { learning: 0, new: 1, known: 2 };
  return [...cardList].sort((a, b) => order[a.status] - order[b.status]);
}

function renderFlashcard() {
  if (cardIndex >= cards.length) {
    showResults();
    return;
  }
  const card = cards[cardIndex];
  const counter = document.getElementById('flashcard-counter');
  counter.textContent = `${cardIndex + 1} / ${cards.length}`;

  const front = direction === 'word' ? card.word : card.translations.join(', ');
  const back = direction === 'word' ? card.translations.join(', ') : card.word;

  document.getElementById('card-front-text').textContent = front;
  document.getElementById('card-back-text').textContent = back;

  const cardEl = document.getElementById('flashcard');
  cardEl.classList.remove('flipped');
  document.getElementById('flashcard-buttons').classList.add('hidden');
}

document.getElementById('flashcard').addEventListener('click', () => {
  const cardEl = document.getElementById('flashcard');
  cardEl.classList.toggle('flipped');
  if (cardEl.classList.contains('flipped')) {
    document.getElementById('flashcard-buttons').classList.remove('hidden');
  }
});

document.getElementById('btn-know').addEventListener('click', async () => {
  const card = cards[cardIndex];
  await api('POST', '/progress', { cardId: card.id, status: 'known' });
  results.push({ card, correct: true });
  cardIndex++;
  renderFlashcard();
});

document.getElementById('btn-dont-know').addEventListener('click', async () => {
  const card = cards[cardIndex];
  await api('POST', '/progress', { cardId: card.id, status: 'learning' });
  results.push({ card, correct: false });
  cardIndex++;
  renderFlashcard();
});

// --- TEST MODE ---

document.getElementById('btn-test').addEventListener('click', () => {
  mode = 'test';
  cards = sortCards(currentSet.cards);
  cardIndex = 0;
  results = [];
  showScreen('test');
  tg.BackButton.show();
  renderTestQuestion();
});

function renderTestQuestion() {
  if (cardIndex >= cards.length) {
    showResults();
    return;
  }
  const card = cards[cardIndex];
  document.getElementById('test-counter').textContent = `${cardIndex + 1} / ${cards.length}`;

  const question = direction === 'word' ? card.word : card.translations.join(', ');
  document.getElementById('test-word').textContent = question;

  const correctAnswer = direction === 'word' ? card.translations.join(', ') : card.word;
  const allAnswers = currentSet.cards.map(c =>
    direction === 'word' ? c.translations.join(', ') : c.word
  );
  const wrongAnswers = allAnswers
    .filter(a => a !== correctAnswer)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const options = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);

  const container = document.getElementById('test-options');
  container.innerHTML = options.map(opt =>
    `<div class="test-option" data-answer="${esc(opt)}" data-correct="${opt === correctAnswer}">${esc(opt)}</div>`
  ).join('');

  document.getElementById('btn-next').classList.add('hidden');

  container.querySelectorAll('.test-option').forEach(el => {
    el.addEventListener('click', () => handleTestAnswer(el, card, correctAnswer));
  });
}

async function handleTestAnswer(el, card, correctAnswer) {
  const allOptions = document.querySelectorAll('.test-option');
  allOptions.forEach(o => o.classList.add('disabled'));

  const chosen = el.dataset.answer;
  const isCorrect = chosen === correctAnswer;

  if (isCorrect) {
    el.classList.add('correct');
    await api('POST', '/progress', { cardId: card.id, status: 'known' });
  } else {
    el.classList.add('wrong');
    allOptions.forEach(o => {
      if (o.dataset.correct === 'true') o.classList.add('correct');
    });
    await api('POST', '/progress', { cardId: card.id, status: 'learning' });
  }

  results.push({ card, correct: isCorrect });
  document.getElementById('btn-next').classList.remove('hidden');
}

document.getElementById('btn-next').addEventListener('click', () => {
  cardIndex++;
  renderTestQuestion();
});

// --- RESULTS ---

function showResults() {
  mode = null;
  const correct = results.filter(r => r.correct).length;
  document.getElementById('results-score').textContent = `${correct} / ${results.length}`;

  document.getElementById('results-details').innerHTML = results.map(r =>
    `<div class="result-item ${r.correct ? 'right' : 'wrong'}">
      <span>${esc(r.card.word)}</span>
      <span>${esc(r.card.translations.join(', '))}</span>
    </div>`
  ).join('');

  showScreen('results');
}

document.getElementById('btn-restart').addEventListener('click', async () => {
  currentSet = await api('GET', `/sets/${currentSet.id}`);
  renderSet();
  showScreen('set');
  tg.BackButton.hide();
});

// --- INIT ---
loadSet();

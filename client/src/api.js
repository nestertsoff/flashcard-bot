async function request(method, path, body) {
  const opts = {
    method,
    headers: {},
    credentials: 'include',
  };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  register: (username, password) => request('POST', '/api/auth/register', { username, password }),
  login: (username, password) => request('POST', '/api/auth/login', { username, password }),
  logout: () => request('POST', '/api/auth/logout'),
  me: () => request('GET', '/api/auth/me'),

  getSets: () => request('GET', '/api/sets'),
  createSet: (title, cards, lang, translationLang) => request('POST', '/api/sets', { title, cards, lang, translationLang }),
  getSet: (id) => request('GET', `/api/sets/${id}`),
  updateSet: (id, data) => request('PATCH', `/api/sets/${id}`, data),
  deleteSet: (id) => request('DELETE', `/api/sets/${id}`),
  addCard: (setId, word, translations) => request('POST', `/api/sets/${setId}/cards`, { word, translations }),
  deleteCard: (id) => request('DELETE', `/api/cards/${id}`),
  shareSet: (id) => request('POST', `/api/sets/${id}/share`),
  importSet: (code) => request('POST', `/api/share/${code}`),
  resetProgress: (setId) => request('POST', `/api/sets/${setId}/reset-progress`),
  updateProgress: (cardId, status) => request('POST', '/api/progress', { cardId, status }),
};

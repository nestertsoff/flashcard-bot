import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

function parseBulkLines(text) {
  return text.split('\n').map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return { line: trimmed, valid: true, empty: true, index: i };
    const sepIdx = trimmed.indexOf(' - ');
    if (sepIdx === -1) return { line: trimmed, valid: false, empty: false, index: i };
    const word = trimmed.slice(0, sepIdx).trim();
    const translations = trimmed.slice(sepIdx + 3).split(',').map(t => t.trim()).filter(Boolean);
    if (!word || translations.length === 0) return { line: trimmed, valid: false, empty: false, index: i };
    return { line: trimmed, valid: true, empty: false, word, translations, index: i };
  });
}

export default function SetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [set, setSet] = useState(null);
  const [tab, setTab] = useState('single');
  const [word, setWord] = useState('');
  const [translation, setTranslation] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [shareCode, setShareCode] = useState(null);
  const [direction, setDirection] = useState('word');

  useEffect(() => { loadSet(); }, [id]);

  async function loadSet() {
    const data = await api.getSet(id);
    setSet(data);
  }

  async function handleAddSingle() {
    if (!word.trim() || !translation.trim()) return;
    const translations = translation.split(',').map(t => t.trim()).filter(Boolean);
    await api.addCard(id, word.trim(), translations);
    setWord('');
    setTranslation('');
    loadSet();
  }

  async function handleAddBulk() {
    const parsed = parseBulkLines(bulkText);
    const valid = parsed.filter(l => !l.empty && l.valid);
    if (valid.length === 0) return;
    for (const line of valid) {
      await api.addCard(id, line.word, line.translations);
    }
    setBulkText('');
    loadSet();
  }

  async function handleDeleteCard(cardId) {
    await api.deleteCard(cardId);
    loadSet();
  }

  async function handleShare() {
    const { code } = await api.shareSet(id);
    setShareCode(code);
  }

  async function handleDeleteSet() {
    if (!confirm('Delete this set?')) return;
    await api.deleteSet(id);
    navigate('/');
  }

  if (!set) return <div className="loader-wrap"><div className="loader"></div></div>;

  const known = set.cards.filter(c => c.status === 'known').length;
  const learning = set.cards.filter(c => c.status === 'learning').length;
  const newCount = set.cards.length - known - learning;
  const total = set.cards.length || 1;

  const bulkParsed = parseBulkLines(bulkText);
  const hasInvalid = bulkParsed.some(l => !l.empty && !l.valid);
  const hasValid = bulkParsed.some(l => !l.empty && l.valid);

  return (
    <div className="container">
      <div className="header">
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>Back</button>
        <button className="btn btn-danger btn-sm" onClick={handleDeleteSet}>Delete</button>
      </div>

      <h1 style={{ textAlign: 'center', marginBottom: 12 }}>{set.title}</h1>

      {set.cards.length > 0 && (
        <>
          <div className="progress-bar">
            <span className="known" style={{ flex: known / total }}></span>
            <span className="learning" style={{ flex: learning / total }}></span>
          </div>
          <p className="stats" style={{ textAlign: 'center' }}>
            {known} known · {learning} learning · {newCount} new · {set.cards.length} total
          </p>
        </>
      )}

      <div className="direction-toggle">
        <button className="btn btn-secondary btn-sm btn-block"
          onClick={() => setDirection(d => d === 'word' ? 'translation' : 'word')}>
          {direction === 'word' ? 'Word → Translation' : 'Translation → Word'}
        </button>
      </div>

      {set.cards.length > 0 && (
        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => navigate(`/sets/${id}/flashcard?dir=${direction}`)}>Cards</button>
          <button className="btn btn-primary" onClick={() => navigate(`/sets/${id}/test?dir=${direction}`)}>Test</button>
        </div>
      )}

      <div className="btn-row">
        <button className="btn btn-secondary" onClick={handleShare}>Share</button>
      </div>
      {shareCode && <div className="share-code">{shareCode}</div>}

      <h2 style={{ margin: '20px 0 12px' }}>Add Words</h2>
      <div className="tabs">
        <div className={`tab ${tab === 'single' ? 'active' : ''}`} onClick={() => setTab('single')}>Single</div>
        <div className={`tab ${tab === 'bulk' ? 'active' : ''}`} onClick={() => setTab('bulk')}>Bulk</div>
      </div>

      {tab === 'single' && (
        <div>
          <div className="form-group">
            <input className="input" placeholder="Word" value={word} onChange={e => setWord(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && document.getElementById('trans-input')?.focus()} />
          </div>
          <div className="form-group">
            <input id="trans-input" className="input" placeholder="Translations (comma separated)"
              value={translation} onChange={e => setTranslation(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSingle()} />
          </div>
          <button className="btn btn-primary btn-block" onClick={handleAddSingle}>Add</button>
        </div>
      )}

      {tab === 'bulk' && (
        <div>
          <div className="form-group">
            <textarea className="input" placeholder={"word1 - translation1, translation2\nword2 - translation1"}
              value={bulkText} onChange={e => setBulkText(e.target.value)} rows={6} />
          </div>
          {bulkText && (
            <div style={{ marginBottom: 12 }}>
              {bulkParsed.map((l, i) => {
                if (l.empty) return null;
                return (
                  <div key={i} className={`bulk-line ${l.valid ? 'valid' : 'invalid'}`}>
                    <span style={{ fontSize: 13 }}>{l.line}</span>
                    {!l.valid && <span style={{ fontSize: 12, color: 'var(--danger)', marginLeft: 8 }}>Invalid format</span>}
                  </div>
                );
              })}
            </div>
          )}
          <button className="btn btn-primary btn-block" onClick={handleAddBulk}
            disabled={!hasValid || hasInvalid}>
            Add All
          </button>
          {hasInvalid && <p className="error-msg">Fix invalid lines before adding</p>}
        </div>
      )}

      {set.cards.length > 0 && <h2 style={{ margin: '24px 0 12px' }}>Words ({set.cards.length})</h2>}
      {set.cards.map(c => (
        <div key={c.id} className="word-item">
          <div>
            <span className="word">{c.word}</span>
            <span className="translation" style={{ marginLeft: 12 }}>{c.translations.join(', ')}</span>
          </div>
          <button className="delete-btn" onClick={() => handleDeleteCard(c.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

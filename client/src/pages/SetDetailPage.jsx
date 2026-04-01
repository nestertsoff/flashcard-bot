import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLang } from '../context/LangContext';
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
  const { t } = useLang();
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
    if (!confirm(t.deleteSetConfirm)) return;
    await api.deleteSet(id);
    navigate('/');
  }

  if (!set) return <div className="loader-wrap"><div className="loader"></div></div>;

  const knownCount = set.cards.filter(c => c.status === 'known').length;
  const learningCount = set.cards.filter(c => c.status === 'learning').length;
  const newCount = set.cards.length - knownCount - learningCount;
  const totalCount = set.cards.length || 1;

  const bulkParsed = parseBulkLines(bulkText);
  const hasInvalid = bulkParsed.some(l => !l.empty && !l.valid);
  const hasValid = bulkParsed.some(l => !l.empty && l.valid);

  return (
    <div className="container">
      <div className="header">
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')} aria-label={t.back} title={t.back}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button className="btn btn-danger btn-sm" onClick={handleDeleteSet} aria-label={t.delete} title={t.delete}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>

      <h1 style={{ textAlign: 'center', marginBottom: 12 }}>{set.title}</h1>

      {set.cards.length > 0 && (
        <>
          <div className="progress-bar">
            <span className="known" style={{ flex: knownCount / totalCount }}></span>
            <span className="learning" style={{ flex: learningCount / totalCount }}></span>
          </div>
          <p className="stats" style={{ textAlign: 'center' }}>
            {knownCount} {t.known} · {learningCount} {t.learning} · {newCount} {t.new_} · {set.cards.length} {t.total}
          </p>
        </>
      )}

      <div className="direction-toggle">
        <button className="btn btn-secondary btn-sm btn-block"
          onClick={() => setDirection(d => d === 'word' ? 'translation' : 'word')}>
          {direction === 'word' ? t.wordToTranslation : t.translationToWord}
        </button>
      </div>

      {set.cards.length > 0 && (
        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => navigate(`/sets/${id}/flashcard?dir=${direction}`)}>{t.flashcards}</button>
          <button className="btn btn-primary" onClick={() => navigate(`/sets/${id}/test?dir=${direction}`)}>{t.test}</button>
        </div>
      )}

      <div className="btn-row">
        <button className="btn btn-secondary" onClick={handleShare}>{t.share}</button>
      </div>
      {shareCode && <div className="share-code">{shareCode}</div>}

      <h2 style={{ margin: '20px 0 12px' }}>{t.addWords}</h2>
      <div className="tabs">
        <div className={`tab ${tab === 'single' ? 'active' : ''}`} onClick={() => setTab('single')}>{t.single}</div>
        <div className={`tab ${tab === 'bulk' ? 'active' : ''}`} onClick={() => setTab('bulk')}>{t.bulk}</div>
      </div>

      {tab === 'single' && (
        <div>
          <div className="form-group">
            <input className="input" placeholder={t.word} value={word} onChange={e => setWord(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && document.getElementById('trans-input')?.focus()} />
          </div>
          <div className="form-group">
            <input id="trans-input" className="input" placeholder={t.translationsPlaceholder}
              value={translation} onChange={e => setTranslation(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSingle()} />
          </div>
          <button className="btn btn-primary btn-block" onClick={handleAddSingle}>{t.add}</button>
        </div>
      )}

      {tab === 'bulk' && (
        <div>
          <div className="form-group">
            <textarea className="input" placeholder={t.bulkPlaceholder}
              value={bulkText} onChange={e => setBulkText(e.target.value)} rows={6} />
          </div>
          {bulkText && (
            <div style={{ marginBottom: 12 }}>
              {bulkParsed.map((l, i) => {
                if (l.empty) return null;
                return (
                  <div key={i} className={`bulk-line ${l.valid ? 'valid' : 'invalid'}`}>
                    <span style={{ fontSize: 13 }}>{l.line}</span>
                    {!l.valid && <span style={{ fontSize: 12, color: 'var(--danger)', marginLeft: 8 }}>{t.invalidFormat}</span>}
                  </div>
                );
              })}
            </div>
          )}
          <button className="btn btn-primary btn-block" onClick={handleAddBulk}
            disabled={!hasValid || hasInvalid}>
            {t.addAll}
          </button>
          {hasInvalid && <p className="error-msg">{t.fixInvalidLines}</p>}
        </div>
      )}

      {set.cards.length > 0 && <h2 style={{ margin: '24px 0 12px' }}>{t.words} ({set.cards.length})</h2>}
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

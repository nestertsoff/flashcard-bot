import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { api } from '../api';
import { getAutoplay, setAutoplay as saveAutoplay } from '../tts';
import SpeakButton from '../components/SpeakButton';
import { timeAgo } from '../timeago';
import { prefetchSetAudio } from '../prefetch';
import { useOnline } from '../hooks/useOnline';

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
  const { t, lang: uiLang } = useLang();
  const online = useOnline();
  const [set, setSet] = useState(null);
  const [page, setPage] = useState('study');
  const [inputMode, setInputMode] = useState('single');
  const [word, setWord] = useState('');
  const [translation, setTranslation] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareLink, setShareLink] = useState(null);
  const [shareError, setShareError] = useState(null);
  const [direction, setDirection] = useState('word');
  const [autoplay, setAutoplayState] = useState(getAutoplay);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [prefetchStatus, setPrefetchStatus] = useState(null);

  useEffect(() => { loadSet(); }, [id]);

  async function loadSet() {
    try {
      const data = await api.getSet(id);
      setSet(data);
      setPrefetchStatus('loading');
      prefetchSetAudio(data, ({ total, loaded }) => {
        if (loaded >= total) {
          setPrefetchStatus('done');
          setTimeout(() => setPrefetchStatus(null), 2000);
        }
      }).catch(() => setPrefetchStatus(null));
    } catch { navigate('/'); }
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

  async function handleCopyLink() {
    setShareError(null);
    try {
      const { code } = await api.shareSet(id);
      const url = `${window.location.origin}/share/${code}`;
      setShareLink(url);
      // Try clipboard — fallback to showing link for manual copy
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // Fallback: select text in a temp input
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        input.setSelectionRange(0, 99999);
        document.execCommand('copy');
        document.body.removeChild(input);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (err) {
      setShareError(err.message);
    }
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
      {/* Header */}
      <div className="header">
        <button className="btn btn-secondary btn-icon" onClick={() => navigate('/')} aria-label={t.back} title={t.back}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        {editingTitle ? (
          <input
            className="input"
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={async () => {
              const trimmed = titleDraft.trim();
              if (trimmed && trimmed !== set.title) {
                await api.updateSet(id, { title: trimmed });
                loadSet();
              }
              setEditingTitle(false);
            }}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingTitle(false); }}
            autoFocus
            style={{ fontSize: 18, fontWeight: 800, textAlign: 'center', padding: '4px 8px', flex: 1, minWidth: 0 }}
          />
        ) : (
          <h1 style={{ fontSize: 20, margin: 0, cursor: online ? 'pointer' : 'default' }} onClick={() => { if (online) { setTitleDraft(set.title); setEditingTitle(true); } }}>{set.title}</h1>
        )}
        <div style={{ width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {prefetchStatus === 'loading' && <div className="prefetch-spinner" />}
          {prefetchStatus === 'done' && (
            <span className="prefetch-done">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
          )}
        </div>
      </div>

      {/* Progress — always visible */}
      {set.cards.length > 0 && (
        <>
          <div className="progress-bar">
            <span className="known" style={{ flex: knownCount / totalCount }}></span>
            <span className="learning" style={{ flex: learningCount / totalCount }}></span>
          </div>
          <p className="stats" style={{ textAlign: 'center', marginBottom: 16 }}>
            {knownCount} {t.known} · {learningCount} {t.learning} · {newCount} {t.new_} · {set.cards.length} {t.total}
          </p>
        </>
      )}

      {/* Page tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        <div className={`tab ${page === 'study' ? 'active' : ''}`} onClick={() => setPage('study')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
          {t.study}
        </div>
        <div className={`tab ${page === 'words' ? 'active' : ''}`} onClick={() => setPage('words')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          {t.words}
        </div>
        <div className={`tab ${page === 'settings' ? 'active' : ''}`} onClick={() => setPage('settings')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          {t.settings}
        </div>
      </div>

      {/* ===== STUDY TAB ===== */}
      {page === 'study' && (
        <div style={{ animation: 'fadeIn 0.2s ease' }}>
          {set.cards.length === 0 ? (
            <div className="empty-state">
              <img src="/stickers/5.webp" alt="" />
              <p>{t.startLearning}</p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setPage('words')}>
                {t.addWords}
              </button>
            </div>
          ) : (
            <>
              <div className="direction-toggle">
                <button className="btn btn-secondary btn-sm btn-block"
                  onClick={() => setDirection(d => d === 'word' ? 'translation' : 'word')}>
                  {direction === 'word' ? t.wordToTranslation : t.translationToWord}
                </button>
              </div>

              <div className="btn-row">
                <button className="btn btn-primary" onClick={() => navigate(`/sets/${id}/flashcard?dir=${direction}`)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  {t.flashcards}
                </button>
                <button className="btn btn-primary" onClick={() => navigate(`/sets/${id}/test?dir=${direction}`)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                  {t.test}
                </button>
              </div>

              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <img src="/stickers/8.webp" alt="" style={{ width: 100, opacity: 0.7 }} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== WORDS TAB ===== */}
      {page === 'words' && (
        <div style={{ animation: 'fadeIn 0.2s ease' }}>
          {online && (<>
          <h2 style={{ marginBottom: 12 }}>{t.addWords}</h2>
          <div className="tabs" style={{ marginBottom: 16 }}>
            <div className={`tab ${inputMode === 'single' ? 'active' : ''}`} onClick={() => setInputMode('single')}>{t.single}</div>
            <div className={`tab ${inputMode === 'bulk' ? 'active' : ''}`} onClick={() => setInputMode('bulk')}>{t.bulk}</div>
          </div>

          {inputMode === 'single' && (
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

          {inputMode === 'bulk' && (
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

          </>)}
          {set.cards.length > 0 && (
            <>
              <h2 style={{ margin: '24px 0 12px' }}>{t.words} ({set.cards.length})</h2>
              {set.cards.map(c => (
                <div key={c.id} className={`word-item status-${c.status || 'new'}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
                    <SpeakButton text={c.word} lang={set.lang} size={16} />
                    <span className="word">{c.word}</span>
                    <span style={{ color: 'var(--text-secondary)', margin: '0 4px' }}>—</span>
                    <SpeakButton text={c.translations.join(', ')} lang={set.translation_lang} size={16} />
                    <span className="translation">{c.translations.join(', ')}</span>
                  </div>
                  <div className="word-meta">
                    {c.status === 'learning' && <span className="mistakes">{c.mistakes}× ·</span>}
                    {c.last_seen ? timeAgo(c.last_seen, uiLang) : (t.new_word || t.new_)}
                  </div>
                  {online && <button className="delete-btn" onClick={() => handleDeleteCard(c.id)} aria-label={t.delete}>×</button>}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ===== SETTINGS TAB ===== */}
      {page === 'settings' && (
        <div style={{ animation: 'fadeIn 0.2s ease' }}>
          <div className="toggle-row">
            <span>{t.autoplay}</span>
            <button className={`toggle ${autoplay ? 'on' : ''}`}
              onClick={() => { const v = !autoplay; setAutoplayState(v); saveAutoplay(v); }} />
          </div>

          {online && (<>
          <div className="card" style={{ cursor: 'default' }}>
            <button className={`btn ${copied ? 'btn-success' : 'btn-secondary'} btn-block`} onClick={handleCopyLink}>
              {copied ? (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> {t.copied}</>
              ) : (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> {t.copyLink}</>
              )}
            </button>
            {shareLink && (
              <input className="input" readOnly value={shareLink} style={{ marginTop: 10, fontSize: 13, textAlign: 'center' }}
                onClick={e => e.target.select()} />
            )}
            {shareError && <p className="error-msg">{shareError}</p>}
          </div>

          <button className="btn btn-secondary btn-block" style={{ marginTop: 12 }} onClick={async () => {
            if (!confirm(t.resetProgressConfirm)) return;
            await api.resetProgress(id);
            loadSet();
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            {t.resetProgress}
          </button>

          <div className="card" style={{ cursor: 'default', marginTop: 16, borderColor: 'var(--danger)' }}>
            <p style={{ fontWeight: 700, marginBottom: 8, color: 'var(--danger)' }}>{t.delete}</p>
            <button className="btn btn-danger btn-block" onClick={handleDeleteSet}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              {t.delete}
            </button>
          </div>
          </>)}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { api } from '../api';
import { TTS_LANGUAGES } from '../tts';
import SettingsDropdown from '../components/SettingsDropdown';

export default function SetsPage() {
  const { logout } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [sets, setSets] = useState([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [importError, setImportError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newLang, setNewLang] = useState('en');
  const [newTransLang, setNewTransLang] = useState('uk');

  useEffect(() => { loadSets(); }, []);

  async function loadSets() {
    const data = await api.getSets();
    setSets(data);
    try {
      const r = await api.getReviewCount();
      setReviewCount(r.count);
    } catch {}
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    const set = await api.createSet(newTitle.trim(), [], newLang, newTransLang);
    navigate(`/sets/${set.id}`);
  }

  async function handleImport() {
    setImportError('');
    try {
      const set = await api.importSet(importCode.trim());
      setShowImport(false);
      setImportCode('');
      navigate(`/sets/${set.id}`);
    } catch (err) {
      setImportError(err.message);
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h1>{t.mySets}</h1>
        <SettingsDropdown onLogout={logout} />
      </div>

      <div className="btn-row">
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>{t.newSet}</button>
        <button className="btn btn-secondary" onClick={() => setShowImport(true)}>{t.import}</button>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{t.newSet}</h2>
            <div className="form-group">
              <label>{t.title}</label>
              <input className="input" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
            </div>
            <div className="form-group">
              <label>{t.wordLang}</label>
              <select className="input" value={newLang} onChange={e => setNewLang(e.target.value)}>
                {TTS_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>{t.translationLang}</label>
              <select className="input" value={newTransLang} onChange={e => setNewTransLang(e.target.value)}>
                {TTS_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-block" onClick={handleCreate}>{t.create}</button>
          </div>
        </div>
      )}

      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{t.importSet}</h2>
            <div className="form-group">
              <label>{t.shareCode}</label>
              <input className="input" value={importCode} onChange={e => setImportCode(e.target.value)}
                placeholder="e.g. a1b2c3" autoFocus />
            </div>
            {importError && <p className="error-msg">{importError}</p>}
            <button className="btn btn-primary btn-block" onClick={handleImport}>{t.import}</button>
          </div>
        </div>
      )}

      {reviewCount > 0 && (
        <div className="card" onClick={() => navigate('/review')} style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderColor: 'var(--primary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-dark)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{t.review}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{reviewCount} {t.wordsToReview}</div>
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      )}

      {sets.length === 0 && (
        <div className="empty-state">
          <img src="/stickers/5.webp" alt="" />
          <p>{t.noSetsYet}</p>
        </div>
      )}

      {sets.map(s => (
        <div key={s.id} className="card" onClick={() => navigate(`/sets/${s.id}`)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>{s.title}</strong>
            <span className="stats">{s.card_count} {t.cards}</span>
          </div>
          {s.card_count > 0 && (
            <div className="progress-bar">
              <span className="known" style={{ flex: s.known_count / s.card_count }}></span>
              <span className="learning" style={{ flex: s.learning_count / s.card_count }}></span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

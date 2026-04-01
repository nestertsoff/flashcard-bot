import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function SetsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sets, setSets] = useState([]);
  const [showImport, setShowImport] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [importError, setImportError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => { loadSets(); }, []);

  async function loadSets() {
    const data = await api.getSets();
    setSets(data);
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    const set = await api.createSet(newTitle.trim(), []);
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
        <h1>My Sets</h1>
        <button className="btn btn-secondary btn-sm" onClick={logout}>Logout</button>
      </div>

      <div className="btn-row">
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>New Set</button>
        <button className="btn btn-secondary" onClick={() => setShowImport(true)}>Import</button>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>New Set</h2>
            <div className="form-group">
              <label>Title</label>
              <input className="input" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
            </div>
            <button className="btn btn-primary btn-block" onClick={handleCreate}>Create</button>
          </div>
        </div>
      )}

      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Import Set</h2>
            <div className="form-group">
              <label>Share Code</label>
              <input className="input" value={importCode} onChange={e => setImportCode(e.target.value)}
                placeholder="e.g. a1b2c3" autoFocus />
            </div>
            {importError && <p className="error-msg">{importError}</p>}
            <button className="btn btn-primary btn-block" onClick={handleImport}>Import</button>
          </div>
        </div>
      )}

      {sets.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: 40 }}>No sets yet. Create one!</p>}

      {sets.map(s => (
        <div key={s.id} className="card" onClick={() => navigate(`/sets/${s.id}`)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>{s.title}</strong>
            <span className="stats">{s.card_count} cards</span>
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

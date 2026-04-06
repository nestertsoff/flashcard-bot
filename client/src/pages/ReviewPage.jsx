import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { api } from '../api';
import { prefetchReviewAudio } from '../prefetch';

const LIMIT_OPTIONS = [10, 20, 30, 50];

function getReviewLimit() {
  return Number(localStorage.getItem('reviewLimit')) || 30;
}

function setReviewLimit(val) {
  localStorage.setItem('reviewLimit', String(val));
}

export default function ReviewPage() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [cards, setCards] = useState(null);
  const [limit, setLimit] = useState(getReviewLimit);
  const [direction, setDirection] = useState('word');
  const [prefetchStatus, setPrefetchStatus] = useState(null);

  useEffect(() => {
    api.getReview(limit).then(data => {
      setCards(data.cards);
      if (data.cards.length > 0) {
        setPrefetchStatus('loading');
        prefetchReviewAudio(data.cards, ({ total, loaded }) => {
          if (loaded >= total) {
            setPrefetchStatus('done');
            setTimeout(() => setPrefetchStatus(null), 2000);
          }
        }).catch(() => setPrefetchStatus(null));
      }
    }).catch(() => navigate('/'));
  }, [limit]);

  if (cards === null) return <div className="loader-wrap"><div className="loader"></div></div>;

  if (cards.length === 0) {
    return (
      <div className="container">
        <div className="header">
          <button className="btn btn-secondary btn-icon" onClick={() => navigate('/')} aria-label={t.back} title={t.back}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 style={{ fontSize: 20, margin: 0 }}>{t.review}</h1>
          <div style={{ width: 44 }} />
        </div>
        <div className="empty-state">
          <img src="/stickers/4.webp" alt="" />
          <p>{t.reviewEmpty}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <button className="btn btn-secondary btn-icon" onClick={() => navigate('/')} aria-label={t.back} title={t.back}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 style={{ fontSize: 20, margin: 0 }}>{t.review}</h1>
        <div style={{ width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {prefetchStatus === 'loading' && <div className="prefetch-spinner" />}
          {prefetchStatus === 'done' && (
            <span className="prefetch-done">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
          )}
        </div>
      </div>

      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 16 }}>
        {cards.length} {t.wordsToReview}
      </p>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
        {LIMIT_OPTIONS.map(n => (
          <button key={n} className={`btn btn-sm ${limit === n ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setLimit(n); setReviewLimit(n); }}>
            {n}
          </button>
        ))}
      </div>

      <div className="direction-toggle">
        <button className="btn btn-secondary btn-sm btn-block"
          onClick={() => setDirection(d => d === 'word' ? 'translation' : 'word')}>
          {direction === 'word' ? t.wordToTranslation : t.translationToWord}
        </button>
      </div>

      <div className="btn-row">
        <button className="btn btn-primary" onClick={() => navigate(`/review/flashcard?dir=${direction}&limit=${limit}`)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          {t.flashcards}
        </button>
        <button className="btn btn-primary" onClick={() => navigate(`/review/test?dir=${direction}&limit=${limit}`)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          {t.test}
        </button>
      </div>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <img src="/stickers/7.webp" alt="" style={{ width: 100, opacity: 0.7 }} />
      </div>
    </div>
  );
}

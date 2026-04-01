import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';

function sortCards(cards) {
  const order = { learning: 0, new: 1, known: 2 };
  return [...cards].sort((a, b) => order[a.status] - order[b.status]);
}

export default function FlashcardPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const direction = searchParams.get('dir') || 'word';
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.getSet(id).then(s => setCards(sortCards(s.cards)));
  }, [id]);

  if (cards.length === 0) return <div className="loader-wrap"><div className="loader"></div></div>;

  if (done) {
    const correct = results.filter(r => r.correct).length;
    return (
      <div className="container">
        <h1 style={{ textAlign: 'center', marginBottom: 16 }}>Results</h1>
        <div className="results-score">{correct} / {results.length}</div>
        {results.map((r, i) => (
          <div key={i} className={`result-item ${r.correct ? 'right' : 'wrong'}`}>
            <span>{r.card.word}</span>
            <span>{r.card.translations.join(', ')}</span>
          </div>
        ))}
        <div className="btn-row" style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={() => { setIndex(0); setResults([]); setDone(false); setFlipped(false); }}>Try Again</button>
          <button className="btn btn-secondary" onClick={() => navigate(`/sets/${id}`)}>Back</button>
        </div>
      </div>
    );
  }

  const card = cards[index];
  const front = direction === 'word' ? card.word : card.translations.join(', ');
  const back = direction === 'word' ? card.translations.join(', ') : card.word;

  async function answer(correct) {
    await api.updateProgress(card.id, correct ? 'known' : 'learning');
    const newResults = [...results, { card, correct }];
    setResults(newResults);
    if (index + 1 >= cards.length) {
      setDone(true);
    } else {
      setIndex(index + 1);
      setFlipped(false);
    }
  }

  return (
    <div className="container">
      <div className="header">
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/sets/${id}`)}>Back</button>
      </div>
      <div className="counter">{index + 1} / {cards.length}</div>
      <div className={`flashcard-container ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)}>
        <div className="flashcard-inner">
          <div className="flashcard-front"><span>{front}</span></div>
          <div className="flashcard-back"><span>{back}</span></div>
        </div>
      </div>
      {flipped && (
        <div className="btn-row">
          <button className="btn btn-danger" onClick={() => answer(false)}>Don't know</button>
          <button className="btn btn-success" onClick={() => answer(true)}>Know</button>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';

function sortCards(cards) {
  const order = { learning: 0, new: 1, known: 2 };
  return [...cards].sort((a, b) => order[a.status] - order[b.status]);
}

export default function TestPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const direction = searchParams.get('dir') || 'word';
  const navigate = useNavigate();
  const [allCards, setAllCards] = useState([]);
  const [cards, setCards] = useState([]);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState([]);
  const [done, setDone] = useState(false);
  const [options, setOptions] = useState([]);

  useEffect(() => {
    api.getSet(id).then(s => {
      setAllCards(s.cards);
      setCards(sortCards(s.cards));
    });
  }, [id]);

  useEffect(() => {
    if (cards.length === 0 || index >= cards.length) return;
    const card = cards[index];
    const correctAnswer = direction === 'word' ? card.translations.join(', ') : card.word;
    const allAnswers = allCards.map(c => direction === 'word' ? c.translations.join(', ') : c.word);
    const wrongAnswers = allAnswers.filter(a => a !== correctAnswer).sort(() => Math.random() - 0.5).slice(0, 3);
    setOptions([correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5));
  }, [cards, index, allCards, direction]);

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
          <button className="btn btn-primary" onClick={() => { setIndex(0); setResults([]); setDone(false); setAnswered(false); setSelected(null); }}>Try Again</button>
          <button className="btn btn-secondary" onClick={() => navigate(`/sets/${id}`)}>Back</button>
        </div>
      </div>
    );
  }

  const card = cards[index];
  const question = direction === 'word' ? card.word : card.translations.join(', ');
  const correctAnswer = direction === 'word' ? card.translations.join(', ') : card.word;

  async function handleAnswer(opt) {
    if (answered) return;
    setAnswered(true);
    setSelected(opt);
    const isCorrect = opt === correctAnswer;
    await api.updateProgress(card.id, isCorrect ? 'known' : 'learning');
    setResults([...results, { card, correct: isCorrect }]);
  }

  function next() {
    if (index + 1 >= cards.length) {
      setDone(true);
    } else {
      setIndex(index + 1);
      setAnswered(false);
      setSelected(null);
    }
  }

  return (
    <div className="container">
      <div className="header">
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/sets/${id}`)}>Back</button>
      </div>
      <div className="counter">{index + 1} / {cards.length}</div>
      <div style={{ textAlign: 'center', fontSize: 28, fontWeight: 600, padding: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', marginBottom: 20 }}>
        {question}
      </div>
      {options.map((opt, i) => (
        <div key={i}
          className={`test-option ${answered ? 'disabled' : ''} ${answered && opt === correctAnswer ? 'correct' : ''} ${answered && opt === selected && opt !== correctAnswer ? 'wrong' : ''}`}
          onClick={() => handleAnswer(opt)}>
          {opt}
        </div>
      ))}
      {answered && (
        <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={next}>
          Next
        </button>
      )}
    </div>
  );
}

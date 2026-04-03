import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { api } from '../api';
import { getCorrectSticker, getWrongSticker, getResultSticker, getResultMessage } from '../stickers';
import { speak, getAutoplay } from '../tts';
import SpeakButton from '../components/SpeakButton';

export default function ReviewTestPage() {
  const [searchParams] = useSearchParams();
  const direction = searchParams.get('dir') || 'word';
  const limit = Number(searchParams.get('limit')) || 30;
  const navigate = useNavigate();
  const { t } = useLang();
  const [allCards, setAllCards] = useState([]);
  const [cards, setCards] = useState([]);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState([]);
  const [done, setDone] = useState(false);
  const [options, setOptions] = useState([]);
  const [sticker, setSticker] = useState(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    api.getReview(limit).then(data => {
      setAllCards(data.cards);
      setCards(data.cards);
    }).catch(() => navigate('/'));
  }, []);

  useEffect(() => {
    if (cards.length === 0 || index >= cards.length) return;
    const card = cards[index];
    const correctAnswer = direction === 'word' ? card.translations.join(', ') : card.word;
    const allAnswers = allCards.map(c => direction === 'word' ? c.translations.join(', ') : c.word);
    const wrongAnswers = allAnswers.filter(a => a !== correctAnswer).sort(() => Math.random() - 0.5).slice(0, 3);
    setOptions([correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5));
  }, [cards, index, allCards, direction]);

  useEffect(() => {
    if (started && cards.length > 0 && !done && !answered && getAutoplay()) {
      const card = cards[index];
      const q = direction === 'word' ? card.word : card.translations.join(', ');
      const qLang = direction === 'word' ? card.lang : card.translation_lang;
      speak(q, qLang);
    }
  }, [index, cards, done, answered, started]);

  if (cards.length === 0) return <div className="loader-wrap"><div className="loader"></div></div>;

  if (!started) {
    return (
      <div className="container">
        <div className="header">
          <button className="btn btn-secondary btn-icon" onClick={() => navigate('/review')} aria-label={t.back} title={t.back}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        </div>
        <div className="counter">{cards.length} {t.cards}</div>
        <div className="flashcard-container" onClick={() => setStarted(true)} style={{ cursor: 'pointer' }}>
          <div className="flashcard-inner">
            <div className="flashcard-front" style={{ fontSize: 36 }}>{t.start}</div>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    const correct = results.filter(r => r.correct).length;
    return (
      <div className="container">
        <h1 style={{ textAlign: 'center', marginBottom: 8 }}>{t.results}</h1>
        <div className="sticker-reaction large"><img src={getResultSticker(correct, results.length)} alt="" /></div>
        <p style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, color: 'var(--primary-dark)' }}>{getResultMessage(correct, results.length, t)}</p>
        <div className="results-score">{correct} / {results.length}</div>
        {results.map((r, i) => (
          <div key={i} className={`result-item ${r.correct ? 'right' : 'wrong'}`}>
            <span>{r.card.word}</span>
            <span>{r.card.translations.join(', ')}</span>
          </div>
        ))}
        <div className="btn-row" style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={() => { setIndex(0); setResults([]); setDone(false); setAnswered(false); setSelected(null); setSticker(null); setStarted(false); }}>{t.tryAgain}</button>
          <button className="btn btn-secondary" onClick={() => navigate('/review')}>{t.back}</button>
        </div>
      </div>
    );
  }

  const card = cards[index];
  const question = direction === 'word' ? card.word : card.translations.join(', ');
  const correctAnswer = direction === 'word' ? card.translations.join(', ') : card.word;
  const questionLang = direction === 'word' ? card.lang : card.translation_lang;

  async function handleAnswer(opt) {
    if (answered) return;
    setAnswered(true);
    setSelected(opt);
    const isCorrect = opt === correctAnswer;
    setSticker(isCorrect ? getCorrectSticker() : getWrongSticker());
    await api.updateProgress(card.id, isCorrect ? 'known' : 'learning');
    setResults([...results, { card, correct: isCorrect }]);
  }

  function next() {
    setSticker(null);
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
        <button className="btn btn-secondary btn-icon" onClick={() => navigate('/review')} aria-label={t.back} title={t.back}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
      </div>
      <div className="counter">{index + 1} / {cards.length}</div>
      <div style={{ textAlign: 'center', fontSize: 28, fontWeight: 700, padding: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', marginBottom: 20, boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <SpeakButton text={question} lang={questionLang} />
        {question}
      </div>
      {sticker && (<div className="sticker-reaction"><img src={sticker} alt="" /></div>)}
      {options.map((opt, i) => (
        <div key={i}
          className={`test-option ${answered ? 'disabled' : ''} ${answered && opt === correctAnswer ? 'correct' : ''} ${answered && opt === selected && opt !== correctAnswer ? 'wrong' : ''}`}
          onClick={() => handleAnswer(opt)}>
          {opt}
        </div>
      ))}
      {answered && (
        <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={next}>{t.next}</button>
      )}
    </div>
  );
}

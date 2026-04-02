import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { api } from '../api';
import { getCorrectSticker, getWrongSticker, getResultSticker, getResultMessage } from '../stickers';
import { speak, getAutoplay } from '../tts';
import SpeakButton from '../components/SpeakButton';

function sortCards(cards) {
  const order = { learning: 0, new: 1, known: 2 };
  return [...cards].sort((a, b) => order[a.status] - order[b.status]);
}

export default function FlashcardPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const direction = searchParams.get('dir') || 'word';
  const navigate = useNavigate();
  const { t } = useLang();
  const [cards, setCards] = useState([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState([]);
  const [done, setDone] = useState(false);
  const [sticker, setSticker] = useState(null);
  const [setData, setSetData] = useState(null);

  useEffect(() => {
    api.getSet(id).then(s => { setSetData(s); setCards(sortCards(s.cards)); }).catch(() => navigate('/'));
  }, [id]);

  // Autoplay front when card changes
  useEffect(() => {
    if (cards.length > 0 && !done && !sticker && setData && getAutoplay()) {
      const card = cards[index];
      const frontText = direction === 'word' ? card.word : card.translations.join(', ');
      const frontL = direction === 'word' ? setData.lang : setData.translation_lang;
      speak(frontText, frontL);
    }
  }, [index, setData, done, sticker]);

  if (cards.length === 0) return <div className="loader-wrap"><div className="loader"></div></div>;

  if (done) {
    const correct = results.filter(r => r.correct).length;
    return (
      <div className="container">
        <h1 style={{ textAlign: 'center', marginBottom: 8 }}>{t.results}</h1>
        <div className="sticker-reaction large">
          <img src={getResultSticker(correct, results.length)} alt="" />
        </div>
        <p style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, color: 'var(--primary-dark)' }}>
          {getResultMessage(correct, results.length, t)}
        </p>
        <div className="results-score">{correct} / {results.length}</div>
        {results.map((r, i) => (
          <div key={i} className={`result-item ${r.correct ? 'right' : 'wrong'}`}>
            <span>{r.card.word}</span>
            <span>{r.card.translations.join(', ')}</span>
          </div>
        ))}
        <div className="btn-row" style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={() => { setIndex(0); setResults([]); setDone(false); setFlipped(false); setSticker(null); }}>{t.tryAgain}</button>
          <button className="btn btn-secondary" onClick={() => navigate(`/sets/${id}`)}>{t.back}</button>
        </div>
      </div>
    );
  }

  const card = cards[index];
  const front = direction === 'word' ? card.word : card.translations.join(', ');
  const back = direction === 'word' ? card.translations.join(', ') : card.word;
  const frontLang = direction === 'word' ? setData?.lang : setData?.translation_lang;
  const backLang = direction === 'word' ? setData?.translation_lang : setData?.lang;

  async function answer(correct) {
    await api.updateProgress(card.id, correct ? 'known' : 'learning');
    setSticker(correct ? getCorrectSticker() : getWrongSticker());
    const newResults = [...results, { card, correct }];
    setResults(newResults);
    setTimeout(() => {
      if (index + 1 >= cards.length) {
        setDone(true);
      } else {
        setIndex(index + 1);
        setFlipped(false);
        setSticker(null);
      }
    }, 800);
  }

  return (
    <div className="container">
      <div className="header">
        <button className="btn btn-secondary btn-icon" onClick={() => navigate(`/sets/${id}`)} aria-label={t.back} title={t.back}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
      </div>
      <div className="counter">{index + 1} / {cards.length}</div>
      {sticker && (
        <div className="sticker-reaction">
          <img src={sticker} alt="" />
        </div>
      )}
      {!sticker && (
        <>
          <div className={`flashcard-container ${flipped ? 'flipped' : ''}`} onClick={() => {
            const next = !flipped;
            setFlipped(next);
          }}>
            <div className="flashcard-inner">
              <div className="flashcard-front">
                <SpeakButton text={front} lang={frontLang} />
                <span style={{ margin: '0 8px' }}>{front}</span>
              </div>
              <div className="flashcard-back">
                <SpeakButton text={back} lang={backLang} />
                <span style={{ margin: '0 8px' }}>{back}</span>
              </div>
            </div>
          </div>
          {flipped && (
            <div className="btn-row">
              <button className="btn btn-danger" onClick={() => answer(false)}>{t.dontKnow}</button>
              <button className="btn btn-success" onClick={() => answer(true)}>{t.know}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

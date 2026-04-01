import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { api } from '../api';

export default function ShareImportPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const [error, setError] = useState(null);

  useEffect(() => {
    api.importSet(code)
      .then(set => navigate(`/sets/${set.id}`, { replace: true }))
      .catch(err => setError(err.message));
  }, [code]);

  if (error) return (
    <div className="container">
      <div className="empty-state">
        <img src="/stickers/3.webp" alt="" />
        <p>{error}</p>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/')}>{t.back}</button>
      </div>
    </div>
  );

  return <div className="loader-wrap"><div className="loader"></div></div>;
}

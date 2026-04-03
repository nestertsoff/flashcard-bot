import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LangProvider } from './context/LangContext';
import { ThemeProvider } from './context/ThemeContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SetsPage from './pages/SetsPage';
import SetDetailPage from './pages/SetDetailPage';
import FlashcardPage from './pages/FlashcardPage';
import TestPage from './pages/TestPage';
import ShareImportPage from './pages/ShareImportPage';
import ReviewPage from './pages/ReviewPage';
import ReviewFlashcardPage from './pages/ReviewFlashcardPage';
import ReviewTestPage from './pages/ReviewTestPage';
import './index.css';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

function GuestRoute({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/" /> : children;
}

function App() {
  return (
    <ThemeProvider>
    <LangProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route path="/" element={<ProtectedRoute><SetsPage /></ProtectedRoute>} />
          <Route path="/sets/:id" element={<ProtectedRoute><SetDetailPage /></ProtectedRoute>} />
          <Route path="/sets/:id/flashcard" element={<ProtectedRoute><FlashcardPage /></ProtectedRoute>} />
          <Route path="/sets/:id/test" element={<ProtectedRoute><TestPage /></ProtectedRoute>} />
          <Route path="/share/:code" element={<ProtectedRoute><ShareImportPage /></ProtectedRoute>} />
          <Route path="/review" element={<ProtectedRoute><ReviewPage /></ProtectedRoute>} />
          <Route path="/review/flashcard" element={<ProtectedRoute><ReviewFlashcardPage /></ProtectedRoute>} />
          <Route path="/review/test" element={<ProtectedRoute><ReviewTestPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </LangProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

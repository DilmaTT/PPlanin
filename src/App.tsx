import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';

import MainPage from './pages/MainPage';
import SettingsPage from './pages/SettingsPage';
import SessionPage from './pages/SessionPage';
import PlanningPage from './pages/PlanningPage';
import DataPage from './pages/DataPage';
import Navbar from './components/Navbar';
import { useStorage } from './hooks/useStorage';
import { SessionProvider } from './context/SessionContext';

function App() {
  const { settings } = useStorage();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(settings.theme);
  }, [settings.theme]);

  return (
    <Router>
      <SessionProvider>
        <div className="min-h-screen bg-background text-foreground">
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<MainPage />} />
              <Route path="/session" element={<SessionPage />} />
              <Route path="/planning" element={<PlanningPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/data" element={<DataPage />} />
            </Routes>
          </main>
        </div>
      </SessionProvider>
    </Router>
  );
}

export default App;

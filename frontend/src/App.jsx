import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/themeContext';
import { ScoreProvider } from './context/scoreContext';
import ColorModeToggle from './components/ColorModeToggle';
import InitialFormPage from './pages/InitialFormPage';
import CalibrationPage from './pages/CalibrationPage';
import StartTestPage from './pages/StartTestPage';
import Test from './pages/Test';
import TestResults from './pages/TestResults';
import AllResults from './pages/AllResults';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <ScoreProvider>
        <Router>
          <ColorModeToggle />
          <Routes>
            <Route path="/" element={<InitialFormPage />} />
            <Route path="/calibration" element={<CalibrationPage />} />
            <Route path="/start-test" element={<StartTestPage />} />
            <Route path="/test" element={<Test />} />
            <Route path="/results" element={<TestResults />} />
            <Route path="/all-results" element={<AllResults />} />
          </Routes>
        </Router>
      </ScoreProvider>
    </ThemeProvider>
  );
}

export default App;
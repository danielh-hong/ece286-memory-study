// src/pages/StartTestPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/themeContext';
import { useScore } from '../context/scoreContext';
import styles from './StartTestPage.module.css';

const StartTestPage = () => {
  const navigate = useNavigate();
  const { colorMode, toggleColorMode, setCanToggle } = useTheme();
  const { participantInfo, updateParticipantInfo } = useScore();

  const [testLevel, setTestLevel] = useState(participantInfo.calibrationLevel);

  const handleLevelChange = (e) => {
    const value = Math.max(1, Math.min(20, Number(e.target.value)));
    setTestLevel(value);
  };

  const handleLevelInputChange = (e) => {
    if (e.target.value === '') {
      setTestLevel('');
      return;
    }
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      setTestLevel(Math.max(1, Math.min(20, val)));
    }
  };

  const handleLevelInputBlur = () => {
    if (testLevel === '' || isNaN(testLevel)) {
      setTestLevel(1);
    }
  };

  const handleToggleMode = () => {
    toggleColorMode();
    updateParticipantInfo({
      startedWithColor: colorMode !== 'color'
    });
  };

  const startTest = () => {
    if (testLevel !== participantInfo.testLevel) {
      updateParticipantInfo({ testLevel });
    }
    setCanToggle(false);
    navigate('/test');
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Ready to Begin Test</h1>

        <div className={styles.calibrationInfo}>
          <h2>Calibration Results</h2>
          <p>
            Based on your performance, we calibrated your level to:{' '}
            <strong>{participantInfo.calibrationLevel}</strong>
          </p>
        </div>

        <div className={styles.testSettings}>
          <h2>Test Settings</h2>

          <div className={styles.settingGroup}>
            <label>Test Difficulty Level:</label>
            <div className={styles.levelInputGroup}>
              <input
                type="range"
                min="1"
                max="20"
                value={testLevel}
                onChange={handleLevelChange}
                className={styles.levelSlider}
              />
              <input
                type="number"
                min="1"
                max="20"
                value={testLevel}
                onChange={handleLevelInputChange}
                onBlur={handleLevelInputBlur}
                className={styles.levelInput}
              />
            </div>
            <div className={styles.levelNote}>
              {testLevel !== participantInfo.calibrationLevel && (
                <p className={styles.warningNote}>
                  Note: This differs from your calibrated level of{' '}
                  {participantInfo.calibrationLevel}
                </p>
              )}
            </div>
          </div>

          <div className={styles.settingGroup}>
            <label>Starting Test Mode:</label>
            <div className={styles.modeToggleContainer}>
              <div
                className={`${styles.modeOption} ${colorMode === 'monochrome' ? styles.activeMode : ''}`}
                onClick={colorMode !== 'monochrome' ? handleToggleMode : undefined}
              >
                Monochrome
              </div>
              <div
                className={`${styles.modeOption} ${colorMode === 'color' ? styles.activeMode : ''}`}
                onClick={colorMode !== 'color' ? handleToggleMode : undefined}
              >
                Color
              </div>
            </div>
          </div>
        </div>

        <div className={styles.testInstructions}>
          <h2>Test Instructions</h2>
          <ul>
            <li>You will complete 7 rounds in each mode (14 total rounds).</li>
            <li>Squares light up for 1.5 seconds. Click them after they go dark.</li>
            <li>If you click an incorrect square, it dims out (removed from the board).</li>
            <li>Each round ends after you pick as many squares as lit initially.</li>
            <li>After 7 rounds, you get a 2-minute break, then it switches mode automatically.</li>
          </ul>
        </div>

        <button className={styles.startButton} onClick={startTest}>
          Start Test
        </button>
      </div>
    </div>
  );
};

export default StartTestPage;

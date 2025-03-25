// src/pages/CalibrationPage.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/themeContext';
import { useScore } from '../context/scoreContext';
import styles from './CalibrationPage.module.css';
import Notification from '../components/Notification';

const DISPLAY_TIME = 1000; // show pattern for 1 second

const CalibrationPage = () => {
  const navigate = useNavigate();
  const { setCanToggle } = useTheme();
  const { updateParticipantInfo } = useScore();

  const [level, setLevel] = useState(1);
  const [gridSize, setGridSize] = useState(3);
  const [grid, setGrid] = useState([]);
  const [pattern, setPattern] = useState([]);
  const [selections, setSelections] = useState([]);
  const [mistakes, setMistakes] = useState(0);
  const [lives, setLives] = useState(3);
  const [gridDimension, setGridDimension] = useState(0);

  // 'intro', 'ready', 'showing', 'selecting', 'levelComplete', 'complete'
  const [gameState, setGameState] = useState('intro');
  const [notification, setNotification] = useState('');

  const containerRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    // disable color toggling in calibration
    setCanToggle(false);
    return () => {
      setCanToggle(true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [setCanToggle]);

  useEffect(() => {
    if (gameState === 'ready') {
      initializeGrid();
    }
  }, [gameState, level]);

  const calculateGridDimension = () => {
    const padding = 60;
    const headerHeight = 150;
    const availableHeight = window.innerHeight - headerHeight - padding;
    const availableWidth = window.innerWidth - padding;
    const dimension = Math.min(availableHeight, availableWidth);
    setGridDimension(dimension);

    if (containerRef.current) {
      containerRef.current.style.width = `${dimension}px`;
      containerRef.current.style.height = `${dimension}px`;
    }
  };

  useEffect(() => {
    calculateGridDimension();
    const initialTimer = setTimeout(() => {
      calculateGridDimension();
    }, 50);

    window.addEventListener('resize', calculateGridDimension);
    return () => {
      window.removeEventListener('resize', calculateGridDimension);
      clearTimeout(initialTimer);
    };
  }, []);

  useEffect(() => {
    if (gameState !== 'intro' && gameState !== 'complete') {
      calculateGridDimension();
    }
  }, [gameState]);

  const startCalibration = () => {
    setGameState('ready');
    setTimeout(calculateGridDimension, 0);
  };

  const initializeGrid = () => {
    const newGridSize = Math.min(3 + Math.floor(level / 3), 9);
    setGridSize(newGridSize);

    const totalCells = newGridSize * newGridSize;
    setGrid(Array(totalCells).fill(false));

    const patternSize = level + 2;
    const available = Array.from({ length: totalCells }, (_, i) => i);
    const newPattern = [];
    for (let i = 0; i < Math.min(patternSize, totalCells); i++) {
      const r = Math.floor(Math.random() * available.length);
      newPattern.push(available[r]);
      available.splice(r, 1);
    }
    setPattern(newPattern);
    setSelections([]);
    setMistakes(0);

    // show pattern after a short delay
    timerRef.current = setTimeout(() => {
      showPattern(newPattern, newGridSize);
    }, 300); // slight delay to prep
  };

  const showPattern = (p, gSize) => {
    setGameState('showing');
    const litGrid = Array(gSize * gSize).fill(false);
    p.forEach((idx) => {
      litGrid[idx] = true;
    });
    setGrid(litGrid);

    // after 1 second, hide
    timerRef.current = setTimeout(() => {
      setGrid(Array(gSize * gSize).fill(false));
      setGameState('selecting');
    }, DISPLAY_TIME);
  };

  const completeCalibrationLevel = () => {
    setGameState('levelComplete');
    setNotification(`Level ${level} complete!`);
    timerRef.current = setTimeout(() => {
      setLevel((prev) => prev + 1);
      setGameState('ready');
    }, 500); // 0.5s delay
  };

  const handleCellPointerDown = (index) => {
    if (gameState !== 'selecting') return;
    if (mistakes >= 3) return;
    if (selections.includes(index)) return;

    const newSelections = [...selections, index];
    setSelections(newSelections);

    const isCorrect = pattern.includes(index);
    if (isCorrect) {
      const updated = [...grid];
      updated[index] = true;
      setGrid(updated);
    } else {
      const newMistakes = mistakes + 1;
      setMistakes(newMistakes);
      setNotification('Incorrect selection!');
      if (newMistakes >= 3) {
        setLives((prev) => prev - 1);
        if (lives - 1 <= 0) {
          completeCalibration();
          return;
        } else {
          timerRef.current = setTimeout(() => {
            setNotification(`${lives - 1} lives left. Retrying level ${level}...`);
            setGameState('ready');
          }, 300); // short delay
          return;
        }
      }
    }

    // Check if we've selected all lit squares
    const correctCount = newSelections.filter((sel) => pattern.includes(sel)).length;
    if (correctCount === pattern.length) {
      completeCalibrationLevel();
    }
  };

  const completeCalibration = () => {
    setGameState('complete');
    const calibratedLevel = Math.max(1, level - 1);
    updateParticipantInfo({
      calibrationLevel: calibratedLevel,
      testLevel: calibratedLevel
    });
    setNotification(`Calibration complete! Your level is ${calibratedLevel}.`);
  };

  const continueToTest = () => {
    navigate('/start-test');
  };

  return (
    <div className={styles.container}>
      <Notification message={notification} />

      <div className={styles.header}>
        <h1>Calibration</h1>
        {gameState !== 'intro' && gameState !== 'complete' && (
          <div className={styles.stats}>
            <div className={styles.level}>Level: {level}</div>
            <div className={styles.lives}>
              Lives: {Array(lives).fill('❤️').join(' ')}
            </div>
            <div className={styles.mistakes}>
              Mistakes: {mistakes}/3
            </div>
          </div>
        )}
      </div>

      {gameState === 'intro' && (
        <div className={styles.instructions}>
          <h2>Memory Test Calibration</h2>
          <p>We'll determine your memory capacity level with this calibration test.</p>
          <ul>
            <li>A grid of squares will appear.</li>
            <li>Some squares will light up briefly.</li>
            <li>Your task: tap all those squares (multi-touch allowed).</li>
            <li>3 mistakes in one level will cost you a life. You have 3 total lives.</li>
            <li>The grid grows as you advance through levels.</li>
          </ul>
          <button className={styles.button} onClick={startCalibration}>
            Start Calibration
          </button>
        </div>
      )}

      {gameState !== 'intro' && gameState !== 'complete' && (
        <div
          ref={containerRef}
          className={styles.gridContainer}
          style={{
            width: `${gridDimension}px`,
            height: `${gridDimension}px`
          }}
        >
          <div
            className={styles.grid}
            style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
          >
            {grid.map((isLit, i) => (
              <div
                key={i}
                className={`
                  ${styles.cell}
                  ${isLit ? styles.lit : ''}
                  ${
                    selections.includes(i) && pattern.includes(i)
                      ? styles.correct
                      : ''
                  }
                  ${
                    selections.includes(i) && !pattern.includes(i)
                      ? styles.wrong
                      : ''
                  }
                `}
                onPointerDown={() => handleCellPointerDown(i)}
              />
            ))}
          </div>
        </div>
      )}

      {gameState === 'complete' && (
        <div className={styles.complete}>
          <h2>Calibration Complete!</h2>
          <p>Based on your performance, we've determined your memory capacity level.</p>
          <div className={styles.resultLevel}>
            Level: {Math.max(1, level - 1)}
          </div>
          <p>This level will be used for the actual test.</p>
          <button className={styles.button} onClick={continueToTest}>
            Continue to Test
          </button>
        </div>
      )}
    </div>
  );
};

export default CalibrationPage;

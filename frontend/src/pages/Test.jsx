// src/pages/Test.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/themeContext';
import { useScore } from '../context/scoreContext';
import styles from './Test.module.css';
import Notification from '../components/Notification';

/**
 * Generates a random HSL color used in color mode.
 */
function getRandomColor() {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 70 + Math.floor(Math.random() * 31);
  const lightness = 50 + Math.floor(Math.random() * 21);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Core constants
const DISPLAY_TIME = 1000;             // How long the pattern is shown (ms)
const ROUNDS_PER_CONDITION = 7;        // Number of rounds per color mode
const BREAK_TIME = 120;                // 2-minute break (in seconds)
const COUNTDOWN_TIME = 3;              // 3-second countdown before test

/**
 * The Test component handles the main memory test after calibration.
 * Phases: 
 *   'initial' -> 'counting' -> 'ready' -> 'showing' -> 'selecting'
 *   -> 'roundComplete' -> 'breakTime' -> 'breakCounting' -> 'complete'
 */
const Test = () => {
  const navigate = useNavigate();
  const { colorMode, toggleColorMode } = useTheme();
  const { participantInfo, addRoundResult, calculateFinalResults } = useScore();

  // Condition & phase
  const [currentRound, setCurrentRound] = useState(1);
  const [currentCondition, setCurrentCondition] = useState(
    participantInfo.startedWithColor ? 'color' : 'monochrome'
  );
  const [testPhase, setTestPhase] = useState('initial');
  const [notification, setNotification] = useState('');
  
  // Timers & countdowns
  const [countdown, setCountdown] = useState(COUNTDOWN_TIME);
  const [breakTimeRemaining, setBreakTimeRemaining] = useState(BREAK_TIME);

  // Grid-related
  const [gridSize, setGridSize] = useState(0);
  const [grid, setGrid] = useState([]);
  const [pattern, setPattern] = useState([]);
  const [selections, setSelections] = useState([]);
  const [clickedWrong, setClickedWrong] = useState([]);
  const [cellColors, setCellColors] = useState({});
  const [gridDimension, setGridDimension] = useState(0);

  // Timing data
  const [roundStartTime, setRoundStartTime] = useState(0);
  const [roundInitiatedTime, setRoundInitiatedTime] = useState(0);
  const [selectionTimes, setSelectionTimes] = useState([]);
  const [lastSelectionTime, setLastSelectionTime] = useState(0);

  // Refs & short-circuits
  const gridContainerRef = useRef(null);
  const countdownContainerRef = useRef(null);
  const timerRef = useRef(null);
  const patternRef = useRef([]);
  const selectionsRef = useRef([]);
  const clickedWrongRef = useRef([]);
  const isProcessingClickRef = useRef(false);

  /**
   * Set grid size based on the participant's test level. Max grid is 9x9.
   */
  useEffect(() => {
    const newGridSize = Math.min(3 + Math.floor(participantInfo.testLevel / 3), 9);
    setGridSize(newGridSize);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [participantInfo.testLevel]);

  /**
   * Calculates grid dimension to keep the grid responsive.
   */
  const calculateGridDimension = () => {
    const headerHeight = 150; // approximate space for header
    const availableHeight = window.innerHeight - headerHeight - 60;
    const availableWidth = window.innerWidth * 0.9;
    const size = Math.min(availableHeight, availableWidth);
    setGridDimension(size);
    if (gridContainerRef.current) {
      gridContainerRef.current.style.width = `${size}px`;
      gridContainerRef.current.style.height = `${size}px`;
    }
  };

  /**
   * Attach listeners for responsive resizing.
   */
  useEffect(() => {
    calculateGridDimension();
    const initialTimer = setTimeout(calculateGridDimension, 50);
    window.addEventListener('resize', calculateGridDimension);
    return () => {
      window.removeEventListener('resize', calculateGridDimension);
      clearTimeout(initialTimer);
    };
  }, []);

  /**
   * Recalculate grid whenever the test phase changes (except break or completion).
   */
  useEffect(() => {
    if (!['breakTime', 'complete'].includes(testPhase)) {
      calculateGridDimension();
    }
  }, [testPhase]);

  /**
   * Start initial 3-second countdown once the component is ready.
   */
  useEffect(() => {
    if (testPhase === 'initial' && gridSize > 0) {
      setCountdown(COUNTDOWN_TIME);
      setTestPhase('counting');
    }
  }, [testPhase, gridSize]);

  /**
   * Manage post-break 3-second countdown.
   */
  useEffect(() => {
    if (testPhase === 'breakCounting' && countdown > 0) {
      const t = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
      return () => clearTimeout(t);
    } else if (testPhase === 'breakCounting' && countdown === 0) {
      setTestPhase('ready');
    }
  }, [testPhase, countdown]);

  /**
   * Manage initial countdown (before first round).
   */
  useEffect(() => {
    if (testPhase === 'counting' && countdown > 0) {
      const t = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
      return () => clearTimeout(t);
    } else if (testPhase === 'counting' && countdown === 0) {
      setTestPhase('ready');
    }
  }, [testPhase, countdown]);

  /**
   * Start a new round once "ready" (no more countdown).
   */
  useEffect(() => {
    if (testPhase === 'ready' && gridSize > 0) {
      startRound();
    }
  }, [testPhase, gridSize]);

  /**
   * Manage 2-minute break countdown (120 seconds).
   */
  useEffect(() => {
    if (testPhase === 'breakTime' && breakTimeRemaining > 0) {
      const t = setTimeout(() => setBreakTimeRemaining((prev) => prev - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [testPhase, breakTimeRemaining]);

  /**
   * Once break is done, begin 3-second break countdown.
   */
  useEffect(() => {
    if (testPhase === 'breakTime' && breakTimeRemaining === 0) {
      setCountdown(COUNTDOWN_TIME);
      setTestPhase('breakCounting');
    }
  }, [breakTimeRemaining, testPhase]);

  /**
   * Keep refs up-to-date with current states.
   */
  useEffect(() => {
    patternRef.current = pattern;
    selectionsRef.current = selections;
    clickedWrongRef.current = clickedWrong;
  }, [pattern, selections, clickedWrong]);

  /**
   * Initialize a round: generate new pattern, prepare the grid, etc.
   */
  const startRound = () => {
    setRoundInitiatedTime(Date.now());
    setClickedWrong([]);
    clickedWrongRef.current = [];
    setSelections([]);
    selectionsRef.current = [];
    setSelectionTimes([]);

    const totalCells = gridSize * gridSize;
    setGrid(Array(totalCells).fill(false));

    // Pattern size is testLevel+2, up to totalCells
    const patternSize = participantInfo.testLevel + 2;
    const availableIndices = Array.from({ length: totalCells }, (_, i) => i);
    const newPattern = [];
    for (let i = 0; i < Math.min(patternSize, totalCells); i++) {
      const randIndex = Math.floor(Math.random() * availableIndices.length);
      newPattern.push(availableIndices[randIndex]);
      availableIndices.splice(randIndex, 1);
    }
    setPattern(newPattern);
    patternRef.current = newPattern;

    // In color mode, each lit cell has a random color; otherwise all white
    const newCellColors = {};
    if (currentCondition === 'color') {
      newPattern.forEach((idx) => {
        newCellColors[idx] = getRandomColor();
      });
    } else {
      newPattern.forEach((idx) => {
        newCellColors[idx] = '#ffffff';
      });
    }
    setCellColors(newCellColors);

    showPattern(newPattern);
  };

  /**
   * Show the pattern for DISPLAY_TIME, then hide and move to selection phase.
   */
  const showPattern = (roundPattern) => {
    setTestPhase('showing');
    const totalCells = gridSize * gridSize;
    const litGrid = Array(totalCells).fill(false);
    roundPattern.forEach((idx) => {
      litGrid[idx] = true;
    });
    setGrid(litGrid);

    timerRef.current = setTimeout(() => {
      setGrid(Array(totalCells).fill(false));
      setTestPhase('selecting');

      const now = Date.now();
      setRoundStartTime(now);
      setLastSelectionTime(now);
    }, DISPLAY_TIME);
  };

  /**
   * Handle each cell click: record selection times, check correctness, etc.
   */
  const handleCellClick = (index) => {
    if (testPhase !== 'selecting') return;
    if (isProcessingClickRef.current) return;
    isProcessingClickRef.current = true;

    // Ignore if user clicks the same cell or a wrong cell again
    if (selectionsRef.current.includes(index) || clickedWrongRef.current.includes(index)) {
      isProcessingClickRef.current = false;
      return;
    }

    // If we already have all pattern cells, ignore
    if (selectionsRef.current.length >= patternRef.current.length) {
      isProcessingClickRef.current = false;
      return;
    }

    // Record time between selections
    const now = Date.now();
    const interval = now - lastSelectionTime;
    setLastSelectionTime(now);
    setSelectionTimes((prev) => [...prev, interval]);

    // Save selection
    const newSelections = [...selectionsRef.current, index];
    setSelections(newSelections);
    selectionsRef.current = newSelections;

    // Correct or wrong
    const isCorrect = patternRef.current.includes(index);
    if (isCorrect) {
      setGrid((prev) => {
        const updated = [...prev];
        updated[index] = true;
        return updated;
      });
    } else {
      const newWrong = [...clickedWrongRef.current, index];
      setClickedWrong(newWrong);
      clickedWrongRef.current = newWrong;
      setNotification('Incorrect selection!');
    }

    // If user has selected all correct pattern cells, finish the round
    const totalCorrectSoFar = newSelections.filter((sel) => patternRef.current.includes(sel)).length;
    if (totalCorrectSoFar === patternRef.current.length) {
      setTimeout(completeRound, 50);
    } else {
      isProcessingClickRef.current = false;
    }
  };

  /**
   * Wrap up the round, store results, update phases or move to break/complete.
   */
  const completeRound = () => {
    const now = Date.now();
    const totalRoundTime = now - roundStartTime;
    const timeIncludingDeadTime = now - roundInitiatedTime;

    const correct = selectionsRef.current.filter((sel) => patternRef.current.includes(sel));
    const incorrect = selectionsRef.current.filter((sel) => !patternRef.current.includes(sel));
    const errorRate = selectionsRef.current.length
      ? (incorrect.length / selectionsRef.current.length) * 100
      : 0;
    const avgSelectionTime = selectionTimes.length
      ? selectionTimes.reduce((a, b) => a + b, 0) / selectionTimes.length
      : 0;
    const effectiveTime = totalRoundTime - DISPLAY_TIME;

    // Save this round's data
    addRoundResult({
      condition: currentCondition,
      roundNumber: currentRound,
      pattern: patternRef.current,
      correctSelections: correct,
      incorrectSelections: incorrect,
      errorRate,
      selectionTimes,
      averageSelectionTime: avgSelectionTime,
      totalTime: totalRoundTime,
      effectiveTime,
      timeIncludingDeadTime,
    });

    setNotification(`Round ${currentRound} complete!`);
    setTestPhase('roundComplete');

    // Small delay to let UI show round completion, then decide next step
    timerRef.current = setTimeout(() => {
      if (currentRound === ROUNDS_PER_CONDITION) {
        // If we've finished the first condition
        if (currentCondition === (participantInfo.startedWithColor ? 'color' : 'monochrome')) {
          setBreakTimeRemaining(BREAK_TIME);
          setTestPhase('breakTime');
          setNotification('Take a 2-minute break before continuing');
          const nextMode = currentCondition === 'color' ? 'monochrome' : 'color';
          setCurrentCondition(nextMode);
          // Toggle site color mode if needed
          if (colorMode !== nextMode) {
            toggleColorMode();
          }
          setCurrentRound(1);
        } else {
          // Finished second condition => test is complete
          setTestPhase('complete');
          const finalResults = calculateFinalResults();
          saveResultsToDatabase(finalResults);
        }
      } else {
        // Move on to the next round
        setCurrentRound((prev) => prev + 1);
        setTestPhase('ready');
      }
      isProcessingClickRef.current = false;
    }, 500);
  };

  /**
   * Allows user to skip break (just sets break time to 0).
   */
  const skipBreak = () => {
    setBreakTimeRemaining(0);
  };

  /**
   * Save results to the server/database. Retries once on error.
   */
  const saveResultsToDatabase = async (results) => {
    try {
      // Local backup
      localStorage.setItem('memoryTestBackupResults', JSON.stringify(results));
      const response = await fetch(`${import.meta.env.VITE_API_URL}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(results),
      });
      if (!response.ok) {
        setNotification('Error saving results. Please contact the researcher.');
        console.error('Server error response:', response.status, response.statusText);

        // Attempt one retry after 3 seconds
        setTimeout(async () => {
          try {
            const retryResponse = await fetch(`${import.meta.env.VITE_API_URL}/participants`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(results),
            });
            if (retryResponse.ok) {
              navigate('/results');
            } else {
              console.error('Retry failed:', retryResponse.status, retryResponse.statusText);
              setNotification('Data save retry failed. Please contact the researcher and save your session ID.');
            }
          } catch (retryErr) {
            console.error('Retry error:', retryErr);
          }
        }, 3000);
      } else {
        navigate('/results');
      }
    } catch (err) {
      console.error('Error saving results:', err);
      setNotification('Error saving results. Please contact the researcher.');
    }
  };

  return (
    <div className={styles.container}>
      <Notification message={notification} />

      <div className={styles.header}>
        <div className={styles.testInfo}>
          <h2>Memory Test</h2>
          <div className={styles.phaseInfo}>
            <div className={styles.conditionInfo}>
              Mode: <span className={currentCondition === 'color' ? styles.colorMode : styles.monoMode}>
                {currentCondition === 'color' ? 'Color' : 'Monochrome'}
              </span>
            </div>
            <div className={styles.roundInfo}>
              Round: {currentRound}/{ROUNDS_PER_CONDITION}
            </div>
          </div>
        </div>
      </div>

      {/* Break phase */}
      {testPhase === 'breakTime' && (
        <div className={styles.breakContainer}>
          <h2>Take a Break</h2>
          <p>
            You've completed the first part of the test. 
            Take a 2-minute break before continuing with the second part.
          </p>
          <div className={styles.breakTimer}>
            <div className={styles.timerDisplay}>
              {Math.floor(breakTimeRemaining / 60)}:
              {(breakTimeRemaining % 60).toString().padStart(2, '0')}
            </div>
            <button className={styles.skipButton} onClick={skipBreak}>Skip Break</button>
          </div>
          <div className={styles.nextModeInfo}>
            Next mode: <span className={currentCondition === 'color' ? styles.monoMode : styles.colorMode}>
              {currentCondition === 'color' ? 'Monochrome' : 'Color'}
            </span>
          </div>
        </div>
      )}

      {/* Countdown overlay (initial or post-break) */}
      {(testPhase === 'counting' || testPhase === 'breakCounting') && (
        <div className={styles.countdownContainer} ref={countdownContainerRef}>
          <div className={styles.getReady}>Get Ready</div>
          <div className={styles.countdown}>{countdown}</div>
        </div>
      )}

      {/* Main grid (most phases except break or complete) */}
      {(testPhase === 'ready' ||
        testPhase === 'showing' ||
        testPhase === 'selecting' ||
        testPhase === 'roundComplete') && (
        <div
          ref={gridContainerRef}
          className={styles.gridContainer}
          style={{ width: `${gridDimension}px`, height: `${gridDimension}px`, position: 'relative' }}
        >
          <div
            className={styles.grid}
            style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
          >
            {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
              const isLit = grid[idx];
              const isCorrectSelection = selections.includes(idx) && pattern.includes(idx);
              const isWrongSelection = clickedWrong.includes(idx);

              // Assign background color for lit cells
              let cellStyle = {};
              if (currentCondition === 'color' && isLit) {
                cellStyle.backgroundColor = cellColors[idx] || 'var(--lit-color)';
              } else if (isLit) {
                cellStyle.backgroundColor = '#ffffff';
              } else {
                cellStyle.backgroundColor = 'var(--cell-bg-color)';
              }

              return (
                <div
                  key={idx}
                  className={`
                    ${styles.cell}
                    ${isLit ? styles.lit : ''}
                    ${isCorrectSelection ? styles.correct : ''}
                    ${isWrongSelection ? styles.wrong : ''}
                  `}
                  onClick={() => handleCellClick(idx)}
                  style={cellStyle}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Test completion message */}
      {testPhase === 'complete' && (
        <div className={styles.completeMessage}>
          <h2>Test Complete!</h2>
          <p>Thank you for participating in the memory test.</p>
          <p>Your results are being processed...</p>
        </div>
      )}
    </div>
  );
};

export default Test;

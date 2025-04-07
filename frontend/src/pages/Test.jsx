import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/themeContext';
import { useScore } from '../context/scoreContext';
import styles from './Test.module.css';
import Notification from '../components/Notification';

/** Generates random HSL for color squares **/
function getRandomColor() {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 70 + Math.floor(Math.random() * 31);
  const lightness = 50 + Math.floor(Math.random() * 21);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

const DISPLAY_TIME = 1000;       // pattern visible for 1s
const ROUNDS_PER_CONDITION = 7;  // 7 rounds in each mode
const BREAK_TIME = 120;          // 2 minutes
const COUNTDOWN_TIME = 3;        // 3-second countdown

const Test = () => {
  const navigate = useNavigate();
  const { colorMode, toggleColorMode } = useTheme();
  const { participantInfo, addRoundResult, calculateFinalResults } = useScore();

  // Round & test states
  const [currentRound, setCurrentRound] = useState(1);
  const [currentCondition, setCurrentCondition] = useState(
    participantInfo.startedWithColor ? 'color' : 'monochrome'
  );
  const [testPhase, setTestPhase] = useState('initial');
  const [notification, setNotification] = useState('');

  // Countdown / break
  const [countdown, setCountdown] = useState(COUNTDOWN_TIME);
  const [breakTimeRemaining, setBreakTimeRemaining] = useState(BREAK_TIME);

  // Grid & pattern
  const [gridSize, setGridSize] = useState(0);
  const [grid, setGrid] = useState([]);
  const [pattern, setPattern] = useState([]);
  const [selections, setSelections] = useState([]);
  const [clickedWrong, setClickedWrong] = useState([]);
  const [cellColors, setCellColors] = useState({});
  const [gridDimension, setGridDimension] = useState(0);

  // Timing
  const [roundStartTime, setRoundStartTime] = useState(0);
  const [roundInitiatedTime, setRoundInitiatedTime] = useState(0);
  const [selectionTimes, setSelectionTimes] = useState([]);
  const [lastSelectionTime, setLastSelectionTime] = useState(0);

  // Add a ref to track if round completion is in progress
  // This prevents double triggering of round completion logic
  const isCompletingRoundRef = useRef(false);

  const gridContainerRef = useRef(null);
  const countdownContainerRef = useRef(null);
  const timerRef = useRef(null);

  // Keep pattern, selections in refs to avoid stale closures
  const patternRef = useRef([]);
  const selectionsRef = useRef([]);
  const clickedWrongRef = useRef([]);
  const currentRoundRef = useRef(1); // Add a ref to track current round

  // Update the ref whenever currentRound changes
  useEffect(() => {
    currentRoundRef.current = currentRound;
  }, [currentRound]);

  // ------------------------------------------------------------------
  //  INITIAL / GRID SIZE
  // ------------------------------------------------------------------
  useEffect(() => {
    // Derive grid size from testLevel
    const size = Math.min(3 + Math.floor(participantInfo.testLevel / 3), 9);
    setGridSize(size);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [participantInfo.testLevel]);

  const calculateGridDimension = () => {
    const headerHeight = 150;
    const availableHeight = window.innerHeight - headerHeight - 60;
    const availableWidth = window.innerWidth * 0.9;
    const size = Math.min(availableHeight, availableWidth);
    setGridDimension(size);
    if (gridContainerRef.current) {
      gridContainerRef.current.style.width = `${size}px`;
      gridContainerRef.current.style.height = `${size}px`;
    }
  };

  useEffect(() => {
    calculateGridDimension();
    const resizeTimer = setTimeout(calculateGridDimension, 50);
    window.addEventListener('resize', calculateGridDimension);
    return () => {
      window.removeEventListener('resize', calculateGridDimension);
      clearTimeout(resizeTimer);
    };
  }, []);

  useEffect(() => {
    // Recalculate dimension if not on break/complete
    if (!['breakTime', 'complete'].includes(testPhase)) {
      calculateGridDimension();
    }
  }, [testPhase]);

  // ------------------------------------------------------------------
  //  COUNTDOWNS
  // ------------------------------------------------------------------
  // Start initial countdown
  useEffect(() => {
    if (testPhase === 'initial' && gridSize > 0) {
      setCountdown(COUNTDOWN_TIME);
      setTestPhase('counting');
    }
  }, [testPhase, gridSize]);

  // Decrement the countdown each second
  useEffect(() => {
    if ((testPhase === 'counting' || testPhase === 'breakCounting') && countdown > 0) {
      const t = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
      return () => clearTimeout(t);
    } else if ((testPhase === 'counting' || testPhase === 'breakCounting') && countdown === 0) {
      setTestPhase('ready');
    }
  }, [testPhase, countdown]);

  // 2-minute break
  useEffect(() => {
    if (testPhase === 'breakTime' && breakTimeRemaining > 0) {
      const t = setTimeout(() => setBreakTimeRemaining((prev) => prev - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [testPhase, breakTimeRemaining]);

  useEffect(() => {
    if (testPhase === 'breakTime' && breakTimeRemaining === 0) {
      setCountdown(COUNTDOWN_TIME);
      setTestPhase('breakCounting');
    }
  }, [testPhase, breakTimeRemaining]);


// Start round once "ready"
useEffect(() => {
  if (testPhase === 'ready' && gridSize > 0) {
    // Reset the completing round flag whenever a new round starts
    isCompletingRoundRef.current = false;
    startRound();
  }
}, [testPhase, gridSize]);

// Keep pattern, selections in sync with refs
useEffect(() => {
  patternRef.current = pattern;
}, [pattern]);
useEffect(() => {
  selectionsRef.current = selections;
}, [selections]);
useEffect(() => {
  clickedWrongRef.current = clickedWrong;
}, [clickedWrong]);

// ------------------------------------------------------------------
//  START ROUND
// ------------------------------------------------------------------
const startRound = () => {
  setRoundInitiatedTime(Date.now());
  setClickedWrong([]);
  setSelections([]);
  setSelectionTimes([]);

  const totalCells = gridSize * gridSize;
  setGrid(Array(totalCells).fill(false));

  // pattern length = testLevel + 2
  const patternSize = participantInfo.testLevel + 2;
  const available = Array.from({ length: totalCells }, (_, i) => i);
  const newPattern = [];
  for (let i = 0; i < Math.min(patternSize, totalCells); i++) {
    const r = Math.floor(Math.random() * available.length);
    newPattern.push(available[r]);
    available.splice(r, 1);
  }
  setPattern(newPattern);

  // color squares or white squares
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

  // Show pattern
  showPattern(newPattern);
};

// ------------------------------------------------------------------
//  SHOW PATTERN
// ------------------------------------------------------------------
const showPattern = (roundPattern) => {
  setTestPhase('showing');
  const totalCells = gridSize * gridSize;
  const litGrid = Array(totalCells).fill(false);
  roundPattern.forEach((idx) => {
    litGrid[idx] = true;
  });
  setGrid(litGrid);

  // After DISPLAY_TIME, hide and let user select
  timerRef.current = setTimeout(() => {
    setGrid(Array(totalCells).fill(false));
    setTestPhase('selecting');
    const now = Date.now();
    setRoundStartTime(now);
    setLastSelectionTime(now);
  }, DISPLAY_TIME);
};

// ------------------------------------------------------------------
//  HANDLE TAP
// ------------------------------------------------------------------
const handleCellPointerDown = (index) => {
  // Only accept taps if in "selecting"
  if (testPhase !== 'selecting') return;

  // If user already picked or flagged wrong, ignore
  if (selectionsRef.current.includes(index) || clickedWrongRef.current.includes(index)) {
    return;
  }

  // measure time since last pick
  const now = Date.now();
  const interval = now - lastSelectionTime;
  setLastSelectionTime(now);

  // We do a functional update to ensure we pass the updated times below
  let newTimes = [];
  setSelectionTimes((prevTimes) => {
    newTimes = [...prevTimes, interval];
    return newTimes;
  });

  // check correctness
  const isCorrect = patternRef.current.includes(index);

  // update selection or clickedWrong
  const newSelections = [...selectionsRef.current, index];
  setSelections(newSelections);
  if (isCorrect) {
    setGrid((prev) => {
      const updated = [...prev];
      updated[index] = true;
      return updated;
    });
  } else {
    setClickedWrong((prev) => [...prev, index]);
    setNotification('Incorrect selection!');
  }

  // If user has made exactly `pattern.length` picks, end the round
  if (newSelections.length === patternRef.current.length) {
    // Immediately set testPhase so no further taps register
    setTestPhase('roundComplete');

    // Only proceed if we're not already completing a round
    if (!isCompletingRoundRef.current) {
      // Set the flag to prevent duplicate completions
      isCompletingRoundRef.current = true;
      
      // Wait a tiny bit so the UI can show the last tap
      setTimeout(() => {
        // use the current round from ref to ensure we have latest value
        completeRound(newTimes);
      }, 50);
    }
  }
};

// ------------------------------------------------------------------
//  COMPLETE ROUND
// ------------------------------------------------------------------
const completeRound = (finalTimes) => {
  const now = Date.now();
  const totalRoundTime = now - roundStartTime;
  const timeIncludingDeadTime = now - roundInitiatedTime;

  // correct/incorrect
  const correct = selectionsRef.current.filter((sel) =>
    patternRef.current.includes(sel)
  );
  const incorrect = selectionsRef.current.filter(
    (sel) => !patternRef.current.includes(sel)
  );

  // error rate
  const errorRate = selectionsRef.current.length
    ? (incorrect.length / selectionsRef.current.length) * 100
    : 0;

  // average time between picks
  const avgSelectionTime = finalTimes.length
    ? finalTimes.reduce((a, b) => a + b, 0) / finalTimes.length
    : 0;

  // effectiveTime = totalRoundTime - the 1s initial display
  const effectiveTime = totalRoundTime - DISPLAY_TIME;

  // Use the current round from ref to ensure we're using the latest value
  const actualRound = currentRoundRef.current;

  // Save the round's data
  addRoundResult({
    condition: currentCondition,
    roundNumber: actualRound,
    pattern: patternRef.current,
    correctSelections: correct,
    incorrectSelections: incorrect,
    errorRate,
    selectionTimes: finalTimes,
    averageSelectionTime: avgSelectionTime,
    totalTime: totalRoundTime,
    effectiveTime,
    timeIncludingDeadTime
  });

  setNotification(`Round ${actualRound} complete!`);

  // Clear any existing timers to prevent race conditions
  if (timerRef.current) {
    clearTimeout(timerRef.current);
  }

  // Move on after 0.5s
  timerRef.current = setTimeout(() => {
    if (actualRound === ROUNDS_PER_CONDITION) {
      // done with 7 rounds for the first condition or second
      const firstCondition = participantInfo.startedWithColor ? 'color' : 'monochrome';
      if (currentCondition === firstCondition) {
        // break + switch to other mode
        setBreakTimeRemaining(BREAK_TIME);
        setTestPhase('breakTime');
        setNotification('Take a 2-minute break before continuing');
        const nextMode = currentCondition === 'color' ? 'monochrome' : 'color';
        setCurrentCondition(nextMode);
        // If colorMode differs, toggle
        if (colorMode !== nextMode) {
          toggleColorMode();
        }
        setCurrentRound(1);
      } else {
        // done with second condition => complete test
        setTestPhase('complete');
        const finalResults = calculateFinalResults();
        saveResultsToDatabase(finalResults);
      }
    } else {
      // Increment to next round - CRITICAL FIX HERE
      // This should only happen once per round completion
      setCurrentRound(prevRound => prevRound + 1);
      setTestPhase('ready');
    }
    
    // Reset the completing round flag
    isCompletingRoundRef.current = false;
  }, 500);
};

// ------------------------------------------------------------------
//  SKIP BREAK / SAVE
// ------------------------------------------------------------------
const skipBreak = () => {
  setBreakTimeRemaining(0);
};

const saveResultsToDatabase = async (results) => {
  try {
    // local backup
    localStorage.setItem('memoryTestBackupResults', JSON.stringify(results));
    const response = await fetch(`${import.meta.env.VITE_API_URL}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(results),
    });
    if (!response.ok) {
      setNotification('Error saving results. Please contact the researcher.');
      console.error('Server error:', response.status, response.statusText);

      // Attempt one retry
      setTimeout(async () => {
        try {
          const retryResp = await fetch(`${import.meta.env.VITE_API_URL}/participants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(results),
          });
          if (retryResp.ok) {
            navigate('/results');
          } else {
            console.error('Retry failed:', retryResp.status, retryResp.statusText);
            setNotification('Data save retry failed. Please contact the researcher.');
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

// ------------------------------------------------------------------
//  RENDER
// ------------------------------------------------------------------
return (
  <div className={styles.container}>
    <Notification message={notification} />

    {/* Header */}
    <div className={styles.header}>
      <div className={styles.testInfo}>
        <h2>Memory Test</h2>
        <div className={styles.phaseInfo}>
          <div className={styles.conditionInfo}>
            Mode:{' '}
            <span
              className={
                currentCondition === 'color'
                  ? styles.colorMode
                  : styles.monoMode
              }
            >
              {currentCondition === 'color' ? 'Color' : 'Monochrome'}
            </span>
          </div>
          <div className={styles.roundInfo}>
            Round: {currentRound}/{ROUNDS_PER_CONDITION}
          </div>
        </div>
      </div>
    </div>

    {/* Break */}
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
          <button className={styles.skipButton} onClick={skipBreak}>
            Skip Break
          </button>
        </div>
        <div className={styles.nextModeInfo}>
          Next mode:{' '}
          <span
            className={
              currentCondition === 'color' ? styles.monoMode : styles.colorMode
            }
          >
            {currentCondition === 'color' ? 'Monochrome' : 'Color'}
          </span>
        </div>
      </div>
    )}

    {/* Countdown */}
    {(testPhase === 'counting' || testPhase === 'breakCounting') && (
      <div
        className={styles.countdownContainer}
        ref={countdownContainerRef}
      >
        <div className={styles.getReady}>Get Ready</div>
        <div className={styles.countdown}>{countdown}</div>
      </div>
    )}

    {/* Main Grid */}
    {(testPhase === 'ready' ||
      testPhase === 'showing' ||
      testPhase === 'selecting' ||
      testPhase === 'roundComplete') && (
      <div
        ref={gridContainerRef}
        className={styles.gridContainer}
        style={{
          width: `${gridDimension}px`,
          height: `${gridDimension}px`,
          position: 'relative'
        }}
      >
        <div
          className={styles.grid}
          style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
        >
          {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
            const isLit = grid[idx];
            const isCorrectSelection =
              selections.includes(idx) && pattern.includes(idx);
            const isWrongSelection = clickedWrong.includes(idx);

            let cellStyle = {};
            if (currentCondition === 'color' && isLit) {
              cellStyle.backgroundColor = cellColors[idx] || '#fff';
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
                onPointerDown={() => handleCellPointerDown(idx)}
                style={cellStyle}
              />
            );
          })}
        </div>
      </div>
    )}

    {/* Test Complete */}
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
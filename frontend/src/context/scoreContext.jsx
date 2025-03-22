// src/context/scoreContext.jsx
import { createContext, useState, useContext } from 'react';

/**
 * ScoreContext keeps track of participantInfo (name, testLevel, etc.)
 * and also testResults (round-by-round plus aggregated summary).
 */
const ScoreContext = createContext();

export const ScoreProvider = ({ children }) => {
  const [participantInfo, setParticipantInfo] = useState({
    name: '',
    startedWithColor: false,
    library: 'Other',
    candy: '',
    calibrationLevel: 0,
    testLevel: 0
  });

  const [testResults, setTestResults] = useState({
    rounds: [],
    results: {
      monochromeErrorRate: 0,
      colorErrorRate: 0,
      monochromeCorrectTotal: 0,
      colorCorrectTotal: 0,
      monochromeIncorrectTotal: 0,
      colorIncorrectTotal: 0,
      monochromeAvgClickTime: 0,
      colorAvgClickTime: 0,
      monochromeAvgRoundTime: 0,
      colorAvgRoundTime: 0,
      monochromeAvgEffectiveTime: 0,
      colorAvgEffectiveTime: 0,
      totalTestTime: 0
    }
  });

  /** Update top-level participant info (e.g. name, library, etc.) */
  const updateParticipantInfo = (info) => {
    setParticipantInfo((prev) => ({
      ...prev,
      ...info
    }));
  };

  /**
   * Add a single round's data. This accumulates in testResults.rounds.
   * The final summary is calculated once the entire test is done.
   */
  const addRoundResult = (roundData) => {
    setTestResults((prev) => ({
      ...prev,
      rounds: [...prev.rounds, roundData]
    }));
  };

  /**
   * Once both conditions are done, call this to compute the final stats
   * and store them in testResults.results. Then we return everything
   * for saving to the database (including participantInfo).
   */
  const calculateFinalResults = () => {
    const { rounds } = testResults;

    // Filter rounds by condition
    const monochromeRounds = rounds.filter((r) => r.condition === 'monochrome');
    const colorRounds = rounds.filter((r) => r.condition === 'color');

    // Helper functions
    const sum = (arr) => arr.reduce((total, val) => total + val, 0);
    const average = (arr) => (arr.length ? sum(arr) / arr.length : 0);

    // Calculate aggregated stats
    const results = {
      monochromeErrorRate: average(monochromeRounds.map((r) => r.errorRate)),
      colorErrorRate: average(colorRounds.map((r) => r.errorRate)),

      monochromeCorrectTotal: sum(monochromeRounds.map((r) => r.correctSelections.length)),
      colorCorrectTotal: sum(colorRounds.map((r) => r.correctSelections.length)),

      monochromeIncorrectTotal: sum(monochromeRounds.map((r) => r.incorrectSelections.length)),
      colorIncorrectTotal: sum(colorRounds.map((r) => r.incorrectSelections.length)),

      monochromeAvgClickTime: average(monochromeRounds.flatMap((r) => r.selectionTimes)),
      colorAvgClickTime: average(colorRounds.flatMap((r) => r.selectionTimes)),

      monochromeAvgRoundTime: average(monochromeRounds.map((r) => r.totalTime)),
      colorAvgRoundTime: average(colorRounds.map((r) => r.totalTime)),

      monochromeAvgEffectiveTime: average(monochromeRounds.map((r) => r.effectiveTime)),
      colorAvgEffectiveTime: average(colorRounds.map((r) => r.effectiveTime)),

      // totalTestTime is the sum of totalTime for all rounds
      // i.e. the total user time from the moment they can click
      totalTestTime: sum(rounds.map((r) => r.totalTime))
    };

    // Store in testResults
    setTestResults((prev) => ({
      ...prev,
      results
    }));

    // Return everything for DB saving
    return {
      ...participantInfo,
      rounds,
      results
    };
  };

  return (
    <ScoreContext.Provider
      value={{
        participantInfo,
        updateParticipantInfo,
        testResults,
        addRoundResult,
        calculateFinalResults
      }}
    >
      {children}
    </ScoreContext.Provider>
  );
};

export const useScore = () => useContext(ScoreContext);

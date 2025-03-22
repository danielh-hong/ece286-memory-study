// src/pages/Results.jsx
import { Link } from 'react-router-dom';
import { useScore } from '../context/scoreContext';
import styles from './Results.module.css';

/**
 * A minimal final results screen for an individual user,
 * highlighting essential stats only.
 */
const Results = () => {
  const { participantInfo, testResults } = useScore();
  const { rounds, results } = testResults;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Your Results</h1>

        <div className={styles.participantInfo}>
          <h2>Participant Summary</h2>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.label}>Name:</span>
              <span className={styles.value}>{participantInfo.name}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.label}>Started With:</span>
              <span className={styles.value}>{participantInfo.startedWithColor ? 'Color' : 'Monochrome'}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.label}>Calibration Level:</span>
              <span className={styles.value}>{participantInfo.calibrationLevel}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.label}>Test Level:</span>
              <span className={styles.value}>{participantInfo.testLevel}</span>
            </div>
          </div>
        </div>

        <div className={styles.resultsSummary}>
          <h2>Performance Metrics</h2>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryRow}>
              <span>Monochrome Error Rate:</span>
              <strong>{results.monochromeErrorRate.toFixed(2)}%</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Color Error Rate:</span>
              <strong>{results.colorErrorRate.toFixed(2)}%</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Average Monochrome Round Time (ms):</span>
              <strong>{results.monochromeAvgRoundTime.toFixed(2)}</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Average Color Round Time (ms):</span>
              <strong>{results.colorAvgRoundTime.toFixed(2)}</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Total Test Time (ms):</span>
              <strong>{results.totalTestTime.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        <div className={styles.buttons}>
          <Link to="/all-results" className={styles.viewAllButton}>
            View All Results
          </Link>
          <Link to="/" className={styles.homeButton}>
            Start New Test
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Results;

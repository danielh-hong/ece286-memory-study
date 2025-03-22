import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useScore } from '../context/scoreContext';
import styles from './TestResults.module.css';

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement,
  Title, 
  Tooltip, 
  Legend
);

const TestResults = () => {
  const { participantInfo, testResults } = useScore();
  const { rounds, results } = testResults;

  const [allParticipantsData, setAllParticipantsData] = useState(null);
  const [selectedRound, setSelectedRound] = useState(null);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/results`);
        if (response.ok) {
          const data = await response.json();
          setAllParticipantsData(data);
        }
      } catch (error) {
        console.error('Error fetching comparison data:', error);
      }
    };
    fetchAllData();
  }, []);

  const colorSelectionTimes = rounds
    .filter((r) => r.condition === 'color')
    .flatMap((r) => r.selectionTimes);

  const monoSelectionTimes = rounds
    .filter((r) => r.condition === 'monochrome')
    .flatMap((r) => r.selectionTimes);

  // Create bins for histogram - using 25ms buckets
  const buildHistogram = (arr, binSize = 25) => {
    if (!arr || arr.length === 0) return [];
    
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    
    // Create bins from min to max with binSize step
    const binCount = Math.ceil((max - min) / binSize) + 1;
    const bins = Array(binCount).fill(0);
    
    arr.forEach(value => {
      const binIndex = Math.floor((value - min) / binSize);
      bins[binIndex]++;
    });
    
    return Array.from({ length: binCount }, (_, i) => ({
      binStart: min + i * binSize,
      count: bins[i]
    }));
  };

  const colorHist = buildHistogram(colorSelectionTimes, 25);
  const monoHist = buildHistogram(monoSelectionTimes, 25);

  // Combine all bins for complete x-axis
  const allBins = [
    ...new Set([
      ...colorHist.map(x => x.binStart), 
      ...monoHist.map(x => x.binStart)
    ])
  ].sort((a, b) => a - b);

  const colorDataByBin = allBins.map(bin => {
    const found = colorHist.find(x => x.binStart === bin);
    return found ? found.count : 0;
  });

  const monoDataByBin = allBins.map(bin => {
    const found = monoHist.find(x => x.binStart === bin);
    return found ? found.count : 0;
  });

  // Format for Chart.js - simple bar chart only, no curve
  const chartData = {
    labels: allBins.map(bin => `${bin}-${bin + 24}ms`),
    datasets: [
      {
        label: 'Color Mode Reactions',
        data: colorDataByBin,
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
      },
      {
        label: 'Monochrome Mode Reactions',
        data: monoDataByBin,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }
    ]
  };

  const handleRoundClick = (round) => {
    setSelectedRound(selectedRound === round ? null : round);
  };

  return (
    <div className={styles.container}>
      <div className={styles.navLinks}>
        <Link to="/" className={styles.navLink}>Home</Link>
        <Link to="/all-results" className={styles.navLink}>View All Results</Link>
      </div>
      
      <div className={styles.card}>
        <h1 className={styles.title}>Test Results</h1>
        
        <div className={styles.participantInfo}>
          <h2>Participant Info</h2>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.label}>Name:</span>
              <span className={styles.value}>{participantInfo.name}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.label}>Started With:</span>
              <span className={styles.value}>
                {participantInfo.startedWithColor ? 'Color' : 'Monochrome'}
              </span>
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

        {/* Distribution Chart Section */}
        <div className={styles.chartSection}>
          <h2>Selection Times Distribution (25ms Buckets)</h2>
          <div className={styles.chartWrapper}>
            <Bar
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  title: { 
                    display: true,
                    text: 'Reaction Time Distribution (ms)',
                    font: { size: 16 },
                    padding: {
                      bottom: 30
                    }
                  },
                  legend: { 
                    position: 'top',
                    labels: {
                      boxWidth: 15,
                      padding: 15
                    }
                  },
                  tooltip: {
                    callbacks: {
                      title: (context) => {
                        return `Time range: ${context[0].label}`;
                      },
                      label: (context) => {
                        const datasetLabel = context.dataset.label;
                        const value = context.parsed.y;
                        return `${datasetLabel}: ${value} occurrences`;
                      }
                    }
                  }
                },
                scales: {
                  x: { 
                    title: {
                      display: true,
                      text: 'Reaction Time (ms)',
                      padding: {
                        top: 20
                      },
                      font: {
                        size: 14,
                        weight: 'bold'
                      }
                    },
                    ticks: {
                      // Show fewer labels on x-axis to prevent overcrowding with 25ms buckets
                      maxTicksLimit: 15,
                      callback: function(val, index) {
                        // Only show every 4th label (100ms intervals)
                        const label = this.getLabelForValue(val);
                        const startTime = parseInt(label.split('-')[0]);
                        return startTime % 100 === 0 ? startTime : '';
                      },
                      font: {
                        size: 12
                      }
                    },
                    grid: {
                      display: true,
                      color: 'rgba(0, 0, 0, 0.1)'
                    }
                  },
                  y: { 
                    title: {
                      display: true,
                      text: 'Frequency',
                      padding: {
                        bottom: 10
                      },
                      font: {
                        size: 14,
                        weight: 'bold'
                      }
                    },
                    ticks: {
                      precision: 0,
                      font: {
                        size: 12
                      }
                    },
                    grid: {
                      display: true,
                      color: 'rgba(0, 0, 0, 0.1)'
                    }
                  }
                },
                layout: {
                  padding: {
                    left: 10,
                    right: 10,
                    top: 0,
                    bottom: 30
                  }
                }
              }}
            />
          </div>
        </div>

        <div className={styles.resultsSummary}>
          <h2>Performance Summary</h2>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryRow}>
              <span>Mono Error Rate:</span>
              <strong>{results.monochromeErrorRate.toFixed(2)}%</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Color Error Rate:</span>
              <strong>{results.colorErrorRate.toFixed(2)}%</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Mono Avg Round Time:</span>
              <strong>{results.monochromeAvgRoundTime.toFixed(2)} ms</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Color Avg Round Time:</span>
              <strong>{results.colorAvgRoundTime.toFixed(2)} ms</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Total Test Time:</span>
              <strong>{(results.totalTestTime / 1000).toFixed(2)} s</strong>
            </div>
          </div>
        </div>

        <div className={styles.roundDetails}>
          <h2>Round Details</h2>
          <p className={styles.clickTip}>Click a round to see details</p>
          <table className={styles.roundTable}>
            <thead>
              <tr>
                <th>Condition</th>
                <th>Round</th>
                <th>Error Rate (%)</th>
                <th>Total Time (ms)</th>
                <th>Effective (ms)</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((r, idx) => (
                <>
                  <tr 
                    key={`${r.condition}-${r.roundNumber}`} 
                    className={`${styles.roundRow} ${selectedRound === idx ? styles.selectedRow : ''}`}
                    onClick={() => handleRoundClick(idx)}
                  >
                    <td>{r.condition}</td>
                    <td>{r.roundNumber}</td>
                    <td>{r.errorRate.toFixed(2)}</td>
                    <td>{r.totalTime}</td>
                    <td>{r.effectiveTime}</td>
                  </tr>
                  {selectedRound === idx && (
                    <tr className={styles.detailsRow}>
                      <td colSpan="5">
                        <div className={styles.roundDetailsContent}>
                          <div className={styles.detailsGrid}>
                            <div className={styles.detailItem}>
                              <span className={styles.detailLabel}>Pattern Size:</span>
                              <span>{r.pattern.length}</span>
                            </div>
                            <div className={styles.detailItem}>
                              <span className={styles.detailLabel}>Correct Selections:</span>
                              <span>{r.correctSelections.length}</span>
                            </div>
                            <div className={styles.detailItem}>
                              <span className={styles.detailLabel}>Incorrect Selections:</span>
                              <span>{r.incorrectSelections.length}</span>
                            </div>
                            <div className={styles.detailItem}>
                              <span className={styles.detailLabel}>Avg Selection Time:</span>
                              <span>{r.averageSelectionTime.toFixed(2)} ms</span>
                            </div>
                            <div className={styles.detailItem}>
                              <span className={styles.detailLabel}>Selection Times:</span>
                              <span className={styles.timesList}>
                                {r.selectionTimes.map((time, i) => (
                                  <span key={i} className={styles.timeChip}>{time} ms</span>
                                ))}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
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

export default TestResults;
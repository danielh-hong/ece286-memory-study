import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import styles from './AllResults.module.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const AllResults = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });
  const [selectedResult, setSelectedResult] = useState(null);
  
  // For reaction time data analysis
  const [reactionStats, setReactionStats] = useState({
    colorTimes: [],
    monoTimes: []
  });

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/results`);
        if (!res.ok) {
          throw new Error('Failed to fetch results');
        }
        const data = await res.json();
        setResults(data);
        
        // Extract all reaction times for distribution analysis
        const allColorTimes = [];
        const allMonoTimes = [];
        
        data.forEach(participant => {
          if (participant.rounds) {
            participant.rounds.forEach(round => {
              if (round.condition === 'color' && round.selectionTimes) {
                allColorTimes.push(...round.selectionTimes);
              } else if (round.condition === 'monochrome' && round.selectionTimes) {
                allMonoTimes.push(...round.selectionTimes);
              }
            });
          }
        });
        
        setReactionStats({
          colorTimes: allColorTimes,
          monoTimes: allMonoTimes
        });
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching results:', err);
        setError('Error loading results. Please try again later.');
        setLoading(false);
      }
    };
    fetchResults();
  }, []);

  const sortResults = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });

    setResults((prev) => {
      const sorted = [...prev].sort((a, b) => {
        const aValue = key.includes('.')
          ? key.split('.').reduce((obj, i) => obj?.[i], a)
          : a[key];
        const bValue = key.includes('.')
          ? key.split('.').reduce((obj, i) => obj?.[i], b)
          : b[key];

        if (aValue == null) return 1;
        if (bValue == null) return -1;

        if (typeof aValue === 'string') {
          return direction === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      });
      return sorted;
    });
  };

  const formatDate = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleString();
  };

  const getAverageResults = () => {
    if (!results.length) return null;

    const colorFirst = results.filter((r) => r.startedWithColor);
    const monoFirst = results.filter((r) => !r.startedWithColor);

    const sum = (arr) => arr.reduce((acc, val) => acc + val, 0);
    const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0);

    const totalColorErrorRates = results.map((r) => r?.results?.colorErrorRate || 0);
    const totalMonoErrorRates = results.map((r) => r?.results?.monochromeErrorRate || 0);
    const colorAvgTimes = results.map((r) => r?.results?.colorAvgRoundTime || 0);
    const monoAvgTimes = results.map((r) => r?.results?.monochromeAvgRoundTime || 0);

    const avgColorErrorRate = avg(totalColorErrorRates);
    const avgMonoErrorRate = avg(totalMonoErrorRates);
    const avgColorTime = avg(colorAvgTimes);
    const avgMonoTime = avg(monoAvgTimes);

    return {
      totalParticipants: results.length,
      colorFirstCount: colorFirst.length,
      monoFirstCount: monoFirst.length,
      avgColorErrorRate,
      avgMonoErrorRate,
      avgColorTime,
      avgMonoTime
    };
  };

  const averages = getAverageResults();
  
  // For showing distribution of reaction times using 25ms buckets
  const buildHistogram = (data, binSize = 25) => {
    if (!data || data.length === 0) return { labels: [], values: [] };
    
    const min = Math.floor(Math.min(...data) / binSize) * binSize;
    const max = Math.ceil(Math.max(...data) / binSize) * binSize;
    
    const bins = {};
    for (let i = min; i <= max; i += binSize) {
      bins[i] = 0;
    }
    
    data.forEach(time => {
      const binIndex = Math.floor(time / binSize) * binSize;
      bins[binIndex] = (bins[binIndex] || 0) + 1;
    });
    
    return {
      labels: Object.keys(bins).map(bin => `${bin}-${parseInt(bin) + binSize - 1}ms`),
      values: Object.values(bins)
    };
  };
  
  const colorHistogram = buildHistogram(reactionStats.colorTimes, 25);
  const monoHistogram = buildHistogram(reactionStats.monoTimes, 25);
  
  const distributionData = {
    labels: colorHistogram.labels,
    datasets: [
      {
        label: 'Color Mode Reaction Times',
        data: colorHistogram.values,
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgb(255, 99, 132)',
        borderWidth: 1
      },
      {
        label: 'Monochrome Mode Reaction Times',
        data: monoHistogram.values,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgb(54, 162, 235)',
        borderWidth: 1
      }
    ]
  };
  
  const handleRowClick = (index) => {
    if (selectedResult === index) {
      setSelectedResult(null);
    } else {
      setSelectedResult(index);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>All Test Results</h1>
        <div className={styles.headerButtons}>
          <Link to="/" className={styles.homeButton}>Back to Home</Link>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading results...</div>
      ) : error ? (
        <div className={styles.error}>{error}</div>
      ) : (
        <>
          {averages && (
            <div className={styles.summaryCard}>
              <h2>Summary Statistics</h2>

              <div className={styles.summaryGrid}>
                <div className={styles.summaryItem}>
                  <span className={styles.label}>Total Participants:</span>
                  <span className={styles.value}>{averages.totalParticipants}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.label}>Started with Color:</span>
                  <span className={styles.value}>{averages.colorFirstCount}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.label}>Started with Monochrome:</span>
                  <span className={styles.value}>{averages.monoFirstCount}</span>
                </div>

                <div className={styles.divider}></div>

                <div className={styles.summaryItem}>
                  <span className={styles.label}>Avg. Color Error Rate:</span>
                  <span className={styles.value}>{averages.avgColorErrorRate.toFixed(2)}%</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.label}>Avg. Monochrome Error Rate:</span>
                  <span className={styles.value}>{averages.avgMonoErrorRate.toFixed(2)}%</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.label}>Avg. Color Reaction Time:</span>
                  <span className={styles.value}>{averages.avgColorTime.toFixed(2)} ms</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.label}>Avg. Monochrome Reaction Time:</span>
                  <span className={styles.value}>{averages.avgMonoTime.toFixed(2)} ms</span>
                </div>
              </div>
            </div>
          )}
          
          <div className={styles.chartCard}>
            <h2>Reaction Time Distribution (25ms Buckets)</h2>
            <div className={styles.chartContainer}>
              <Bar 
                data={distributionData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: 'top',
                    },
                    title: {
                      display: true,
                      text: 'Reaction Time Distribution Across All Participants'
                    },
                  },
                  scales: {
                    y: {
                      title: {
                        display: true,
                        text: 'Frequency'
                      }
                    },
                    x: {
                      title: {
                        display: true,
                        text: 'Reaction Time (ms)'
                      },
                      ticks: {
                        // Show fewer labels on x-axis to prevent overcrowding with 25ms buckets
                        maxTicksLimit: 20,
                        callback: function(val, index) {
                          // Only show every 4th label (100ms intervals)
                          const label = this.getLabelForValue(val);
                          const startTime = parseInt(label.split('-')[0]);
                          return startTime % 100 === 0 ? startTime : '';
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>

          <div className={styles.resultsTable}>
            <h2>Individual Results</h2>
            <p className={styles.clickTip}>Click on a row to see detailed information</p>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th onClick={() => sortResults('timestamp')}>
                    Date/Time
                    {sortConfig.key === 'timestamp' && (
                      <span className={styles.sortIndicator}>
                        {sortConfig.direction === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </th>
                  <th onClick={() => sortResults('testLevel')}>
                    Level
                    {sortConfig.key === 'testLevel' && (
                      <span className={styles.sortIndicator}>
                        {sortConfig.direction === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </th>
                  <th onClick={() => sortResults('startedWithColor')}>
                    Started With
                    {sortConfig.key === 'startedWithColor' && (
                      <span className={styles.sortIndicator}>
                        {sortConfig.direction === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </th>
                  <th onClick={() => sortResults('results.colorErrorRate')}>
                    Color Error Rate
                    {sortConfig.key === 'results.colorErrorRate' && (
                      <span className={styles.sortIndicator}>
                        {sortConfig.direction === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </th>
                  <th onClick={() => sortResults('results.monochromeErrorRate')}>
                    Mono Error Rate
                    {sortConfig.key === 'results.monochromeErrorRate' && (
                      <span className={styles.sortIndicator}>
                        {sortConfig.direction === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </th>
                  <th onClick={() => sortResults('results.totalTestTime')}>
                    Total Time
                    {sortConfig.key === 'results.totalTestTime' && (
                      <span className={styles.sortIndicator}>
                        {sortConfig.direction === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <>
                    <tr 
                      key={i} 
                      className={`${styles.dataRow} ${selectedResult === i ? styles.selectedRow : ''}`}
                      onClick={() => handleRowClick(i)}
                    >
                      <td>{formatDate(r.timestamp)}</td>
                      <td>{r.testLevel}</td>
                      <td>{r.startedWithColor ? 'Color' : 'Monochrome'}</td>
                      <td>
                        {r.results?.colorErrorRate 
                          ? r.results.colorErrorRate.toFixed(2) 
                          : 0
                        }%
                      </td>
                      <td>
                        {r.results?.monochromeErrorRate 
                          ? r.results.monochromeErrorRate.toFixed(2)
                          : 0
                        }%
                      </td>
                      <td>
                        {r.results?.totalTestTime
                          ? (r.results.totalTestTime / 1000).toFixed(2)
                          : 0
                        }s
                      </td>
                    </tr>
                    {selectedResult === i && (
                      <tr className={styles.detailsRow}>
                        <td colSpan={6}>
                          <div className={styles.detailsContainer}>
                            <h3>Detailed Results</h3>
                            
                            <div className={styles.detailsSection}>
                              <h4>Overall Performance</h4>
                              <div className={styles.detailsGrid}>
                                <div className={styles.detailItem}>
                                  <span className={styles.detailLabel}>Testing Location:</span>
                                  <span>{r.library || 'Not specified'}</span>
                                </div>
                                <div className={styles.detailItem}>
                                  <span className={styles.detailLabel}>Calibration Level:</span>
                                  <span>{r.calibrationLevel}</span>
                                </div>
                                <div className={styles.detailItem}>
                                  <span className={styles.detailLabel}>Color Avg Time:</span>
                                  <span>{r.results?.colorAvgRoundTime?.toFixed(2) || 0} ms</span>
                                </div>
                                <div className={styles.detailItem}>
                                  <span className={styles.detailLabel}>Mono Avg Time:</span>
                                  <span>{r.results?.monochromeAvgRoundTime?.toFixed(2) || 0} ms</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className={styles.detailsSection}>
                              <h4>Round Details</h4>
                              <table className={styles.roundsTable}>
                                <thead>
                                  <tr>
                                    <th>Condition</th>
                                    <th>Round</th>
                                    <th>Error Rate</th>
                                    <th>Avg Selection Time</th>
                                    <th>Total Time</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.rounds && r.rounds.map((round, idx) => (
                                    <tr key={idx}>
                                      <td>{round.condition}</td>
                                      <td>{round.roundNumber}</td>
                                      <td>{round.errorRate?.toFixed(2) || 0}%</td>
                                      <td>{round.averageSelectionTime?.toFixed(2) || 0} ms</td>
                                      <td>{round.totalTime} ms</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
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
        </>
      )}
    </div>
  );
};

export default AllResults;
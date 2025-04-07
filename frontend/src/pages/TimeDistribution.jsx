// pages/TimeDistribution.jsx
import React, { useEffect, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import ZoomPlugin from 'chartjs-plugin-zoom';
import { Bar } from 'react-chartjs-2';
import styles from './TimeDistribution.module.css';

ChartJS.register(
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  ZoomPlugin
);

const TimeDistribution = () => {
  const [chartData, setChartData] = useState(null);
  const [calculatedYAxisMax, setCalculatedYAxisMax] = useState(null);
  const [customYAxisMax, setCustomYAxisMax] = useState('');
  const [customXAxisMax, setCustomXAxisMax] = useState(''); // New state for custom x-axis max
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const chartRef = useRef(null);

  // Default x-axis max if no custom value is provided
  const defaultXAxisMax = 1000;

  // Determine the effective x-axis maximum
  const effectiveXAxisMax = customXAxisMax !== '' && !isNaN(customXAxisMax) && Number(customXAxisMax) > 0
    ? Number(customXAxisMax)
    : defaultXAxisMax;

  useEffect(() => {
    const fetchAndProcessData = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/results');
        if (!response.ok) throw new Error('Failed to fetch participant data');
        const participants = await response.json();

        const clickData = {
          color: [],
          monochrome: [],
          first: [],
          middle: [],
          last: []
        };

        // Use the effective x-axis max for filtering click times
        participants.forEach(participant => {
          if (!participant.rounds || participant.rounds.length === 0) return;

          participant.rounds.forEach(round => {
            if (!round.selectionTimes || round.selectionTimes.length === 0) return;

            round.selectionTimes.forEach((clickTime, index) => {
              if (clickTime <= effectiveXAxisMax) { // Filter based on custom x-axis max
                if (round.condition === 'color') {
                  clickData.color.push(clickTime);
                } else {
                  clickData.monochrome.push(clickTime);
                }

                const totalClicks = round.selectionTimes.length;
                const isFirstClick = index === 0;
                const isMiddleClick = index === Math.floor(totalClicks / 2);
                const isLastClick = index === totalClicks - 1;

                if (isFirstClick) clickData.first.push(clickTime);
                if (isMiddleClick) clickData.middle.push(clickTime);
                if (isLastClick) clickData.last.push(clickTime);
              }
            });
          });
        });

        const binSize = 10;
        const maxValue = effectiveXAxisMax; // Use effective x-axis max for binning
        const binCount = Math.ceil(maxValue / binSize);
        const labels = Array(binCount).fill(0).map((_, i) => (i * binSize).toString());

        const getHistogram = (data) => {
          const bins = Array(binCount).fill(0);
          data.forEach(value => {
            const bin = Math.min(Math.floor(value / binSize), binCount - 1);
            bins[bin]++;
          });
          return bins;
        };

        const computeDensity = (data, bandwidth = 50) => {
          if (data.length === 0) return Array(binCount).fill(0);

          const xValues = Array(binCount).fill(0).map((_, i) => i * binSize);
          const density = [];
          const n = data.length;
          const factor = 1 / (n * bandwidth * Math.sqrt(2 * Math.PI));

          xValues.forEach(x => {
            let sum = 0;
            data.forEach(d => {
              const z = (x - d) / bandwidth;
              sum += Math.exp(-0.5 * z * z);
            });
            density.push(sum * factor);
          });

          let area = 0;
          for (let i = 0; i < density.length - 1; i++) {
            const dx = xValues[i + 1] - xValues[i];
            area += (density[i] + density[i + 1]) * dx / 2;
          }

          const normalizedDensity = density.map(d => (area > 0 ? d / area : 0));
          const maxDensity = Math.max(...normalizedDensity);
          const maxHist = Math.max(...getHistogram(data));
          const scale = maxHist / maxDensity;
          return normalizedDensity.map(d => d * scale);
        };

        const histograms = {
          color: getHistogram(clickData.color),
          monochrome: getHistogram(clickData.monochrome),
          first: getHistogram(clickData.first),
          middle: getHistogram(clickData.middle),
          last: getHistogram(clickData.last)
        };

        const densities = {
          color: computeDensity(clickData.color),
          monochrome: computeDensity(clickData.monochrome),
          first: computeDensity(clickData.first),
          middle: computeDensity(clickData.middle),
          last: computeDensity(clickData.last)
        };

        const allMaxValues = [
          Math.max(...histograms.color),
          Math.max(...histograms.monochrome),
          Math.max(...histograms.first),
          Math.max(...histograms.middle),
          Math.max(...histograms.last),
          Math.max(...densities.color),
          Math.max(...densities.monochrome),
          Math.max(...densities.first),
          Math.max(...densities.middle),
          Math.max(...densities.last)
        ].filter(val => !isNaN(val) && val !== -Infinity && val !== Infinity);

        const globalMax = allMaxValues.length > 0 ? Math.max(...allMaxValues) : 0;
        const calculatedMax = globalMax > 0 ? Math.ceil(globalMax * 1.1) : 10;

        const datasets = [
          {
            label: 'Color Histogram',
            data: histograms.color,
            type: 'bar',
            backgroundColor: 'rgba(33, 150, 243, 0.3)',
            borderColor: 'rgba(33, 150, 243, 1)',
            borderWidth: 1,
            barPercentage: 1.0,
            categoryPercentage: 1.0,
            order: 5
          },
          {
            label: 'Monochrome Histogram',
            data: histograms.monochrome,
            type: 'bar',
            backgroundColor: 'rgba(102, 102, 102, 0.3)',
            borderColor: 'rgba(102, 102, 102, 1)',
            borderWidth: 1,
            barPercentage: 1.0,
            categoryPercentage: 1.0,
            order: 5
          },
          {
            label: 'First Clicks Histogram',
            data: histograms.first,
            type: 'bar',
            backgroundColor: 'rgba(17, 138, 178, 0.3)',
            borderColor: 'rgba(17, 138, 178, 1)',
            borderWidth: 1,
            barPercentage: 1.0,
            categoryPercentage: 1.0,
            order: 5
          },
          {
            label: 'Middle Clicks Histogram',
            data: histograms.middle,
            type: 'bar',
            backgroundColor: 'rgba(106, 76, 147, 0.3)',
            borderColor: 'rgba(106, 76, 147, 1)',
            borderWidth: 1,
            barPercentage: 1.0,
            categoryPercentage: 1.0,
            order: 5
          },
          {
            label: 'Last Clicks Histogram',
            data: histograms.last,
            type: 'bar',
            backgroundColor: 'rgba(239, 71, 111, 0.3)',
            borderColor: 'rgba(239, 71, 111, 1)',
            borderWidth: 1,
            barPercentage: 1.0,
            categoryPercentage: 1.0,
            order: 5
          },
          {
            label: 'Color Density',
            data: densities.color,
            type: 'line',
            fill: false,
            borderColor: 'rgba(33, 150, 243, 1)',
            borderWidth: 2,
            pointRadius: 0,
            order: 1
          },
          {
            label: 'Monochrome Density',
            data: densities.monochrome,
            type: 'line',
            fill: false,
            borderColor: 'rgba(102, 102, 102, 1)',
            borderWidth: 2,
            pointRadius: 0,
            order: 1
          },
          {
            label: 'First Clicks Density',
            data: densities.first,
            type: 'line',
            fill: false,
            borderColor: 'rgba(17, 138, 178, 1)',
            borderWidth: 2,
            pointRadius: 0,
            order: 1
          },
          {
            label: 'Middle Clicks Density',
            data: densities.middle,
            type: 'line',
            fill: false,
            borderColor: 'rgba(106, 76, 147, 1)',
            borderWidth: 2,
            pointRadius: 0,
            order: 1
          },
          {
            label: 'Last Clicks Density',
            data: densities.last,
            type: 'line',
            fill: false,
            borderColor: 'rgba(239, 71, 111, 1)',
            borderWidth: 2,
            pointRadius: 0,
            order: 1
          }
        ];

        setChartData({ labels, datasets });
        setCalculatedYAxisMax(calculatedMax);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchAndProcessData();
  }, [effectiveXAxisMax]); // Re-run effect when effectiveXAxisMax changes

  // Cleanup chart on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  // Determine the effective y-axis maximum
  const effectiveYAxisMax = customYAxisMax !== '' && !isNaN(customYAxisMax) && Number(customYAxisMax) > 0
    ? Number(customYAxisMax)
    : calculatedYAxisMax || 10;

  const options = {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: `Click Time Distributions with Density Curves (Max ${effectiveXAxisMax}ms)`, // Update title dynamically
        color: 'var(--header-text-color)',
        font: { size: 24 }
      },
      legend: {
        position: 'top',
        labels: { 
          color: 'var(--text-color)',
          font: { size: 16 }
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false
      },
      zoom: {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x'
        },
        pan: {
          enabled: true,
          mode: 'x'
        },
        limits: {
          x: { min: 0, max: effectiveXAxisMax } // Update zoom/pan limits
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Click Time (ms)',
          color: 'var(--text-muted-color)',
          font: { size: 24 }
        },
        ticks: { 
          color: 'var(--text-muted-color)',
          font: { size: 24 }
        },
        min: 0,
        max: effectiveXAxisMax // Use the effective x-axis max
      },
      y: {
        title: {
          display: true,
          text: 'Frequency / Scaled Density',
          color: 'var(--text-muted-color)',
          font: { size: 24 }
        },
        ticks: { 
          color: 'var(--text-muted-color)',
          font: { size: 24 }
        },
        beginAtZero: true,
        max: effectiveYAxisMax
      }
    },
    maintainAspectRatio: false
  };

  // Handlers for input changes
  const handleYAxisMaxChange = (e) => {
    setCustomYAxisMax(e.target.value);
  };

  const handleXAxisMaxChange = (e) => {
    setCustomXAxisMax(e.target.value);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Click Time Distribution</h1>
      {/* Input for setting custom y-axis maximum */}
      <div style={{ marginBottom: '10px' }}>
        <label htmlFor="yAxisMax" style={{ marginRight: '10px' }}>
          Set Custom Y-Axis Maximum (leave blank to use calculated value: {calculatedYAxisMax || 'N/A'}):
        </label>
        <input
          id="yAxisMax"
          type="number"
          value={customYAxisMax}
          onChange={handleYAxisMaxChange}
          placeholder="Enter Y-Axis Max"
          style={{ padding: '5px', width: '150px' }}
          min="0"
        />
      </div>
      {/* Input for setting custom x-axis maximum */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="xAxisMax" style={{ marginRight: '10px' }}>
          Set Custom X-Axis Maximum (leave blank to use default: {defaultXAxisMax}ms):
        </label>
        <input
          id="xAxisMax"
          type="number"
          value={customXAxisMax}
          onChange={handleXAxisMaxChange}
          placeholder="Enter X-Axis Max"
          style={{ padding: '5px', width: '150px' }}
          min="0"
        />
      </div>
      {loading && <p className={styles.message}>Loading distribution data...</p>}
      {error && <p className={styles.error}>Error: {error}</p>}
      {chartData && (
        <div className={styles.chartWrapper}>
          <Bar
            ref={chartRef}
            data={chartData}
            options={options}
            height={600}
            onElementsCreated={(chart) => {
              chartRef.current = chart;
            }}
          />
        </div>
      )}
    </div>
  );
};

export default TimeDistribution;
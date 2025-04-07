// t-distribution-analysis.js
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
// Use simple-statistics library for statistical calculations
const stats = require('simple-statistics');
// Use csv-writer for CSV export
const { createObjectCsvWriter } = require('csv-writer');
require('dotenv').config();

/**
 * Participant schema matching your database structure
 */
const participantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  startedWithColor: { type: Boolean, required: true },
  timestamp: { type: Date, default: Date.now },
  library: { type: String, default: 'Other' },
  candy: { type: String, default: '' },
  calibrationLevel: { type: Number, required: true },
  testLevel: { type: Number, required: true },
  rounds: [
    {
      condition: { type: String, enum: ['monochrome', 'color'], required: true },
      roundNumber: { type: Number, required: true },
      pattern: [Number],
      correctSelections: [Number],
      incorrectSelections: [Number],
      errorRate: Number,
      selectionTimes: [Number],
      averageSelectionTime: Number,
      totalTime: Number,
      effectiveTime: Number,
      timeIncludingDeadTime: Number
    }
  ],
  results: {
    monochromeErrorRate: Number,
    colorErrorRate: Number,
    monochromeCorrectTotal: Number,
    colorCorrectTotal: Number,
    monochromeIncorrectTotal: Number,
    colorIncorrectTotal: Number,
    monochromeAvgClickTime: Number,
    colorAvgClickTime: Number,
    monochromeAvgRoundTime: Number,
    colorAvgRoundTime: Number,
    monochromeAvgEffectiveTime: Number,
    colorAvgEffectiveTime: Number,
    totalTestTime: Number
  }
});

const Participant = mongoose.model('Participant', participantSchema);

/**
 * Calculate p-value from t-statistic and degrees of freedom using t-distribution CDF
 * Implementation of the Student's t-distribution CDF (cumulative distribution function)
 */
function tDistCDF(t, df) {
  const absoluteT = Math.abs(t);

  // For large df (> 100), approximate with the normal distribution
  if (df > 100) {
    const z = absoluteT;
    const p = 0.5 * (1 + stats.errorFunction(z / Math.sqrt(2)));
    return t < 0 ? 1 - p : p;
  }

  // For smaller df, use a more accurate approximation
  const x = df / (df + absoluteT * absoluteT);
  
  let pForPositiveT;
  
  // Check if simple-statistics provides incompleteBeta
  if (typeof stats.incompleteBeta === 'function') {
    // Use the incomplete beta function for precision
    pForPositiveT = 0.5 * stats.incompleteBeta(x, df / 2, 0.5);
  } else {
    // Fallback to a normal approximation adjusted for t-distribution
    const z = absoluteT * Math.sqrt(df / (df + absoluteT * absoluteT));
    pForPositiveT = 0.5 * (1 + stats.errorFunction(z / Math.sqrt(2)));
  }

  // Adjust for negative t
  return t < 0 ? 1 - pForPositiveT : pForPositiveT;
}

/**
 * Calculate two-tailed p-value from t-statistic and degrees of freedom
 */
function twoTailedTTest(t, df) {
  // For a two-tailed test, we calculate P(|T| > |t|) = 2 * P(T > |t|) = 2 * (1 - CDF(|t|))
  const p = 2 * (1 - tDistCDF(Math.abs(t), df));
  return p;
}

/**
 * Run paired t-test and return detailed results
 */
function pairedTTest(sample1, sample2) {
  if (sample1.length !== sample2.length) {
    throw new Error('Paired t-test requires samples of equal length');
  }
  
  // Calculate differences between paired samples
  const diffs = [];
  for (let i = 0; i < sample1.length; i++) {
    diffs.push(sample1[i] - sample2[i]);
  }
  
  // Calculate statistics
  const meanDiff = stats.mean(diffs);
  const sdDiff = stats.standardDeviation(diffs);
  const n = diffs.length;
  const se = sdDiff / Math.sqrt(n);
  const tStat = meanDiff / se;
  const df = n - 1;
  
  // Calculate p-value (two-tailed)
  const pValue = twoTailedTTest(tStat, df);
  
  return {
    meanDiff,
    sdDiff,
    n,
    se,
    tStat,
    df,
    pValue,
    significant: pValue < 0.05
  };
}

/**
 * Run independent t-test and return detailed results
 */
function independentTTest(sample1, sample2) {
  // Calculate basic statistics
  const n1 = sample1.length;
  const n2 = sample2.length;
  const mean1 = stats.mean(sample1);
  const mean2 = stats.mean(sample2);
  const var1 = stats.variance(sample1);
  const var2 = stats.variance(sample2);
  
  // Calculate pooled variance (assuming equal variances)
  const pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
  const se = Math.sqrt(pooledVar * (1/n1 + 1/n2));
  
  // Calculate t-statistic and degrees of freedom
  const tStat = (mean1 - mean2) / se;
  const df = n1 + n2 - 2;
  
  // Calculate p-value (two-tailed)
  const pValue = twoTailedTTest(tStat, df);
  
  return {
    mean1,
    mean2,
    var1,
    var2,
    n1,
    n2,
    se,
    tStat,
    df,
    pValue,
    significant: pValue < 0.05,
    difference: mean1 - mean2
  };
}

/**
 * Main analysis function
 */
async function analyzeClickTimes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Get all participants
    const participants = await Participant.find({}).lean();
    console.log(`Found ${participants.length} participants`);
    
    // Extract all click times
    let allClickData = [];
    let participantAvgData = [];
    
    participants.forEach(participant => {
      if (!participant.rounds || participant.rounds.length === 0) return;
      
      // Track this participant's average click times by condition
      const participantClickTimes = {
        participantId: participant._id.toString(),
        name: participant.name,
        colorClickTimes: [],
        monoClickTimes: []
      };
      
      // Process all rounds for this participant
      participant.rounds.forEach(round => {
        if (!round.selectionTimes || round.selectionTimes.length === 0) return;
        
        const totalClicks = round.selectionTimes.length;
        
        // Process each click in this round
        round.selectionTimes.forEach((clickTime, index) => {
          // Determine if this is the first, middle or last click
          const isFirstClick = index === 0;
          const isLastClick = index === totalClicks - 1;
          const isMiddleClick = !isFirstClick && !isLastClick;
          
          // Selected middle click for comparison
          const middleIndex = Math.floor(totalClicks / 2);
          const isSelectedMiddleClick = index === middleIndex;
          
          // Save this click's data
          allClickData.push({
            participantId: participant._id,
            condition: round.condition,
            roundNumber: round.roundNumber,
            clickNumber: index,
            clickTime: clickTime,
            isFirstClick: isFirstClick ? 1 : 0,
            isLastClick: isLastClick ? 1 : 0,
            isMiddleClick: isMiddleClick ? 1 : 0,
            isSelectedMiddleClick: isSelectedMiddleClick ? 1 : 0,
            totalClicks
          });
          
          // Add to this participant's condition-specific data
          if (round.condition === 'color') {
            participantClickTimes.colorClickTimes.push(clickTime);
          } else {
            participantClickTimes.monoClickTimes.push(clickTime);
          }
        });
      });
      
      // Calculate this participant's average click times by condition
      if (participantClickTimes.colorClickTimes.length > 0 && participantClickTimes.monoClickTimes.length > 0) {
        participantAvgData.push({
          participantId: participantClickTimes.participantId,
          name: participantClickTimes.name,
          colorAvg: stats.mean(participantClickTimes.colorClickTimes),
          monoAvg: stats.mean(participantClickTimes.monoClickTimes)
        });
      }
    });
    
    console.log(`Processed ${allClickData.length} total clicks`);
    
    // Export all click data to CSV
    await exportClickData(allClickData);
    
    // ======================================================
    // ANALYSIS 1: COLOR vs. MONOCHROME
    // ======================================================
    console.log("\n========== COLOR vs. MONOCHROME ==========");
    
    // Get color and monochrome click times
    const colorTimes = allClickData.filter(d => d.condition === 'color').map(d => d.clickTime);
    const monoTimes = allClickData.filter(d => d.condition === 'monochrome').map(d => d.clickTime);
    
    // Calculate means and std deviations
    const colorMean = stats.mean(colorTimes);
    const monoMean = stats.mean(monoTimes);
    const colorSD = stats.standardDeviation(colorTimes);
    const monoSD = stats.standardDeviation(monoTimes);
    
    console.log(`Color: Mean=${colorMean.toFixed(2)}ms, SD=${colorSD.toFixed(2)}ms, n=${colorTimes.length}`);
    console.log(`Monochrome: Mean=${monoMean.toFixed(2)}ms, SD=${monoSD.toFixed(2)}ms, n=${monoTimes.length}`);
    console.log(`Raw difference: ${(colorMean - monoMean).toFixed(2)}ms`);
    
    // Paired t-test for color vs. monochrome
    const colorAvgs = participantAvgData.map(p => p.colorAvg);
    const monoAvgs = participantAvgData.map(p => p.monoAvg);
    const pairedResult = pairedTTest(colorAvgs, monoAvgs);
    
    console.log("\nPaired t-test results:");
    console.log(`Mean difference: ${pairedResult.meanDiff.toFixed(2)}ms`);
    console.log(`t(${pairedResult.df}) = ${pairedResult.tStat.toFixed(2)}, p = ${pairedResult.pValue.toFixed(4)}`);
    console.log(`Conclusion: ${pairedResult.significant ? 'Significant' : 'No significant'} difference between conditions`);
    
    // ======================================================
    // ANALYSIS 2: CLICK POSITION (FIRST, MIDDLE, LAST)
    // ======================================================
    console.log("\n========== CLICK POSITION ANALYSIS ==========");
    
    // Get click times by position
    const firstClickTimes = allClickData.filter(d => d.isFirstClick === 1).map(d => d.clickTime);
    const middleClickTimes = allClickData.filter(d => d.isSelectedMiddleClick === 1).map(d => d.clickTime);
    const lastClickTimes = allClickData.filter(d => d.isLastClick === 1).map(d => d.clickTime);
    
    // Calculate means and std deviations
    const firstMean = stats.mean(firstClickTimes);
    const middleMean = stats.mean(middleClickTimes);
    const lastMean = stats.mean(lastClickTimes);
    const firstSD = stats.standardDeviation(firstClickTimes);
    const middleSD = stats.standardDeviation(middleClickTimes);
    const lastSD = stats.standardDeviation(lastClickTimes);
    
    console.log(`First clicks: Mean=${firstMean.toFixed(2)}ms, SD=${firstSD.toFixed(2)}ms, n=${firstClickTimes.length}`);
    console.log(`Middle clicks: Mean=${middleMean.toFixed(2)}ms, SD=${middleSD.toFixed(2)}ms, n=${middleClickTimes.length}`);
    console.log(`Last clicks: Mean=${lastMean.toFixed(2)}ms, SD=${lastSD.toFixed(2)}ms, n=${lastClickTimes.length}`);
    
    // Run independent t-tests for position comparisons
    const firstVsLastTest = independentTTest(firstClickTimes, lastClickTimes);
    const firstVsMiddleTest = independentTTest(firstClickTimes, middleClickTimes);
    const middleVsLastTest = independentTTest(middleClickTimes, lastClickTimes);
    
    console.log("\nPosition comparison t-tests:");
    console.log(`First vs. Last: t(${firstVsLastTest.df}) = ${firstVsLastTest.tStat.toFixed(2)}, p = ${firstVsLastTest.pValue.toFixed(4)}, ${firstVsLastTest.significant ? 'significant' : 'not significant'}`);
    console.log(`First vs. Middle: t(${firstVsMiddleTest.df}) = ${firstVsMiddleTest.tStat.toFixed(2)}, p = ${firstVsMiddleTest.pValue.toFixed(4)}, ${firstVsMiddleTest.significant ? 'significant' : 'not significant'}`);
    console.log(`Middle vs. Last: t(${middleVsLastTest.df}) = ${middleVsLastTest.tStat.toFixed(2)}, p = ${middleVsLastTest.pValue.toFixed(4)}, ${middleVsLastTest.significant ? 'significant' : 'not significant'}`);
    
    // Generate simple HTML visualization
    generateVisualization({
      color: {
        mean: colorMean,
        sd: colorSD,
        n: colorTimes.length
      },
      mono: {
        mean: monoMean,
        sd: monoSD,
        n: monoTimes.length
      },
      colorVsMono: pairedResult,
      positions: {
        first: {
          mean: firstMean,
          sd: firstSD,
          n: firstClickTimes.length
        },
        middle: {
          mean: middleMean,
          sd: middleSD,
          n: middleClickTimes.length
        },
        last: {
          mean: lastMean,
          sd: lastSD,
          n: lastClickTimes.length
        }
      },
      positionTests: {
        firstVsLast: firstVsLastTest,
        firstVsMiddle: firstVsMiddleTest,
        middleVsLast: middleVsLastTest
      }
    });
    
    // Summary and conclusion
    console.log("\n========== SUMMARY ==========");
    console.log("Color vs. Monochrome:");
    console.log(`- ${pairedResult.significant ? 'REJECTED' : 'SUPPORTED'} hypothesis that there's no correlation between color and response time`);
    console.log(`- p-value: ${pairedResult.pValue.toFixed(4)} (${pairedResult.significant ? 'significant' : 'not significant'})`);
    
    console.log("\nClick Position:");
    console.log(`- ${firstVsLastTest.difference < 0 ? 'SUPPORTED' : 'REJECTED'} hypothesis that first clicks are faster than last clicks`);
    console.log(`- First clicks were ${Math.abs(firstVsLastTest.difference).toFixed(2)}ms ${firstVsLastTest.difference < 0 ? 'faster' : 'slower'} than last clicks`);
    console.log(`- Statistical significance: p = ${firstVsLastTest.pValue.toFixed(4)} (${firstVsLastTest.significant ? 'significant' : 'not significant'})`);
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB. Analysis complete!");
    
  } catch (error) {
    console.error('Error during analysis:', error);
    try {
      await mongoose.disconnect();
    } catch (err) {
      console.error('Error disconnecting from MongoDB:', err);
    }
    process.exit(1);
  }
}

/**
 * Export click data to CSV
 */
async function exportClickData(clickData) {
  const csvWriter = createObjectCsvWriter({
    path: 'click_data.csv',
    header: [
      { id: 'participantId', title: 'Participant ID' },
      { id: 'condition', title: 'Condition' },
      { id: 'roundNumber', title: 'Round Number' },
      { id: 'clickNumber', title: 'Click Number' },
      { id: 'clickTime', title: 'Click Time (ms)' },
      { id: 'isFirstClick', title: 'Is First Click' },
      { id: 'isLastClick', title: 'Is Last Click' },
      { id: 'isMiddleClick', title: 'Is Middle Click' },
      { id: 'totalClicks', title: 'Total Clicks in Round' }
    ]
  });
  
  await csvWriter.writeRecords(clickData);
  console.log(`Exported ${clickData.length} records to click_data.csv`);
}

/**
 * Generate a simple HTML visualization
 */
function generateVisualization(data) {
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Visual Memory Test Analysis</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; }
    .chart-container { height: 400px; margin: 30px 0; }
    .stats-box { background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 8px; }
    h1 { text-align: center; }
    .significant { color: green; font-weight: bold; }
    .not-significant { color: #555; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <h1>Visual Memory Test Analysis</h1>
  
  <div class="stats-box">
    <h2>Color vs. Monochrome</h2>
    <p>
      <strong>Result:</strong> There is 
      <span class="${data.colorVsMono.significant ? 'significant' : 'not-significant'}">
        ${data.colorVsMono.significant ? 'a significant' : 'no significant'}
      </span> 
      difference between color and monochrome conditions.
    </p>
    <p>
      <strong>Statistics:</strong> t(${data.colorVsMono.df}) = ${data.colorVsMono.tStat.toFixed(2)}, 
      p = ${data.colorVsMono.pValue.toFixed(4)} ${data.colorVsMono.significant ? '(significant)' : '(not significant)'}
    </p>
    <p>
      <strong>Mean difference:</strong> ${data.colorVsMono.meanDiff.toFixed(2)}ms
    </p>
  </div>
  
  <div class="chart-container">
    <canvas id="conditionChart"></canvas>
  </div>
  
  <div class="stats-box">
    <h2>Click Position Analysis</h2>
    <p>
      <strong>Result:</strong> First clicks are 
      ${data.positionTests.firstVsLast.difference < 0 ? 'faster' : 'slower'} 
      than last clicks by ${Math.abs(data.positionTests.firstVsLast.difference).toFixed(2)}ms.
    </p>
    <p>
      <strong>Statistical significance:</strong> t(${data.positionTests.firstVsLast.df}) = ${data.positionTests.firstVsLast.tStat.toFixed(2)}, 
      p = ${data.positionTests.firstVsLast.pValue.toFixed(4)} ${data.positionTests.firstVsLast.significant ? '(significant)' : '(not significant)'}
    </p>
    
    <table>
      <tr>
        <th>Comparison</th>
        <th>Difference</th>
        <th>t-statistic</th>
        <th>p-value</th>
        <th>Significance</th>
      </tr>
      <tr>
        <td>First vs. Last</td>
        <td>${data.positionTests.firstVsLast.difference.toFixed(2)}ms</td>
        <td>t(${data.positionTests.firstVsLast.df}) = ${data.positionTests.firstVsLast.tStat.toFixed(2)}</td>
        <td>${data.positionTests.firstVsLast.pValue.toFixed(4)}</td>
        <td>${data.positionTests.firstVsLast.significant ? 'Significant' : 'Not significant'}</td>
      </tr>
      <tr>
        <td>First vs. Middle</td>
        <td>${data.positionTests.firstVsMiddle.difference.toFixed(2)}ms</td>
        <td>t(${data.positionTests.firstVsMiddle.df}) = ${data.positionTests.firstVsMiddle.tStat.toFixed(2)}</td>
        <td>${data.positionTests.firstVsMiddle.pValue.toFixed(4)}</td>
        <td>${data.positionTests.firstVsMiddle.significant ? 'Significant' : 'Not significant'}</td>
      </tr>
      <tr>
        <td>Middle vs. Last</td>
        <td>${data.positionTests.middleVsLast.difference.toFixed(2)}ms</td>
        <td>t(${data.positionTests.middleVsLast.df}) = ${data.positionTests.middleVsLast.tStat.toFixed(2)}</td>
        <td>${data.positionTests.middleVsLast.pValue.toFixed(4)}</td>
        <td>${data.positionTests.middleVsLast.significant ? 'Significant' : 'Not significant'}</td>
      </tr>
    </table>
  </div>
  
  <div class="chart-container">
    <canvas id="positionChart"></canvas>
  </div>
  
  <div class="stats-box">
    <h2>Conclusions</h2>
    <p><strong>Color vs. Monochrome:</strong> The statistical analysis ${data.colorVsMono.significant ? 'rejects' : 'supports'} your hypothesis that there's no correlation between color and response time. The paired t-test showed ${data.colorVsMono.significant ? 'a significant' : 'no significant'} difference between color and monochrome conditions (t(${data.colorVsMono.df}) = ${data.colorVsMono.tStat.toFixed(2)}, p = ${data.colorVsMono.pValue.toFixed(4)}).</p>
    
    <p><strong>Click Position:</strong> The analysis ${data.positionTests.firstVsLast.difference < 0 ? 'supports' : 'does not support'} your hypothesis that first clicks are faster than last clicks. First clicks were ${Math.abs(data.positionTests.firstVsLast.difference).toFixed(2)}ms ${data.positionTests.firstVsLast.difference < 0 ? 'faster' : 'slower'} than last clicks, with a ${data.positionTests.firstVsLast.significant ? 'statistically significant' : 'non-significant'} difference (p = ${data.positionTests.firstVsLast.pValue.toFixed(4)}).</p>
  </div>
  
  <script>
    // Condition comparison chart
    new Chart(document.getElementById('conditionChart'), {
      type: 'bar',
      data: {
        labels: ['Color', 'Monochrome'],
        datasets: [{
          label: 'Average Response Time (ms)',
          data: [${data.color.mean.toFixed(2)}, ${data.mono.mean.toFixed(2)}],
          backgroundColor: ['rgba(54, 162, 235, 0.5)', 'rgba(75, 75, 75, 0.5)'],
          borderColor: ['rgba(54, 162, 235, 1)', 'rgba(75, 75, 75, 1)'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Response Time by Condition'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Response Time (ms)'
            }
          }
        }
      }
    });
    
    // Position comparison chart
    new Chart(document.getElementById('positionChart'), {
      type: 'bar',
      data: {
        labels: ['First Clicks', 'Middle Clicks', 'Last Clicks'],
        datasets: [{
          label: 'Average Response Time (ms)',
          data: [
            ${data.positions.first.mean.toFixed(2)}, 
            ${data.positions.middle.mean.toFixed(2)}, 
            ${data.positions.last.mean.toFixed(2)}
          ],
          backgroundColor: [
            'rgba(75, 192, 192, 0.5)',
            'rgba(153, 102, 255, 0.5)',
            'rgba(255, 99, 132, 0.5)'
          ],
          borderColor: [
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 99, 132, 1)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Response Time by Click Position'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Response Time (ms)'
            }
          }
        }
      }
    });
  </script>
</body>
</html>
  `;
  
  fs.writeFileSync('analysis_results.html', htmlContent);
  console.log('Visualization saved to analysis_results.html');
}

// Run the analysis if this script is executed directly
if (require.main === module) {
  analyzeClickTimes();
}

module.exports = { analyzeClickTimes, pairedTTest, independentTTest };
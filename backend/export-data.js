// export-data.js
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const { Participant } = require('./database');
require('dotenv').config();

async function exportParticipantData(mongoUri) {
  try {
    // Connect to the database directly
    const uri = mongoUri || process.env.MONGODB_URI;
    await mongoose.connect(uri);
    console.log('Connected to MongoDB, fetching data...');
    
    // Fetch all participants with all fields
    const participants = await Participant.find({}).lean();
    console.log(`Found ${participants.length} participants`);
    
    // Create a new workbook
    const workbook = XLSX.utils.book_new();
    
    // ===== SHEET 1: Summary Data =====
    // Create array for summary data with one row per participant
    const summaryData = participants.map(p => {
      return {
        'Participant ID': p._id.toString(),
        'Name': p.name,
        'Timestamp': p.timestamp,
        'Started With Color': p.startedWithColor ? 'Yes' : 'No',
        'Library': p.library,
        'Candy': p.candy,
        'Calibration Level': p.calibrationLevel,
        'Test Level': p.testLevel,
        // Results data
        'Monochrome Error Rate': p.results?.monochromeErrorRate,
        'Color Error Rate': p.results?.colorErrorRate,
        'Monochrome Correct Total': p.results?.monochromeCorrectTotal,
        'Color Correct Total': p.results?.colorCorrectTotal,
        'Monochrome Incorrect Total': p.results?.monochromeIncorrectTotal,
        'Color Incorrect Total': p.results?.colorIncorrectTotal,
        'Monochrome Avg Click Time (ms)': p.results?.monochromeAvgClickTime,
        'Color Avg Click Time (ms)': p.results?.colorAvgClickTime,
        'Monochrome Avg Round Time (ms)': p.results?.monochromeAvgRoundTime,
        'Color Avg Round Time (ms)': p.results?.colorAvgRoundTime,
        'Monochrome Avg Effective Time (ms)': p.results?.monochromeAvgEffectiveTime,
        'Color Avg Effective Time (ms)': p.results?.colorAvgEffectiveTime,
        'Total Test Time (ms)': p.results?.totalTestTime,
        'Round Count': p.rounds?.length || 0
      };
    });
    
    // Create worksheet for summary data
    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary Data');
    
    // ===== SHEET 2: Detailed Round Data =====
    // Create array for detailed round data with one row per round
    const roundData = [];
    participants.forEach(p => {
      if (p.rounds && p.rounds.length > 0) {
        p.rounds.forEach(round => {
          roundData.push({
            'Participant ID': p._id.toString(),
            'Name': p.name,
            'Condition': round.condition,
            'Round Number': round.roundNumber,
            'Pattern': round.pattern ? round.pattern.join(',') : '',
            'Correct Selections': round.correctSelections ? round.correctSelections.join(',') : '',
            'Incorrect Selections': round.incorrectSelections ? round.incorrectSelections.join(',') : '',
            'Error Rate': round.errorRate,
            'Selection Times (ms)': round.selectionTimes ? round.selectionTimes.join(',') : '',
            'Average Selection Time (ms)': round.averageSelectionTime,
            'Total Time (ms)': round.totalTime,
            'Effective Time (ms)': round.effectiveTime,
            'Time Including Dead Time (ms)': round.timeIncludingDeadTime,
            'Started With Color': p.startedWithColor ? 'Yes' : 'No',
            'Calibration Level': p.calibrationLevel,
            'Test Level': p.testLevel
          });
        });
      }
    });
    
    // Create worksheet for round data
    const roundWorksheet = XLSX.utils.json_to_sheet(roundData);
    XLSX.utils.book_append_sheet(workbook, roundWorksheet, 'Round Data');
    
    // ===== SHEET 3: Participant Rounds as Columns =====
    // Create a wide-format table where each participant is a row and rounds are columns
    const wideFormatData = participants.map(p => {
      // Start with the participant info
      const participantRow = {
        'Participant ID': p._id.toString(),
        'Name': p.name,
        'Timestamp': p.timestamp,
        'Started With Color': p.startedWithColor ? 'Yes' : 'No',
        'Library': p.library,
        'Candy': p.candy,
        'Calibration Level': p.calibrationLevel,
        'Test Level': p.testLevel
      };
      
      // Add the results data
      if (p.results) {
        Object.entries(p.results).forEach(([key, value]) => {
          participantRow[`Result_${key}`] = value;
        });
      }
      
      // Add each round's data as columns
      if (p.rounds && p.rounds.length > 0) {
        p.rounds.forEach(round => {
          const prefix = `Round${round.roundNumber}_${round.condition}_`;
          
          participantRow[`${prefix}ErrorRate`] = round.errorRate;
          participantRow[`${prefix}AvgSelectionTime`] = round.averageSelectionTime;
          participantRow[`${prefix}TotalTime`] = round.totalTime;
          participantRow[`${prefix}EffectiveTime`] = round.effectiveTime;
          participantRow[`${prefix}TimeIncludingDeadTime`] = round.timeIncludingDeadTime;
          participantRow[`${prefix}CorrectSelections`] = round.correctSelections ? round.correctSelections.join(',') : '';
          participantRow[`${prefix}IncorrectSelections`] = round.incorrectSelections ? round.incorrectSelections.join(',') : '';
        });
      }
      
      return participantRow;
    });
    
    // Create worksheet for wide format data
    const wideFormatWorksheet = XLSX.utils.json_to_sheet(wideFormatData);
    XLSX.utils.book_append_sheet(workbook, wideFormatWorksheet, 'Participants-Wide Format');
    
    // ===== SHEET 5: Aggregated Statistics =====
    // Calculate some aggregated statistics
    const colorFirst = participants.filter(p => p.startedWithColor);
    const monochromeFirst = participants.filter(p => !p.startedWithColor);
    
    const calculateAvg = (arr, prop) => {
      const validValues = arr.filter(item => item && typeof item[prop] === 'number');
      if (validValues.length === 0) return null;
      return validValues.reduce((sum, item) => sum + item[prop], 0) / validValues.length;
    };
    
    const statsData = [
      { 'Statistic': 'Total Participants', 'Value': participants.length },
      { 'Statistic': 'Started With Color', 'Value': colorFirst.length },
      { 'Statistic': 'Started With Monochrome', 'Value': monochromeFirst.length },
      { 'Statistic': 'Average Monochrome Error Rate', 'Value': calculateAvg(participants, 'results.monochromeErrorRate') },
      { 'Statistic': 'Average Color Error Rate', 'Value': calculateAvg(participants, 'results.colorErrorRate') },
      { 'Statistic': 'Average Monochrome Avg Click Time (ms)', 'Value': calculateAvg(participants, 'results.monochromeAvgClickTime') },
      { 'Statistic': 'Average Color Avg Click Time (ms)', 'Value': calculateAvg(participants, 'results.colorAvgClickTime') },
      { 'Statistic': 'Average Total Test Time (ms)', 'Value': calculateAvg(participants, 'results.totalTestTime') },
      // Add more statistics as needed
    ];
    
    // Create worksheet for stats data
    const statsWorksheet = XLSX.utils.json_to_sheet(statsData);
    XLSX.utils.book_append_sheet(workbook, statsWorksheet, 'Aggregated Statistics');
    
    // ===== SHEET 6: Individual Participant Sheets =====
    // For each participant, create a separate sheet with their complete data
    participants.forEach((p, index) => {
      // Create participant info section
      const participantInfo = [
        { 'Property': 'Participant ID', 'Value': p._id.toString() },
        { 'Property': 'Name', 'Value': p.name },
        { 'Property': 'Timestamp', 'Value': p.timestamp },
        { 'Property': 'Started With Color', 'Value': p.startedWithColor ? 'Yes' : 'No' },
        { 'Property': 'Library', 'Value': p.library },
        { 'Property': 'Candy', 'Value': p.candy },
        { 'Property': 'Calibration Level', 'Value': p.calibrationLevel },
        { 'Property': 'Test Level', 'Value': p.testLevel }
      ];
      
      // Add results data if it exists
      if (p.results) {
        Object.entries(p.results).forEach(([key, value]) => {
          participantInfo.push({ 'Property': key, 'Value': value });
        });
      }
      
      // Create worksheet for this participant
      const participantWorksheet = XLSX.utils.json_to_sheet(participantInfo);
      
      // Add rounds data below the participant info (with 2 rows gap)
      if (p.rounds && p.rounds.length > 0) {
        // Convert rounds data to format suitable for Excel
        const roundsHeaders = [
          'Round Number', 'Condition', 'Pattern', 'Correct Selections', 
          'Incorrect Selections', 'Error Rate', 'Selection Times', 
          'Average Selection Time', 'Total Time', 'Effective Time', 'Time Including Dead Time'
        ];
        
        const roundsData = p.rounds.map(round => [
          round.roundNumber,
          round.condition,
          round.pattern ? round.pattern.join(',') : '',
          round.correctSelections ? round.correctSelections.join(',') : '',
          round.incorrectSelections ? round.incorrectSelections.join(',') : '',
          round.errorRate,
          round.selectionTimes ? round.selectionTimes.join(',') : '',
          round.averageSelectionTime,
          round.totalTime,
          round.effectiveTime,
          round.timeIncludingDeadTime
        ]);
        
        // Add a title for the rounds section
        XLSX.utils.sheet_add_aoa(participantWorksheet, [['Rounds Data']], { origin: { r: participantInfo.length + 2, c: 0 } });
        
        // Add headers for rounds data
        XLSX.utils.sheet_add_aoa(participantWorksheet, [roundsHeaders], { origin: { r: participantInfo.length + 3, c: 0 } });
        
        // Add rounds data
        XLSX.utils.sheet_add_aoa(participantWorksheet, roundsData, { origin: { r: participantInfo.length + 4, c: 0 } });
      }
      
      // Set column widths for better readability
      const maxWidth = 20;
      const colWidths = {};
      for (let i = 0; i < 12; i++) {
        colWidths[i] = maxWidth;
      }
      participantWorksheet['!cols'] = Object.keys(colWidths).map(key => ({ wch: colWidths[key] }));
      
      // Add the participant worksheet to the workbook
      const sheetName = `Participant ${index + 1}`;
      XLSX.utils.book_append_sheet(workbook, participantWorksheet, sheetName);
    });
    
    // Write to file
    const filename = `participant_data_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
    console.log(`Data exported successfully to ${filename}`);
    
    // Disconnect from the database
    if (isMongoConnected()) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
    
    return { success: true, filename };
  } catch (error) {
    console.error('Error exporting data:', error);
    // Try to disconnect in case of error
    try {
      if (isMongoConnected()) {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB after error');
      }
    } catch (disconnectError) {
      console.error('Error disconnecting from MongoDB:', disconnectError);
    }
    return { success: false, error: error.message };
  }
}

// Run the export function if this script is executed directly
if (require.main === module) {
  // Check if MongoDB URI is provided as a command line argument
  const mongoUri = process.argv[2];
  if (!mongoUri) {
    console.log('No MongoDB URI provided as command line argument.');
    console.log('Usage: node export-data.js "mongodb://username:password@host:port/database"');
    console.log('Attempting to use MONGODB_URI from .env file or default localhost connection...');
  }
  
  exportParticipantData(mongoUri)
    .then(result => {
      if (result.success) {
        console.log('Export completed successfully!');
        process.exit(0);
      } else {
        console.error('Export failed:', result.error);
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Unhandled error in export process:', err);
      process.exit(1);
    });
} else {
  // Export function if this file is required as a module
  module.exports = { exportParticipantData };
}

// Helper function to check if MongoDB is connected
function isMongoConnected() {
  return mongoose.connection.readyState === 1; // 1 = connected
}
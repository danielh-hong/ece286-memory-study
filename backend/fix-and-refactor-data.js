// fix-and-refactor-data.js
const mongoose = require('mongoose');
const { Participant } = require('./database');
require('dotenv').config();

/**
 * Cleans participant data by keeping only the relevant rounds and recalculating statistics
 */
async function cleanParticipantData(mongoUri, dryRun = false) {
  try {
    // Connect to the database directly
    const uri = mongoUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/ece286-memory-study';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB, fetching participants...');
    
    // Fetch all participants
    const participants = await Participant.find({});
    console.log(`Found ${participants.length} participants to process`);
    
    let fixedCount = 0;
    
    // Process each participant
    for (const participant of participants) {
      console.log(`Processing participant: ${participant.name} (ID: ${participant._id})`);
      
      if (!participant.rounds || participant.rounds.length === 0) {
        console.log(`  Skipping participant with no rounds`);
        continue;
      }
      
      // Check if we need to fix this participant
      if (participant.rounds.length <= 14) {
        console.log(`  Participant ${participant.name} has ${participant.rounds.length} rounds, which is within normal range (≤14). Skipping.`);
        continue;
      }
      
      console.log(`  Found ${participant.rounds.length} rounds, which exceeds normal range. Cleaning...`);
      
      // Keep only the last 14 rounds (or 13 if there are exactly 13 rounds expected)
      const expectedRounds = 14; // Usually 7 in first condition + 7 in second condition
      const roundsToKeep = Math.min(expectedRounds, participant.rounds.length);
      const startIdx = participant.rounds.length - roundsToKeep;
      
      // Extract the rounds to keep
      const cleanedRounds = participant.rounds.slice(startIdx);
      
      // Verify that the first round matches the expected condition 
      // (should be the same as startedWithColor)
      const firstRoundCondition = cleanedRounds[0].condition;
      const expectedFirstCondition = participant.startedWithColor ? 'color' : 'monochrome';
      
      if (firstRoundCondition !== expectedFirstCondition) {
        console.log(`  WARNING: First round condition "${firstRoundCondition}" doesn't match expected "${expectedFirstCondition}" for participant ${participant.name}`);
        
        // Find the point where the correct condition starts
        let correctStartIndex = -1;
        for (let i = 0; i < cleanedRounds.length; i++) {
          if (cleanedRounds[i].condition === expectedFirstCondition && 
              cleanedRounds[i].roundNumber === 1) {
            correctStartIndex = i;
            break;
          }
        }
        
        if (correctStartIndex >= 0) {
          console.log(`  Found correct starting point at index ${correctStartIndex}`);
          // Keep only rounds from the correct starting point
          cleanedRounds.splice(0, correctStartIndex);
        } else {
          console.log(`  Could not find correct starting point. Using all available rounds.`);
        }
      }
      
      // Update the rounds for this participant
      participant.rounds = cleanedRounds;
      
      // Recalculate all the statistics
      recalculateStats(participant);
      
      // Save the updated participant (unless in dry run mode)
      if (!dryRun) {
        await participant.save();
        // Print before/after comparison
      console.log(`  BEFORE: ${participant.rounds.length} rounds, AFTER: ${cleanedRounds.length} rounds`);
      
      if (!dryRun) {
        console.log(`  Updated participant ${participant.name} successfully. Now has ${participant.rounds.length} rounds.`);
      } else {
        console.log(`  [DRY RUN] Would update participant ${participant.name}. Would now have ${cleanedRounds.length} rounds.`);
      }
      } else {
        console.log(`  [DRY RUN] Would update participant ${participant.name}. Would now have ${participant.rounds.length} rounds.`);
      }
      fixedCount++;
    }
    
    console.log(`Finished processing. Fixed ${fixedCount} participants out of ${participants.length}.`);
    
    // Disconnect from the database
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
    return { success: true, processedCount: participants.length, fixedCount };
  } catch (error) {
    console.error('Error cleaning participant data:', error);
    // Try to disconnect in case of error
    try {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB after error');
    } catch (disconnectError) {
      console.error('Error disconnecting from MongoDB:', disconnectError);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Recalculate all the statistics for a participant based on their rounds
 */
function recalculateStats(participant) {
  if (!participant.rounds || participant.rounds.length === 0) {
    return;
  }
  
  // Initialize counters for different conditions
  const stats = {
    monochrome: {
      correctTotal: 0,
      incorrectTotal: 0,
      totalSelectionTime: 0,
      selectionCount: 0,
      totalRoundTime: 0,
      totalEffectiveTime: 0,
      roundCount: 0
    },
    color: {
      correctTotal: 0,
      incorrectTotal: 0,
      totalSelectionTime: 0,
      selectionCount: 0,
      totalRoundTime: 0,
      totalEffectiveTime: 0,
      roundCount: 0
    }
  };
  
  // Process each round
  participant.rounds.forEach(round => {
    const condition = round.condition;
    
    // Skip if condition is not valid
    if (!stats[condition]) {
      console.log(`    Skipping round with unknown condition: ${condition}`);
      return;
    }
    
    // Update selection counts
    if (round.correctSelections && Array.isArray(round.correctSelections)) {
      stats[condition].correctTotal += round.correctSelections.length;
    }
    
    if (round.incorrectSelections && Array.isArray(round.incorrectSelections)) {
      stats[condition].incorrectTotal += round.incorrectSelections.length;
    }
    
    // Update selection times
    if (round.selectionTimes && Array.isArray(round.selectionTimes)) {
      round.selectionTimes.forEach(time => {
        stats[condition].totalSelectionTime += time;
        stats[condition].selectionCount++;
      });
    }
    
    // Update round times
    if (round.totalTime) {
      stats[condition].totalRoundTime += round.totalTime;
      stats[condition].roundCount++;
    }
    
    if (round.effectiveTime) {
      stats[condition].totalEffectiveTime += round.effectiveTime;
    }
  });
  
  // Calculate derived statistics
  const results = {};
  
  // Error rates
  results.monochromeErrorRate = calculateErrorRate(
    stats.monochrome.incorrectTotal,
    stats.monochrome.correctTotal + stats.monochrome.incorrectTotal
  );
  
  results.colorErrorRate = calculateErrorRate(
    stats.color.incorrectTotal,
    stats.color.correctTotal + stats.color.incorrectTotal
  );
  
  // Total selections
  results.monochromeCorrectTotal = stats.monochrome.correctTotal;
  results.colorCorrectTotal = stats.color.correctTotal;
  results.monochromeIncorrectTotal = stats.monochrome.incorrectTotal;
  results.colorIncorrectTotal = stats.color.incorrectTotal;
  
  // Average click times
  results.monochromeAvgClickTime = stats.monochrome.selectionCount > 0 
    ? stats.monochrome.totalSelectionTime / stats.monochrome.selectionCount 
    : 0;
    
  results.colorAvgClickTime = stats.color.selectionCount > 0 
    ? stats.color.totalSelectionTime / stats.color.selectionCount 
    : 0;
  
  // Average round times
  results.monochromeAvgRoundTime = stats.monochrome.roundCount > 0 
    ? stats.monochrome.totalRoundTime / stats.monochrome.roundCount 
    : 0;
    
  results.colorAvgRoundTime = stats.color.roundCount > 0 
    ? stats.color.totalRoundTime / stats.color.roundCount 
    : 0;
  
  // Average effective times
  results.monochromeAvgEffectiveTime = stats.monochrome.roundCount > 0 
    ? stats.monochrome.totalEffectiveTime / stats.monochrome.roundCount 
    : 0;
    
  results.colorAvgEffectiveTime = stats.color.roundCount > 0 
    ? stats.color.totalEffectiveTime / stats.color.roundCount 
    : 0;
  
  // Total test time (sum of all round times)
  results.totalTestTime = stats.monochrome.totalRoundTime + stats.color.totalRoundTime;
  
  // Update the participant's results
  participant.results = results;
}

/**
 * Calculate error rate percentage
 */
function calculateErrorRate(incorrectCount, totalCount) {
  if (totalCount === 0) {
    return 0;
  }
  return (incorrectCount / totalCount) * 100;
}

// Run the clean function if this script is executed directly
if (require.main === module) {
  const mongoUri = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  
  console.log(dryRun ? 'RUNNING IN DRY RUN MODE - NO CHANGES WILL BE SAVED' : 'RUNNING IN LIVE MODE - CHANGES WILL BE SAVED');
  console.log('To perform a test run without saving, add --dry-run to the command');
  
  cleanParticipantData(mongoUri, dryRun)
    .then(result => {
      if (result.success) {
        console.log(`Cleaning completed successfully! Fixed ${result.fixedCount} out of ${result.processedCount} participants.`);
        process.exit(0);
      } else {
        console.error('Cleaning failed:', result.error);
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Unhandled error during cleaning:', err);
      process.exit(1);
    });
} else {
  // Export function if this file is required as a module
  module.exports = { cleanParticipantData };
}
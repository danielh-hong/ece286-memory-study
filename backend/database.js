// database.js
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

/**
 * Participant schema. Notice the `timeIncludingDeadTime` field
 * included in each round now.
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
      totalTime: Number,            // from user can-click to final click
      effectiveTime: Number,        // totalTime minus displayTime
      timeIncludingDeadTime: Number // from startRound() to final click
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

/** Basic stats for the initial page */
async function getTestStats() {
  try {
    const totalParticipants = await Participant.countDocuments();
    const colorFirstCount = await Participant.countDocuments({ startedWithColor: true });
    const monochromeFirstCount = totalParticipants - colorFirstCount;

    return {
      totalParticipants,
      colorFirstCount,
      monochromeFirstCount
    };
  } catch (err) {
    console.error('Error in getTestStats:', err);
    return { totalParticipants: 0, colorFirstCount: 0, monochromeFirstCount: 0 };
  }
}

/** Get all participants but omit name if you want anonymity */
// database.js (FIXED getAllResults)
async function getAllResults() {
  try {
    // This excludes just 'name' and '__v' fields, returning everything else, 
    // including 'timestamp', 'startedWithColor', etc.
    return await Participant.find({}, {
      name: 0,
      __v: 0
    }).sort({ timestamp: -1 });
  } catch (err) {
    console.error('Error in getAllResults:', err);
    return [];
  }
}

module.exports = {
  connectDB,
  Participant,
  getTestStats,
  getAllResults
};

// api/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB (if not already connected)
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
}
connectDB().catch(err => console.error(err));

// Define Mongoose Schema and Model
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

// Helper function: get test statistics
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

// Helper function: get all results (excluding name and __v)
async function getAllResults() {
  try {
    return await Participant.find({}, { name: 0, __v: 0 }).sort({ timestamp: -1 });
  } catch (err) {
    console.error('Error in getAllResults:', err);
    return [];
  }
}

// Define routes
// Note: We use routes like '/test-stats' because this file is deployed at /api
app.get('/test-stats', async (req, res) => {
  try {
    const stats = await getTestStats();
    res.json(stats);
  } catch (error) {
    console.error('Error in /test-stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/participants', async (req, res) => {
  try {
    const participant = new Participant(req.body);
    await participant.save();
    res.status(201).json({ message: 'Participant data saved successfully', id: participant._id });
  } catch (error) {
    console.error('Error in /participants:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/results', async (req, res) => {
  try {
    const results = await getAllResults();
    res.json(results);
  } catch (error) {
    console.error('Error in /results:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Fallback route for any undefined endpoints
app.all('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Export the app wrapped in serverless-http so Vercel can handle it as a serverless function
module.exports = serverless(app);

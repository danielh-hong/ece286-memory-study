// server.js (Node/Express)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, Participant, getTestStats, getAllResults } = require('./database');

const app = express();
const port = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Connect to Mongo
connectDB();

// Routes
app.get('/api/test-stats', async (req, res) => {
  try {
    const stats = await getTestStats();
    res.json(stats);
  } catch (error) {
    console.error('Error in /api/test-stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/participants', async (req, res) => {
  try {
    const participant = new Participant(req.body);
    await participant.save();
    res.status(201).json({ message: 'Participant data saved successfully', id: participant._id });
  } catch (error) {
    console.error('Error in /api/participants:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/results', async (req, res) => {
  try {
    const all = await getAllResults();
    res.json(all);
  } catch (error) {
    console.error('Error in /api/results:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// fallback
app.all('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

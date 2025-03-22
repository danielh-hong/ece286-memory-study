// routes.js - optimized for serverless
const express = require('express');
const { connectDB, Participant, getTestStats, getAllResults } = require('./database');

const router = express.Router();

// Debug middleware to log requests
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint with DB connection test
router.get('/health', async (req, res) => {
  try {
    await connectDB();
    res.status(200).json({
      status: 'ok',
      dbConnected: true,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      dbConnected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test stats endpoint
router.get('/test-stats', async (req, res) => {
  try {
    const stats = await getTestStats();
    res.json(stats);
  } catch (error) {
    console.error('Error in /test-stats:', error);
    res.status(500).json({
      error: 'Server error',
      message: error.message || 'Unknown error'
    });
  }
});

// Endpoint to save a new participant
router.post('/participants', async (req, res) => {
  try {
    await connectDB();
    const participant = new Participant(req.body);
    await participant.save();
    res.status(201).json({
      message: 'Participant data saved successfully',
      id: participant._id
    });
  } catch (error) {
    console.error('Error in /participants:', error);
    res.status(500).json({
      error: 'Server error',
      message: error.message || 'Unknown error'
    });
  }
});

// Endpoint to retrieve all results
router.get('/results', async (req, res) => {
  try {
    const results = await getAllResults();
    res.json(results);
  } catch (error) {
    console.error('Error in /results:', error);
    res.status(500).json({
      error: 'Server error',
      message: error.message || 'Unknown error'
    });
  }
});

module.exports = router;

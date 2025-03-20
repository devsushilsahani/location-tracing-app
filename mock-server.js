const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// In-memory storage for locations
let locations = [];

// Routes
app.post('/api/locations', (req, res) => {
  const newLocation = {
    id: Date.now(), // Simple ID generation
    ...req.body,
    timestamp: req.body.timestamp || Date.now()
  };
  
  locations.push(newLocation);
  console.log('Location saved:', newLocation);
  res.status(201).json(newLocation);
});

app.get('/api/locations', (req, res) => {
  const { startTime, endTime } = req.query;
  
  let filteredLocations = [...locations];
  
  if (startTime && endTime) {
    filteredLocations = filteredLocations.filter(
      loc => loc.timestamp >= parseInt(startTime) && loc.timestamp <= parseInt(endTime)
    );
  }
  
  console.log(`Returning ${filteredLocations.length} locations`);
  res.json(filteredLocations);
});

app.delete('/api/locations', (req, res) => {
  const { olderThan } = req.query;
  
  if (olderThan) {
    const beforeCount = locations.length;
    locations = locations.filter(loc => loc.timestamp >= parseInt(olderThan));
    const deletedCount = beforeCount - locations.length;
    console.log(`Deleted ${deletedCount} locations older than ${new Date(parseInt(olderThan)).toISOString()}`);
  } else {
    console.log('Deleted all locations');
    locations = [];
  }
  
  res.status(200).json({ message: 'Locations deleted successfully' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Mock server running at http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  POST /api/locations - Save a new location');
  console.log('  GET /api/locations?startTime=123&endTime=456 - Get locations by date range');
  console.log('  DELETE /api/locations?olderThan=123 - Delete locations older than timestamp');
});

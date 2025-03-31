const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

// Store received locations
let locations = [];

// Enable JSON parsing and CORS
app.use(express.json());
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'user-id', 'device-id']
}));

// Root endpoint with simple UI
app.get('/', (req, res) => {
  let html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>ESP32 Test Server</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
      h1 { color: #333; }
      .location { border: 1px solid #ddd; margin-bottom: 10px; padding: 10px; border-radius: 5px; }
      .location:hover { background-color: #f8f8f8; }
      .location p { margin: 5px 0; }
      .timestamp { color: #666; font-size: 0.9em; }
      .no-data { color: #999; font-style: italic; }
      .controls { margin: 20px 0; }
      button { padding: 8px 16px; background: #4CAF50; color: white; border: none; cursor: pointer; margin-right: 10px; }
      button:hover { background: #45a049; }
      code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-family: monospace; }
      .map { height: 400px; margin-top: 20px; border: 1px solid #ddd; }
      #status { margin-top: 10px; padding: 10px; border-radius: 5px; }
      .online { background-color: #dff0d8; color: #3c763d; }
      .offline { background-color: #f2dede; color: #a94442; }
    </style>
  </head>
  <body>
    <h1>ESP32 GPS Test Server</h1>
    <div id="status" class="offline">ESP32 Status: Waiting for connection...</div>
    
    <div class="controls">
      <button onclick="clearLocations()">Clear All Locations</button>
      <button onclick="location.reload()">Refresh</button>
    </div>
    
    <h2>Received Locations</h2>
    <div id="locations">`;
    
  if (locations.length === 0) {
    html += '<p class="no-data">No locations received yet. Waiting for ESP32 data...</p>';
  } else {
    locations.slice().reverse().forEach((loc, index) => {
      html += `
      <div class="location">
        <h3>Location ${locations.length - index}</h3>
        <p><strong>Coordinates:</strong> ${loc.latitude}, ${loc.longitude}</p>
        <p><strong>Altitude:</strong> ${loc.altitude !== undefined ? loc.altitude + ' meters' : 'N/A'}</p>
        <p><strong>Speed:</strong> ${loc.speed !== undefined ? loc.speed + ' km/h' : 'N/A'}</p>
        <p><strong>Device ID:</strong> ${loc.deviceId || 'N/A'}</p>
        <p class="timestamp"><strong>Timestamp:</strong> ${new Date(loc.timestamp).toLocaleString()}</p>
        <p class="timestamp"><strong>Received at:</strong> ${new Date(loc.receivedAt).toLocaleString()}</p>
        <p><a href="https://www.google.com/maps?q=${loc.latitude},${loc.longitude}" target="_blank">View on Google Maps</a></p>
      </div>`;
    });
  }
    
  html += `
    </div>

    <script>
      // Function to clear locations
      function clearLocations() {
        fetch('/clear', { method: 'POST' })
          .then(response => response.json())
          .then(data => {
            console.log(data);
            location.reload();
          });
      }
      
      // Check for new locations every 5 seconds
      setInterval(() => {
        fetch('/status')
          .then(response => response.json())
          .then(data => {
            const statusDiv = document.getElementById('status');
            if (data.lastContact && (Date.now() - new Date(data.lastContact).getTime()) < 60000) {
              statusDiv.className = 'online';
              statusDiv.innerHTML = 'ESP32 Status: Online - Last contact: ' + new Date(data.lastContact).toLocaleString();
            } else {
              statusDiv.className = 'offline';
              statusDiv.innerHTML = 'ESP32 Status: Offline - Last contact: ' + 
                (data.lastContact ? new Date(data.lastContact).toLocaleString() : 'Never');
            }
          });
      }, 5000);
    </script>
  </body>
  </html>
  `;
  
  res.send(html);
});

// Endpoint to receive location data
app.post('/api/user/trace-movement', (req, res) => {
  console.log('Received location data:', req.body);
  console.log('Headers:', req.headers);
  
  // Extract all relevant data
  const location = {
    ...req.body,
    receivedAt: new Date().toISOString(),
    headers: {
      deviceId: req.headers['device-id'],
      userId: req.headers['user-id']
    }
  };
  
  locations.push(location);
  
  // Keep only the last 100 locations
  if (locations.length > 100) {
    locations = locations.slice(-100);
  }
  
  // Update last contact time
  lastContact = new Date();
  
  res.status(201).json({
    message: 'Movement tracked successfully',
    location: req.body
  });
});

// Endpoint to get all locations
app.get('/api/locations', (req, res) => {
  const { startTime, endTime } = req.query;
  
  let filteredLocations = [...locations];
  
  // Filter by time range if provided
  if (startTime && endTime) {
    filteredLocations = filteredLocations.filter(loc => {
      const timestamp = loc.timestamp ? new Date(loc.timestamp).getTime() : 0;
      return timestamp >= parseInt(startTime) && timestamp <= parseInt(endTime);
    });
  }
  
  res.json(filteredLocations);
});

// Endpoint to delete locations
app.delete('/api/locations', (req, res) => {
  const { olderThan } = req.query;
  
  if (olderThan) {
    const threshold = parseInt(olderThan);
    const originalCount = locations.length;
    
    locations = locations.filter(loc => {
      const timestamp = loc.timestamp ? new Date(loc.timestamp).getTime() : 0;
      return timestamp >= threshold;
    });
    
    res.json({ 
      message: `Deleted ${originalCount - locations.length} locations older than ${new Date(threshold).toISOString()}`,
      deletedCount: originalCount - locations.length
    });
  } else {
    // If no olderThan parameter, clear all
    const deletedCount = locations.length;
    locations = [];
    res.json({ 
      message: `Deleted all ${deletedCount} locations`,
      deletedCount
    });
  }
});

// Endpoint to get server status
let lastContact = null;
app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    locationsCount: locations.length,
    lastContact: lastContact
  });
});

// Endpoint to clear all locations
app.post('/clear', (req, res) => {
  locations = [];
  res.json({ message: 'All locations cleared' });
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`
========================================================
  ESP32 GPS Test Server running at http://localhost:${port}
========================================================

To configure your ESP32 to use this server:
1. Find your computer's local IP address
2. Update your ESP32 code:
   - Set useWebhook = false (to use the main API)
   - Change serverAddress to your computer's IP
   - Change serverPort to ${port}
   - Leave traceEndpoint as "/api/user/trace-movement"

Your ESP32 data will be displayed at http://localhost:${port}
  `);
});

const fetch = require('node-fetch');

// URL of your Railway deployment
const railwayUrl = 'https://location-tracing-backend-production.up.railway.app';

// Function to check the latest locations
async function checkAllLocations() {
  try {
    console.log('=== CHECKING ALL LOCATION DATA ===');
    
    // First, check if the server is up
    try {
      const healthResponse = await fetch(`${railwayUrl}/health`);
      const healthData = await healthResponse.json();
      console.log('Server health check:', healthData);
    } catch (error) {
      console.log('❌ Error connecting to server:', error.message);
      return;
    }
    
    // Get the latest locations from the server
    const response = await fetch(`${railwayUrl}/api/user/latest-locations?limit=50`);
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Error fetching latest locations:', data);
      return;
    }
    
    console.log(`Found ${data.length} location records in the database.`);
    
    if (data.length > 0) {
      console.log('\nAll locations (newest first):');
      data.forEach((loc, index) => {
        console.log(`\nLocation ${index + 1}:`);
        console.log(`  ID: ${loc.id}`);
        console.log(`  Latitude: ${loc.latitude}`);
        console.log(`  Longitude: ${loc.longitude}`);
        console.log(`  Altitude: ${loc.altitude !== null ? loc.altitude : 'N/A'}`);
        console.log(`  Speed: ${loc.speed !== null ? loc.speed : 'N/A'}`);
        console.log(`  Timestamp: ${new Date(loc.timestamp).toLocaleString()}`);
        console.log(`  Created at: ${new Date(loc.createdAt).toLocaleString()}`);
        console.log(`  Device ID: ${loc.deviceId || 'N/A'}`);
        console.log(`  Route ID: ${loc.routeId || 'N/A'}`);
      });
    } else {
      console.log('\n❌ No location data found in the database.');
    }
    
    // Check all unique device IDs
    const uniqueDeviceIds = [...new Set(data.map(loc => loc.deviceId).filter(id => id))];
    console.log('\nUnique device IDs in the database:');
    if (uniqueDeviceIds.length > 0) {
      uniqueDeviceIds.forEach(id => console.log(`- ${id}`));
    } else {
      console.log('No device IDs found in the database.');
    }
    
    console.log('\n=== TESTING API ===');
    // Test sending a location to the API
    try {
      const testLocation = {
        latitude: 19.0222,
        longitude: 72.8753,
        altitude: 10,
        speed: 0,
        timestamp: new Date().toISOString(),
        deviceId: 'test-script'
      };
      
      console.log('Sending test location:', testLocation);
      
      const testResponse = await fetch(`${railwayUrl}/api/user/trace-movement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'device-id': testLocation.deviceId
        },
        body: JSON.stringify(testLocation)
      });
      
      const testData = await testResponse.json();
      console.log('API test response status:', testResponse.status);
      console.log('API test response:', testData);
      
      if (testResponse.ok) {
        console.log('✅ API test successful! The server is accepting location data.');
      } else {
        console.log('❌ API test failed. The server returned an error.');
      }
    } catch (error) {
      console.log('❌ API test error:', error.message);
    }
    
  } catch (error) {
    console.error('Error checking locations:', error.message);
  }
}

// Run the check
checkAllLocations();

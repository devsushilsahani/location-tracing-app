const fetch = require('node-fetch');

// URL of your Railway deployment
const railwayUrl = 'https://location-tracing-backend-production.up.railway.app';

// The device ID from your ESP32
const espDeviceId = 'esp32-gps-device-001';

// Function to check the latest locations
async function checkLatestLocations() {
  try {
    console.log('=== CHECKING LATEST LOCATIONS ===');
    
    // Get the latest locations from the server
    const response = await fetch(`${railwayUrl}/api/user/latest-locations?limit=20`);
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Error fetching latest locations:', data);
      return;
    }
    
    console.log(`Found ${data.length} location records in the database.`);
    
    // Check if any of the locations match our ESP32's device ID
    const espLocations = data.filter(loc => loc.deviceId === espDeviceId);
    
    if (espLocations.length > 0) {
      console.log(`\n✅ SUCCESS! Found ${espLocations.length} location records from your ESP32 device.`);
      
      // Show the 3 most recent locations from the ESP32
      console.log('\nMost recent locations from your ESP32:');
      espLocations.slice(0, 3).forEach((loc, index) => {
        console.log(`\nLocation ${index + 1}:`);
        console.log(`  Latitude: ${loc.latitude}`);
        console.log(`  Longitude: ${loc.longitude}`);
        console.log(`  Altitude: ${loc.altitude !== null ? loc.altitude : 'N/A'}`);
        console.log(`  Speed: ${loc.speed !== null ? loc.speed : 'N/A'}`);
        console.log(`  Timestamp: ${new Date(loc.timestamp).toLocaleString()}`);
      });
      
      console.log('\n=== SYSTEM STATUS ===');
      console.log('✅ ESP32 GPS module: WORKING');
      console.log('✅ Data transmission to Railway: WORKING');
      console.log('✅ Railway backend: WORKING');
      console.log('\nYour location tracking system is fully operational! 🎉');
      
    } else {
      console.log('\n❌ No locations found from your ESP32 device.');
      console.log('\nPossible issues:');
      console.log('1. ESP32 is not sending data correctly');
      console.log('2. ESP32 might not be connected to WiFi');
      console.log('3. The device ID in the database might be different from what we expected');
      
      // List all unique device IDs in the database to help troubleshoot
      const uniqueDeviceIds = [...new Set(data.map(loc => loc.deviceId).filter(id => id))];
      
      if (uniqueDeviceIds.length > 0) {
        console.log('\nDevice IDs found in the database:');
        uniqueDeviceIds.forEach(id => console.log(`- ${id}`));
      } else {
        console.log('\nNo device IDs found in the database.');
      }
    }
    
  } catch (error) {
    console.error('Error checking latest locations:', error.message);
  }
}

// Run the check
checkLatestLocations();

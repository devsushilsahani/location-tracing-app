const fetch = require('node-fetch');

// URL of your Railway deployment
const railwayUrl = 'https://location-tracing-backend-production.up.railway.app';

// The device ID from your ESP32 code
const espDeviceId = 'esp32-gps-device-001';

// Function to check for ESP32 data
async function checkEsp32Data() {
  try {
    console.log(`=== CHECKING FOR ESP32 DATA (Device ID: ${espDeviceId}) ===`);
    
    // Get the latest locations from the server
    const response = await fetch(`${railwayUrl}/api/user/latest-locations?limit=50`);
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Error fetching latest locations:', data);
      return;
    }
    
    console.log(`Found ${data.length} total location records in the database.`);
    
    // Look for our ESP32 device ID
    const espLocations = data.filter(loc => loc.deviceId === espDeviceId);
    
    if (espLocations.length > 0) {
      console.log(`\n✅ SUCCESS! Found ${espLocations.length} records from your ESP32 device.`);
      
      // Show the ESP32 locations
      console.log('\nESP32 location data:');
      espLocations.forEach((loc, index) => {
        console.log(`\nLocation ${index + 1}:`);
        console.log(`  Created: ${new Date(loc.createdAt).toLocaleString()}`);
        console.log(`  Latitude: ${loc.latitude}`);
        console.log(`  Longitude: ${loc.longitude}`);
        console.log(`  Altitude: ${loc.altitude !== null ? loc.altitude : 'N/A'}`);
        console.log(`  Speed: ${loc.speed !== null ? loc.speed : 'N/A'}`);
      });
      
      console.log('\n=== SYSTEM STATUS ===');
      console.log('✅ ESP32 GPS module: WORKING');
      console.log('✅ Data transmission to Railway: WORKING');
      console.log('✅ Data storage in database: WORKING');
      console.log('\nYour location tracking system is fully operational! 🎉');
      
      // Provide a link to view the location on Google Maps
      if (espLocations.length > 0) {
        const latestLoc = espLocations[0];
        const mapsUrl = `https://www.google.com/maps?q=${latestLoc.latitude},${latestLoc.longitude}`;
        console.log(`\nView latest location on Google Maps: ${mapsUrl}`);
      }
      
    } else {
      console.log('\n❌ No data found from your ESP32 device.');
      console.log('\nTroubleshooting suggestions:');
      console.log('1. Make sure your ESP32 is powered on and running the updated code');
      console.log('2. Check that your ESP32 has a WiFi connection');
      console.log('3. Ensure your ESP32 is receiving valid GPS data');
      console.log('4. Check the Serial Monitor for any error messages');
      console.log('5. Verify that the device ID in your ESP32 code matches what you\'re searching for');
      
      // List all device IDs in the database
      const uniqueDeviceIds = [...new Set(data.map(loc => loc.deviceId).filter(id => id))];
      
      if (uniqueDeviceIds.length > 0) {
        console.log('\nDevice IDs found in the database:');
        uniqueDeviceIds.forEach(id => console.log(`- ${id}`));
      }
    }
    
  } catch (error) {
    console.error('Error checking ESP32 data:', error.message);
  }
}

// Run the check
checkEsp32Data();

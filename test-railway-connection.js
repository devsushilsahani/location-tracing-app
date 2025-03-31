const fetch = require('node-fetch');

// Replace with your actual Railway deployment URL
const railwayUrl = 'https://location-tracing-backend-production.up.railway.app';

// Test the health endpoint
async function testHealthEndpoint() {
  try {
    console.log(`Testing health endpoint: ${railwayUrl}/health`);
    const response = await fetch(`${railwayUrl}/health`);
    const data = await response.json();
    console.log('Health check response:', data);
    console.log('Status:', response.status, response.ok ? 'OK' : 'Failed');
    return response.ok;
  } catch (error) {
    console.error('Health check failed:', error.message);
    return false;
  }
}

// Test getting latest locations
async function testLatestLocations() {
  try {
    console.log(`\nTesting latest locations endpoint: ${railwayUrl}/api/user/latest-locations`);
    const response = await fetch(`${railwayUrl}/api/user/latest-locations`);
    const data = await response.json();
    console.log('Latest locations response status:', response.status);
    
    if (response.ok) {
      console.log(`Found ${data.length} location records:`);
      data.forEach((location, index) => {
        console.log(`\nLocation ${index + 1}:`);
        console.log(`  Latitude: ${location.latitude}`);
        console.log(`  Longitude: ${location.longitude}`);
        console.log(`  Timestamp: ${location.timestamp}`);
        console.log(`  Device ID: ${location.deviceId || 'Not provided'}`);
      });
    } else {
      console.log('Error response:', data);
    }
    
    return response.ok;
  } catch (error) {
    console.error('Latest locations check failed:', error.message);
    return false;
  }
}

// Test sending a mock location
async function testSendLocation() {
  try {
    console.log(`\nTesting trace-movement endpoint: ${railwayUrl}/api/user/trace-movement`);
    
    const mockLocation = {
      latitude: 37.7749,
      longitude: -122.4194,
      altitude: 10,
      speed: 0,
      timestamp: new Date().toISOString(),
      deviceId: 'test-device-001'
    };
    
    console.log('Sending mock location:', mockLocation);
    
    const response = await fetch(`${railwayUrl}/api/user/trace-movement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'device-id': mockLocation.deviceId
      },
      body: JSON.stringify(mockLocation)
    });
    
    const data = await response.json();
    console.log('Send location response status:', response.status);
    console.log('Response data:', data);
    
    return response.ok;
  } catch (error) {
    console.error('Send location test failed:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('=== RAILWAY BACKEND CONNECTION TEST ===');
  
  const healthOk = await testHealthEndpoint();
  const locationsOk = await testLatestLocations();
  const sendOk = await testSendLocation();
  
  console.log('\n=== TEST RESULTS ===');
  console.log('Health check:', healthOk ? 'PASSED' : 'FAILED');
  console.log('Latest locations:', locationsOk ? 'PASSED' : 'FAILED');
  console.log('Send location:', sendOk ? 'PASSED' : 'FAILED');
  
  if (healthOk && locationsOk && sendOk) {
    console.log('\n✅ All tests PASSED! Your Railway backend is working correctly.');
  } else {
    console.log('\n❌ Some tests FAILED. Check the logs above for details.');
  }
}

runTests();

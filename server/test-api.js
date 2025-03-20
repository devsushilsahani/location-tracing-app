// Simple script to test the backend API endpoints
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000/api';

// Test data
const testUserId = 'test-user-id'; // Replace with a valid user ID from your database
const testRouteId = 'test-route-id'; // Replace with a valid route ID from your database
const testDeviceId = 'test-device-id'; // Replace with a valid device ID or create a new one

// Helper function to make API requests
async function makeRequest(url, method = 'GET', body = null, headers = {}) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    console.error(`Error making request to ${url}:`, error);
    return { status: 500, error: error.message };
  }
}

// Test functions
async function testHealthCheck() {
  console.log('\n--- Testing Health Check ---');
  const result = await makeRequest('http://localhost:3000/health');
  console.log(`Status: ${result.status}`);
  console.log('Response:', result.data);
}

async function testGetUserLocation() {
  console.log('\n--- Testing Get User Location ---');
  const result = await makeRequest(`${BASE_URL}/user/location/${testUserId}`);
  console.log(`Status: ${result.status}`);
  console.log('Response:', result.data);
}

async function testGetDeviceLocation() {
  console.log('\n--- Testing Get Device Location ---');
  const result = await makeRequest(`${BASE_URL}/user/device-location/${testDeviceId}`);
  console.log(`Status: ${result.status}`);
  console.log('Response:', result.data);
}

async function testGetLatestLocations() {
  console.log('\n--- Testing Get Latest Locations ---');
  const result = await makeRequest(`${BASE_URL}/user/latest-locations?limit=5`);
  console.log(`Status: ${result.status}`);
  console.log('Response:', result.data);
}

async function testTraceMovement() {
  console.log('\n--- Testing Trace Movement ---');
  const locationData = {
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: 10,
    speed: 5,
    timestamp: Date.now(),
  };
  const result = await makeRequest(
    `${BASE_URL}/user/trace-movement`, 
    'POST', 
    locationData, 
    { 'user-id': testUserId }
  );
  console.log(`Status: ${result.status}`);
  console.log('Response:', result.data);
}

async function testTraceMovementWithDevice() {
  console.log('\n--- Testing Trace Movement with Device Only ---');
  const locationData = {
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: 10,
    speed: 5,
    timestamp: Date.now(),
    deviceId: testDeviceId
  };
  const result = await makeRequest(
    `${BASE_URL}/user/trace-movement`, 
    'POST', 
    locationData
  );
  console.log(`Status: ${result.status}`);
  console.log('Response:', result.data);
}

async function testCompleteRoute() {
  console.log('\n--- Testing Complete Route ---');
  const result = await makeRequest(`${BASE_URL}/user/complete-route/${testUserId}`, 'POST');
  console.log(`Status: ${result.status}`);
  console.log('Response:', result.data);
}

async function testReturnToStart() {
  console.log('\n--- Testing Return to Start ---');
  const result = await makeRequest(`${BASE_URL}/user/return-to-start/${testRouteId}`);
  console.log(`Status: ${result.status}`);
  console.log('Response:', result.data);
}

async function testGetUserHistory() {
  console.log('\n--- Testing Get User History ---');
  const result = await makeRequest(`${BASE_URL}/user/history/${testUserId}?limit=5&page=1`);
  console.log(`Status: ${result.status}`);
  console.log('Response:', result.data);
}

async function testGetRouteDetails() {
  console.log('\n--- Testing Get Route Details ---');
  const result = await makeRequest(`${BASE_URL}/user/route-details/${testRouteId}`);
  console.log(`Status: ${result.status}`);
  console.log('Response:', result.data);
}

// Run all tests
async function runTests() {
  try {
    await testHealthCheck();
    await testGetUserLocation();
    await testGetDeviceLocation();
    await testGetLatestLocations();
    await testTraceMovement();
    await testTraceMovementWithDevice();
    await testCompleteRoute();
    await testReturnToStart();
    await testGetUserHistory();
    await testGetRouteDetails();
    console.log('\n--- All tests completed ---');
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Run the tests
runTests();

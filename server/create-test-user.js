// Script to create a test user in the database
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // Create a test user
    const user = await prisma.user.create({
      data: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User'
      }
    });

    console.log('Test user created successfully:', user);
    
    // Create a test route
    const route = await prisma.route.create({
      data: {
        id: 'test-route-id',
        userId: user.id,
        date: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        duration: 3600, // 1 hour in seconds
        distance: 5000 // 5 km in meters
      }
    });
    
    console.log('Test route created successfully:', route);
    
    // Create a test location
    const location = await prisma.location.create({
      data: {
        latitude: 37.7749,
        longitude: -122.4194,
        altitude: 10,
        speed: 5,
        timestamp: new Date(),
        routeId: route.id,
        deviceId: 'test-device-id'
      }
    });
    
    console.log('Test location created successfully:', location);
    
  } catch (error) {
    console.error('Error creating test data:', error);
    
    // If the user already exists, try to fetch it
    if (error.code === 'P2002') {
      console.log('User already exists, fetching existing user...');
      const existingUser = await prisma.user.findUnique({
        where: { id: 'test-user-id' }
      });
      console.log('Existing user:', existingUser);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();

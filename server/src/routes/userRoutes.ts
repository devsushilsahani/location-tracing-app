import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { 
  TypedRequest, 
  TypedResponse, 
  UserHistoryQueryParams, 
  UserTraceRequestBody, 
  UserRetraceRequestBody,
  LocationRequestBody
} from '../types';

const router = Router();
const prisma = new PrismaClient();

// Get user's current location
router.get('/location/:userId', async (req: TypedRequest, res: TypedResponse) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check if the user exists
    const userExists = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!userExists) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get the most recent location for this user
    const latestLocation = await prisma.location.findFirst({
      where: {
        route: {
          userId: userId
        }
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    if (!latestLocation) {
      return res.status(404).json({ error: 'No location found for this user' });
    }

    return res.json(latestLocation);
  } catch (error) {
    console.error('Error fetching user location:', error);
    return res.status(500).json({ error: 'Failed to fetch user location' });
  }
});

// Get latest location by device ID (for devices not yet associated with a user)
router.get('/device-location/:deviceId', async (req: TypedRequest, res: TypedResponse) => {
  try {
    const { deviceId } = req.params;
    
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    // Get the most recent location for this device
    // Note: This assumes you've added a deviceId field to your Location model
    // You would need to update your Prisma schema to include this
    const latestLocation = await prisma.location.findFirst({
      where: {
        deviceId: deviceId
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    if (!latestLocation) {
      return res.status(404).json({ error: 'No location found for this device' });
    }

    return res.json(latestLocation);
  } catch (error) {
    console.error('Error fetching device location:', error);
    return res.status(500).json({ error: 'Failed to fetch device location' });
  }
});

// Get latest locations (most recent locations, regardless of user)
router.get('/latest-locations', async (req: TypedRequest, res: TypedResponse) => {
  try {
    const { limit = '10' } = req.query;
    const limitNum = parseInt(String(limit), 10);

    // Get the most recent locations
    const latestLocations = await prisma.location.findMany({
      orderBy: {
        timestamp: 'desc'
      },
      take: limitNum,
      include: {
        route: {
          select: {
            userId: true
          }
        }
      }
    });

    return res.json(latestLocations);
  } catch (error) {
    console.error('Error fetching latest locations:', error);
    return res.status(500).json({ error: 'Failed to fetch latest locations' });
  }
});

// Trace movement from hardware device (user ID is optional)
router.post('/trace-movement', async (req: TypedRequest<LocationRequestBody>, res: TypedResponse) => {
  try {
    const { latitude, longitude, altitude, speed, timestamp, deviceId: bodyDeviceId } = req.body;
    const userId = req.headers['user-id'] as string;
    const headerDeviceId = req.headers['device-id'] as string;
    
    // Use device ID from header or body
    const deviceId = headerDeviceId || bodyDeviceId;

    if (!latitude || !longitude || !timestamp) {
      return res.status(400).json({ error: 'latitude, longitude, and timestamp are required' });
    }

    if (!deviceId && !userId) {
      return res.status(400).json({ error: 'Either device-id header/body or user-id header is required' });
    }

    let routeId: string | null = null;

    // If we have a userId, check for an active route or create one
    if (userId) {
      // Check if the user exists
      const userExists = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!userExists) {
        return res.status(404).json({ error: 'User not found' });
      }

      let activeRoute = await prisma.route.findFirst({
        where: {
          userId: userId,
          endTime: {
            gte: new Date('2099-01-01T00:00:00Z') // Check for our "unfinished" route marker
          }
        }
      });

      // If no active route, create one
      if (!activeRoute) {
        try {
          activeRoute = await prisma.route.create({
            data: {
              userId: userId,
              date: new Date(),
              startTime: new Date(timestamp),
              endTime: new Date('2099-12-31T23:59:59Z'),
              duration: 0, // Will be calculated when route is completed
              distance: 0 // Will be updated incrementally
            }
          });
        } catch (error) {
          console.error('Error creating route:', error);
          return res.status(500).json({ 
            error: 'Failed to create route',
            details: 'There was an error creating a route for this user. The user may not exist in the database.'
          });
        }
      }

      routeId = activeRoute.id;
    }

    // Create the location point
    const location = await prisma.location.create({
      data: {
        latitude,
        longitude,
        altitude,
        speed,
        timestamp: new Date(timestamp),
        routeId,
        deviceId
      }
    });

    // If we have a routeId, update the route's distance if there are previous points
    if (routeId) {
      const previousLocation = await prisma.location.findFirst({
        where: {
          routeId: routeId,
          id: { not: location.id }
        },
        orderBy: {
          timestamp: 'desc'
        }
      });

      if (previousLocation) {
        // Calculate distance between points (simplified version using Haversine formula)
        const distance = calculateDistance(
          previousLocation.latitude, previousLocation.longitude,
          latitude, longitude
        );

        // Update the route with the new distance
        await prisma.route.update({
          where: { id: routeId },
          data: {
            distance: { increment: distance }
          }
        });
      }
    }

    return res.status(201).json({
      message: 'Movement tracked successfully',
      location,
      routeId
    });
  } catch (error) {
    console.error('Error tracking movement:', error);
    return res.status(500).json({ error: 'Failed to track movement' });
  }
});

// Complete the current route and calculate stats
router.post('/complete-route/:userId', async (req: TypedRequest, res: TypedResponse) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check if the user exists
    const userExists = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!userExists) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find the active route
    const activeRoute = await prisma.route.findFirst({
      where: {
        userId: userId,
        endTime: {
          gte: new Date('2099-01-01T00:00:00Z') // Check for our "unfinished" route marker
        }
      }
    });

    if (!activeRoute) {
      return res.status(404).json({ error: 'No active route found for this user' });
    }

    // Calculate duration
    const now = new Date();
    const durationMs = now.getTime() - activeRoute.startTime.getTime();
    const durationSeconds = Math.floor(durationMs / 1000);

    // Update the route to mark it as completed
    const completedRoute = await prisma.route.update({
      where: { id: activeRoute.id },
      data: {
        endTime: now, 
        duration: durationSeconds
      },
      include: {
        locations: {
          orderBy: {
            timestamp: 'asc'
          }
        }
      }
    });

    return res.json({
      message: 'Route completed successfully',
      route: completedRoute
    });
  } catch (error) {
    console.error('Error completing route:', error);
    return res.status(500).json({ error: 'Failed to complete route' });
  }
});

// Return to initial position (navigate back to starting point)
router.get('/return-to-start/:routeId', async (req: TypedRequest, res: TypedResponse) => {
  try {
    const { routeId } = req.params;
    
    if (!routeId) {
      return res.status(400).json({ error: 'routeId is required' });
    }

    // Get the route with its locations
    const route = await prisma.route.findUnique({
      where: { id: routeId },
      include: {
        locations: {
          orderBy: {
            timestamp: 'asc'
          }
        }
      }
    });

    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    if (route.locations.length === 0) {
      return res.status(404).json({ error: 'No locations found for this route' });
    }

    // Get the starting point (first location)
    const startingPoint = route.locations[0];
    
    // Get the current/last point
    const currentPoint = await prisma.location.findFirst({
      where: {
        routeId: routeId
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    if (!currentPoint) {
      return res.status(404).json({ error: 'No current location found for this route' });
    }

    // Calculate distance to starting point
    const distanceToStart = calculateDistance(
      currentPoint.latitude, currentPoint.longitude,
      startingPoint.latitude, startingPoint.longitude
    );

    // Calculate bearing to starting point
    const bearingToStart = calculateBearing(
      currentPoint.latitude, currentPoint.longitude,
      startingPoint.latitude, startingPoint.longitude
    );

    return res.json({
      startingPoint,
      currentPoint,
      navigationInfo: {
        distanceToStart,
        bearingToStart,
        startCoordinates: {
          latitude: startingPoint.latitude,
          longitude: startingPoint.longitude
        }
      }
    });
  } catch (error) {
    console.error('Error getting return path:', error);
    return res.status(500).json({ error: 'Failed to get return path' });
  }
});

// Get user history (list of routes)
router.get('/history/:userId', async (req: TypedRequest<{}, UserHistoryQueryParams>, res: TypedResponse) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, limit = '10', page = '1' } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check if the user exists
    const userExists = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!userExists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const limitNum = parseInt(limit, 10);
    const pageNum = parseInt(page, 10);
    const skip = (pageNum - 1) * limitNum;

    // Create date filters if provided
    const dateFilter: any = {};
    if (startDate) {
      const startDateTime = new Date(String(startDate));
      dateFilter.gte = startDateTime;
    }
    if (endDate) {
      const endDateTime = new Date(String(endDate));
      dateFilter.lte = endDateTime;
    }

    // Query for completed routes (those with a real endTime, not our placeholder)
    const routes = await prisma.route.findMany({
      where: {
        userId: userId,
        endTime: { 
          lt: new Date('2099-01-01T00:00:00Z') // Only include routes with real end times
        },
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
      },
      orderBy: {
        date: 'desc'
      },
      skip,
      take: limitNum,
      include: {
        locations: true
      }
    });

    // Get total count for pagination
    const totalRoutes = await prisma.route.count({
      where: {
        userId: userId,
        endTime: { 
          lt: new Date('2099-01-01T00:00:00Z') // Only include routes with real end times
        },
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
      }
    });

    // Format the response
    const formattedRoutes = routes.map(route => ({
      id: route.id,
      date: route.date,
      startTime: route.startTime,
      endTime: route.endTime,
      duration: route.duration,
      distance: route.distance,
      locationCount: route.locations.length
    }));

    return res.json({
      data: formattedRoutes,
      pagination: {
        total: totalRoutes,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(totalRoutes / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching user history:', error);
    return res.status(500).json({ error: 'Failed to fetch user history' });
  }
});

// Get detailed route information with all location points
router.get('/route-details/:routeId', async (req: TypedRequest, res: TypedResponse) => {
  try {
    const { routeId } = req.params;
    
    if (!routeId) {
      return res.status(400).json({ error: 'routeId is required' });
    }

    const route = await prisma.route.findUnique({
      where: { id: routeId },
      include: {
        locations: {
          orderBy: {
            timestamp: 'asc'
          }
        }
      }
    });

    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    return res.json(route);
  } catch (error) {
    console.error('Error fetching route details:', error);
    return res.status(500).json({ error: 'Failed to fetch route details' });
  }
});

// Helper function to calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

// Helper function to calculate bearing between two points
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
          Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  
  let θ = Math.atan2(y, x);
  θ = θ * 180 / Math.PI; // Convert to degrees
  return (θ + 360) % 360; // Normalize to 0-360
}

export default router;

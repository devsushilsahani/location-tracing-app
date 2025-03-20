import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { TypedRequest, TypedResponse, LocationRequestBody, LocationQueryParams, RouteRequestBody } from '../types';

const router = Router();
const prisma = new PrismaClient();

// Get locations between two timestamps
router.get('/locations', async (req: TypedRequest<{}, LocationQueryParams>, res: TypedResponse) => {
  try {
    const { startTime, endTime } = req.query;
    
    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'startTime and endTime are required' });
    }

    const startDate = new Date(Number(startTime));
    const endDate = new Date(Number(endTime));

    const locations = await prisma.location.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    return res.json(locations);
  } catch (error) {
    console.error('Error fetching locations:', error);
    return res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// Save a location point
router.post('/locations', async (req: TypedRequest<LocationRequestBody>, res: TypedResponse) => {
  try {
    const { latitude, longitude, altitude, speed, timestamp } = req.body;

    if (!latitude || !longitude || !timestamp) {
      return res.status(400).json({ error: 'latitude, longitude, and timestamp are required' });
    }

    const location = await prisma.location.create({
      data: {
        latitude,
        longitude,
        altitude,
        speed,
        timestamp: new Date(timestamp),
      },
    });

    return res.status(201).json(location);
  } catch (error) {
    console.error('Error saving location:', error);
    return res.status(500).json({ error: 'Failed to save location' });
  }
});

// Get routes for a specific date
router.get('/routes', async (req: TypedRequest<{}, LocationQueryParams>, res: TypedResponse) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    const queryDate = new Date(String(date));
    const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));

    const routes = await prisma.route.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        locations: {
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });

    return res.json(routes);
  } catch (error) {
    console.error('Error fetching routes:', error);
    return res.status(500).json({ error: 'Failed to fetch routes' });
  }
});

// Create a new route
router.post('/routes', async (req: TypedRequest<RouteRequestBody>, res: TypedResponse) => {
  try {
    const { date, startTime, endTime, duration, distance, userId, locations } = req.body;

    if (!date || !startTime || !endTime || !duration || !distance) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create the route with a transaction to ensure all data is saved
    const route = await prisma.$transaction(async (tx) => {
      // Create the route
      const newRoute = await tx.route.create({
        data: {
          date: new Date(date),
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          duration,
          distance,
          userId: userId || 'anonymous', // Default user if not provided
        },
      });

      // If locations are provided, create them and associate with the route
      if (locations && locations.length > 0) {
        await tx.location.createMany({
          data: locations.map((loc) => ({
            latitude: loc.latitude,
            longitude: loc.longitude,
            altitude: loc.altitude,
            speed: loc.speed,
            timestamp: new Date(loc.timestamp),
            routeId: newRoute.id,
          })),
        });
      }

      return newRoute;
    });

    return res.status(201).json(route);
  } catch (error) {
    console.error('Error creating route:', error);
    return res.status(500).json({ error: 'Failed to create route' });
  }
});

// Delete old locations
router.delete('/locations', async (req: TypedRequest<{}, LocationQueryParams>, res: TypedResponse) => {
  try {
    const { olderThan } = req.query;
    
    if (!olderThan) {
      return res.status(400).json({ error: 'olderThan timestamp is required' });
    }

    const date = new Date(Number(olderThan));

    const result = await prisma.location.deleteMany({
      where: {
        timestamp: {
          lt: date,
        },
        routeId: null, // Only delete locations not associated with a route
      },
    });

    return res.json({ deleted: result.count });
  } catch (error) {
    console.error('Error deleting locations:', error);
    return res.status(500).json({ error: 'Failed to delete locations' });
  }
});

export default router;
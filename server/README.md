# Location Tracking API

This is a backend API for tracking and managing location data, routes, and user history.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Set up the database:
   ```
   npx prisma migrate dev
   ```

3. Start the server:
   ```
   npm start
   ```

## Testing the Backend

There are several ways to test the backend:

### 1. Using the test script

We've provided a simple test script that checks all the main API endpoints:

```
npm install node-fetch
node test-api.js
```

Before running the test script, make sure to:
- Update the `testUserId` and `testRouteId` variables in the script with valid IDs from your database
- Ensure the server is running on port 3000

### 2. Using Postman or similar API testing tools

You can test the API endpoints using Postman, Insomnia, or any other API testing tool.

#### Main Endpoints:

##### Location Endpoints
- `GET /api/locations` - Get locations between timestamps
- `POST /api/locations` - Save a location point
- `GET /api/routes` - Get routes for a specific date
- `POST /api/routes` - Create a new route
- `DELETE /api/locations` - Delete old locations

##### User History Endpoints
- `GET /api/user/history` - Get user's route history
- `POST /api/user/trace` - Get detailed location history for a user
- `POST /api/user/retrace` - Get a specific route for retracing

### 3. Using curl

You can also test the API using curl commands:

```bash
# Health check
curl http://localhost:3000/health

# Get locations
curl "http://localhost:3000/api/locations?startTime=1647734400000&endTime=1647820800000"

# Create a location
curl -X POST http://localhost:3000/api/locations \
  -H "Content-Type: application/json" \
  -d '{"latitude": 37.7749, "longitude": -122.4194, "timestamp": 1647777600000}'

# Get user history
curl "http://localhost:3000/api/user/history?userId=your-user-id&limit=10&page=1"

# Get user trace
curl -X POST http://localhost:3000/api/user/trace \
  -H "Content-Type: application/json" \
  -d '{"userId": "your-user-id", "startTime": "2023-01-01T00:00:00Z", "includeRoutes": true}'

# Get route for retracing
curl -X POST http://localhost:3000/api/user/retrace \
  -H "Content-Type: application/json" \
  -d '{"routeId": "your-route-id", "speed": 2}'
```

## API Documentation

### User and Device Location Endpoints

#### GET /api/user/location/:userId
Get the most recent location for a user.

**Path Parameters:**
- `userId` (required): The ID of the user

#### GET /api/user/device-location/:deviceId
Get the most recent location for a specific device.

**Path Parameters:**
- `deviceId` (required): The ID of the device

#### GET /api/user/latest-locations
Get the most recent locations from all users and devices.

**Query Parameters:**
- `limit` (optional): Number of locations to return (default: 10)

#### POST /api/user/trace-movement
Track movement from a hardware device.

**Request Headers:**
- `user-id` (optional): The ID of the user
- `device-id` (optional): The ID of the device

**Request Body:**
```json
{
  "latitude": number,
  "longitude": number,
  "altitude": number (optional),
  "speed": number (optional),
  "timestamp": number,
  "deviceId": string (optional)
}
```

**Note:** Either a user ID (via header) or a device ID (via header or body) must be provided.

#### POST /api/user/complete-route/:userId
Complete the current active route for a user and calculate statistics.

**Path Parameters:**
- `userId` (required): The ID of the user

#### GET /api/user/return-to-start/:routeId
Get navigation information to return to the starting point of a route.

**Path Parameters:**
- `routeId` (required): The ID of the route

**Response:**
```json
{
  "startingPoint": { /* location data */ },
  "currentPoint": { /* location data */ },
  "navigationInfo": {
    "distanceToStart": number,
    "bearingToStart": number,
    "startCoordinates": {
      "latitude": number,
      "longitude": number
    }
  }
}
```

#### GET /api/user/history/:userId
Get a paginated list of routes for a user.

**Path Parameters:**
- `userId` (required): The ID of the user

**Query Parameters:**
- `startDate` (optional): Filter routes after this date
- `endDate` (optional): Filter routes before this date
- `limit` (optional): Number of routes per page (default: 10)
- `page` (optional): Page number (default: 1)

#### GET /api/user/route-details/:routeId
Get detailed information about a specific route including all location points.

**Path Parameters:**
- `routeId` (required): The ID of the route

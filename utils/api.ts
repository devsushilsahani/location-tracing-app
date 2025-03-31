// utils/api.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// Define API URLs
const LOCAL_API_URL = 'http://192.168.1.100:3000/api';
const PRODUCTION_API_URL = 'https://location-tracing-backend-production.up.railway.app/api';

// Default to local server for development
const API_BASE_URL = LOCAL_API_URL;

// Device ID for this mobile device
const DEVICE_ID = 'mobile-app-device-001';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'device-id': DEVICE_ID,
  }
});

// Queue for storing requests when offline
let offlineQueue: Array<{
  method: string;
  url: string;
  data?: any;
  headers?: any;
}> = [];

// Initialize network state
let isConnected = true;

// Setup network state monitoring
NetInfo.addEventListener((state: NetInfoState) => {
  const wasConnected = isConnected;
  isConnected = state.isConnected ?? false;
  
  // If we just came back online, process the offline queue
  if (!wasConnected && isConnected) {
    processOfflineQueue();
  }
});

// Process queued requests when back online
const processOfflineQueue = async () => {
  if (offlineQueue.length === 0) return;
  
  console.log(`Processing ${offlineQueue.length} offline requests`);
  
  const queue = [...offlineQueue];
  offlineQueue = [];
  
  for (const request of queue) {
    try {
      if (request.method === 'post') {
        await api.post(request.url, request.data, { headers: request.headers });
      } else if (request.method === 'get') {
        await api.get(request.url, { headers: request.headers });
      } else if (request.method === 'delete') {
        await api.delete(request.url, { headers: request.headers });
      }
      console.log(`Successfully processed offline request: ${request.method} ${request.url}`);
    } catch (error) {
      console.error(`Failed to process offline request: ${request.method} ${request.url}`, error);
      // Re-queue failed requests
      offlineQueue.push(request);
    }
  }
};

// Add response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Add request interceptor for offline handling
api.interceptors.request.use(
  async config => {
    // Check if we're online
    const netInfo = await NetInfo.fetch();
    
    // If offline and this is a write operation, queue it for later
    if (!netInfo.isConnected && (config.method === 'post' || config.method === 'delete')) {
      console.log(`Offline: Queuing ${config.method} request to ${config.url}`);
      
      // Store in offline queue
      offlineQueue.push({
        method: config.method,
        url: config.url?.replace(config.baseURL || '', '') || '',
        data: config.data,
        headers: config.headers
      });
      
      // Also store in AsyncStorage for persistence
      try {
        const queueData = await AsyncStorage.getItem('offline_queue');
        const queue = queueData ? JSON.parse(queueData) : [];
        queue.push({
          method: config.method,
          url: config.url?.replace(config.baseURL || '', '') || '',
          data: config.data,
          headers: config.headers
        });
        await AsyncStorage.setItem('offline_queue', JSON.stringify(queue));
      } catch (e) {
        console.error('Failed to save offline request to AsyncStorage', e);
      }
      
      // Throw a custom error to prevent the actual request
      throw new Error('OFFLINE_QUEUED');
    }
    
    return config;
  },
  error => Promise.reject(error)
);

// Load offline queue from AsyncStorage on startup
const loadOfflineQueue = async () => {
  try {
    const queueData = await AsyncStorage.getItem('offline_queue');
    if (queueData) {
      const queue = JSON.parse(queueData);
      offlineQueue = [...queue];
      console.log(`Loaded ${offlineQueue.length} offline requests from storage`);
      
      // Try to process if we're online
      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected) {
        processOfflineQueue();
      }
    }
  } catch (e) {
    console.error('Failed to load offline queue from AsyncStorage', e);
  }
};

// Call this when the app starts
loadOfflineQueue();

// Location data interface
export interface LocationData {
  id?: string | number;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speed?: number | null;
  timestamp: number;
  deviceId?: string;
}

// Route data interface
export interface RouteData {
  id: string;
  date: string;
  duration: string;
  distance: string;
  coordinates: Array<{latitude: number; longitude: number}>;
}

// Location API endpoints
export const LocationAPI = {
  // Save a location point
  saveLocation: async (locationData: LocationData) => {
    try {
      // Add device ID if not present
      if (!locationData.deviceId) {
        locationData.deviceId = DEVICE_ID;
      }
      
      const response = await api.post<LocationData>('/user/trace-movement', locationData);
      
      // Also store locally for offline access
      try {
        const storedLocations = await AsyncStorage.getItem('local_locations');
        const locations = storedLocations ? JSON.parse(storedLocations) : [];
        locations.push({...locationData, savedAt: Date.now()});
        
        // Keep only the last 1000 locations to avoid storage issues
        if (locations.length > 1000) {
          locations.splice(0, locations.length - 1000);
        }
        
        await AsyncStorage.setItem('local_locations', JSON.stringify(locations));
      } catch (e) {
        console.error('Failed to save location to local storage', e);
      }
      
      return response;
    } catch (error) {
      // If it's our offline error, return a fake successful response
      if (error instanceof Error && error.message === 'OFFLINE_QUEUED') {
        console.log('Request queued for when online');
        return { 
          data: locationData,
          status: 200,
          statusText: 'OK (Queued)',
          headers: {},
          config: {} as any
        };
      }
      throw error;
    }
  },
  
  // Get locations between two timestamps
  getLocationsByDate: async (startTime: number, endTime: number) => {
    try {
      // Try to get from API first
      const response = await api.get<LocationData[]>(`/locations?startTime=${startTime}&endTime=${endTime}`);
      return response;
    } catch (error) {
      // If offline, fall back to local storage
      if (!isConnected) {
        console.log('Offline: Using local locations');
        try {
          const storedLocations = await AsyncStorage.getItem('local_locations');
          const allLocations = storedLocations ? JSON.parse(storedLocations) : [];
          
          // Filter by date range
          const filteredLocations = allLocations.filter(
            (loc: LocationData & {savedAt: number}) => 
              loc.timestamp >= startTime && loc.timestamp <= endTime
          );
          
          return { 
            data: filteredLocations,
            status: 200,
            statusText: 'OK (Local)',
            headers: {},
            config: {} as any
          };
        } catch (e) {
          console.error('Failed to get locations from local storage', e);
          throw e;
        }
      }
      throw error;
    }
  },
  
  // Delete locations older than a timestamp
  deleteLocations: (olderThan: number) =>
    api.delete(`/locations?olderThan=${olderThan}`)
};

export default api;
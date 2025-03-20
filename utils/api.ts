// utils/api.ts
import axios from 'axios';

// Define the base API URL - update this to your actual backend URL
const API_BASE_URL = 'http://localhost:3000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Location data interface
export interface LocationData {
  id?: string | number;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speed?: number | null;
  timestamp: number;
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
  saveLocation: (locationData: LocationData) => 
    api.post<LocationData>('/locations', locationData),
  
  // Get locations between two timestamps
  getLocationsByDate: (startTime: number, endTime: number) =>
    api.get<LocationData[]>(`/locations?startTime=${startTime}&endTime=${endTime}`),
  
  // Delete locations older than a timestamp
  deleteLocations: (olderThan: number) =>
    api.delete(`/locations?olderThan=${olderThan}`)
};

export default api;
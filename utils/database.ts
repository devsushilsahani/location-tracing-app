import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

export interface LocationData {
  id?: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  timestamp: number;
}

// Enable WebSQL for web platform
const openDatabase = () => {
  if (Platform.OS === "web") {
    // Return a mock database for web platform
    const mockDb: SQLite.WebSQLDatabase = {
      transaction: () => ({
        executeSql: () => {},
      }),
      readTransaction: () => ({
        executeSql: () => {},
      }),
      closeAsync: () => Promise.resolve(),
      deleteAsync: () => Promise.resolve(),
      exec: () => Promise.resolve([]),
      version: "1.0"
    };
    return mockDb;
  }
  return SQLite.openDatabase('locations.db');
};

// Open or create the database
const db = openDatabase();

// Initialize database tables
export const initDatabase = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(
      tx => {
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            altitude REAL,
            speed REAL,
            timestamp INTEGER NOT NULL
          );`,
          [],
          () => resolve(),
          (_, error) => {
            console.error('Database initialization error:', error);
            reject(error);
            return false;
          }
        );
      },
      error => {
        console.error('Transaction error:', error);
        reject(error);
      }
    );
  });
};

// Save location
export const saveLocation = async (location: { coords: { latitude: number; longitude: number; altitude?: number | null; speed?: number | null; }; timestamp: number }): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(
      tx => {
        tx.executeSql(
          'INSERT INTO locations (latitude, longitude, altitude, speed, timestamp) VALUES (?, ?, ?, ?, ?)',
          [
            location.coords.latitude,
            location.coords.longitude,
            location.coords.altitude || null,
            location.coords.speed || null,
            location.timestamp,
          ],
          (_, result) => resolve(),
          (_, error) => {
            console.error('Error saving location:', error);
            reject(error);
            return false;
          }
        );
      },
      error => {
        console.error('Transaction error:', error);
        reject(error);
      }
    );
  });
};

// Get locations by date
export const getLocationsByDate = async (startTime: number, endTime: number): Promise<LocationData[]> => {
  return new Promise((resolve, reject) => {
    db.transaction(
      tx => {
        tx.executeSql(
          'SELECT * FROM locations WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp ASC',
          [startTime, endTime],
          (_, { rows: { _array } }) => resolve(_array),
          (_, error) => {
            console.error('Error fetching locations:', error);
            reject(error);
            return false;
          }
        );
      },
      error => {
        console.error('Transaction error:', error);
        reject(error);
      }
    );
  });
};

// Delete old locations (optional cleanup function)
export const deleteOldLocations = async (olderThan: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(
      tx => {
        tx.executeSql(
          'DELETE FROM locations WHERE timestamp < ?',
          [olderThan],
          () => resolve(),
          (_, error) => {
            console.error('Error deleting old locations:', error);
            reject(error);
            return false;
          }
        );
      },
      error => {
        console.error('Transaction error:', error);
        reject(error);
      }
    );
  });
};

export default db;

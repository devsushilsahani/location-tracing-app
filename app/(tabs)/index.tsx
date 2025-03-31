import { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Text, Platform, ActivityIndicator, TouchableOpacity, Alert, RefreshControl, ScrollView } from 'react-native';
import MapView, { Polyline, PROVIDER_GOOGLE, Provider, Region, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useColorScheme } from 'react-native';
import { Battery, Signal, Wifi, Download, CheckCircle, AlertCircle, ZoomIn, ZoomOut, Navigation, Play, Square, RefreshCw } from 'lucide-react-native';
import * as TaskManager from 'expo-task-manager';
import { BlurView } from 'expo-blur';
import { LocationAPI } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';

const LOCATION_TRACKING = 'location-tracking';
const API_URL = 'http://192.168.120.234:3000';

// Don't try to define task if it's already defined
if (!TaskManager.isTaskDefined(LOCATION_TRACKING)) {
  TaskManager.defineTask(LOCATION_TRACKING, async ({ data, error }) => {
    if (error) {
      console.error(error);
      return;
    }
    if (data) {
      // Use a more specific type for the data
      const locationData = data as { locations: Array<Location.LocationObject> };
      const { locations } = locationData;
      const location = locations[0];
      
      // Store location using API
      try {
        await fetch(`${API_URL}/api/user/trace-movement`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'device-id': 'mobile-app-device-001'
          },
          body: JSON.stringify({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            altitude: location.coords.altitude,
            speed: location.coords.speed,
            timestamp: location.timestamp
          }),
        });
      } catch (error) {
        console.error('Failed to save location:', error);
      }
    }
  });
}

export default function TrackingScreen() {
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{latitude: number; longitude: number}>>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [esp32Status, setEsp32Status] = useState<'online' | 'offline'>('offline');
  const [lastContact, setLastContact] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [startPosition, setStartPosition] = useState<{latitude: number; longitude: number} | null>(null);
  const [retraceMode, setRetraceMode] = useState(false);
  const [distanceToStart, setDistanceToStart] = useState<number | null>(null);

  // Function to check ESP32 status
  const checkESP32Status = useCallback(async () => {
    try {
      console.log('Checking ESP32 status...');
      const response = await fetch(`${API_URL}/status`);
      const data = await response.json();
      console.log('ESP32 status response:', data);
      
      if (data.lastContact && (Date.now() - new Date(data.lastContact).getTime()) < 60000) {
        setEsp32Status('online');
        setIsConnected(true);
      } else {
        setEsp32Status('offline');
        setIsConnected(false);
        if (isTracking) {
          setIsTracking(false);
          Alert.alert('GPS Disconnected', 'GPS module is offline. Tracking has been stopped.');
        }
      }
      
      if (data.lastContact) {
        setLastContact(data.lastContact);
      }
    } catch (error) {
      console.error('Failed to check ESP32 status:', error);
      setEsp32Status('offline');
      setIsConnected(false);
      if (isTracking) {
        setIsTracking(false);
        Alert.alert('GPS Disconnected', 'Cannot connect to GPS module. Tracking has been stopped.');
      }
    }
  }, [isTracking]);

  // Refresh function
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await checkESP32Status();
    setRefreshing(false);
  }, [checkESP32Status]);

  // Check ESP32 status on component mount and periodically
  useEffect(() => {
    // Check initially
    checkESP32Status();
    
    // Set interval to check regularly
    const interval = setInterval(() => {
      checkESP32Status();
    }, 10000); // Check every 10 seconds
    
    // Exit loading state after a maximum timeout even if ESP32 is offline
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000); // Exit loading state after 5 seconds max
    
    return () => {
      clearInterval(interval);
      clearTimeout(loadingTimeout);
    };
  }, [checkESP32Status]);

  // Fetch location data from server
  useEffect(() => {
    // Function to fetch locations
    const fetchLocationData = async () => {
      try {
        const response = await fetch(`${API_URL}/api/locations`);
        const locations = await response.json();
        
        if (locations && locations.length > 0) {
          // Get the most recent location
          const latestLocation = locations[locations.length - 1];
          
          // Create a location object similar to Expo's LocationObject
          const newLocation = {
            coords: {
              latitude: latestLocation.latitude,
              longitude: latestLocation.longitude,
              altitude: latestLocation.altitude || null,
              accuracy: 5,
              altitudeAccuracy: null,
              heading: null,
              speed: latestLocation.speed || null
            },
            timestamp: new Date(latestLocation.timestamp).getTime()
          };
          
          setLocation(newLocation);
          setLoading(false); // Exit loading state once we have a location
          
          // If actively tracing, add to route
          if (isTracking) {
            const newCoord = {
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude
            };
            
            setRouteCoordinates(prevCoords => {
              // Only add if it's different from the last coordinate
              if (prevCoords.length === 0) return [newCoord];
              
              const lastCoord = prevCoords[prevCoords.length - 1];
              if (lastCoord.latitude !== newCoord.latitude || 
                  lastCoord.longitude !== newCoord.longitude) {
                return [...prevCoords, newCoord];
              }
              return prevCoords;
            });
          }
        } else {
          console.log('No location data found on server');
        }
      } catch (error) {
        console.error('Failed to fetch location data:', error);
      }
    };
    
    // Fetch immediately
    fetchLocationData();
    
    // Set up interval to fetch periodically
    const interval = setInterval(fetchLocationData, 3000); // Fetch every 3 seconds
    
    return () => clearInterval(interval);
  }, [isTracking]);

  // Request location permissions - now separate from fetching locations
  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          return;
        }

        let { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          setErrorMsg('Permission to access location in background was denied');
        }
      } catch (error) {
        console.error('Error requesting location permissions:', error);
        setErrorMsg('Failed to request location permissions');
      }
    })();
  }, []);

  // Start tracing function
  const startTracing = useCallback(async () => {
    if (!location) return;
    
    const startPos = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude
    };
    setStartPosition(startPos);
    
    setRouteCoordinates([startPos]);
    
    setIsTracking(true);
    setRetraceMode(false); // Ensure we're not in retrace mode
    
    try {
      console.log('Started active tracing at', startPos);
      Alert.alert('Tracing Started', 'Your movement is now being tracked. A marker has been placed at your starting position.');
    } catch (error) {
      console.error('Error starting tracing:', error);
      Alert.alert('Error', 'Failed to start tracing. Please try again.');
      setIsTracking(false);
    }
  }, [location]);

  // Stop tracing function
  const stopTracing = useCallback(async () => {
    if (!isTracking) return;
    
    setIsTracking(false);
    
    try {
      console.log('Stopped active tracing with', routeCoordinates.length, 'points');
      
      if (routeCoordinates.length > 1) {
        Alert.alert(
          'Tracing Complete', 
          'Do you want to retrace your steps back to the starting point?',
          [
            {
              text: 'No',
              style: 'cancel'
            },
            {
              text: 'Yes',
              onPress: () => startRetracing()
            }
          ]
        );
      } else {
        Alert.alert('Tracing Complete', 'Not enough movement was detected to create a trace.');
      }
    } catch (error) {
      console.error('Error stopping tracing:', error);
    }
  }, [routeCoordinates, isTracking]);

  // Calculate distance between two coordinates in meters
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in meters
  }, []);

  // Calculate bearing between two points
  const calculateBearing = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const λ1 = lon1 * Math.PI/180;
    const λ2 = lon2 * Math.PI/180;

    const y = Math.sin(λ2-λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2-λ1);
    const θ = Math.atan2(y, x);
    
    const bearing = (θ*180/Math.PI + 360) % 360; // in degrees
    return bearing;
  }, []);

  // Convert bearing to a direction string
  const getDirectionFromBearing = useCallback((bearing: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
    return directions[Math.round(bearing / 45)];
  }, []);

  // Start retracing function
  const startRetracing = useCallback(() => {
    if (!startPosition || routeCoordinates.length <= 1) {
      Alert.alert('Error', 'Not enough coordinates to retrace.');
      return;
    }
    
    setRetraceMode(true);
    setIsTracking(false);
    
    if (location) {
      const distance = calculateDistance(
        location.coords.latitude,
        location.coords.longitude,
        startPosition.latitude,
        startPosition.longitude
      );
      setDistanceToStart(distance);
      
      const bearing = calculateBearing(
        location.coords.latitude,
        location.coords.longitude,
        startPosition.latitude,
        startPosition.longitude
      );
      const direction = getDirectionFromBearing(bearing);
      
      Alert.alert(
        'Retracing Started', 
        `Follow the dotted line to return to your starting point. Current distance: ${Math.round(distance)}m. Head ${direction}.`
      );
      
      if (mapRef.current) {
        mapRef.current.fitToCoordinates(
          [location.coords, startPosition], 
          {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true
          }
        );
      }
    } else {
      Alert.alert('Retracing Started', 'Follow the dotted line to return to your starting point.');
    }
  }, [routeCoordinates, startPosition, location, calculateDistance, calculateBearing, getDirectionFromBearing]);

  // Update distance to start while retracing
  useEffect(() => {
    if (!retraceMode || !startPosition || !location) return;
    
    const distance = calculateDistance(
      location.coords.latitude,
      location.coords.longitude,
      startPosition.latitude,
      startPosition.longitude
    );
    setDistanceToStart(distance);
    
    if (distance < 10) { // Within 10 meters
      Alert.alert('Destination Reached', 'You have returned to your starting point!');
      setRetraceMode(false);
      setDistanceToStart(null);
    }
  }, [retraceMode, startPosition, location, calculateDistance]);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={isDark ? "#ffffff" : "#007AFF"} />
        <Text style={[styles.loadingText, isDark && styles.textDark]}>
          Initializing location tracking...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {location ? (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={(Platform.OS === 'android' ? PROVIDER_GOOGLE : null) as Provider}
            customMapStyle={isDark ? [
              {
                "elementType": "geometry",
                "stylers": [{ "color": "#242f3e" }]
              },
              {
                "elementType": "labels.text.fill",
                "stylers": [{ "color": "#746855" }]
              },
              {
                "elementType": "labels.text.stroke",
                "stylers": [{ "color": "#242f3e" }]
              },
              {
                "featureType": "water",
                "elementType": "geometry",
                "stylers": [{ "color": "#17263c" }]
              }
            ] : []}
            showsUserLocation
            followsUserLocation
            onRegionChangeComplete={(region) => {
              // Update current region
            }}
            initialRegion={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}>
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#007AFF"
              strokeWidth={3}
              lineDashPattern={retraceMode ? [5, 5] : undefined} // Dotted when retracing
            />
            
            {startPosition && (
              <Marker
                coordinate={{
                  latitude: startPosition.latitude,
                  longitude: startPosition.longitude
                }}
                title="Start Position"
                description="Your starting point"
                pinColor={retraceMode ? "green" : "red"} // Green during retracing mode
              />
            )}
          </MapView>
          
          {retraceMode && distanceToStart !== null && (
            <View style={styles.distanceContainer}>
              <Text style={styles.distanceText}>
                Distance to starting point: {Math.round(distanceToStart)} meters
              </Text>
              {location && startPosition && (
                <Text style={styles.directionText}>
                  Direction: {getDirectionFromBearing(calculateBearing(
                    location.coords.latitude,
                    location.coords.longitude,
                    startPosition.latitude,
                    startPosition.longitude
                  ))}
                </Text>
              )}
            </View>
          )}
          
          {/* Trace History View */}
          <ScrollView 
            style={styles.historyContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
              />
            }
          >
            <Text style={styles.historyTitle}>Trace History</Text>
            {routeCoordinates.length === 0 ? (
              <Text style={styles.noHistoryText}>No trace history available. Start tracing to record your path.</Text>
            ) : (
              <View>
                <Text style={styles.historyInfo}>
                  {routeCoordinates.length} points recorded
                </Text>
                {routeCoordinates.map((coord, index) => (
                  <View key={index} style={styles.historyItem}>
                    <Text style={styles.historyText}>Point {index + 1}</Text>
                    <Text style={styles.historyDetails}>
                      Lat: {coord.latitude.toFixed(6)}, Lng: {coord.longitude.toFixed(6)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.loading}>
          <Text style={[styles.loadingText, isDark && styles.textDark]}>
            {errorMsg || 'Waiting for location...'}
          </Text>
        </View>
      )}

      {/* Zoom Controls */}
      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.zoomButton} onPress={() => {
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: location!.coords.latitude,
              longitude: location!.coords.longitude,
              latitudeDelta: 0.0922 / 2,
              longitudeDelta: 0.0421 / 2,
            }, 300);
          }
        }}>
          <ZoomIn size={24} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomButton} onPress={() => {
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: location!.coords.latitude,
              longitude: location!.coords.longitude,
              latitudeDelta: 0.0922 * 2,
              longitudeDelta: 0.0421 * 2,
            }, 300);
          }
        }}>
          <ZoomOut size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Tracing Controls */}
      <BlurView
        intensity={80}
        style={styles.tracingContainer}
        tint={isDark ? 'dark' : 'light'}>
        {!isTracking && !retraceMode ? (
          <TouchableOpacity style={styles.tracingButton} onPress={startTracing}>
            <Play size={20} color="#ffffff" />
            <Text style={styles.tracingButtonText}>Start Tracing</Text>
          </TouchableOpacity>
        ) : isTracking ? (
          <TouchableOpacity style={[styles.tracingButton, styles.stopButton]} onPress={stopTracing}>
            <Square size={20} color="#ffffff" />
            <Text style={styles.tracingButtonText}>Stop Tracing</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.tracingButton, styles.retraceButton]} onPress={() => setRetraceMode(false)}>
            <Navigation size={20} color="#ffffff" />
            <Text style={styles.tracingButtonText}>End Retracing</Text>
          </TouchableOpacity>
        )}
      </BlurView>

      {/* Status bar */}
      <BlurView
        intensity={80}
        style={styles.statsContainer}
        tint={isDark ? 'dark' : 'light'}>
        <View style={styles.espStatusContainer}>
          <Signal size={20} color={esp32Status === 'online' ? (isDark ? '#34c759' : '#34c759') : '#ff3b30'} />
          <Text style={[styles.statText, isDark && styles.textDark, esp32Status === 'offline' && styles.offlineText]}>
            Neo6M GPS: {esp32Status === 'online' ? 'Online' : 'Offline'}
          </Text>
        </View>
        
        <View style={styles.lastContactContainer}>
          <Text style={[styles.statText, isDark && styles.textDark]}>
            Last Contact: {lastContact ? new Date(lastContact).toLocaleTimeString() : 'Never'}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.refreshButtonContainer, refreshing && styles.refreshingButton]} 
          onPress={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={20} color={isDark ? '#ffffff' : '#007AFF'} />
          {refreshing ? (
            <ActivityIndicator size="small" color={isDark ? "#ffffff" : "#007AFF"} style={styles.refreshingIndicator} />
          ) : (
            <Text style={[styles.refreshText, isDark && styles.textDark]}>Refresh</Text>
          )}
        </TouchableOpacity>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '60%', 
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#000',
  },
  textDark: {
    color: '#fff',
  },
  offlineText: {
    color: '#ff3b30',
  },
  readyText: {
    color: '#34c759',
  },
  zoomControls: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  zoomButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  tracingContainer: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  tracingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4cd964',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  tracingButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  statsContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  espStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastContactContainer: {
    flex: 1,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  refreshButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  refreshingButton: {
    opacity: 0.7,
  },
  refreshingIndicator: {
    marginLeft: 6,
  },
  statText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#000000',
  },
  stopButton: {
    backgroundColor: '#ff3b30',
  },
  retraceButton: {
    backgroundColor: '#007AFF',
  },
  refreshText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 6,
  },
  historyContainer: {
    flex: 1,
    height: '40%',
    backgroundColor: '#f9f9f9',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  historyInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  noHistoryText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  historyItem: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  historyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  historyDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  distanceContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  distanceText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  directionText: {
    color: '#ffffff',
    fontSize: 14,
    marginTop: 4,
  },
});
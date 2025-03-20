import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, Platform, ActivityIndicator } from 'react-native';
import MapView, { Polyline, PROVIDER_GOOGLE, Provider } from 'react-native-maps';
import * as Location from 'expo-location';
import { useColorScheme } from 'react-native';
import { Battery, Signal, Wifi } from 'lucide-react-native';
import * as TaskManager from 'expo-task-manager';
import { BlurView } from 'expo-blur';
import { LocationAPI } from '../../utils/api';

const LOCATION_TRACKING = 'location-tracking';

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
      await LocationAPI.saveLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude,
        speed: location.coords.speed,
        timestamp: location.timestamp
      });
    } catch (error) {
      console.error('Failed to save location:', error);
    }
  }
});

export default function TrackingScreen() {
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{latitude: number; longitude: number}>>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [loading, setLoading] = useState(true);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          setLoading(false);
          return;
        }

        let { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          setErrorMsg('Permission to access location in background was denied');
          setLoading(false);
          return;
        }

        await Location.startLocationUpdatesAsync(LOCATION_TRACKING, {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000,
          distanceInterval: 10,
          foregroundService: {
            notificationTitle: 'Location Tracking Active',
            notificationBody: 'Tracking your location in background',
          },
        });

        setIsTracking(true);

        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });
        setLocation(location);
        setLoading(false);
      } catch (error) {
        console.error('Error starting location tracking:', error);
        setErrorMsg('Failed to start location tracking. Please try again.');
        setLoading(false);
      }
    })();

    return () => {
      Location.stopLocationUpdatesAsync(LOCATION_TRACKING)
        .catch(error => console.error('Error stopping location tracking:', error));
    };
  }, []);

  const mapStyle = isDark ? [
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
  ] : [];

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
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={(Platform.OS === 'android' ? PROVIDER_GOOGLE : null) as Provider}
          customMapStyle={mapStyle}
          showsUserLocation
          followsUserLocation
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
          />
        </MapView>
      ) : (
        <View style={styles.loading}>
          <Text style={[styles.loadingText, isDark && styles.textDark]}>
            {errorMsg || 'Waiting for location...'}
          </Text>
        </View>
      )}

      <BlurView
        intensity={80}
        style={styles.statsContainer}
        tint={isDark ? 'dark' : 'light'}>
        <View style={styles.stat}>
          <Battery size={20} color={isDark ? '#ffffff' : '#000000'} />
          <Text style={[styles.statText, isDark && styles.textDark]}>100%</Text>
        </View>
        <View style={styles.stat}>
          <Signal size={20} color={isDark ? '#ffffff' : '#000000'} />
          <Text style={[styles.statText, isDark && styles.textDark]}>GPS</Text>
        </View>
        <View style={styles.stat}>
          <Wifi size={20} color={isDark ? '#ffffff' : '#000000'} />
          <Text style={[styles.statText, isDark && styles.textDark]}>{isTracking ? 'Tracking' : 'Offline'}</Text>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 10,
  },
  textDark: {
    color: '#ffffff',
  },
  statsContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 15,
    borderRadius: 15,
    overflow: 'hidden',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
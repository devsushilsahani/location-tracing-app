import { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { useColorScheme } from 'react-native';
import MapView, { Polyline, PROVIDER_GOOGLE, Provider } from 'react-native-maps';
import { Calendar, Clock } from 'lucide-react-native';
import { LocationAPI, LocationData } from '../../utils/api';

interface RouteData {
  id: string;
  date: string;
  duration: string;
  distance: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
}

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLocations = async () => {
      setLoading(true);
      setError(null);
      try {
        // Get start and end of selected date
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Fetch locations for the selected date
        const response = await LocationAPI.getLocationsByDate(
          startOfDay.getTime(), 
          endOfDay.getTime()
        );
        
        if (response.data.length > 0) {
          // Convert locations into route format
          const route: RouteData = {
            id: selectedDate.toISOString(),
            date: selectedDate.toISOString().split('T')[0],
            duration: calculateDuration(response.data),
            distance: calculateDistance(response.data),
            coordinates: response.data.map((loc: LocationData) => ({
              latitude: loc.latitude,
              longitude: loc.longitude
            }))
          };
          setRoutes([route]);
        } else {
          setRoutes([]);
        }
      } catch (error) {
        console.error('Failed to load locations:', error);
        setError('Failed to load location data. Please try again.');
        setRoutes([]);
      } finally {
        setLoading(false);
      }
    };

    loadLocations();
  }, [selectedDate]);

  // Helper function to calculate duration
  const calculateDuration = (locations: LocationData[]): string => {
    if (locations.length < 2) return '0m';
    const start = locations[0].timestamp;
    const end = locations[locations.length - 1].timestamp;
    const durationMs = end - start;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  // Helper function to calculate distance
  const calculateDistance = (locations: LocationData[]): string => {
    if (locations.length < 2) return '0 km';
    let distance = 0;
    for (let i = 1; i < locations.length; i++) {
      distance += calculateHaversineDistance(
        locations[i-1].latitude,
        locations[i-1].longitude,
        locations[i].latitude,
        locations[i].longitude
      );
    }
    return `${distance.toFixed(1)} km`;
  };

  // Haversine formula to calculate distance between two points
  const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const mapStyle = isDark ? [
    {
      "elementType": "geometry",
      "stylers": [{ "color": "#242f3e" }]
    },
    {
      "elementType": "labels.text.fill",
      "stylers": [{ "color": "#746855" }]
    },
  ] : [];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={isDark ? "#ffffff" : "#007AFF"} />
        <Text style={[styles.loadingText, isDark && styles.textDark]}>Loading routes...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={[styles.errorText, isDark && styles.textDark]}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => setSelectedDate(new Date(selectedDate))}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={(Platform.OS === 'android' ? PROVIDER_GOOGLE : null) as Provider}
        customMapStyle={mapStyle}
        initialRegion={{
          latitude: 37.78825,
          longitude: -122.4324,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}>
        {routes.map((route) => (
          <Polyline
            key={route.id}
            coordinates={route.coordinates}
            strokeColor="#007AFF"
            strokeWidth={3}
          />
        ))}
      </MapView>

      <ScrollView
        style={[
          styles.routesList,
          { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' },
        ]}>
        {routes.length === 0 ? (
          <View style={styles.noRoutesContainer}>
            <Text style={[styles.noRoutesText, isDark && styles.textDark]}>
              No routes found for this date
            </Text>
          </View>
        ) : (
          routes.map((route) => (
            <TouchableOpacity
              key={route.id}
              style={[
                styles.routeItem,
                { borderBottomColor: isDark ? '#333333' : '#e5e5e5' },
              ]}>
              <View style={styles.routeHeader}>
                <View style={styles.routeDate}>
                  <Calendar size={16} color={isDark ? '#ffffff' : '#000000'} />
                  <Text style={[styles.routeDateText, isDark && styles.textDark]}>
                    {route.date}
                  </Text>
                </View>
                <View style={styles.routeDuration}>
                  <Clock size={16} color={isDark ? '#ffffff' : '#000000'} />
                  <Text style={[styles.routeDurationText, isDark && styles.textDark]}>
                    {route.duration}
                  </Text>
                </View>
              </View>
              <Text style={[styles.routeDistance, isDark && styles.textDark]}>
                {route.distance}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  routesList: {
    maxHeight: 200,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
  },
  routeItem: {
    padding: 15,
    borderBottomWidth: 1,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  routeDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeDateText: {
    marginLeft: 5,
    fontSize: 14,
  },
  routeDuration: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeDurationText: {
    marginLeft: 5,
    fontSize: 14,
  },
  routeDistance: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  textDark: {
    color: '#ffffff',
  },
  noRoutesContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noRoutesText: {
    fontSize: 16,
  },
});
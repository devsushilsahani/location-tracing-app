import { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useColorScheme } from 'react-native';
import { Activity, TrendingUp, Clock, MapPin } from 'lucide-react-native';
import { LocationAPI } from '../../utils/api';

export default function AnalyticsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [stats, setStats] = useState({
    totalDistance: '0 km',
    avgSpeed: '0 km/h',
    totalTime: '0h 0m',
    locations: '0',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        // Get date range for last 30 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        // Fetch locations for the date range
        const response = await LocationAPI.getLocationsByDate(
          startDate.getTime(),
          endDate.getTime()
        );
        
        if (response.data.length > 0) {
          // Calculate analytics from location data
          const totalDistance = calculateTotalDistance(response.data);
          const avgSpeed = calculateAverageSpeed(response.data);
          const totalTime = calculateTotalTime(response.data);
          
          setStats({
            totalDistance: `${totalDistance.toFixed(1)} km`,
            avgSpeed: `${avgSpeed.toFixed(1)} km/h`,
            totalTime,
            locations: response.data.length.toString(),
          });
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
        setError('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalytics();
  }, []);
  
  // Helper function to calculate total distance
  const calculateTotalDistance = (locations: any[]): number => {
    if (locations.length < 2) return 0;
    let distance = 0;
    for (let i = 1; i < locations.length; i++) {
      distance += calculateHaversineDistance(
        locations[i-1].latitude,
        locations[i-1].longitude,
        locations[i].latitude,
        locations[i].longitude
      );
    }
    return distance;
  };
  
  // Helper function to calculate average speed
  const calculateAverageSpeed = (locations: any[]): number => {
    if (locations.length < 2) return 0;
    const speeds = locations.filter(loc => loc.speed !== null && loc.speed !== undefined);
    if (speeds.length === 0) return 0;
    const totalSpeed = speeds.reduce((sum, loc) => sum + loc.speed, 0);
    return totalSpeed / speeds.length;
  };
  
  // Helper function to calculate total time
  const calculateTotalTime = (locations: any[]): string => {
    if (locations.length < 2) return '0h 0m';
    const start = locations[0].timestamp;
    const end = locations[locations.length - 1].timestamp;
    const durationMs = end - start;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
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

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDark ? '#000000' : '#f5f5f5' }]}>
        <ActivityIndicator size="large" color={isDark ? "#ffffff" : "#007AFF"} />
        <Text style={[styles.loadingText, isDark && styles.textDark]}>
          Loading analytics...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: isDark ? '#000000' : '#f5f5f5' }]}>
        <Text style={[styles.errorText, isDark && styles.textDark]}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: isDark ? '#000000' : '#f5f5f5' },
      ]}>
      <View style={styles.header}>
        <Text style={[styles.title, isDark && styles.textDark]}>Analytics</Text>
        <Text style={[styles.subtitle, isDark && styles.textDark]}>
          Last 30 Days
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <View
          style={[
            styles.statCard,
            { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' },
          ]}>
          <Activity size={24} color={isDark ? '#ffffff' : '#000000'} />
          <Text style={[styles.statValue, isDark && styles.textDark]}>
            {stats.totalDistance}
          </Text>
          <Text style={[styles.statLabel, isDark && styles.textDark]}>
            Total Distance
          </Text>
        </View>

        <View
          style={[
            styles.statCard,
            { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' },
          ]}>
          <TrendingUp size={24} color={isDark ? '#ffffff' : '#000000'} />
          <Text style={[styles.statValue, isDark && styles.textDark]}>
            {stats.avgSpeed}
          </Text>
          <Text style={[styles.statLabel, isDark && styles.textDark]}>
            Average Speed
          </Text>
        </View>

        <View
          style={[
            styles.statCard,
            { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' },
          ]}>
          <Clock size={24} color={isDark ? '#ffffff' : '#000000'} />
          <Text style={[styles.statValue, isDark && styles.textDark]}>
            {stats.totalTime}
          </Text>
          <Text style={[styles.statLabel, isDark && styles.textDark]}>
            Total Time
          </Text>
        </View>

        <View
          style={[
            styles.statCard,
            { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' },
          ]}>
          <MapPin size={24} color={isDark ? '#ffffff' : '#000000'} />
          <Text style={[styles.statValue, isDark && styles.textDark]}>
            {stats.locations}
          </Text>
          <Text style={[styles.statLabel, isDark && styles.textDark]}>
            Locations Visited
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.chartContainer,
          { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' },
        ]}>
        <Text style={[styles.chartTitle, isDark && styles.textDark]}>
          Activity Overview
        </Text>
        {/* Add charts here using a charting library */}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    gap: 10,
  },
  statCard: {
    width: '47%',
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  statLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  chartContainer: {
    margin: 20,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  textDark: {
    color: '#ffffff',
  },
});
import { useState } from 'react';
import { View, StyleSheet, Text, Switch, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useColorScheme } from 'react-native';
import {
  Battery,
  Bell,
  Bluetooth,
  Moon,
  Shield,
  Wifi,
} from 'lucide-react-native';
import { LocationAPI } from '../../utils/api';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isClearing, setIsClearing] = useState(false);
  const [settings, setSettings] = useState({
    bluetooth: true,
    offlineMode: false,
    batteryOptimization: true,
    notifications: true,
    darkMode: isDark,
    privacyMode: false,
  });

  const updateSetting = (key: string, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const clearAllData = async () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to delete all your location data? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              // Delete all locations older than now (effectively all locations)
              await LocationAPI.deleteLocations(Date.now());
              Alert.alert('Success', 'All location data has been deleted.');
            } catch (error) {
              console.error('Failed to clear data:', error);
              Alert.alert('Error', 'Failed to clear data. Please try again.');
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#000000' : '#f5f5f5' },
      ]}>
      <Text style={[styles.title, isDark && styles.textDark]}>Settings</Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDark && styles.textDark]}>
          Device
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' },
          ]}>
          <TouchableOpacity style={styles.setting}>
            <View style={styles.settingLeft}>
              <Bluetooth size={20} color={isDark ? '#ffffff' : '#000000'} />
              <Text style={[styles.settingText, isDark && styles.textDark]}>
                Bluetooth
              </Text>
            </View>
            <Switch 
              value={settings.bluetooth} 
              onValueChange={(value) => updateSetting('bluetooth', value)}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.setting}>
            <View style={styles.settingLeft}>
              <Wifi size={20} color={isDark ? '#ffffff' : '#000000'} />
              <Text style={[styles.settingText, isDark && styles.textDark]}>
                Offline Mode
              </Text>
            </View>
            <Switch 
              value={settings.offlineMode} 
              onValueChange={(value) => updateSetting('offlineMode', value)}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.setting}>
            <View style={styles.settingLeft}>
              <Battery size={20} color={isDark ? '#ffffff' : '#000000'} />
              <Text style={[styles.settingText, isDark && styles.textDark]}>
                Battery Optimization
              </Text>
            </View>
            <Switch 
              value={settings.batteryOptimization} 
              onValueChange={(value) => updateSetting('batteryOptimization', value)}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDark && styles.textDark]}>
          Preferences
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' },
          ]}>
          <TouchableOpacity style={styles.setting}>
            <View style={styles.settingLeft}>
              <Bell size={20} color={isDark ? '#ffffff' : '#000000'} />
              <Text style={[styles.settingText, isDark && styles.textDark]}>
                Notifications
              </Text>
            </View>
            <Switch 
              value={settings.notifications} 
              onValueChange={(value) => updateSetting('notifications', value)}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.setting}>
            <View style={styles.settingLeft}>
              <Moon size={20} color={isDark ? '#ffffff' : '#000000'} />
              <Text style={[styles.settingText, isDark && styles.textDark]}>
                Dark Mode
              </Text>
            </View>
            <Switch 
              value={settings.darkMode} 
              onValueChange={(value) => updateSetting('darkMode', value)}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.setting}>
            <View style={styles.settingLeft}>
              <Shield size={20} color={isDark ? '#ffffff' : '#000000'} />
              <Text style={[styles.settingText, isDark && styles.textDark]}>
                Privacy Mode
              </Text>
            </View>
            <Switch 
              value={settings.privacyMode} 
              onValueChange={(value) => updateSetting('privacyMode', value)}
            />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.dangerButton,
          { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' },
        ]}
        onPress={clearAllData}
        disabled={isClearing}>
        {isClearing ? (
          <ActivityIndicator size="small" color="#ff3b30" />
        ) : (
          <Text style={[styles.dangerButtonText]}>Clear All Data</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  card: {
    borderRadius: 15,
    padding: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  setting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  settingText: {
    fontSize: 16,
  },
  dangerButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  dangerButtonText: {
    color: '#ff3b30',
    fontSize: 16,
    fontWeight: '600',
  },
  textDark: {
    color: '#ffffff',
  },
});
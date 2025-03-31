#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WebSocketsClient.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>
#include <time.h>

// Define GPS UART pins
#define RXD2 16  // Connect GPS TX here
#define TXD2 17  // Connect GPS RX hereee

// WiFi Credentials
const char* ssid = "SUSHIL_72"; // Replace with your actual WiFi name
const char* password = "sushil@72"; // Replace with your actual WiFi password

// Server configuration
const char* localServerAddress = "192.168.0.101"; // Your local IP address
const int localServerPort = 3000; // Port for the local test server

const char* railwayServerAddress = "location-tracing-backend-production.up.railway.app"; // Railway URL without https://

// Which server to use - set to 1 for local, 2 for Railway
int serverMode = 1; // 1=Local, 2=Railway

// HTTP API Endpoint (for sending location via HTTP POST)
const char* traceEndpoint = "/api/user/trace-movement";
 
// Device identification - CHANGE THIS to a unique ID for your device
const char* deviceId = "esp32-gps-device-001";

// Optional: If this device is associated with a specific user, set the userId
// Leave empty if this is a standalone device
const char* userId = "test-user-id"; // e.g., "test-user-id" if using test user

// WebSocket Server configuration
const char* webSocketServerHost = localServerAddress; // Using same server
const uint16_t webSocketServerPort = 8080;       // Update if your WebSocket server uses a different port
const char* webSocketPath = "/";

// BLE configuration
#define SERVICE_UUID "12345678-1234-5678-1234-56789abcdef0"
#define CHARACTERISTIC_UUID "12345678-1234-5678-1234-56789abcdef1"

// Global objects
TinyGPSPlus gps;
HardwareSerial SerialGPS(2);  // Use UART2 for GPS

WebSocketsClient webSocket;

BLEServer* pBLEServer = NULL;
BLECharacteristic* pBLECharacteristic = NULL;
bool bleDeviceConnected = false;

// For HTTP POST throttling
unsigned long lastHttpUpdate = 0;
const unsigned long httpInterval = 5000; // 5 seconds between HTTP posts

// For HTTPS connection
WiFiClientSecure *client = new WiFiClientSecure;

// For GPS fix monitoring
unsigned long gpsStartTime = 0;
unsigned long gpsTimeout = 300000; // 5 minutes max wait for first fix
bool firstFixObtained = false;

// BLE Server Callback to track connection state
class MyBLEServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    bleDeviceConnected = true;
    Serial.println("BLE Client connected");
  }
  void onDisconnect(BLEServer* pServer) {
    bleDeviceConnected = false;
    Serial.println("BLE Client disconnected");
    // Restart advertising when disconnected
    pServer->getAdvertising()->start();
  }
};

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket Disconnected!");
      break;
    case WStype_CONNECTED:
      Serial.println("WebSocket Connected!");
      break;
    case WStype_TEXT:
      Serial.printf("WebSocket Message: %s\n", payload);
      break;
    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  // Start the GPS on hardware serial 2
  SerialGPS.begin(9600, SERIAL_8N1, RXD2, TXD2);
  delay(1000);
  
  Serial.println("ESP32 GPS Tracker");
  Serial.println("=================");
  Serial.print("Connecting to WiFi network: ");
  Serial.println(ssid);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  
  // Try to connect to WiFi with timeout
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Server address: ");
    Serial.println(localServerAddress);
    if (serverMode == 1) {
      Serial.print("Server port: ");
      Serial.println(localServerPort);
      Serial.println("Using LOCAL TEST SERVER mode (HTTP)");
    } else if (serverMode == 2) {
      Serial.println("Using RAILWAY SERVER mode (HTTPS)");
    }
  } else {
    Serial.println("\nFailed to connect to WiFi after multiple attempts!");
    Serial.println("Will continue without WiFi. Check your WiFi credentials.");
  }
  
  // Initialize the BLE device
  setupBLE();
  
  // Set up secure client for HTTPS
  client = new WiFiClientSecure();
  client->setInsecure(); // Don't verify the SSL certificate - simplifies HTTPS connections
  
  // Configure NTP for time sync
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  
  Serial.println("Waiting for GPS module...");
  
  // Initialize GPS start time for timeout handling
  gpsStartTime = millis();
}

void loop() {
  // Process WebSocket events to keep the connection alive (if using WebSockets)
  // webSocket.loop();
  
  static unsigned long lastDebugTime = 0;
  static int gpsCharCount = 0;
  static unsigned long lastLocationUpdate = 0;
  static int fixAttemptCount = 0;
  
  // Read from GPS serial stream
  while (SerialGPS.available()) {
    char c = SerialGPS.read();
    gps.encode(c);
    gpsCharCount++;
  }
  
  // Debug output every 5 seconds
  if (millis() - lastDebugTime > 5000) {
    fixAttemptCount++;
    Serial.println("\n=== Status Update #" + String(fixAttemptCount) + " ===");
    Serial.print("WiFi connected: ");
    Serial.println(WiFi.status() == WL_CONNECTED ? "YES" : "NO");
    
    Serial.print("GPS running for: ");
    Serial.print((millis() - gpsStartTime) / 1000);
    Serial.println(" seconds");
    
    Serial.print("GPS chars processed: ");
    Serial.println(gpsCharCount);
    
    Serial.print("GPS satellites: ");
    Serial.println(gps.satellites.value());
    
    Serial.print("GPS location valid: ");
    Serial.println(gps.location.isValid() ? "YES" : "NO");
    
    Serial.print("GPS date valid: ");
    Serial.println(gps.date.isValid() ? "YES" : "NO");
    
    Serial.print("GPS time valid: ");
    Serial.println(gps.time.isValid() ? "YES" : "NO");
    
    if (gps.location.isValid()) {
      Serial.print("Latitude: ");
      Serial.println(gps.location.lat(), 6);
      Serial.print("Longitude: ");
      Serial.println(gps.location.lng(), 6);
      Serial.print("Altitude: ");
      Serial.println(gps.altitude.meters());
      Serial.print("Speed (km/h): ");
      Serial.println(gps.speed.kmph());
      
      if (!firstFixObtained) {
        firstFixObtained = true;
        Serial.println("*** FIRST GPS FIX OBTAINED! ***");
      }
    } else {
      // If still waiting for first fix
      if (!firstFixObtained) {
        unsigned long waitTime = millis() - gpsStartTime;
        if (waitTime > gpsTimeout) {
          Serial.println("*** WARNING: GPS fix timeout reached! ***");
          Serial.println("1. Make sure the GPS module is outdoors with clear sky view");
          Serial.println("2. Check GPS module antenna and connections");
          Serial.println("3. It may still get a fix later - will keep trying");
        } else {
          Serial.print("Waiting for GPS fix... ");
          Serial.print((gpsTimeout - waitTime) / 1000);
          Serial.println(" seconds remaining before timeout");
        }
      }
    }
    
    // Suggest troubleshooting if no satellites detected after some time
    if (fixAttemptCount > 6 && gps.satellites.value() == 0) {
      Serial.println("\n*** GPS TROUBLESHOOTING SUGGESTIONS ***");
      Serial.println("1. Take the GPS module OUTDOORS with a clear view of the sky");
      Serial.println("2. Check that the GPS module's LED is blinking");
      Serial.println("3. Verify your wiring connections:");
      Serial.println("   - GPS TX connected to ESP32 RX2 (pin 16)");
      Serial.println("   - GPS RX connected to ESP32 TX2 (pin 17)");
      Serial.println("   - GPS VCC connected to 3.3V or 5V power");
      Serial.println("   - GPS GND connected to ground");
      Serial.println("4. First fix can take 5-10 minutes on a cold start");
    }
    
    lastDebugTime = millis();
    gpsCharCount = 0;
  }
  
  // Print diagnostics every 5 seconds if no GPS fix
  if (!gps.location.isValid() && ((millis() - lastLocationUpdate) > 5000)) {
    int charsProcessed = gpsCharCount;
    gpsCharCount = 0;
    
    // Check if GPS is working at all
    if (charsProcessed == 0) {
      Serial.println("WARNING: No GPS data received! Check wiring.");
    } else {
      Serial.print("GPS chars processed: ");
      Serial.println(charsProcessed);
    }
    
    // Show GPS module stats
    Serial.print("Satellites in view: ");
    Serial.println(gps.satellites.value());
    
    Serial.print("GPS time valid: ");
    Serial.println(gps.time.isValid() ? "YES" : "NO");
    
    // Check for GPS timeout
    unsigned long timeElapsed = millis() - gpsStartTime;
    unsigned long timeRemaining = (timeElapsed < gpsTimeout) ? (gpsTimeout - timeElapsed) / 1000 : 0;
    
    if (timeElapsed > gpsTimeout) {
      Serial.println("WARNING: GPS fix timeout! The GPS module couldn't get a fix.");
      Serial.println("Possible issues:");
      Serial.println(" - GPS module needs clear view of the sky");
      Serial.println(" - Low GPS signal in current location");
      Serial.println(" - GPS module hardware issue");
      Serial.println("Will continue trying...");
    } else {
      Serial.print("Waiting for GPS fix... ");
      Serial.print(timeRemaining);
      Serial.println(" seconds remaining before timeout");
    }
    
    lastLocationUpdate = millis();
  }
  
  // When GPS location is updated and we have valid data, send data via all channels
  if (gps.location.isValid() && gps.date.isValid() && gps.time.isValid()) {
    float lat = gps.location.lat();
    float lng = gps.location.lng();
    float alt = gps.altitude.meters();
    float spd = gps.speed.kmph();
    
    String timestamp = getISOTimestamp();
    
    String locationString = String(lat, 6) + "," + String(lng, 6) + 
                           ",alt:" + String(alt, 1) + 
                           ",spd:" + String(spd, 1) +
                           ",time:" + timestamp;
    
    Serial.println("\nUpdated Location: " + locationString);
    
    // 1. Update BLE Characteristic and notify connected devices
    if (bleDeviceConnected) {
      pBLECharacteristic->setValue(locationString.c_str());
      pBLECharacteristic->notify();
    }
    
    // 2. Send location via WebSocket (if using WebSockets)
    // webSocket.sendTXT(locationString);
    
    // 3. Send location via HTTP POST every httpInterval milliseconds
    if (millis() - lastHttpUpdate > httpInterval) {
      sendHTTPUpdate(lat, lng, alt, spd, timestamp.c_str());
      lastHttpUpdate = millis();
    }
  } else if ((millis() - lastHttpUpdate) > 60000) {
    // If no valid GPS data for a minute, print status
    Serial.println("Waiting for valid GPS data...");
    Serial.print("Satellites: ");
    Serial.println(gps.satellites.value());
    lastHttpUpdate = millis();
  }
  
  // Small delay to prevent CPU overload
  delay(10);
}

String getISOTimestamp() {
  if (gps.date.isValid() && gps.time.isValid()) {
    char buffer[30];
    
    // Format: YYYY-MM-DDTHH:MM:SS.000Z
    // Note: TinyGPS++ returns year as YY (e.g., 25 for 2025)
    int year = gps.date.year();
    // Fix the year format - if it's less than 100, assume it's 2000+
    if (year < 100) {
      year += 2000;
    }
    
    sprintf(buffer, "%04d-%02d-%02dT%02d:%02d:%02d.000Z", 
            year, 
            gps.date.month(), 
            gps.date.day(),
            gps.time.hour(), 
            gps.time.minute(), 
            gps.time.second());
            
    return String(buffer);
  }
  
  // Fallback to current time if GPS time is not valid
  time_t now;
  struct tm timeinfo;
  if(!getLocalTime(&timeinfo)){
    Serial.println("Failed to obtain time");
    return "2025-01-01T00:00:00.000Z"; // Fallback timestamp
  }
  
  char buffer[30];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%S.000Z", &timeinfo);
  return String(buffer);
}

void sendHTTPUpdate(float lat, float lng, float alt, float spd, const char* timestamp) {
  if(WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url;
    
    // Decide which server to use based on serverMode
    if (serverMode == 1) {
      // Local test server (HTTP)
      url = "http://" + String(localServerAddress) + ":" + String(localServerPort) + String(traceEndpoint);
      Serial.println("\n--- Sending data to local test server ---");
      Serial.println("Initializing HTTP client for local server...");
      bool beginSuccess = http.begin(url); // Regular HTTP for local server
      if (beginSuccess) {
        Serial.println("HTTP client initialized successfully");
      } else {
        Serial.println("HTTP client initialization failed!");
        return;
      }
    } else if (serverMode == 2) {
      // Railway backend (HTTPS)
      url = "https://" + String(railwayServerAddress) + String(traceEndpoint);
      Serial.println("\n--- Sending data to Railway backend ---");
      Serial.println("Initializing HTTPS client...");
      bool beginSuccess = http.begin(*client, url); // HTTPS for Railway
      if (beginSuccess) {
        Serial.println("HTTPS client initialized successfully");
      } else {
        Serial.println("HTTPS client initialization failed!");
        return;
      }
    }
    
    Serial.println("Server URL: " + url);
    
    // Set headers
    http.addHeader("Content-Type", "application/json");
    if (userId && strlen(userId) > 0) {
      http.addHeader("user-id", userId);
      Serial.println("Adding user-id header: " + String(userId));
    }
    http.addHeader("device-id", deviceId);
    Serial.println("Adding device-id header: " + String(deviceId));
    
    // Create JSON payload
    String jsonPayload = "{";
    jsonPayload += "\"latitude\": " + String(lat, 6) + ", ";
    jsonPayload += "\"longitude\": " + String(lng, 6) + ", ";
    jsonPayload += "\"altitude\": " + String(alt, 1) + ", ";
    jsonPayload += "\"speed\": " + String(spd, 1) + ", ";
    jsonPayload += "\"timestamp\": \"" + String(timestamp) + "\", ";
    jsonPayload += "\"deviceId\": \"" + String(deviceId) + "\"";
    jsonPayload += "}";
    
    Serial.println("Payload: " + jsonPayload);
    
    // Send the POST request
    int httpResponseCode = http.POST(jsonPayload);
    
    if(httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("HTTP Response Code: " + String(httpResponseCode));
      Serial.println("Response: " + response);
      if (httpResponseCode >= 200 && httpResponseCode < 300) {
        Serial.println("✅ Data sent successfully!");
      } else {
        Serial.println("❌ Server returned error code");
      }
    } else {
      Serial.print("HTTP POST Failed, Error: ");
      Serial.println(http.errorToString(httpResponseCode));
      Serial.println("❌ Failed to send data to server");
      
      // If Railway failed, try switching to local server next time
      if (serverMode == 2) {
        Serial.println("Will try local server on next update");
        serverMode = 1;
      }
    }
    
    http.end();
  } else {
    Serial.println("\n❌ WiFi not connected for HTTP POST");
    Serial.println("Attempting to reconnect to WiFi...");
    // Try to reconnect
    WiFi.begin(ssid, password);
    int reconnectAttempts = 0;
    while (WiFi.status() != WL_CONNECTED && reconnectAttempts < 10) {
      delay(500);
      Serial.print(".");
      reconnectAttempts++;
    }
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\n✅ Reconnected to WiFi!");
    } else {
      Serial.println("\n❌ Failed to reconnect to WiFi");
    }
  }
}

void setupBLE() {
  BLEDevice::init("ESP32_GPS_Tracker");
  pBLEServer = BLEDevice::createServer();
  pBLEServer->setCallbacks(new MyBLEServerCallbacks());
  BLEService *pService = pBLEServer->createService(SERVICE_UUID);
  pBLECharacteristic = pService->createCharacteristic(
                        CHARACTERISTIC_UUID,
                        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
                      );
  pBLECharacteristic->addDescriptor(new BLE2902());
  pService->start();
  pBLEServer->getAdvertising()->start();
  Serial.println("BLE Advertising Started");
}

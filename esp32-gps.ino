#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>
#include <time.h>

// Define GPS UART pins
#define RXD2 16  // Connect GPS TX here
#define TXD2 17  // Connect GPS RX here

// WiFi Credentials
const char* ssid = "location";
const char* password = "gpsmodule";

// Server configuration
const char* serverAddress = "your-server-ip-or-domain"; // CHANGE THIS - Replace with your actual server IP/domain
const int serverPort = 3000;

// HTTP API Endpoint (for sending location via HTTP POST)
const char* traceEndpoint = "/api/user/trace-movement";
 
// Device identification - CHANGE THIS to a unique ID for your device
const char* deviceId = "esp32-gps-device-001";

// Optional: If this device is associated with a specific user, set the userId
// Leave empty if this is a standalone device
const char* userId = ""; // e.g., "test-user-id" if using test user

// WebSocket Server configuration
const char* webSocketServerHost = serverAddress; // Using same server
const uint16_t webSocketServerPort = 8080;       // Update if your WebSocket server uses a different port
const char* webSocketPath = "/";

// BLE configuration
#define SERVICE_UUID "12345678-1234-5678-1234-56789abcdef0"
#define CHARACTERISTIC_UUID "12345678-1234-5678-1234-56789abcdef1"

// Global objects
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);  // Use UART2 for GPS

WebSocketsClient webSocket;

BLEServer* pBLEServer = NULL;
BLECharacteristic* pBLECharacteristic = NULL;
bool bleDeviceConnected = false;

// For HTTP POST throttling
unsigned long lastHttpUpdate = 0;
const unsigned long httpInterval = 5000; // 5 seconds between HTTP posts

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
  gpsSerial.begin(9600, SERIAL_8N1, RXD2, TXD2);
  
  // Connect to WiFi
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  while(WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(1000);
  }
  Serial.println("\nConnected to WiFi!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  // Setup BLE
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

  // Setup WebSocket (optional)
  // Uncomment if you're using WebSockets on your server
  /*
  webSocket.begin(webSocketServerHost, webSocketServerPort, webSocketPath);
  webSocket.onEvent(webSocketEvent);
  Serial.println("WebSocket Initialized");
  */
}

void loop() {
  // Process WebSocket events to keep the connection alive (if using WebSockets)
  // webSocket.loop();
  
  // Read from GPS serial stream
  while (gpsSerial.available()) {
    char c = gpsSerial.read();
    gps.encode(c);
  }
  
  // When GPS location is updated and we have valid data, send data via all channels
  if (gps.location.isValid() && gps.date.isValid() && gps.time.isValid()) {
    float lat = gps.location.lat();
    float lng = gps.location.lng();
    float alt = gps.altitude.meters();
    float spd = gps.speed.kmph();
    
    // Create timestamp from GPS date and time
    char timestamp[30];
    sprintf(timestamp, "20%02d-%02d-%02dT%02d:%02d:%02d.000Z", 
      gps.date.year(), 
      gps.date.month(), 
      gps.date.day(),
      gps.time.hour(),
      gps.time.minute(),
      gps.time.second());
    
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
      sendHTTPUpdate(lat, lng, alt, spd, timestamp);
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

void sendHTTPUpdate(float lat, float lng, float alt, float spd, const char* timestamp) {
  if(WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    
    // Construct the full URL
    String url = "http://" + String(serverAddress) + ":" + String(serverPort) + String(traceEndpoint);
    http.begin(url);
    
    // Set headers
    http.addHeader("Content-Type", "application/json");
    if (userId && strlen(userId) > 0) {
      http.addHeader("user-id", userId);
    }
    http.addHeader("device-id", deviceId);
    
    // Create JSON payload
    String jsonPayload = "{";
    jsonPayload += "\"latitude\": " + String(lat, 6) + ", ";
    jsonPayload += "\"longitude\": " + String(lng, 6) + ", ";
    jsonPayload += "\"altitude\": " + String(alt, 1) + ", ";
    jsonPayload += "\"speed\": " + String(spd, 1) + ", ";
    jsonPayload += "\"timestamp\": \"" + String(timestamp) + "\", ";
    jsonPayload += "\"deviceId\": \"" + String(deviceId) + "\"";
    jsonPayload += "}";
    
    // Send the POST request
    int httpResponseCode = http.POST(jsonPayload);
    
    if(httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("HTTP Response: " + String(httpResponseCode));
      Serial.println(response);
    } else {
      Serial.print("HTTP POST Failed, Error: ");
      Serial.println(http.errorToString(httpResponseCode));
    }
    
    http.end();
  } else {
    Serial.println("WiFi not connected for HTTP POST");
    // Try to reconnect
    WiFi.begin(ssid, password);
  }
}

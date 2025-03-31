#include <WiFi.h>
#include <HTTPClient.h>

// WiFi Credentials
const char* ssid = "SUSHIL_72"; // Your WiFi name
const char* password = "sushil@72"; // Your WiFi password

// Server configuration - Local test server
const char* serverAddress = "192.168.1.100"; // Your computer's IP address
const int serverPort = 3000;

// HTTP API Endpoint
const char* endpoint = "/api/user/trace-movement";

// Device ID
const char* deviceId = "esp32-gps-device-001";

// Test data (simulated GPS coordinates for Mumbai)
const float testLat = 19.0222;
const float testLng = 72.8753;
const float testAlt = 10.0;
const float testSpeed = 5.0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n=== ESP32 Simple HTTP Test ===");
  Serial.println("This sketch tests HTTP connectivity without GPS");
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  
  // Wait for connection
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
    Serial.print("Server: ");
    Serial.print(serverAddress);
    Serial.print(":");
    Serial.println(serverPort);
  } else {
    Serial.println("\nFailed to connect to WiFi!");
  }
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    // Send HTTP request every 10 seconds
    sendHTTPRequest();
    delay(10000);
  } else {
    Serial.println("WiFi not connected. Reconnecting...");
    WiFi.begin(ssid, password);
    delay(5000);
  }
}

void sendHTTPRequest() {
  HTTPClient http;
  
  // Construct the URL with port
  String url = "http://" + String(serverAddress) + ":" + String(serverPort) + String(endpoint);
  
  Serial.println("\n--- Sending HTTP request ---");
  Serial.println("URL: " + url);
  
  // Begin HTTP connection
  Serial.println("Initializing HTTP client...");
  bool beginSuccess = http.begin(url);
  
  if (!beginSuccess) {
    Serial.println("Failed to initialize HTTP client!");
    return;
  }
  
  Serial.println("HTTP client initialized successfully");
  
  // Set headers
  http.addHeader("Content-Type", "application/json");
  http.addHeader("device-id", deviceId);
  
  // Create JSON payload with test data
  String timestamp = "2025-03-21T" + String(random(10, 23)) + ":" + String(random(10, 59)) + ":00.000Z";
  
  String jsonPayload = "{";
  jsonPayload += "\"latitude\": " + String(testLat + (random(-100, 100) / 10000.0), 6) + ", ";
  jsonPayload += "\"longitude\": " + String(testLng + (random(-100, 100) / 10000.0), 6) + ", ";
  jsonPayload += "\"altitude\": " + String(testAlt, 1) + ", ";
  jsonPayload += "\"speed\": " + String(testSpeed, 1) + ", ";
  jsonPayload += "\"timestamp\": \"" + timestamp + "\", ";
  jsonPayload += "\"deviceId\": \"" + String(deviceId) + "\"";
  jsonPayload += "}";
  
  Serial.println("Payload: " + jsonPayload);
  
  // Send the POST request
  int httpResponseCode = http.POST(jsonPayload);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("HTTP Response code: " + String(httpResponseCode));
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
  }
  
  http.end();
}

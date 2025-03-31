const os = require('os');

function getLocalIP() {
  const networkInterfaces = os.networkInterfaces();
  let ipAddress = '';
  
  console.log('Available network interfaces:');
  
  // Loop through network interfaces
  Object.keys(networkInterfaces).forEach((interfaceName) => {
    const interfaces = networkInterfaces[interfaceName];
    
    console.log(`\nInterface: ${interfaceName}`);
    
    // Loop through interfaces
    interfaces.forEach((iface) => {
      // Skip internal and non-IPv4 addresses
      if (!iface.internal && iface.family === 'IPv4') {
        console.log(`  IPv4 Address: ${iface.address} (Likely the one you need)`);
        ipAddress = iface.address;
      } else {
        console.log(`  ${iface.family} Address: ${iface.address} ${iface.internal ? '(internal)' : ''}`);
      }
    });
  });
  
  return ipAddress;
}

const localIP = getLocalIP();

console.log('\n==========================');
console.log(' ESP32 CONNECTION DETAILS ');
console.log('==========================');
console.log(`Your local IP address is: ${localIP || 'Not found'}`);

if (localIP) {
  console.log('\nTo configure your ESP32 to connect to your local test server:');
  console.log('1. Update your ESP32 code with these settings:');
  console.log(`   const char* serverAddress = "${localIP}";`);
  console.log('   const int serverPort = 3000;');
  console.log('   const bool useWebhook = false;');
  console.log('\n2. Upload the modified code to your ESP32');
  console.log('3. View your ESP32 data at http://localhost:3000');
} else {
  console.log('\nCould not determine your local IP address.');
  console.log('Please check your network connection and try again.');
}

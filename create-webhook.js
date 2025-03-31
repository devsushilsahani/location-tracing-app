const fetch = require('node-fetch');

async function createWebhook() {
  try {
    console.log("Creating a new webhook for testing...");
    
    // This API generates a new webhook URL
    const response = await fetch('https://webhook.site/token', {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log("\n=== YOUR WEBHOOK INFO ===");
    console.log(`Your webhook URL: http://webhook.site${data.path}`);
    console.log(`Your webhook token: ${data.uuid}`);
    console.log("\n=== INSTRUCTIONS ===");
    console.log("1. Update your ESP32 code with this information:");
    console.log(`   const char* webhookAddress = "webhook.site";`);
    console.log(`   const char* webhookPath = "${data.path}";`);
    console.log("2. Upload the updated code to your ESP32");
    console.log("3. Monitor incoming requests at:");
    console.log(`   https://webhook.site/${data.uuid}`);
    console.log("\nThis webhook will stay active for a few hours, so you can use it for testing.");
    
  } catch (error) {
    console.error("Error creating webhook:", error);
  }
}

createWebhook();

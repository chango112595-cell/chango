// Test script to verify MCP endpoints

const PORT = process.env.PORT || 5000;
const TOKEN = process.env.MCP_TOKEN || 'mcp-connect-chatgpt';

console.log(`Testing MCP endpoints on port ${PORT} with token ${TOKEN}`);

async function test() {
  try {
    // Test discovery endpoint
    console.log('\n1. Testing GET /mcp (discovery)...');
    const discoveryResponse = await fetch(`http://localhost:${PORT}/mcp?token=${TOKEN}`);
    if (discoveryResponse.status === 403) {
      console.log('  ✗ Authentication failed - check MCP_TOKEN');
      return;
    }
    const discoveryData = await discoveryResponse.json();
    console.log('  ✓ Discovery response:', JSON.stringify(discoveryData, null, 2));

    // Test write_file endpoint
    console.log('\n2. Testing POST /mcp/write_file...');
    const writeResponse = await fetch(`http://localhost:${PORT}/mcp/write_file?token=${TOKEN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: 'test.txt',
        content: 'Hello from MCP test!'
      })
    });
    const writeData = await writeResponse.json();
    console.log('  ✓ Write response:', JSON.stringify(writeData, null, 2));

    // Test with Bearer token
    console.log('\n3. Testing with Bearer token...');
    const bearerResponse = await fetch(`http://localhost:${PORT}/mcp`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    const bearerData = await bearerResponse.json();
    console.log('  ✓ Bearer auth response:', JSON.stringify(bearerData, null, 2));

    // Test invalid auth
    console.log('\n4. Testing invalid auth...');
    const invalidResponse = await fetch(`http://localhost:${PORT}/mcp?token=wrong`);
    console.log('  ✓ Invalid auth status:', invalidResponse.status, '(should be 403)');

    console.log('\n✅ All MCP tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Wait a moment for server to be ready
setTimeout(test, 2000);
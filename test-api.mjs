import fetch from 'node-fetch';
import fs from 'fs';

async function testEndpoint() {
  const testData = {
    accent: "british",
    score: 0.85,
    feedback: "Great pronunciation!",
    user: "test_user",
    timestamp: new Date().toISOString()
  };

  try {
    console.log('Sending request to /api/accent_feedback...');
    const response = await fetch('http://localhost:5000/api/accent_feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const responseText = await response.text();
    console.log('Status:', response.status);
    console.log('Response headers:', response.headers.get('content-type'));
    
    // Try to parse as JSON if it looks like JSON
    if (responseText.startsWith('{') || responseText.startsWith('[')) {
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log('Response (JSON):', jsonResponse);
      } catch (e) {
        console.log('Response (text):', responseText.substring(0, 100));
      }
    } else {
      console.log('Response (text):', responseText.substring(0, 200));
    }

    // Check if file was created
    setTimeout(() => {
      const filePath = 'data/accents_log.jsonl';
      if (fs.existsSync(filePath)) {
        console.log('\n✓ File created successfully!');
        console.log('File contents:');
        console.log(fs.readFileSync(filePath, 'utf8'));
      } else {
        console.log('\n✗ File not found at', filePath);
        // Check if data directory exists
        if (fs.existsSync('data')) {
          console.log('  Data directory exists');
          const files = fs.readdirSync('data');
          console.log('  Files in data directory:', files);
        } else {
          console.log('  Data directory does not exist');
        }
      }
    }, 1000);

  } catch (error) {
    console.error('Error:', error);
  }
}

testEndpoint();
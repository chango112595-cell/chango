import http from 'http';
import fs from 'fs';

const data = JSON.stringify({
  accent: "british",
  score: 0.85,
  feedback: "Great pronunciation!",
  user: "test_user"
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/accent_feedback',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:', responseData);
    
    // Now check if the file was created
    const filePath = 'data/accents_log.jsonl';
    
    if (fs.existsSync(filePath)) {
      console.log('\nFile created successfully!');
      console.log('File contents:');
      console.log(fs.readFileSync(filePath, 'utf8'));
    } else {
      console.log('\nFile not found at', filePath);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
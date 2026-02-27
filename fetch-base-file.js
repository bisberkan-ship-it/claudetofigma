const https = require('https');
const TOKEN = process.env.FIGMA_TOKEN;

// First, get the team/project info from the known file
const FILE_KEY = 'AvviE6CV0aUug9xfQgqgNi';

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.figma.com',
      path: path,
      method: 'GET',
      headers: { 'X-Figma-Token': TOKEN }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`${res.statusCode}: ${data.substring(0, 300)}`));
          return;
        }
        resolve(JSON.parse(data));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Step 1: Get project info from known file
  console.log('Step 1: Getting project info from known file...');
  try {
    const fileData = await apiGet(`/v1/files/${FILE_KEY}?depth=1`);
    console.log('File:', fileData.name);
    // No direct project info from file endpoint, try projects approach
  } catch (e) {
    console.log('Error:', e.message);
  }

  // Step 2: Try to get team projects - we need team ID
  // Let's search for the file in recent files or try known patterns
  // The file name pattern suggests it might be in the same project

  // Step 3: Try to find _FellowKit [00 Base] by searching team files
  // First let's check if we can get project files
  console.log('\nStep 2: Getting project files...');
  try {
    const projects = await apiGet(`/v1/files/${FILE_KEY}/projects`);
    console.log('Projects:', JSON.stringify(projects, null, 2));
  } catch (e) {
    // This endpoint doesn't exist, let's try another way
    console.log('Projects endpoint not available');
  }

  // Try to get the file directly if we know its key
  // Let's check team library to find the base file
  console.log('\nStep 3: Checking team library styles from current file...');
  try {
    const styles = await apiGet(`/v1/files/${FILE_KEY}/styles`);
    console.log('Styles count:', styles.meta?.styles?.length || 0);
    if (styles.meta?.styles?.length > 0) {
      // Show first few styles to understand the structure
      styles.meta.styles.slice(0, 5).forEach(s => {
        console.log(`  Style: ${s.name} (${s.style_type}) key:${s.key}`);
      });
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}

main();

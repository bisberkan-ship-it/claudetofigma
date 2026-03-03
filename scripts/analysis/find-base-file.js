const https = require('https');
const TOKEN = process.env.FIGMA_TOKEN;
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
          reject(new Error(`${res.statusCode}: ${data.substring(0, 500)}`));
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
  // Step 1: Get variables from the current Register file
  // Variables might be referenced from the base file
  console.log('=== Step 1: Local variables in Register file ===');
  try {
    const vars = await apiGet(`/v1/files/${FILE_KEY}/variables/local`);
    console.log('Variable collections:', Object.keys(vars.meta?.variableCollections || {}).length);
    for (const [id, col] of Object.entries(vars.meta?.variableCollections || {})) {
      console.log(`\nCollection: "${col.name}" (${col.id})`);
      console.log(`  Modes:`, col.modes?.map(m => m.name).join(', '));
      console.log(`  Variable count:`, col.variableIds?.length || 0);
    }
    // Show variables
    const variables = vars.meta?.variables || {};
    for (const [vid, v] of Object.entries(variables)) {
      if (v.name.toLowerCase().includes('color') || v.resolvedType === 'COLOR') {
        console.log(`  VAR: ${v.name} (${v.resolvedType}) collection:${v.variableCollectionId}`);
        if (v.valuesByMode) {
          for (const [modeId, val] of Object.entries(v.valuesByMode)) {
            console.log(`    Mode ${modeId}:`, JSON.stringify(val));
          }
        }
      }
    }
  } catch (e) {
    console.log('Error:', e.message);
  }

  // Step 2: Get published variables (from libraries)
  console.log('\n=== Step 2: Published variables ===');
  try {
    const pubVars = await apiGet(`/v1/files/${FILE_KEY}/variables/published`);
    console.log('Published collections:', Object.keys(pubVars.meta?.variableCollections || {}).length);
    for (const [id, col] of Object.entries(pubVars.meta?.variableCollections || {})) {
      console.log(`\nPublished Collection: "${col.name}" (${col.id})`);
    }
  } catch (e) {
    console.log('Error:', e.message);
  }

  // Step 3: Try to get the file key from variable references
  console.log('\n=== Step 3: Check variable references ===');
  try {
    const vars = await apiGet(`/v1/files/${FILE_KEY}/variables/local`);
    const variables = vars.meta?.variables || {};
    // Look for alias references pointing to external files
    for (const [vid, v] of Object.entries(variables)) {
      if (v.valuesByMode) {
        for (const [modeId, val] of Object.entries(v.valuesByMode)) {
          if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
            console.log(`  Alias: ${v.name} -> ${val.id}`);
          }
        }
      }
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}

main();

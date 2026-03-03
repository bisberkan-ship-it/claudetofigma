const https = require('https');
const TOKEN = process.env.FIGMA_TOKEN;

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

function rgbToHex(r, g, b) {
  const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

async function main() {
  // First verify this is the right file
  const LIB_KEY = 'y0fqsC9RIiddun3581BQhH';

  console.log('=== Checking library file ===');
  const fileInfo = await apiGet(`/v1/files/${LIB_KEY}?depth=1`);
  console.log('File name:', fileInfo.name);
  console.log('Pages:', fileInfo.document.children.map(p => p.name).join(', '));

  // Get all variables
  console.log('\n=== Fetching variables ===');
  const vars = await apiGet(`/v1/files/${LIB_KEY}/variables/local`);
  const collections = vars.meta?.variableCollections || {};
  const variables = vars.meta?.variables || {};

  console.log(`Total collections: ${Object.keys(collections).length}`);
  console.log(`Total variables: ${Object.keys(variables).length}`);

  // List all collections
  for (const [colId, col] of Object.entries(collections)) {
    console.log(`\n📁 Collection: "${col.name}" (${col.variableIds?.length || 0} variables)`);
    console.log(`   Modes: ${col.modes?.map(m => m.name).join(', ')}`);
  }

  // Find Flagship Colors collection
  console.log('\n\n========================================');
  console.log('🎨 Flagship Colors - Detailed Analysis');
  console.log('========================================\n');

  for (const [colId, col] of Object.entries(collections)) {
    if (!col.name.includes('Flagship') && !col.name.includes('Color') && !col.name.includes('flagship') && !col.name.includes('color')) continue;

    console.log(`Collection: "${col.name}"`);
    console.log(`Modes: ${col.modes?.map(m => `${m.name} (${m.modeId})`).join(' | ')}`);
    console.log('─'.repeat(60));

    let currentGroup = '';
    for (const varId of col.variableIds || []) {
      const v = variables[varId];
      if (!v) continue;

      // Group by path prefix
      const parts = v.name.split('/');
      const group = parts.length > 1 ? parts[0] : '';
      if (group !== currentGroup) {
        currentGroup = group;
        console.log(`\n  ── ${group || 'Root'} ──`);
      }

      let line = `  ${v.name}`;
      if (v.description) line += ` (${v.description})`;
      console.log(line);

      for (const mode of col.modes || []) {
        const val = v.valuesByMode?.[mode.modeId];
        if (!val) continue;

        if (val.type === 'VARIABLE_ALIAS') {
          const refVar = variables[val.id];
          console.log(`    ${mode.name}: → ${refVar?.name || val.id}`);
        } else if (val.r !== undefined) {
          const hex = rgbToHex(val.r, val.g, val.b);
          const alpha = val.a !== undefined && val.a < 1 ? ` (${Math.round(val.a * 100)}%)` : '';
          console.log(`    ${mode.name}: ${hex}${alpha}`);
        } else {
          console.log(`    ${mode.name}: ${JSON.stringify(val)}`);
        }
      }
    }
  }

  // If no "Flagship Colors" found in variables, check all COLOR variables
  const colorVars = Object.values(variables).filter(v => v.resolvedType === 'COLOR');
  if (colorVars.length === 0) {
    console.log('\nNo COLOR variables found. Checking published variables...');
    try {
      const pubVars = await apiGet(`/v1/files/${LIB_KEY}/variables/published`);
      const pubCollections = pubVars.meta?.variableCollections || {};
      const pubVariables = pubVars.meta?.variables || {};

      console.log(`Published collections: ${Object.keys(pubCollections).length}`);
      console.log(`Published variables: ${Object.keys(pubVariables).length}`);

      for (const [colId, col] of Object.entries(pubCollections)) {
        console.log(`\n📁 Published: "${col.name}" (${col.variableIds?.length || 0} variables)`);
        console.log(`   Modes: ${col.modes?.map(m => m.name).join(', ')}`);
      }
    } catch(e) {
      console.log('Published vars error:', e.message);
    }
  }
}

main().catch(e => console.error('Fatal:', e));

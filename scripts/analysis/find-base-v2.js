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
  // Get ALL remote components from full Register file
  const fullNodes = await apiGet('/v1/files/AvviE6CV0aUug9xfQgqgNi/nodes?ids=1:9995&depth=1');
  const allComponents = fullNodes.nodes['1:9995']?.components || {};
  const remoteComps = Object.entries(allComponents).filter(([id, c]) => c.remote);
  console.log(`Remote components: ${remoteComps.length}`);

  // Find all unique source files
  const fileKeys = new Set();
  fileKeys.add('y0fqsC9RIiddun3581BQhH'); // Already found TopNav

  for (const [id, comp] of remoteComps) {
    try {
      const info = await apiGet(`/v1/components/${comp.key}`);
      const fk = info.meta?.file_key;
      if (fk && !fileKeys.has(fk)) {
        fileKeys.add(fk);
        const fInfo = await apiGet(`/v1/files/${fk}?depth=1`);
        console.log(`\nFile: "${fInfo.name}" (${fk})`);

        if (fInfo.name.includes('Base') || fInfo.name.includes('00')) {
          console.log('>>> BASE FILE FOUND! <<<');
          await analyzeVariables(fk);
          return;
        }
      }
    } catch(e) {
      // skip
    }
  }

  // If not found via remote components, try published variables approach
  // Check all found files for the Flagship Colors collection
  console.log('\n\nAll unique source files:', [...fileKeys]);
  console.log('\nChecking each file for Flagship Colors...');

  for (const fk of fileKeys) {
    try {
      const vars = await apiGet(`/v1/files/${fk}/variables/local`);
      const cols = vars.meta?.variableCollections || {};
      for (const [id, col] of Object.entries(cols)) {
        if (col.name.toLowerCase().includes('flagship')) {
          const fInfo = await apiGet(`/v1/files/${fk}?depth=1`);
          console.log(`\nFOUND Flagship in: "${fInfo.name}" (${fk})`);
          await analyzeVariables(fk);
          return;
        }
      }
    } catch(e) {}
  }

  // If still not found, the base file might not be directly referenced
  // Try to find it via the variable collection hash
  console.log('\n\nBase file not found through component tracing.');
  console.log('The variable collection hash 4829f89e68f92a7e6b770146eaa48120e6653922 is shared across files.');
  console.log('Let me check the TopNav file for Flagship Colors since it shares the same token system...');

  await analyzeVariables('y0fqsC9RIiddun3581BQhH');
}

async function analyzeVariables(fileKey) {
  const vars = await apiGet(`/v1/files/${fileKey}/variables/local`);
  const collections = vars.meta?.variableCollections || {};
  const variables = vars.meta?.variables || {};

  console.log(`\nTotal collections: ${Object.keys(collections).length}`);

  for (const [colId, col] of Object.entries(collections)) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📁 ${col.name}`);
    console.log(`   Modes: ${col.modes?.map(m => m.name).join(', ')}`);
    console.log(`   Variables: ${col.variableIds?.length || 0}`);
    console.log('='.repeat(60));

    let currentGroup = '';
    for (const varId of col.variableIds || []) {
      const v = variables[varId];
      if (!v || v.resolvedType !== 'COLOR') continue;

      const parts = v.name.split('/');
      const group = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
      if (group !== currentGroup) {
        currentGroup = group;
        console.log(`\n  ── ${group || 'Ungrouped'} ──`);
      }

      console.log(`  ${v.name}${v.description ? ' (' + v.description + ')' : ''}`);
      for (const mode of col.modes || []) {
        const val = v.valuesByMode?.[mode.modeId];
        if (!val) continue;
        if (val.type === 'VARIABLE_ALIAS') {
          const ref = variables[val.id];
          console.log(`    ${mode.name}: → ${ref?.name || val.id}`);
        } else if (val.r !== undefined) {
          const hex = rgbToHex(val.r, val.g, val.b);
          const alpha = val.a !== undefined && val.a < 1 ? ` (${Math.round(val.a * 100)}%)` : '';
          console.log(`    ${mode.name}: ${hex}${alpha}`);
        }
      }
    }
  }
}

main().catch(e => console.error('Fatal:', e));

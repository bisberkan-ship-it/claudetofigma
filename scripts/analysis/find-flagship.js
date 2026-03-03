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

function rgbToHex(r, g, b) {
  const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

async function main() {
  // The variable collection ID contains a hash prefix that identifies the source file
  // VariableCollectionId:4829f89e68f92a7e6b770146eaa48120e6653922/...
  // This hash is the file key for the library file

  // Let's try to find the base file by looking at component references
  // from the imported SSO Account instances
  console.log('=== Looking for _FellowKit [00 Base] file ===\n');

  // Get all variables including remote/library ones
  // The /v1/files/:key/variables/local only gives local vars
  // We need to find the source file key

  // From the variable collection ID: 4829f89e68f92a7e6b770146eaa48120e6653922
  // This could be the source file's internal ID

  // Let's try to get the file's full node tree and find component references
  // that point to the base file
  const fileData = await apiGet(`/v1/files/${FILE_KEY}?depth=1&plugin_data=shared`);
  console.log('File:', fileData.name);
  console.log('Version:', fileData.version);
  console.log('Schema:', fileData.schemaVersion);

  // Check if there's branch/mainFileKey info
  if (fileData.mainFileKey) console.log('Main file key:', fileData.mainFileKey);
  if (fileData.branches) console.log('Branches:', fileData.branches);

  // Let's get components to find library references
  console.log('\n=== Component references ===');
  const comps = await apiGet(`/v1/files/${FILE_KEY}/components`);
  if (comps.meta?.components?.length > 0) {
    const uniqueFiles = new Set();
    comps.meta.components.forEach(c => {
      if (c.containing_frame?.containingStateGroup) {
        uniqueFiles.add(c.containing_frame.containingStateGroup.nodeId);
      }
    });
    console.log('Components count:', comps.meta.components.length);
  }

  // Let's try to search recent files or team files
  // Use /v1/me to find user info first
  console.log('\n=== User info ===');
  const me = await apiGet('/v1/me');
  console.log('User:', me.handle, '| Email:', me.email);

  // Get team projects
  if (me.teams) {
    for (const team of me.teams) {
      console.log(`\nTeam: ${team.name} (${team.id})`);
    }
  }

  // Try to find projects through teams endpoint
  console.log('\n=== Looking for team projects ===');
  // We know the variable collection references file hash: 4829f89e68f92a7e6b770146eaa48120e6653922
  // Let's check the node tree for external component file_key references

  const nodesData = await apiGet(`/v1/files/${FILE_KEY}/nodes?ids=1:9996&depth=1`);
  const nodeComponents = nodesData.nodes['1:9996']?.components || {};
  console.log('\nReferenced components count:', Object.keys(nodeComponents).length);

  // Check for component sets
  const nodeSets = nodesData.nodes['1:9996']?.componentSets || {};
  console.log('Referenced component sets:', Object.keys(nodeSets).length);

  // Show unique component keys to trace back to files
  const keys = Object.values(nodeComponents).map(c => c.key).filter(Boolean).slice(0, 5);
  console.log('Sample keys:', keys);

  // Now try searching for the base file directly
  // Common approach: check user's recent files
  console.log('\n=== Searching for _FellowKit base file ===');
  try {
    // Try to get the team projects
    const teams = await apiGet('/v1/me');
    // We don't have direct access to search, but we can try known file patterns
    // Let's check if we can access files by traversing projects
  } catch(e) {}

  // Display local variables analysis as the primary output
  console.log('\n\n========================================');
  console.log('=== 01-Color Tokens Analysis ===');
  console.log('========================================\n');

  const vars = await apiGet(`/v1/files/${FILE_KEY}/variables/local`);
  const collections = vars.meta?.variableCollections || {};
  const variables = vars.meta?.variables || {};

  for (const [colId, col] of Object.entries(collections)) {
    console.log(`Collection: "${col.name}"`);
    console.log(`Modes: ${col.modes?.map(m => `${m.name} (${m.modeId})`).join(' | ')}`);
    console.log(`---`);

    for (const varId of col.variableIds || []) {
      const v = variables[varId];
      if (!v) continue;

      console.log(`\n  📌 ${v.name} (${v.resolvedType})`);
      if (v.description) console.log(`     Description: ${v.description}`);

      for (const mode of col.modes || []) {
        const val = v.valuesByMode?.[mode.modeId];
        if (!val) continue;

        if (val.type === 'VARIABLE_ALIAS') {
          // Find the referenced variable
          const refVar = variables[val.id];
          console.log(`     ${mode.name}: -> alias (${refVar?.name || val.id})`);
        } else if (val.r !== undefined) {
          const hex = rgbToHex(val.r, val.g, val.b);
          const alpha = val.a !== undefined ? val.a : 1;
          console.log(`     ${mode.name}: ${hex}${alpha < 1 ? ` (alpha: ${alpha})` : ''}`);
        } else {
          console.log(`     ${mode.name}: ${JSON.stringify(val)}`);
        }
      }
    }
  }
}

main().catch(e => console.error('Fatal:', e));

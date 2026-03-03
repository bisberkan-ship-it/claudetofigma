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
  // The variable collection ID prefix from Register file is:
  // 4829f89e68f92a7e6b770146eaa48120e6653922
  // This is a consistent identifier across files that share the same library

  // Let's find team ID first
  const me = await apiGet('/v1/me');
  console.log('User:', me.handle);

  // Try to get all projects for each team
  // The user's teams might be in a different endpoint format
  // Let's try /v1/teams/:team_id/projects

  // First, let's see what file the Register references for its variables
  // The collection ID hash: 4829f89e68f92a7e6b770146eaa48120e6653922
  // is likely the variable collection key from the published library

  // Let's check the TopNav file (y0fqsC9RIiddun3581BQhH) variable collection ID
  const topNavVars = await apiGet('/v1/files/y0fqsC9RIiddun3581BQhH/variables/local');
  const topNavCollections = topNavVars.meta?.variableCollections || {};
  for (const [id, col] of Object.entries(topNavCollections)) {
    console.log(`TopNav collection ID: ${id}`);
    console.log(`TopNav collection name: ${col.name}`);
  }

  // Published vars from TopNav - might reference the base file
  console.log('\n=== TopNav published variables ===');
  try {
    const pubVars = await apiGet('/v1/files/y0fqsC9RIiddun3581BQhH/variables/published');
    const pubCols = pubVars.meta?.variableCollections || {};
    for (const [id, col] of Object.entries(pubCols)) {
      console.log(`Published: ${col.name} (${id}) - subscribed: ${col.subscribedFileKeys || 'none'}`);
    }
    // Check if there are references to subscribed libraries
    const pubVarList = pubVars.meta?.variables || {};
    for (const [vid, v] of Object.entries(pubVarList)) {
      if (v.valuesByMode) {
        for (const [modeId, val] of Object.entries(v.valuesByMode)) {
          if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
            // Check if it references a different collection (external)
            const refId = val.id;
            if (!pubVarList[refId]) {
              console.log(`  External ref: ${v.name} -> ${refId}`);
            }
          }
        }
      }
    }
  } catch(e) {
    console.log('Error:', e.message);
  }

  // Let's look at the Register file more carefully
  // The full file data might contain library references
  console.log('\n=== Register file library references ===');
  const regFile = await apiGet('/v1/files/AvviE6CV0aUug9xfQgqgNi?depth=0');

  // Check the styles endpoint for all referenced files
  // Also check component references more thoroughly
  const regComps = await apiGet('/v1/files/AvviE6CV0aUug9xfQgqgNi?depth=2');

  // Collect all unique component IDs from instances
  const fileKeys = new Set();

  function scanForRemoteRefs(node) {
    if (node.componentId) {
      // This is an instance
    }
    if (node.styles) {
      // Style references
      for (const [key, styleId] of Object.entries(node.styles)) {
        if (typeof styleId === 'string') {
          // Collect unique style IDs
        }
      }
    }
    if (node.children) {
      node.children.forEach(c => scanForRemoteRefs(c));
    }
  }

  // Instead, let's directly look for the base file by trying common FellowKit file patterns
  // Check the component endpoints for remote components that come from the base file
  console.log('\n=== Searching via component keys ===');

  // Get ALL components referenced in the Register file (including remote ones from the full tree)
  const fullNodes = await apiGet('/v1/files/AvviE6CV0aUug9xfQgqgNi/nodes?ids=1:9995&depth=1');
  const allComponents = fullNodes.nodes['1:9995']?.components || {};

  // Get unique file keys by checking component keys
  const remoteComps = Object.entries(allComponents).filter(([id, c]) => c.remote);
  console.log(`Remote components in section: ${remoteComps.length}`);

  // Check each remote component key to find its source file
  const checkedFileKeys = new Set();
  for (const [id, comp] of remoteComps) {
    if (checkedFileKeys.has(comp.key)) continue;
    checkedFileKeys.add(comp.key);

    try {
      const info = await apiGet(`/v1/components/${comp.key}`);
      const fk = info.meta?.file_key;
      if (fk && !fileKeys.has(fk)) {
        fileKeys.add(fk);
        // Check if this is the base file
        const fInfo = await apiGet(`/v1/files/${fk}?depth=0`);
        console.log(`\n  File: ${fInfo.name} (${fk})`);

        if (fInfo.name.includes('Base') || fInfo.name.includes('00')) {
          console.log('  >>> THIS IS THE BASE FILE! <<<');

          // Get variables from this file
          const baseVars = await apiGet(`/v1/files/${fk}/variables/local`);
          const baseCols = baseVars.meta?.variableCollections || {};
          const baseVariables = baseVars.meta?.variables || {};

          console.log(`\n  Collections: ${Object.keys(baseCols).length}`);
          for (const [colId, col] of Object.entries(baseCols)) {
            console.log(`  📁 ${col.name} (${col.variableIds?.length || 0} vars)`);
            console.log(`     Modes: ${col.modes?.map(m => m.name).join(', ')}`);

            if (col.name.includes('Flagship') || col.name.includes('Color')) {
              console.log('\n  🎨 FLAGSHIP COLORS FOUND!\n');
              for (const varId of col.variableIds || []) {
                const v = baseVariables[varId];
                if (!v) continue;
                console.log(`    ${v.name} (${v.resolvedType})`);
                for (const mode of col.modes || []) {
                  const val = v.valuesByMode?.[mode.modeId];
                  if (!val) continue;
                  if (val.type === 'VARIABLE_ALIAS') {
                    const ref = baseVariables[val.id];
                    console.log(`      ${mode.name}: → ${ref?.name || val.id}`);
                  } else if (val.r !== undefined) {
                    const hex = rgbToHex(val.r, val.g, val.b);
                    const alpha = val.a !== undefined && val.a < 1 ? ` (${Math.round(val.a * 100)}%)` : '';
                    console.log(`      ${mode.name}: ${hex}${alpha}`);
                  }
                }
              }
            }
          }
        }
      }
    } catch(e) {
      // Skip errors
    }
  }

  if (fileKeys.size === 0) {
    console.log('No external file keys found via component keys.');
  } else {
    console.log(`\nAll source files found: ${[...fileKeys].join(', ')}`);
  }
}

main().catch(e => console.error('Fatal:', e));

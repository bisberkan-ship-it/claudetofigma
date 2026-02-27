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

async function main() {
  // Get user teams
  const me = await apiGet('/v1/me');
  console.log('User:', me.handle);

  // Try to find teams - the /v1/me endpoint might not list teams
  // Let's try to extract team ID from project references

  // Alternative: use search endpoint or try common team IDs
  // Let's check if we can get project info for the file

  // The Figma API v1 doesn't have a search endpoint
  // But we can try to find the project that contains our known file
  // and then list all files in that project

  // Approach: Get the file's project via the file endpoint
  // Unfortunately /v1/files doesn't return project info directly

  // Let's try the /v1/teams endpoint with known patterns
  // Or use the component key approach to find the library file

  // From the Register file, we have component references like:
  // componentId:2304:51196 (FKTopNavigation)
  // The "2304" prefix suggests these come from a specific file

  // Let's try to trace a component key to find the source file
  const FILE_KEY = 'AvviE6CV0aUug9xfQgqgNi';

  // Get full component info
  const comps = await apiGet(`/v1/files/${FILE_KEY}/components`);

  // Find components that reference external files
  const uniqueKeys = new Set();
  comps.meta?.components?.forEach(c => {
    uniqueKeys.add(c.key);
  });

  console.log(`\nTotal unique component keys: ${uniqueKeys.size}`);

  // Try the component key endpoint to find the source file
  // /v1/components/:key returns info including file_key
  const sampleKeys = Array.from(uniqueKeys).slice(0, 3);

  for (const key of sampleKeys) {
    try {
      const compInfo = await apiGet(`/v1/components/${key}`);
      if (compInfo.meta) {
        console.log(`\nComponent: ${compInfo.meta.name}`);
        console.log(`  File key: ${compInfo.meta.file_key}`);
        console.log(`  Node ID: ${compInfo.meta.node_id}`);
        console.log(`  Containing frame: ${compInfo.meta.containing_frame?.name}`);
      }
    } catch (e) {
      console.log(`Key ${key}: ${e.message}`);
    }
  }

  // Now let's try to find the base file through team library
  // Get all referenced component keys from the SSO instances
  console.log('\n=== Tracing library source ===');

  // Get a component from the imported SSO instance to find its library file
  const nodesData = await apiGet(`/v1/files/${FILE_KEY}/nodes?ids=1:9996&depth=3`);
  const refComponents = nodesData.nodes['1:9996']?.components || {};

  // Find external component IDs (ones not in this file)
  const externalIds = Object.keys(refComponents).filter(id => {
    const comp = refComponents[id];
    return comp.key && comp.remote === true;
  });

  console.log(`External (remote) components: ${externalIds.length}`);

  // Try first external component key
  for (const id of externalIds.slice(0, 3)) {
    const comp = refComponents[id];
    try {
      const compInfo = await apiGet(`/v1/components/${comp.key}`);
      if (compInfo.meta) {
        console.log(`\n  Remote Component: ${compInfo.meta.name}`);
        console.log(`  Source file key: ${compInfo.meta.file_key}`);
        console.log(`  Created at: ${compInfo.meta.created_at}`);
      }
    } catch (e) {
      console.log(`  Key ${comp.key}: ${e.message}`);
    }
  }

  // Also check the full file for ALL remote components
  console.log('\n=== Full file remote components ===');
  const fullComps = await apiGet(`/v1/files/${FILE_KEY}?depth=1`);
  // The file-level components map might have remote ones
  // Let's check styles instead - styles might reference the base file

  const styles = await apiGet(`/v1/files/${FILE_KEY}/styles`);
  const remoteStyles = styles.meta?.styles?.filter(s => s.file_key !== FILE_KEY) || [];
  console.log(`Remote styles: ${remoteStyles.length}`);
  remoteStyles.slice(0, 3).forEach(s => {
    console.log(`  Style: ${s.name} from file: ${s.file_key}`);
  });
}

main().catch(e => console.error('Fatal:', e));

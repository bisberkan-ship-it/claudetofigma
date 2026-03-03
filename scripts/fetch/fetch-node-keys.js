const https = require('https');
const TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = 'AvviE6CV0aUug9xfQgqgNi';

// All Kripto variant node IDs
const ids = [
  '1:10716', '1:10752', '1:10788', '1:10824',
  '1:10860', '1:10896', '1:10932', '1:10968',
  '1:11004', '1:11040', '1:11076'
];

const idsParam = ids.join(',');

const req = https.request({
  hostname: 'api.figma.com',
  path: `/v1/files/${FILE_KEY}/nodes?ids=${idsParam}&depth=0`,
  method: 'GET',
  headers: { 'X-Figma-Token': TOKEN }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.log('Error:', res.statusCode, data.substring(0, 500));
      return;
    }
    const json = JSON.parse(data);
    for (const [id, nodeData] of Object.entries(json.nodes)) {
      const doc = nodeData.document;
      if (doc) {
        const components = nodeData.components || {};
        console.log(`ID: ${doc.id} | Name: ${doc.name} | Type: ${doc.type}`);
        // Check for key in components metadata
        if (components[doc.id]) {
          console.log(`  -> KEY: ${components[doc.id].key}`);
        }
      }
    }
    // Also print raw components metadata
    const firstNode = Object.values(json.nodes)[0];
    if (firstNode && firstNode.components) {
      console.log('\n--- Components metadata ---');
      for (const [cid, cdata] of Object.entries(firstNode.components)) {
        if (ids.some(i => i.replace(':', ':') === cid)) {
          console.log(`Component ${cid}: key=${cdata.key}, name=${cdata.name}`);
        }
      }
    }
  });
});
req.on('error', e => console.error(e));
req.end();

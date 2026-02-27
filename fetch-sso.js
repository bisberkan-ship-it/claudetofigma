const https = require('https');
const TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = 'AvviE6CV0aUug9xfQgqgNi';
const NODE_ID = '1:10697';

const req = https.request({
  hostname: 'api.figma.com',
  path: `/v1/files/${FILE_KEY}/nodes?ids=${NODE_ID}&depth=2`,
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
    const node = json.nodes['1:10697'].document;
    console.log(JSON.stringify(node, null, 2));
  });
});
req.on('error', e => console.error(e));
req.end();

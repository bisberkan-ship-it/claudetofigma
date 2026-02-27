const https = require('https');
const TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = 'AvviE6CV0aUug9xfQgqgNi';
const NODE_ID = '1:9995';

const req = https.request({
  hostname: 'api.figma.com',
  path: `/v1/files/${FILE_KEY}/nodes?ids=${NODE_ID}&depth=10`,
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
    const node = json.nodes['1:9995'].document;
    printNode(node, 0);
  });
});
req.on('error', e => console.error(e));
req.end();

function printNode(node, depth) {
  const indent = '  '.repeat(depth);
  let extra = '';
  if (node.type === 'COMPONENT') extra = ' KEY:' + node.key;
  if (node.type === 'COMPONENT_SET') extra = ' [VARIANT_SET]';
  if (node.type === 'TEXT' && node.characters) extra = ' text:"' + node.characters.substring(0, 50) + '"';
  if (node.type === 'INSTANCE') extra = ' componentId:' + (node.componentId || '');

  const box = node.absoluteBoundingBox;
  const size = box ? Math.round(box.width) + 'x' + Math.round(box.height) : '';
  console.log(`${indent}${node.type} [${node.id}] ${node.name}${size ? ' (' + size + ')' : ''}${extra}`);

  if (node.children) {
    node.children.forEach(c => printNode(c, depth + 1));
  }
}

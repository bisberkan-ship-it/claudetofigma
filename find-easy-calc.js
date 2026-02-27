const http = require('http');

async function cmd(action, params = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ action, params });
    const req = http.request({
      hostname: 'localhost', port: 9001, path: '/command', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const p = JSON.parse(d);
        if (p.error) reject(new Error(p.error));
        else resolve(p.result);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function findNode(nodeId, targetName, depth, prefix) {
  if (depth < 0) return null;
  let data;
  try { data = await cmd('get_children', { nodeId, depth: 1 }); }
  catch (e) { return null; }
  if (!data.children) return null;

  for (const child of data.children) {
    if (child.name && child.name.toLowerCase().includes(targetName.toLowerCase())) {
      const det = await cmd('get_node_details', { nodeId: child.nodeId });
      console.log(prefix + '✓ FOUND:', child.name, '[' + child.type + ']');
      console.log(prefix + '  nodeId:', child.nodeId);
      console.log(prefix + '  abs x:', det.x, 'abs y:', det.y);
      console.log(prefix + '  w:', det.width, 'h:', det.height);
      return { ...child, absX: det.x, absY: det.y, width: det.width, height: det.height };
    }
    if (['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT'].includes(child.type)) {
      const r = await findNode(child.nodeId, targetName, depth - 1, prefix + '  ');
      if (r) return r;
    }
    await new Promise(r => setTimeout(r, 50));
  }
  return null;
}

async function main() {
  const FRAME_3B = '39:52681';
  const FRAME_3B_DETAILS = await cmd('get_node_details', { nodeId: FRAME_3B });
  console.log('Frame 3B abs pos:', FRAME_3B_DETAILS.x, FRAME_3B_DETAILS.y);
  console.log('Frame 3B size:', FRAME_3B_DETAILS.width, 'x', FRAME_3B_DETAILS.height);

  console.log('\n--- Easy Calculation aranıyor ---');
  const ec = await findNode(FRAME_3B, 'Easy Calculation', 8, '');

  if (ec) {
    console.log('\n--- Price frame aranıyor ---');
    await findNode(FRAME_3B, 'Price', 8, '');
  }
}

main().catch(e => console.error('HATA:', e.message));

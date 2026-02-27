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

async function scanDeep(nodeId, depth, prefix) {
  if (depth < 0) return;
  const data = await cmd('get_children', { nodeId, depth: 1 });
  if (!data.children) return;

  for (const child of data.children) {
    console.log(prefix + child.name + ' [' + child.type + '] id:' + child.nodeId);

    // Check if INSTANCE has interesting properties
    if (child.type === 'INSTANCE') {
      try {
        const info = await cmd('get_instance_info', { nodeId: child.nodeId });
        const props = info.componentProperties || {};
        const pairs = Object.entries(props);
        const interesting = pairs.filter(([k, v]) =>
          k.toLowerCase().includes('pair') ||
          k.toLowerCase().includes('coin') ||
          k.toLowerCase().includes('currency') ||
          k.toLowerCase().includes('btc') ||
          k.toLowerCase().includes('eth') ||
          String(v.value).toLowerCase().includes('btc') ||
          String(v.value).toLowerCase().includes('eth') ||
          String(v.value).toLowerCase().includes('try')
        );
        if (interesting.length > 0) {
          interesting.forEach(([k, v]) => console.log(prefix + '  >> prop:', k, '=', v.value));
        }
        if (info.mainComponent?.name) {
          const n = info.mainComponent.name.toLowerCase();
          if (n.includes('btc') || n.includes('eth') || n.includes('coin') || n.includes('pair') || n.includes('currency')) {
            console.log(prefix + '  >> mainComp:', info.mainComponent.name);
          }
        }
      } catch (e) { /* skip */ }
      await new Promise(r => setTimeout(r, 100));
    }

    // Check TEXT nodes
    if (child.type === 'TEXT') {
      try {
        const det = await cmd('get_node_details', { nodeId: child.nodeId });
        const chars = det.characters || '';
        const n = chars.toLowerCase();
        if (n.includes('btc') || n.includes('eth') || n.includes('/try') || n.includes('/usdt')) {
          console.log(prefix + '  >> TEXT: "' + chars + '"');
        }
      } catch (e) { /* skip */ }
      await new Promise(r => setTimeout(r, 80));
    }

    if (['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT'].includes(child.type)) {
      await scanDeep(child.nodeId, depth - 1, prefix + '  ');
    }
  }
}

async function main() {
  // Frame 3 Create Alarm (I32:41215;10995:25473) children
  console.log('=== Frame 3: Create Alarm iç tarama (depth 4) ===');
  await scanDeep('I32:41215;10995:25473', 4, '');
}

main().catch(e => console.error('HATA:', e.message));

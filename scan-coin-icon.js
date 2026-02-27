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
  let data;
  try { data = await cmd('get_children', { nodeId, depth: 1 }); }
  catch (e) { return; }
  if (!data.children) return;

  for (const child of data.children) {
    let extra = '';
    if (child.type === 'INSTANCE') {
      try {
        const info = await cmd('get_instance_info', { nodeId: child.nodeId });
        const props = info.componentProperties || {};
        const pairsStr = Object.entries(props)
          .map(([k, v]) => k + '=' + v.value)
          .join(', ');
        extra = ' | comp:' + (info.mainComponent?.name || '?');
        if (pairsStr) extra += ' | props:{' + pairsStr.substring(0, 120) + '}';
      } catch (e) { /* skip */ }
      await new Promise(r => setTimeout(r, 100));
    }
    if (child.type === 'TEXT') {
      try {
        const det = await cmd('get_node_details', { nodeId: child.nodeId });
        extra = ' | text:"' + (det.characters || '') + '"';
      } catch (e) { /* skip */ }
      await new Promise(r => setTimeout(r, 80));
    }
    console.log(prefix + child.name + ' [' + child.type + '] id:' + child.nodeId + extra);

    if (['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT'].includes(child.type)) {
      await scanDeep(child.nodeId, depth - 1, prefix + '  ');
    }
  }
}

async function main() {
  // Frame 3 FKInput (İşlem Çifti alanı) - Left icon alanı
  const fkInputId = 'I32:41215;10995:25473;10774:480';

  console.log('=== Frame 3 FKInput tam yapısı ===');
  console.log('Node:', fkInputId);

  // Önce instance info al
  const info = await cmd('get_instance_info', { nodeId: fkInputId });
  console.log('\nComponent properties:');
  Object.entries(info.componentProperties || {}).forEach(([k, v]) =>
    console.log(' ', k, '=', JSON.stringify(v))
  );

  console.log('\nChildren (depth 4):');
  await scanDeep(fkInputId, 4, '');
}

main().catch(e => console.error('HATA:', e.message));

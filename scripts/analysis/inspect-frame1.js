const http = require('http');

async function cmd(action, params = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ action, params });
    const req = http.request({
      hostname: 'localhost', port: 9001, path: '/command', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.error) reject(new Error(parsed.error));
        else resolve(parsed.result);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // Frame 1 detayları
  console.log('=== Frame 1 — Alarm Listesi (Boş) ===');
  const frame = await cmd('get_node_details', { nodeId: '32:1293' });
  console.log('Frame:', frame.name, '| size:', frame.width + 'x' + frame.height);
  console.log('Fill:', JSON.stringify(frame.fills));
  console.log('\nChildren:');
  if (frame.children) {
    frame.children.forEach((c, i) => {
      console.log(i + '.', c.name, '| type:', c.type, '| nodeId:', c.nodeId);
    });
  }

  // Tüm child'ları detaylıca incele
  console.log('\n=== Her child detayı ===');
  const deep = await cmd('get_children', { nodeId: '32:1293', depth: 1 });
  if (deep.children) {
    deep.children.forEach((c, i) => {
      console.log(i + '.', c.name);
      console.log('   type:', c.type, '| pos:', c.x + ',' + c.y, '| size:', c.width + 'x' + c.height);
      console.log('   nodeId:', c.nodeId);
    });
  }

  // Kripto Dark modunda level/surface token değerini bul
  console.log('\n=== Library Variables (level tokens) ===');
  const vars = await cmd('list_variables', { resolvedType: 'COLOR' });
  if (vars.collections) {
    for (const col of vars.collections) {
      const levelVars = col.variables.filter(v => v.name.includes('level') || v.name.includes('surface'));
      if (levelVars.length > 0) {
        console.log('Collection:', col.name);
        levelVars.forEach(v => console.log('  -', v.id, v.name));
      }
    }
  }
}

main().catch(e => console.error('HATA:', e.message));

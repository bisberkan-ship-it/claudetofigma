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

const FRAMES = [
  { id: '32:1293',  name: '1 — Alarm Listesi (Boş)' },
  { id: '32:35725', name: '2 — Alarm Listesi (Aktif)' },
  { id: '32:37655', name: '3 — Alarm Oluştur (Default)' },
  { id: '32:42115', name: '4 — Alarm Oluştur (Typing)' },
  { id: '32:43675', name: '5 — Alarm Oluştur (Tamamlandı)' },
  { id: '32:45997', name: '6 — Alarm Silme (Drawer)' },
];

const CRYPTO_TERMS = ['btc', 'bitcoin', 'eth', 'usdt', 'try', 'pair', 'kripto', 'alarm', 'coin'];

function hasCryptoRef(name) {
  const n = name.toLowerCase();
  return CRYPTO_TERMS.some(t => n.includes(t)) ||
    /btc|eth|usdt|try|bnb|sol|avax/i.test(name);
}

async function scanNode(nodeId, depth, results) {
  const data = await cmd('get_children', { nodeId, depth: 1 });
  if (!data.children) return;

  for (const child of data.children) {
    const entry = {
      nodeId: child.nodeId,
      name: child.name,
      type: child.type,
      x: child.x, y: child.y,
      width: child.width, height: child.height,
    };

    // Instance → componentProperties kontrol
    if (child.type === 'INSTANCE') {
      const info = await cmd('get_instance_info', { nodeId: child.nodeId });
      const props = info.componentProperties || {};
      const pairProp = Object.entries(props).find(([k]) => k.toLowerCase().includes('pair'));
      const hasCrypto = hasCryptoRef(child.name) || pairProp;
      if (hasCrypto || pairProp) {
        entry.componentProperties = props;
        entry.mainComponent = info.mainComponent?.name;
        entry.pairProp = pairProp ? { key: pairProp[0], value: pairProp[1].value } : null;
        results.push(entry);
      }
      await new Promise(r => setTimeout(r, 150));
    }

    // TEXT → içerik kontrol
    if (child.type === 'TEXT') {
      const det = await cmd('get_node_details', { nodeId: child.nodeId });
      if (hasCryptoRef(det.characters || '') || hasCryptoRef(child.name)) {
        entry.text = det.characters;
        results.push(entry);
      }
      await new Promise(r => setTimeout(r, 100));
    }

    // Daha derine in (depth sınırlı tutarak)
    if (depth > 0 && ['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT'].includes(child.type)) {
      await scanNode(child.nodeId, depth - 1, results);
    }
  }
}

async function main() {
  for (const frame of FRAMES) {
    console.log('\n=== ' + frame.name + ' ===');
    const results = [];
    await scanNode(frame.id, 3, results);

    if (results.length === 0) {
      console.log('  (kripto referansı bulunamadı)');
    } else {
      results.forEach(r => {
        if (r.pairProp) {
          console.log('  [INSTANCE]', r.name, '| Pair:', r.pairProp.value, '| id:', r.nodeId);
        } else if (r.text) {
          console.log('  [TEXT]', '"' + r.text + '" | name:', r.name, '| id:', r.nodeId);
        } else {
          console.log('  [INSTANCE]', r.name, '| comp:', r.mainComponent, '| id:', r.nodeId);
          if (r.componentProperties) {
            Object.entries(r.componentProperties).forEach(([k, v]) =>
              console.log('    prop:', k, '=', v.value)
            );
          }
        }
      });
    }
  }
}

main().catch(e => console.error('HATA:', e.message));

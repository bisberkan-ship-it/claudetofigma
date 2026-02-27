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
  // 1. Ekran 1 - Alarm Top Navigation ekle (timeout olmustu)
  console.log('Ekran 1: Alarm Top Navigation ekleniyor...');
  try {
    const nav = await cmd('import_component_by_key', {
      key: '6e05b043f46e6bb1746f3884708d86712d10a119',
      x: 0, y: 0,
      parentFrameId: '32:1293',
    });
    console.log('  OK:', nav.nodeId, nav.width + 'x' + nav.height);
  } catch (e) {
    console.error('  HATA:', e.message);
  }

  await new Promise(r => setTimeout(r, 600));

  // 2. Ekran 4 - TRY/Typing varyantı dene
  console.log('\nEkran 4: Create Alarm (Typing - TRY) deneniyor...');
  const typingKeys = [
    { key: '7926e1c0200434b30e3ae6a14e6befc7a541a870', name: 'Create Alarm TRY Typing' },
    { key: 'a754ed5fecdadc385e2c2579e30560df2206ef41', name: 'Create Alarm USDT Typing' },
  ];

  for (const tk of typingKeys) {
    try {
      const instance = await cmd('import_component_by_key', {
        key: tk.key,
        x: 0, y: 0,
        parentFrameId: '32:42115',
      });
      console.log('  OK:', tk.name, instance.nodeId, instance.width + 'x' + instance.height);
      break;
    } catch (e) {
      console.error('  HATA', tk.name + ':', e.message);
      await new Promise(r => setTimeout(r, 500));
    }
  }

  await new Promise(r => setTimeout(r, 600));

  // 3. Tüm frame'leri gözden geçir
  console.log('\nMevcut frame listesi:');
  const nodes = await cmd('list_nodes', {});
  if (nodes.nodes) {
    nodes.nodes
      .filter(n => n.name.includes('Alarm') || n.name.includes('alarm'))
      .forEach(n => console.log(' -', n.name, '| id:', n.nodeId, '| pos:', n.x + ',' + n.y));
  }

  console.log('\nDuzeltme tamamlandi!');
}

main().catch(e => console.error('HATA:', e.message));

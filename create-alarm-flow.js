const https_mod = require('http');

const BASE = 'http://localhost:9001';

async function cmd(action, params = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ action, params });
    const req = https_mod.request({
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

// Alarm akışı ekranları ve component key'leri
const SCREENS = [
  {
    label: '1 — Alarm Listesi (Boş)',
    components: [
      { key: '6e05b043f46e6bb1746f3884708d86712d10a119', name: 'Alarm Top Navigation', x: 0, y: 0 },
      { key: '2a9a5e27ede040fa6f11b56fe4630da33943251c', name: 'Alarm Page (Empty)', x: 0, y: 56 },
    ]
  },
  {
    label: '2 — Alarm Listesi (Aktif)',
    components: [
      { key: '6e05b043f46e6bb1746f3884708d86712d10a119', name: 'Alarm Top Navigation', x: 0, y: 0 },
      { key: 'ad5eefeff97c989b5123bdbd58bf1b3719432a71', name: 'Active Alarms Header', x: 0, y: 56 },
      { key: 'c5c0748e6f88fc00da9646c2f28e28099701fe5d', name: 'Alarm Card BTC/USDT', x: 0, y: 110 },
      { key: '16604be16572ec7a5b23eb3ef525d89692d3f0f4', name: 'Alarm Card ETH/USDT', x: 0, y: 190 },
    ]
  },
  {
    label: '3 — Alarm Oluştur (Default)',
    components: [
      { key: '72074a821cf19bccf9c274cd905d42a79f973329', name: 'Create Alarm Page - Default', x: 0, y: 0 },
    ]
  },
  {
    label: '4 — Alarm Oluştur (Typing)',
    components: [
      { key: '8e97943ad77277c27746eba5b72309cb31a93663', name: 'Create Alarm Page - Typing', x: 0, y: 0 },
    ]
  },
  {
    label: '5 — Alarm Oluştur (Tamamlandı)',
    components: [
      { key: '96374212c6359134417d97f4ae270f7f2fcf841e', name: 'Create Alarm Page - Done', x: 0, y: 0 },
    ]
  },
  {
    label: '6 — Alarm Silme (Drawer)',
    components: [
      { key: '1fb2e651d5cf6b110401c7ab77855918018bdbd5', name: 'Alarm Page (Filled)', x: 0, y: 0 },
      { key: 'd627723529e9400357ba1a556bab0522c235e7c1', name: 'Drawer - Delete Alarm', x: 0, y: 600 },
    ]
  },
];

const FRAME_W = 390;
const FRAME_H = 844;
const GAP = 80;

async function main() {
  console.log('Alarm akisi olusturuluyor...\n');

  const createdFrames = [];

  for (let i = 0; i < SCREENS.length; i++) {
    const screen = SCREENS[i];
    const frameX = i * (FRAME_W + GAP);

    console.log('Ekran', (i + 1) + ':', screen.label);

    // Ana frame oluştur
    let frame;
    try {
      frame = await cmd('create_frame', {
        name: screen.label,
        width: FRAME_W,
        height: FRAME_H,
        x: frameX,
        y: 0,
        fillColor: { r: 0.122, g: 0.122, b: 0.145 }, // Kripto Dark background
      });
      console.log('  Frame olusturuldu:', frame.nodeId);
    } catch (e) {
      console.error('  Frame HATA:', e.message);
      continue;
    }

    // Her component'i import et ve frame'e ekle
    for (const comp of screen.components) {
      try {
        console.log('  Import:', comp.name);
        const instance = await cmd('import_component_by_key', {
          key: comp.key,
          x: comp.x,
          y: comp.y,
          parentFrameId: frame.nodeId,
        });
        console.log('    OK - nodeId:', instance.nodeId, '| size:', instance.width + 'x' + instance.height);
      } catch (e) {
        console.error('    HATA:', e.message);
      }
      // Rate limit için küçük bekleme
      await new Promise(r => setTimeout(r, 500));
    }

    createdFrames.push({ label: screen.label, frameId: frame.nodeId, x: frameX });
    console.log('  Ekran tamamlandi\n');
  }

  console.log('\n=== ALARM AKISI TAMAMLANDI ===');
  createdFrames.forEach(f => console.log(' -', f.label, '| frameId:', f.frameId));
}

main().catch(e => {
  console.error('KRITIK HATA:', e.message);
  process.exit(1);
});

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

async function main() {
  // Frame 3 — x:940, y:1857, w:375, h:812
  const FRAME3_ID = '32:37655';
  const GAP = 80;

  console.log('Frame 3 bilgileri alınıyor...');
  const details = await cmd('get_node_details', { nodeId: FRAME3_ID });
  console.log(`Mevcut: x=${details.x}, y=${details.y}, w=${details.width}, h=${details.height}`);

  const newX = details.x;
  const newY = details.y + details.height + GAP;

  console.log(`\nKlon oluşturuluyor → x:${newX}, y:${newY}`);
  const cloned = await cmd('clone_node', {
    nodeId: FRAME3_ID,
    x: newX,
    y: newY,
  });

  console.log('Klon ID:', cloned.nodeId);
  console.log('Konum:', cloned.x, cloned.y);

  // Adını güncelle
  await new Promise(r => setTimeout(r, 500));
  await cmd('update_node', {
    nodeId: cloned.nodeId,
    name: '3B — Alarm Oluştur (Alternatif Slider)',
  });
  console.log('İsim güncellendi: 3B — Alarm Oluştur (Alternatif Slider)');
  console.log('\nTamamlandı. Yeni frame ID:', cloned.nodeId);
}

main().catch(e => console.error('HATA:', e.message));

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

async function setRadius(nodeId, radius, label) {
  try {
    await cmd('update_node', { nodeId, cornerRadius: radius });
    console.log('OK', label, '→ r=' + radius);
  } catch (e) {
    console.error('HATA', label, ':', e.message);
  }
  await new Promise(r => setTimeout(r, 150));
}

async function main() {
  console.log('=== Corner radius düzeltiliyor ===');

  // Track bg (r=2)
  await setRadius('39:53601', 2, 'TrackBg');
  // Track fill (r=2)
  await setRadius('39:53602', 2, 'TrackFill');
  // Thumb dış daire (r=11 → tam daire)
  await setRadius('39:53604', 11, 'Thumb');
  // Thumb iç nokta (r=4 → tam daire)
  await setRadius('39:53605', 4, 'ThumbDot');

  // Slider ana bg (r=8)
  await setRadius('39:53598', 8, 'SliderBg');

  console.log('\nDoğrulama:');
  const thumb = await cmd('get_node_details', { nodeId: '39:53604' });
  console.log('Thumb cornerRadius:', thumb.cornerRadius);
  const track = await cmd('get_node_details', { nodeId: '39:53601' });
  console.log('Track cornerRadius:', track.cornerRadius);
}

main().catch(e => console.error('KRITIK HATA:', e.message));

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

async function getDetails(nodeId, label) {
  try {
    const d = await cmd('get_node_details', { nodeId });
    console.log('\n=== ' + label + ' (' + nodeId + ') ===');
    const keys = ['x','y','width','height','layoutMode','paddingLeft','paddingRight','paddingTop','paddingBottom','itemSpacing','cornerRadius','topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius'];
    keys.forEach(k => { if (d[k] !== undefined) console.log(' ', k, ':', d[k]); });
    return d;
  } catch (e) {
    console.error(label, 'HATA:', e.message);
  }
}

async function main() {
  // Frame 3B'nin çocuklarını bul
  const f3b = await cmd('get_children', { nodeId: '39:52681', depth: 1 });
  console.log('Frame 3B children:');
  f3b.children.forEach(c => console.log(' ', c.name, '['+c.type+'] id:', c.nodeId));

  // Create Alarm Page / Create Alarm bileşenini bul
  await new Promise(r => setTimeout(r, 200));

  // Alarm & pair frame (from Clone, prefix I39:52682)
  // Pattern from original: I32:41215;10995:25473;10774:479
  // In clone Frame 3B: first child should be the Create Alarm Page
  const firstChild = f3b.children.find(c => c.type === 'INSTANCE' || c.name.includes('Alarm') || c.name.includes('Create'));
  if (firstChild) {
    console.log('\nFirst relevant child:', firstChild.name, firstChild.nodeId);
    const prefix = firstChild.nodeId;

    // Alarm & pair
    await getDetails(prefix + ';10774:479', 'Alarm & pair');
    // Price frame
    await getDetails(prefix + ';10774:481', 'Price frame');
    // FKInput (price)
    await getDetails(prefix + ';10774:482', 'Price FKInput');
    // Easy Calculation
    await getDetails(prefix + ';10774:483', 'Easy Calculation');
    // Concent
    await getDetails(prefix + ';10774:477', 'Concent');
    // FKButton
    await getDetails(prefix + ';10774:509', 'FKButton');
  }

  // Slider elementlerinin konumları
  console.log('\n=== Slider elementleri ===');
  const sliderIds = [
    '39:53598', // SliderBg
    '39:53599', // SliderLabel
    '39:53600', // SliderValue
    '39:53601', // TrackBg
    '39:53602', // TrackFill
    '39:53603', // CenterTick
    '39:53604', // Thumb
    '39:53605', // ThumbDot
    '39:53606', '39:53607', '39:53608', '39:53609', // Ticks
    '39:53610', '39:53611', '39:53612', '39:53613', '39:53614', // Labels
    '39:53615', // SeparatorTop
  ];
  for (const id of sliderIds) {
    try {
      const d = await cmd('get_node_details', { nodeId: id });
      console.log(' ', (d.name||'?').padEnd(25), 'x:', String(d.x).padStart(4), 'y:', String(d.y).padStart(4), 'w:', d.width, 'h:', d.height);
    } catch (e) { console.log(' ', id, 'HATA:', e.message); }
    await new Promise(r => setTimeout(r, 80));
  }
}

main().catch(e => console.error('HATA:', e.message));

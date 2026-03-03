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

async function scanForNode(nodeId, targets, depth, results = {}) {
  if (depth < 0) return results;
  let data;
  try { data = await cmd('get_children', { nodeId, depth: 1 }); }
  catch (e) { return results; }
  if (!data.children) return results;

  for (const child of data.children) {
    for (const [key, matcher] of Object.entries(targets)) {
      if (!results[key] && matcher(child)) {
        try {
          const det = await cmd('get_node_details', { nodeId: child.nodeId });
          results[key] = { ...child, absX: det.x, absY: det.y, width: det.width, height: det.height, layoutMode: det.layoutMode, paddingLeft: det.paddingLeft, paddingRight: det.paddingRight, paddingTop: det.paddingTop, paddingBottom: det.paddingBottom, itemSpacing: det.itemSpacing };
          console.log('✓ Found [' + key + ']:', child.name, '| id:', child.nodeId, '| x:', det.x, 'y:', det.y, 'w:', det.width, 'h:', det.height);
          if (det.layoutMode) console.log('  layout:', det.layoutMode, 'pad:', det.paddingLeft, det.paddingRight, det.paddingTop, det.paddingBottom, 'gap:', det.itemSpacing);
        } catch(e) {}
      }
    }

    if (['FRAME','GROUP','INSTANCE','COMPONENT'].includes(child.type)) {
      await scanForNode(child.nodeId, targets, depth - 1, results);
    }
    await new Promise(r => setTimeout(r, 40));
  }
  return results;
}

async function main() {
  console.log('=== Frame 3B iç yapı taraması ===');

  const targets = {
    'alarm_pair': c => c.name === 'Alarm & pair',
    'price_frame': c => c.name === 'Price',
    'price_input': c => c.name === '{FKInput}' && false, // skip — find via Price frame
    'easy_calc':  c => c.name === 'Easy Calculation',
    'concent':    c => c.name === 'Concent',
    'fk_button':  c => c.name === '{FKButton}' || (c.name.includes('Button') && c.type === 'INSTANCE'),
    'frame937':   c => c.name === 'Frame 937' || c.name === 'Frame 939' || c.name.match(/^Frame \d+$/),
  };

  const found = await scanForNode('39:52682', targets, 6, {});

  console.log('\n=== Sonuçlar ===');
  Object.entries(found).forEach(([k, v]) => {
    console.log(k, ':', v.name, '| id:', v.nodeId, '| x:', v.absX, 'y:', v.absY, 'w:', v.width, 'h:', v.height);
  });

  // Özellikle Alarm & pair padding değerlerini göster
  if (found.alarm_pair) {
    const ap = found.alarm_pair;
    console.log('\nAlarm & pair layout detayları:');
    console.log('  layoutMode:', ap.layoutMode);
    console.log('  padding L/R/T/B:', ap.paddingLeft, ap.paddingRight, ap.paddingTop, ap.paddingBottom);
    console.log('  itemSpacing:', ap.itemSpacing);
  }

  // Price FKInput corner radius
  if (found.price_frame) {
    const pfChildren = await cmd('get_children', { nodeId: found.price_frame.nodeId, depth: 1 });
    console.log('\nPrice frame children:');
    for (const ch of pfChildren.children || []) {
      const det = await cmd('get_node_details', { nodeId: ch.nodeId });
      console.log(' ', ch.name, '['+ch.type+'] id:', ch.nodeId, '| x:', det.x, 'y:', det.y, 'h:', det.height, '| cr:', det.cornerRadius, det.topLeftRadius, det.topRightRadius, det.bottomLeftRadius, det.bottomRightRadius);
      await new Promise(r => setTimeout(r, 80));
    }
  }
}

main().catch(e => console.error('HATA:', e.message));

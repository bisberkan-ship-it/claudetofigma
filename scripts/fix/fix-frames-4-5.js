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

// Recursively find FKInput with BTC in Input Text
async function findFKInputWithBTC(nodeId, depth, prefix) {
  if (depth < 0) return null;
  const data = await cmd('get_children', { nodeId, depth: 1 });
  if (!data.children) return null;

  for (const child of data.children) {
    if (child.type === 'INSTANCE' && child.name.includes('FKInput')) {
      try {
        const info = await cmd('get_instance_info', { nodeId: child.nodeId });
        const props = info.componentProperties || {};
        const inputKey = Object.keys(props).find(k => k.startsWith('Input Text'));
        if (inputKey && String(props[inputKey]?.value).includes('BTC')) {
          console.log(prefix + 'FOUND FKInput with BTC:', child.nodeId, '→ Input Text =', props[inputKey].value);
          return { nodeId: child.nodeId, props, inputKey };
        }
      } catch (e) { /* skip */ }
      await new Promise(r => setTimeout(r, 100));
    }

    if (['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT'].includes(child.type)) {
      const result = await findFKInputWithBTC(child.nodeId, depth - 1, prefix + '  ');
      if (result) return result;
    }
  }
  return null;
}

async function updateFKInput(found) {
  const extKey = Object.keys(found.props).find(k => k.startsWith('Extension Text'));
  const newProps = {};
  newProps[found.inputKey] = 'ETH/TRY';
  if (extKey) newProps[extKey] = 'Son Fiyat: 85.920 TRY';
  console.log('Güncelleniyor:', found.nodeId, JSON.stringify(newProps));
  try {
    await cmd('set_variant', { nodeId: found.nodeId, variantProperties: newProps });
    console.log('OK');
  } catch (e) {
    console.error('HATA:', e.message);
  }
}

async function main() {
  // Frame 4 — scan from Create Alarm root
  console.log('=== Frame 4: 34:6157 tarama ===');
  const f4 = await findFKInputWithBTC('34:6157', 5, '');
  if (f4) {
    await updateFKInput(f4);
  } else {
    console.log('FKInput bulunamadi!');
  }
  await new Promise(r => setTimeout(r, 400));

  // Frame 5 — scan from Create Alarm root
  console.log('\n=== Frame 5: I32:45089;10995:27785 tarama ===');
  const f5 = await findFKInputWithBTC('I32:45089;10995:27785', 5, '');
  if (f5) {
    await updateFKInput(f5);
  } else {
    console.log('FKInput bulunamadi!');
  }

  console.log('\nTamamlandi');
}

main().catch(e => console.error('KRITIK HATA:', e.message));

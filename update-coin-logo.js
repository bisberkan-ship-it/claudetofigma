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

async function setToETH(nodeId, label) {
  // First verify it's the Crypto Images BTC node
  try {
    const info = await cmd('get_instance_info', { nodeId });
    const props = info.componentProperties || {};
    console.log(label, '| comp:', info.mainComponent?.name, '| Type:', props['Type']?.value);

    if (props['Type']?.value === 'BTC') {
      await cmd('set_variant', { nodeId, variantProperties: { 'Type': 'ETH' } });
      console.log('  → ETH OK');
    } else if (props['Type']?.value === 'ETH') {
      console.log('  zaten ETH');
    } else {
      console.log('  Type degeri:', props['Type']?.value, '— set_variant deneniyor');
      await cmd('set_variant', { nodeId, variantProperties: { 'Type': 'ETH' } });
      console.log('  → ETH OK');
    }
  } catch (e) {
    console.error(label, 'HATA:', e.message);
    // Try scanning to find correct node
    return false;
  }
  await new Promise(r => setTimeout(r, 300));
  return true;
}

// Fallback: find Crypto Images inside an FKInput node
async function findAndSetCryptoImage(fkInputId, label) {
  console.log('\n' + label + ' — FKInput:', fkInputId);

  // Try direct `;4:1197` suffix pattern
  const directId = fkInputId + ';4:1197';
  const ok = await setToETH(directId, label + ' (direct)');
  if (ok) return;

  // Fallback: scan children
  console.log('  Direct pattern failed, scanning children...');
  try {
    const left = await cmd('get_children', { nodeId: fkInputId + ';4:1196', depth: 1 });
    if (left.children) {
      for (const child of left.children) {
        if (child.name.includes('Crypto') || child.name.includes('crypto')) {
          console.log('  Found via scan:', child.name, child.nodeId);
          await setToETH(child.nodeId, label + ' (scan)');
          return;
        }
      }
    }
  } catch (e) { /* skip */ }

  // Deeper scan
  try {
    const data = await cmd('get_children', { nodeId: fkInputId, depth: 2 });
    if (data.children) {
      for (const child of data.children) {
        if (child.name === 'Left' || child.name.includes('Left')) {
          const leftData = await cmd('get_children', { nodeId: child.nodeId, depth: 1 });
          if (leftData.children) {
            for (const lc of leftData.children) {
              if (lc.type === 'INSTANCE') {
                console.log('  Checking instance in Left:', lc.name, lc.nodeId);
                await setToETH(lc.nodeId, label + ' (deep scan)');
                return;
              }
            }
          }
        }
      }
    }
  } catch (e) { console.error('  scan error:', e.message); }
}

async function main() {
  console.log('=== BTC → ETH logo güncelleme ===\n');

  // Frame 3 — FKInput: I32:41215;10995:25473;10774:480
  await findAndSetCryptoImage('I32:41215;10995:25473;10774:480', 'Frame 3');

  // Frame 4 — FKInput: I34:6157;10774:21568
  await findAndSetCryptoImage('I34:6157;10774:21568', 'Frame 4');

  // Frame 5 — FKInput: I32:45089;10995:27785;10774:21595
  await findAndSetCryptoImage('I32:45089;10995:27785;10774:21595', 'Frame 5');

  console.log('\n=== Tamamlandı ===');
}

main().catch(e => console.error('KRITIK HATA:', e.message));

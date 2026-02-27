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

// Find FKInput with BTC/TRY Input Text inside a Create Alarm node
async function findPairInput(createAlarmId) {
  // Go into Concent → Frame → Alarm & pair → {FKInput}
  const concentId = createAlarmId + ';10774:477';
  const frame937Id = createAlarmId + ';10774:478';
  const alarmPairId = createAlarmId + ';10774:479';
  const fkInputId   = createAlarmId + ';10774:480';

  // Try direct ID first
  try {
    const info = await cmd('get_instance_info', { nodeId: fkInputId });
    const props = info.componentProperties || {};
    const inputProp = Object.entries(props).find(([k]) => k.startsWith('Input Text'));
    if (inputProp) {
      return { nodeId: fkInputId, inputKey: inputProp[0], currentValue: inputProp[1].value };
    }
  } catch (e) { /* try scanning */ }

  // Fallback: scan children of Concent
  try {
    const children = await cmd('get_children', { nodeId: createAlarmId, depth: 3 });
    if (children.children) {
      for (const child of children.children) {
        if (child.name === 'Concent' || child.name.includes('937')) {
          // check sub-children
        }
      }
    }
  } catch (e) { /* skip */ }
  return null;
}

async function updatePairInput(nodeId, inputKey, newPair, newExt) {
  const props = {};
  props[inputKey] = newPair;

  // Find the Extension Text key
  try {
    const info = await cmd('get_instance_info', { nodeId });
    const allProps = info.componentProperties || {};
    const extKey = Object.keys(allProps).find(k => k.startsWith('Extension Text'));
    if (extKey) props[extKey] = newExt;
  } catch (e) { /* skip ext */ }

  console.log('  Setting props:', JSON.stringify(props));
  try {
    const r = await cmd('set_variant', { nodeId, variantProperties: props });
    console.log('  OK:', JSON.stringify(r.componentProperties).substring(0, 100));
  } catch (e) {
    console.error('  HATA set_variant:', e.message);
  }
}

async function main() {
  // ──────────────────────────────────────────────
  // Frame 3 — Input Text: BTC/TRY → ETH/TRY
  // ──────────────────────────────────────────────
  console.log('\n── Frame 3: FKInput ──');
  const f3Input = 'I32:41215;10995:25473;10774:480';
  const f3Info = await cmd('get_instance_info', { nodeId: f3Input });
  const f3Props = f3Info.componentProperties || {};
  console.log('Mevcut props:');
  Object.entries(f3Props).forEach(([k, v]) => console.log(' ', k, '=', v.value));

  const inputKey3 = Object.keys(f3Props).find(k => k.startsWith('Input Text'));
  const extKey3   = Object.keys(f3Props).find(k => k.startsWith('Extension Text'));
  if (inputKey3) {
    const props = {};
    props[inputKey3] = 'ETH/TRY';
    if (extKey3) props[extKey3] = 'Son Fiyat: 85.920 TRY';
    console.log('Güncelleniyor:', JSON.stringify(props));
    try {
      await cmd('set_variant', { nodeId: f3Input, variantProperties: props });
      console.log('  OK Frame 3 FKInput');
    } catch (e) { console.error('  HATA:', e.message); }
  }
  await new Promise(r => setTimeout(r, 400));

  // ──────────────────────────────────────────────
  // Frame 4 — Scan for FKInput
  // ──────────────────────────────────────────────
  console.log('\n── Frame 4: FKInput tarama ──');
  const f4CreateAlarm = '34:6157';

  // Frame 4 Create Alarm children
  const f4Children = await cmd('get_children', { nodeId: f4CreateAlarm, depth: 1 });
  console.log('Frame 4 children:', f4Children.children?.map(c => c.name + '|' + c.nodeId).join(', '));
  await new Promise(r => setTimeout(r, 200));

  if (f4Children.children) {
    const concent = f4Children.children.find(c => c.name === 'Concent');
    if (concent) {
      console.log('Concent found:', concent.nodeId);
      const concentChildren = await cmd('get_children', { nodeId: concent.nodeId, depth: 2 });
      if (concentChildren.children) {
        for (const child of concentChildren.children) {
          console.log(' ', child.name, child.nodeId);
          if (child.name.includes('Alarm') || child.name.includes('pair')) {
            const pairChildren = await cmd('get_children', { nodeId: child.nodeId, depth: 1 });
            if (pairChildren.children) {
              for (const pc of pairChildren.children) {
                console.log('   ', pc.name, pc.nodeId, pc.type);
                if (pc.type === 'INSTANCE' && pc.name.includes('FKInput')) {
                  const info = await cmd('get_instance_info', { nodeId: pc.nodeId });
                  const props = info.componentProperties || {};
                  const inputKey = Object.keys(props).find(k => k.startsWith('Input Text'));
                  const extKey   = Object.keys(props).find(k => k.startsWith('Extension Text'));
                  if (inputKey && props[inputKey]?.value?.includes('BTC')) {
                    const newProps = {};
                    newProps[inputKey] = 'ETH/TRY';
                    if (extKey) newProps[extKey] = 'Son Fiyat: 85.920 TRY';
                    console.log('    Güncelleniyor:', JSON.stringify(newProps));
                    try {
                      await cmd('set_variant', { nodeId: pc.nodeId, variantProperties: newProps });
                      console.log('    OK Frame 4 FKInput');
                    } catch (e) { console.error('    HATA:', e.message); }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  await new Promise(r => setTimeout(r, 400));

  // ──────────────────────────────────────────────
  // Frame 5 — Same structure as Frame 3
  // ──────────────────────────────────────────────
  console.log('\n── Frame 5: FKInput ──');
  const f5Input = 'I32:45089;10995:27785;10774:480';
  try {
    const f5Info = await cmd('get_instance_info', { nodeId: f5Input });
    const f5Props = f5Info.componentProperties || {};
    console.log('Mevcut props:');
    Object.entries(f5Props).forEach(([k, v]) => console.log(' ', k, '=', v.value));

    const inputKey5 = Object.keys(f5Props).find(k => k.startsWith('Input Text'));
    const extKey5   = Object.keys(f5Props).find(k => k.startsWith('Extension Text'));
    if (inputKey5) {
      const props = {};
      props[inputKey5] = 'ETH/TRY';
      if (extKey5) props[extKey5] = 'Son Fiyat: 85.920 TRY';
      console.log('Güncelleniyor:', JSON.stringify(props));
      await cmd('set_variant', { nodeId: f5Input, variantProperties: props });
      console.log('  OK Frame 5 FKInput');
    }
  } catch (e) {
    console.error('  Frame 5 FKInput HATA:', e.message);
  }
  await new Promise(r => setTimeout(r, 400));

  console.log('\n=== Tamamlandı ===');
}

main().catch(e => console.error('KRITIK HATA:', e.message));

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

async function setVariant(nodeId, props, label) {
  try {
    const r = await cmd('set_variant', { nodeId, variantProperties: props });
    console.log('  OK [set_variant]', label);
    return r;
  } catch (e) {
    console.error('  HATA [set_variant]', label, ':', e.message);
  }
  await new Promise(r => setTimeout(r, 200));
}

async function updateText(nodeId, text, label) {
  try {
    const r = await cmd('update_text', { nodeId, text });
    console.log('  OK [update_text]', label);
    return r;
  } catch (e) {
    console.error('  HATA [update_text]', label, ':', e.message);
  }
  await new Promise(r => setTimeout(r, 200));
}

async function getInfo(nodeId) {
  try {
    return await cmd('get_instance_info', { nodeId });
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('=== ETH güncelleme başlıyor ===\n');

  // ──────────────────────────────────────────────
  // 1. ALARM LIST CARDS — Pair: BTC/TRY → ETH/TRY
  // ──────────────────────────────────────────────
  console.log('── Frame 2: Alarm Listesi (Aktif) ──');
  const frame2Cards = [
    'I32:36803;10774:17481',
    'I32:36803;10774:17683',
    'I32:36803;10774:17985',
  ];
  for (const id of frame2Cards) {
    await setVariant(id, { 'Pair': 'ETH/TRY' }, id);
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n── Frame 3: Alarm Oluştur (Default) ──');
  const frame3Cards = [
    'I32:41215;10995:31013;10774:17481',
    'I32:41215;10995:31013;10774:17683',
    'I32:41215;10995:31013;10774:17985',
  ];
  for (const id of frame3Cards) {
    await setVariant(id, { 'Pair': 'ETH/TRY' }, id);
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n── Frame 5: Alarm Oluştur (Tamamlandı) ──');
  const frame5Cards = [
    'I32:45089;10995:31347;10774:17481',
    'I32:45089;10995:31347;10774:17683',
    'I32:45089;10995:31347;10774:17985',
  ];
  for (const id of frame5Cards) {
    await setVariant(id, { 'Pair': 'ETH/TRY' }, id);
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n── Frame 6: Alarm Silme (Drawer) ──');
  // BTC/USDT → ETH/USDT
  await setVariant('I32:47694;10995:13462;10774:15904', { 'Pair': 'ETH/USDT' }, 'BTC/USDT→ETH/USDT');
  await new Promise(r => setTimeout(r, 300));
  // BTC/TRY → ETH/TRY
  await setVariant('I32:47694;10995:13462;10774:15946', { 'Pair': 'ETH/TRY' }, 'BTC/TRY→ETH/TRY');
  await new Promise(r => setTimeout(r, 300));

  // ──────────────────────────────────────────────
  // 2. TEXT NODES — "BTC/TRY Alarmlarım (3)" → "ETH/TRY Alarmlarım (3)"
  // ──────────────────────────────────────────────
  console.log('\n── Metin güncellemeleri ──');
  await updateText('I32:36803;10774:970', 'ETH/TRY Alarmlarım (3)', 'Frame 2 başlık');
  await new Promise(r => setTimeout(r, 300));
  await updateText('I32:41215;10995:31013;10774:970', 'ETH/TRY Alarmlarım (3)', 'Frame 3 başlık');
  await new Promise(r => setTimeout(r, 300));
  await updateText('I32:45089;10995:31347;10774:970', 'ETH/TRY Alarmlarım (3)', 'Frame 5 başlık');
  await new Promise(r => setTimeout(r, 300));

  // ──────────────────────────────────────────────
  // 3. CREATE ALARM — Coin seçimi için iç yapıyı incele
  // ──────────────────────────────────────────────
  console.log('\n── Create Alarm iç yapısı inceleniyor ──');

  const createAlarmNodes = [
    { id: 'I32:41215;10995:25473', frame: '3' },
    { id: '34:6157',               frame: '4' },
    { id: 'I32:45089;10995:27785', frame: '5' },
  ];

  for (const { id, frame } of createAlarmNodes) {
    console.log('\nFrame', frame, 'Create Alarm:', id);
    const info = await getInfo(id);
    if (info) {
      console.log('  mainComponent:', info.mainComponent?.name);
      const props = info.componentProperties || {};
      Object.entries(props).forEach(([k, v]) =>
        console.log('  prop:', k, '=', v.value)
      );
      // Deeper children scan
      try {
        const children = await cmd('get_children', { nodeId: id, depth: 1 });
        if (children.children) {
          console.log('  Children:', children.children.map(c => `${c.name}(${c.type})`).join(', '));
        }
      } catch (e) { /* skip */ }
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n=== Tamamlandı ===');
}

main().catch(e => console.error('KRITIK HATA:', e.message));

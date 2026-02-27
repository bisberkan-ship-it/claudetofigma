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

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Değişken key'leri ─────────────────────────────────────────────────────────
const VARS = {
  surface:      '4503d4627b553f04a8182e9278b607be03a15d28', // level/surface
  elevation:    '8ea01437fc5f43b3a09e848c38a3fdad51f2c6f2', // level/elevation
  elevation1:   '0717c5369d015254b9cfbf255ca6318985b113ec', // level/elevation +1
  brand:        '2906dff3b605e0a495e80e981017199363e500d4', // brand/primary
  textSecond:   '2d42771e303a1c532adc1f3d1e45401111406282', // text/secondary
  textFocus:    '7e92ca9d9f71befe5dfd6674dde1fe1872a5b355', // text/focus
};

// ── Node ID'leri ─────────────────────────────────────────────────────────────
const NODES = {
  frame3b:    '39:52681',
  container:  '39:53616',  // SliderContainer
  header:     '39:53617',  // SliderHeader frame
  labelText:  '39:53618',  // "Fiyat Sapması" TEXT
  valueText:  '39:53619',  // "0,00 %" TEXT
  track:      '39:53620',  // SliderTrack frame
  trackBg:    '39:53621',  // TrackBg rect
  trackNeg:   '39:53622',  // TrackNegZone rect
  centerTick: '39:53623',  // CenterTick rect
  thumb:      '39:53624',  // Thumb circle
  thumbDot:   '39:53625',  // ThumbDot white circle
  tick0:      '39:53626',  // −20% tick
  tick25:     '39:53627',  // −10% tick
  tick75:     '39:53628',  // +10% tick
  tick100:    '39:53629',  // +20% tick
  labels:     '39:53630',  // SliderLabels frame
  lbl20n:     '39:53631',  // "−20%"
  lbl10n:     '39:53632',  // "−10%"
  lbl0:       '39:53633',  // "0%"
  lbl10p:     '39:53634',  // "+10%"
  lbl20p:     '39:53635',  // "+20%"
};

// Instance iç node'ları
const INST = {
  frame937:   'I39:52682;10995:25473;10774:478',  // Frame 937 (Alarm&pair + Price)
  concent:    'I39:52682;10995:25473;10774:477',  // Concent
  divider:    'I39:52682;10995:25473;10774:492',  // Divider rect
  fkButton:   'I39:52682;10995:25473;10774:509',  // FKButton
};

// Spacing reference (from scan)
// Alarm&pair (h=54) → gap 16px → Price (y=70, h=88 → end:158)
// Standard inter-section gap = 16px
const GAP = 16;
const PRICE_FRAME_END_IN_937 = 158; // Price frame ends at y=158 inside Frame 937
const SLIDER_H = 100;               // SliderContainer auto-layout height
const SECTION_RADIUS = 8;           // Slider container corner radius (form section std.)

async function bindVar(nodeId, varKey, label) {
  try {
    await cmd('bind_variable', { nodeId, variableKey: varKey, field: 'fills' });
    console.log('  ✓ var:', label, '→', nodeId.substring(0, 15));
  } catch (e) {
    console.error('  ✗ var:', label, e.message.substring(0, 60));
  }
  await delay(200);
}

async function updateNode(nodeId, props, label) {
  try {
    await cmd('update_node', { nodeId, ...props });
    console.log('  ✓ update:', label);
  } catch (e) {
    console.error('  ✗ update:', label, e.message.substring(0, 60));
  }
  await delay(150);
}

async function main() {

  // ═══════════════════════════════════════════════════════════════════
  // 1. VARIABLE BINDING — Tüm slider elementlerine token ata
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n══ 1. Variable Binding ══');

  // Container ve sub-frame'ler → level/surface
  await bindVar(NODES.container, VARS.surface,    'container bg → surface');
  await bindVar(NODES.header,    VARS.surface,    'header bg → surface');
  await bindVar(NODES.track,     VARS.surface,    'track frame bg → surface');
  await bindVar(NODES.labels,    VARS.surface,    'labels bg → surface');

  // Track elemanları
  await bindVar(NODES.trackBg,    VARS.elevation,  'trackBg → elevation');
  await bindVar(NODES.trackNeg,   VARS.elevation,  'trackNeg → elevation');
  await bindVar(NODES.centerTick, VARS.elevation1, 'centerTick → elevation+1');
  await bindVar(NODES.tick0,      VARS.elevation1, 'tick −20% → elevation+1');
  await bindVar(NODES.tick25,     VARS.elevation1, 'tick −10% → elevation+1');
  await bindVar(NODES.tick75,     VARS.elevation1, 'tick +10% → elevation+1');
  await bindVar(NODES.tick100,    VARS.elevation1, 'tick +20% → elevation+1');
  await bindVar(NODES.thumb,      VARS.brand,      'thumb → brand/primary');
  // thumbDot → beyaz (inverse/pureWhite key elimizde yok; text/focus light renk)
  await bindVar(NODES.thumbDot,   VARS.textFocus,  'thumbDot → text/focus (near-white)');

  // Metinler
  await bindVar(NODES.labelText, VARS.textSecond, '"Fiyat Sapması" → text/secondary');
  await bindVar(NODES.valueText, VARS.brand,      '"0,00 %" → brand/primary');
  await bindVar(NODES.lbl20n,   VARS.textSecond,  '−20% → text/secondary');
  await bindVar(NODES.lbl10n,   VARS.textSecond,  '−10% → text/secondary');
  await bindVar(NODES.lbl0,     VARS.textFocus,   '0% → text/focus');
  await bindVar(NODES.lbl10p,   VARS.textSecond,  '+10% → text/secondary');
  await bindVar(NODES.lbl20p,   VARS.textSecond,  '+20% → text/secondary');

  // ═══════════════════════════════════════════════════════════════════
  // 2. CORNER RADIUS — Section standart değeri
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n══ 2. Corner Radius ══');
  // Çevre bileşenler: Alarm&pair=0, Price=0, FKInput=12
  // Slider → section (FKInput gibi bağımsız kontrol) = 8px
  await updateNode(NODES.container, { cornerRadius: 8 }, 'SliderContainer r=8');
  await updateNode(NODES.header,    { cornerRadius: 8 }, 'SliderHeader r=8');
  await updateNode(NODES.track,     { cornerRadius: 8 }, 'SliderTrack r=8');
  await updateNode(NODES.labels,    { cornerRadius: 0 }, 'SliderLabels r=0');

  // ═══════════════════════════════════════════════════════════════════
  // 3. INSTANCE'A TAŞI — Slider'ı Frame 937'ye ekle
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n══ 3. Instance Yerleştirme ══');

  // 3a. SliderContainer boyutunu Concent genişliğine ayarla
  await updateNode(NODES.container, { width: 343 }, 'Container w=343');
  await delay(200);

  // 3b. SliderContainer'ı Frame 937'ye taşı
  // Pozisyon: Price frame biter (y=158) + GAP=16 → y=174 içinde Frame 937
  const SLIDER_Y_IN_937 = PRICE_FRAME_END_IN_937 + GAP; // 174
  try {
    await cmd('move_node', {
      nodeId:   NODES.container,
      parentId: INST.frame937,
      x: 0,
      y: SLIDER_Y_IN_937,
    });
    console.log('  ✓ SliderContainer → Frame 937 (y=' + SLIDER_Y_IN_937 + ')');
  } catch (e) {
    console.error('  ✗ move to Frame 937:', e.message.substring(0, 80));
  }
  await delay(400);

  // 3c. Frame 937'yi yeniden boyutlandır (Price_end + gap + slider_h)
  const NEW_937_H = SLIDER_Y_IN_937 + SLIDER_H; // 174+100=274
  await updateNode(INST.frame937, { height: NEW_937_H }, 'Frame 937 h=' + NEW_937_H);

  // 3d. Concent'i yeniden boyutlandır
  // Eski h=218, fark = NEW_937_H - 158 = 116
  const DIFF = NEW_937_H - PRICE_FRAME_END_IN_937; // 116
  const OLD_CONCENT_H = 218;
  const NEW_CONCENT_H = OLD_CONCENT_H + DIFF; // 334
  await updateNode(INST.concent, { height: NEW_CONCENT_H }, 'Concent h=' + NEW_CONCENT_H);

  // 3e. Divider'ı aşağı taşı (eski y=158 → yeni y=158+DIFF=274)
  await updateNode(INST.divider, { y: PRICE_FRAME_END_IN_937 + DIFF }, 'Divider y=' + (PRICE_FRAME_END_IN_937 + DIFF));

  // 3f. FKButton'ı aşağı taşı (eski y=174 → yeni y=174+DIFF=290)
  const OLD_BTN_Y = 174;
  await updateNode(INST.fkButton, { y: OLD_BTN_Y + DIFF }, 'FKButton y=' + (OLD_BTN_Y + DIFF));

  // ═══════════════════════════════════════════════════════════════════
  // 4. FRAME 3B'DEKİ FAZLADAN separator'ı temizle
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n══ 4. Temizlik ══');
  // Frame 3B'deki artık separator rect'ini bul ve sil
  try {
    const f3bCh = await cmd('get_children', { nodeId: NODES.frame3b, depth: 1 });
    for (const ch of f3bCh.children || []) {
      if (ch.type === 'RECTANGLE' && ch.name === 'SliderSep') {
        await cmd('delete_node', { nodeId: ch.nodeId });
        console.log('  ✓ SliderSep silindi:', ch.nodeId);
      }
    }
  } catch (e) { /* skip */ }

  // ═══════════════════════════════════════════════════════════════════
  // 5. Doğrulama
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n══ 5. Doğrulama ══');
  try {
    const cont = await cmd('get_node_details', { nodeId: NODES.container });
    console.log('Container parent check: x=', cont.x, 'y=', cont.y, 'w=', cont.width, 'h=', cont.height);
    const f937 = await cmd('get_node_details', { nodeId: INST.frame937 });
    console.log('Frame 937: h=', f937.height);
    const conc = await cmd('get_node_details', { nodeId: INST.concent });
    console.log('Concent: h=', conc.height);
    const btn = await cmd('get_node_details', { nodeId: INST.fkButton });
    console.log('FKButton: y=', btn.y, 'h=', btn.height);
  } catch (e) {
    console.error('Doğrulama hatası:', e.message);
  }

  console.log('\n=== Tamamlandı ===');
}

main().catch(e => console.error('KRİTİK HATA:', e.message));

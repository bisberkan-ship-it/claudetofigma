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

async function upd(nodeId, props, label) {
  try {
    await cmd('update_node', { nodeId, ...props });
    console.log('  ✓', label);
  } catch (e) {
    console.error('  ✗', label, ':', e.message.substring(0, 60));
  }
  await delay(120);
}

async function bind(nodeId, key, label) {
  try {
    await cmd('bind_variable', { nodeId, variableKey: key, field: 'fills' });
    console.log('  ✓ var', label);
  } catch (e) {
    console.error('  ✗ var', label, ':', e.message.substring(0, 60));
  }
  await delay(150);
}

// ── Sabitler ────────────────────────────────────────────────────────────────
// Container: w=343, paddingLeft=16, paddingRight=16
// Inner genişlik: 343 - 16 - 16 = 311
const IW = 311;        // iç genişlik
const MID = Math.floor(IW / 2);   // 155 — merkez (0% konumu)
const THUMB_D = 22;
const DOT_D   = 8;
const TRACK_H = 4;
const TRACK_FRAME_H = 24;
const TRACK_Y = Math.floor((TRACK_FRAME_H - TRACK_H) / 2); // 10

// Node ID'leri
const N = {
  container:  '39:53616',
  header:     '39:53617',
  labelTxt:   '39:53618',  // "Fiyat Sapması"
  valueTxt:   '39:53619',  // "0,00 %"
  track:      '39:53620',
  trackBg:    '39:53621',  // ray arka planı → level/surface
  trackNeg:   '39:53622',  // negatif bölge → level/surface
  centerTick: '39:53623',
  thumb:      '39:53624',
  thumbDot:   '39:53625',
  tick0:      '39:53626',  // −20% tick
  tick25:     '39:53627',  // −10% tick
  tick75:     '39:53628',  // +10% tick
  tick100:    '39:53629',  // +20% tick
  labels:     '39:53630',
  lbl20n:     '39:53631',
  lbl10n:     '39:53632',
  lbl0:       '39:53633',
  lbl10p:     '39:53634',
  lbl20p:     '39:53635',
};

const VAR_SURFACE   = '4503d4627b553f04a8182e9278b607be03a15d28';  // level/surface
const VAR_ELEVATION = '8ea01437fc5f43b3a09e848c38a3fdad51f2c6f2';  // level/elevation

async function main() {

  // ═══════════════════════════════════════════════════════
  // 1. Sub-frame genişliklerini 311'e daralt
  // ═══════════════════════════════════════════════════════
  console.log('1. Sub-frame genişlikleri 311px yapılıyor...');
  await upd(N.header, { width: IW }, 'Header w=311');
  await upd(N.track,  { width: IW }, 'Track w=311');
  await upd(N.labels, { width: IW }, 'Labels w=311');

  // ═══════════════════════════════════════════════════════
  // 2. HEADER içindeki textleri 311px'e göre konumla
  // ═══════════════════════════════════════════════════════
  console.log('\n2. Header içerikleri 311px\'e göre...');
  await upd(N.labelTxt, { x: 0, y: 1 }, 'label x=0');
  await upd(N.valueTxt, { x: IW - 48, y: 0 }, `value x=${IW - 48}`);

  // ═══════════════════════════════════════════════════════
  // 3. TRACK elementlerini 311px'e göre yeniden konumla
  // ═══════════════════════════════════════════════════════
  console.log('\n3. Track elementleri 311px\'e göre...');

  // TrackBg — tam genişlik
  await upd(N.trackBg,    { x: 0, y: TRACK_Y, width: IW, height: TRACK_H }, 'TrackBg');

  // TrackNeg — sol yarı (negatif bölge, aynı yükseklik)
  await upd(N.trackNeg,   { x: 0, y: TRACK_Y, width: MID, height: TRACK_H }, 'TrackNeg');

  // CenterTick — tam orta
  await upd(N.centerTick, {
    x: MID - 1, y: TRACK_Y - 4,
    width: 2, height: TRACK_H + 8
  }, 'CenterTick x=' + (MID - 1));

  // Thumb — ortada (0% konumu)
  const thumbX = MID - Math.floor(THUMB_D / 2);
  const thumbY = Math.floor((TRACK_FRAME_H - THUMB_D) / 2);
  await upd(N.thumb,      { x: thumbX, y: thumbY, width: THUMB_D, height: THUMB_D }, 'Thumb x=' + thumbX);

  // ThumbDot — thumb ortası
  const dotX = MID - Math.floor(DOT_D / 2);
  const dotY = Math.floor((TRACK_FRAME_H - DOT_D) / 2);
  await upd(N.thumbDot,   { x: dotX, y: dotY, width: DOT_D, height: DOT_D }, 'ThumbDot x=' + dotX);

  // Tick işaretleri — 0%, 25%, 75%, 100% pozisyonları
  const tickY = TRACK_FRAME_H - 6;
  await upd(N.tick0,   { x: 0,              y: tickY, width: 2, height: 4 }, 'Tick −20% x=0');
  await upd(N.tick25,  { x: Math.round(IW * 0.25) - 1, y: tickY, width: 2, height: 4 }, 'Tick −10% x=' + (Math.round(IW * 0.25) - 1));
  await upd(N.tick75,  { x: Math.round(IW * 0.75) - 1, y: tickY, width: 2, height: 4 }, 'Tick +10% x=' + (Math.round(IW * 0.75) - 1));
  await upd(N.tick100, { x: IW - 2,        y: tickY, width: 2, height: 4 }, 'Tick +20% x=' + (IW - 2));

  // ═══════════════════════════════════════════════════════
  // 4. LABELS — 311px'e göre yeniden konumla
  // ═══════════════════════════════════════════════════════
  console.log('\n4. Range etiketleri 311px\'e göre...');
  const p0   = 0;
  const p25  = Math.round(IW * 0.25);
  const p50  = MID;
  const p75  = Math.round(IW * 0.75);
  const p100 = IW;

  await upd(N.lbl20n, { x: p0,           y: 0 }, '−20% x=0');
  await upd(N.lbl10n, { x: p25 - 13,     y: 0 }, '−10% x=' + (p25 - 13));
  await upd(N.lbl0,   { x: p50 - 7,      y: 0 }, '0%   x=' + (p50 - 7));
  await upd(N.lbl10p, { x: p75 - 13,     y: 0 }, '+10% x=' + (p75 - 13));
  await upd(N.lbl20p, { x: p100 - 27,    y: 0 }, '+20% x=' + (p100 - 27));

  // ═══════════════════════════════════════════════════════
  // 5. Ray (TrackBg + TrackNeg) → level/surface (daha koyu)
  // ═══════════════════════════════════════════════════════
  console.log('\n5. Ray rengi → level/surface...');
  await bind(N.trackBg,  VAR_SURFACE, 'TrackBg → level/surface');
  await bind(N.trackNeg, VAR_SURFACE, 'TrackNeg → level/surface');

  // ═══════════════════════════════════════════════════════
  // 6. Doğrulama
  // ═══════════════════════════════════════════════════════
  console.log('\n6. Doğrulama...');
  const cont = await cmd('get_node_details', { nodeId: N.container });
  console.log('Container: w=' + cont.width + ' h=' + cont.height);
  const hdr = await cmd('get_node_details', { nodeId: N.header });
  console.log('Header: w=' + hdr.width + ' (max right=' + (hdr.x + hdr.width) + ' ≤ ' + cont.width + ' ✓)');
  const trk = await cmd('get_node_details', { nodeId: N.track });
  console.log('Track: w=' + trk.width + ' (max right=' + (trk.x + trk.width) + ' ≤ ' + cont.width + ' ✓)');

  console.log('\n=== Tamamlandı ===');
}

main().catch(e => console.error('KRİTİK HATA:', e.message));

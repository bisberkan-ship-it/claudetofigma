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

function hex(h) {
  const v = h.replace('#', '');
  return {
    r: parseInt(v.substring(0, 2), 16) / 255,
    g: parseInt(v.substring(2, 4), 16) / 255,
    b: parseInt(v.substring(4, 6), 16) / 255,
  };
}

const C = {
  surface:   hex('#161B2E'),
  trackBg:   hex('#1E2640'),
  trackFill: hex('#3B5BD3'),
  thumb:     hex('#4F6FE8'),
  thumbDot:  hex('#FFFFFF'),
  textPri:   hex('#FFFFFF'),
  textSec:   hex('#8A8FA8'),
  textBlue:  hex('#4F6FE8'),
  tick:      hex('#2A3050'),
};

const FRAME_3B  = '39:52681';
// Canvas position of Frame 3B
const F3B_X = 940, F3B_Y = 2749;

// Slider'ın Frame 3B içindeki konumu (Easy Calculation üstü)
// Price FKInput y=166..220; slider y=220 başlasın
const SL_REL_Y = 220;    // frame-relative y
const SL_W     = 375;    // full frame width (padding ile içeride 343 kalır)

// İç içerik genişliği (SL_W - padL - padR = 375 - 16 - 16)
const INNER_W = 343;

const PAD_LR = 16;
const PAD_T  = 12;
const PAD_B  = 16;
const ROW_GAP = 8;

// Track
const TRACK_H  = 4;
const TRACK_R  = 2;
const THUMB_D  = 22;
const DOT_D    = 8;
// Track çerçevesinin yüksekliği thumb'u kapsayacak kadar
const TRACK_FRAME_H = THUMB_D + 2; // 24

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Yardımcılar ──────────────────────────────────────────────────────────────

async function createFrame({ name, w, h, fill }) {
  const r = await cmd('create_frame', { name, width: w, height: h, fillColor: fill });
  console.log('  [frame]', name, r.nodeId);
  await delay(200);
  return r.nodeId;
}

async function moveInto(nodeId, parentId, x, y) {
  await cmd('move_node', { nodeId, parentId, x: x ?? 0, y: y ?? 0 });
  await delay(150);
}

async function applyAutoLayout(nodeId, opts) {
  await cmd('set_auto_layout', {
    nodeId,
    direction: opts.dir || 'VERTICAL',
    spacing: opts.gap ?? 0,
    paddingTop: opts.pt ?? 0,
    paddingBottom: opts.pb ?? 0,
    paddingLeft: opts.pl ?? 0,
    paddingRight: opts.pr ?? 0,
    alignItems: opts.align || 'MIN',
  });
  await delay(150);
}

async function addRect({ parent, name, x, y, w, h, fill, radius }) {
  const r = await cmd('add_rectangle', {
    name, width: w, height: h, x, y,
    fillColor: fill,
    parentFrameId: parent,
  });
  if (radius) await cmd('update_node', { nodeId: r.nodeId, cornerRadius: radius });
  await delay(150);
  return r.nodeId;
}

async function addText({ parent, name, text, x, y, size, fill, bold }) {
  const r = await cmd('add_text', {
    name, text, x, y,
    fontSize: size,
    fillColor: fill,
    parentFrameId: parent,
    fontWeight: bold ? 600 : 400,
  });
  await delay(150);
  return r.nodeId;
}

// ── Ana script ────────────────────────────────────────────────────────────────

async function main() {

  // ── 0. Eski slider nodelarını sil ────────────────────────────────────────
  console.log('0. Eski slider siliniyor...');
  const OLD = [
    '39:53598','39:53599','39:53600','39:53601','39:53602','39:53603',
    '39:53604','39:53605','39:53606','39:53607','39:53608','39:53609',
    '39:53610','39:53611','39:53612','39:53613','39:53614','39:53615',
  ];
  for (const id of OLD) {
    try { await cmd('delete_node', { nodeId: id }); }
    catch (e) { /* zaten yok */ }
    await delay(80);
  }
  console.log('  Eski slider temizlendi.');

  // ── 1. SliderContainer ────────────────────────────────────────────────────
  console.log('\n1. SliderContainer oluşturuluyor...');
  // Canvas coords için placeholder (move_node sonra düzeltecek)
  const containerId = await createFrame({
    name: 'SliderContainer',
    w: SL_W, h: 80,
    fill: C.surface,
  });
  // Frame 3B içine taşı; x=0, y=SL_REL_Y (frame-relative)
  await moveInto(containerId, FRAME_3B, 0, SL_REL_Y);

  // VERTICAL auto layout — Alarm & pair standardı: 16px yatay, 12/16 dikey
  await applyAutoLayout(containerId, {
    dir: 'VERTICAL',
    gap: ROW_GAP,
    pl: PAD_LR, pr: PAD_LR,
    pt: PAD_T,  pb: PAD_B,
    align: 'MIN',
  });
  console.log('  Auto layout uygulandı.');

  // ── 2. Row 1 — Header (label + değer) ────────────────────────────────────
  console.log('\n2. Header row...');
  const headId = await createFrame({ name: 'SliderHeader', w: INNER_W, h: 18, fill: C.surface });
  await moveInto(headId, containerId);

  // Label: "Fiyat Sapması" — sol
  await addText({
    parent: headId, name: 'LabelText',
    text: 'Fiyat Sapması',
    x: 0, y: 1, size: 12, fill: C.textSec,
  });

  // Değer: "0,00 %" — sağ (inline'da r-aligned gibi davransın)
  await addText({
    parent: headId, name: 'ValueText',
    text: '0,00 %',
    x: INNER_W - 48, y: 0,
    size: 13, fill: C.textBlue, bold: true,
  });

  // ── 3. Row 2 — Track alanı ────────────────────────────────────────────────
  console.log('\n3. Track alanı...');
  const trackId = await createFrame({ name: 'SliderTrack', w: INNER_W, h: TRACK_FRAME_H, fill: C.surface });
  await moveInto(trackId, containerId);

  // Track arka planı — tam genişlik
  await addRect({
    parent: trackId, name: 'TrackBg',
    x: 0, y: (TRACK_FRAME_H - TRACK_H) / 2,
    w: INNER_W, h: TRACK_H,
    fill: C.trackBg, radius: TRACK_R,
  });

  // Sol yarı negatif bölge tonu (koyu mavi, hafif)
  await addRect({
    parent: trackId, name: 'TrackNegZone',
    x: 0, y: (TRACK_FRAME_H - TRACK_H) / 2,
    w: Math.floor(INNER_W / 2), h: TRACK_H,
    fill: C.trackBg, radius: TRACK_R,
  });

  // Merkez çentik (0% işareti)
  await addRect({
    parent: trackId, name: 'CenterTick',
    x: Math.floor(INNER_W / 2) - 1,
    y: (TRACK_FRAME_H - TRACK_H) / 2 - 4,
    w: 2, h: TRACK_H + 8,
    fill: C.tick,
  });

  // Thumb dış daire
  const thumbX = Math.floor(INNER_W / 2) - Math.floor(THUMB_D / 2);
  const thumbY = Math.floor((TRACK_FRAME_H - THUMB_D) / 2);
  await addRect({
    parent: trackId, name: 'Thumb',
    x: thumbX, y: thumbY,
    w: THUMB_D, h: THUMB_D,
    fill: C.thumb, radius: THUMB_D / 2,
  });

  // Thumb iç beyaz nokta
  const dotX = Math.floor(INNER_W / 2) - Math.floor(DOT_D / 2);
  const dotY = Math.floor((TRACK_FRAME_H - DOT_D) / 2);
  await addRect({
    parent: trackId, name: 'ThumbDot',
    x: dotX, y: dotY,
    w: DOT_D, h: DOT_D,
    fill: C.thumbDot, radius: DOT_D / 2,
  });

  // Küçük tick'ler (−20%, −10%, +10%, +20%)
  const tickPcts = [0, 0.25, 0.75, 1.0];
  for (const p of tickPcts) {
    await addRect({
      parent: trackId, name: 'Tick',
      x: Math.round(INNER_W * p) - 1,
      y: TRACK_FRAME_H - 6,
      w: 2, h: 4,
      fill: C.tick,
    });
  }

  // ── 4. Row 3 — Aralık etiketleri ─────────────────────────────────────────
  console.log('\n4. Range etiketleri...');
  const labelsId = await createFrame({ name: 'SliderLabels', w: INNER_W, h: 14, fill: C.surface });
  await moveInto(labelsId, containerId);

  const LABELS = [
    { text: '−20%', x: 0 },
    { text: '−10%', x: Math.round(INNER_W * 0.25) - 13 },
    { text: '0%',   x: Math.round(INNER_W * 0.5) - 7 },
    { text: '+10%', x: Math.round(INNER_W * 0.75) - 13 },
    { text: '+20%', x: INNER_W - 27 },
  ];

  for (const l of LABELS) {
    await addText({
      parent: labelsId, name: 'RangeLabel',
      text: l.text, x: l.x, y: 0,
      size: 10,
      fill: l.text === '0%' ? C.textPri : C.textSec,
    });
  }

  // ── 5. Üst ayırıcı çizgi (container ın en üstüne) ────────────────────────
  console.log('\n5. Separator çizgisi...');
  await addRect({
    parent: FRAME_3B, name: 'SliderSep',
    x: 16, y: SL_REL_Y - 1,
    w: INNER_W, h: 1,
    fill: C.tick,
  });

  // ── 6. Price FKInput corner radius eşitleme ───────────────────────────────
  console.log('\n6. Price FKInput köşe radius eşitleniyor...');
  const PRICE_INPUT = 'I39:52682;10995:25473;10774:482';
  try {
    // Önce mevcut değerleri gör
    const det = await cmd('get_node_details', { nodeId: PRICE_INPUT });
    console.log('  Mevcut cr:', det.cornerRadius,
      det.topLeftRadius, det.topRightRadius,
      det.bottomLeftRadius, det.bottomRightRadius);

    // Tüm köşeleri 12 yap (FellowKit Input standart değeri)
    await cmd('update_node', {
      nodeId: PRICE_INPUT,
      cornerRadius: 12,
      topLeftRadius: 12,
      topRightRadius: 12,
      bottomLeftRadius: 12,
      bottomRightRadius: 12,
    });
    console.log('  Tüm köşeler 12px yapıldı.');
  } catch (e) {
    console.error('  corner radius HATA:', e.message);
    // Fallback: sadece cornerRadius dene
    try {
      await cmd('update_node', { nodeId: PRICE_INPUT, cornerRadius: 12 });
      console.log('  cornerRadius 12 uygulandı (fallback).');
    } catch (e2) {
      console.error('  Fallback da başarısız:', e2.message);
    }
  }

  // ── Son doğrulama ─────────────────────────────────────────────────────────
  console.log('\n=== Tamamlandı ===');
  const contDet = await cmd('get_node_details', { nodeId: containerId });
  console.log('SliderContainer:', contDet.width + 'x' + contDet.height,
    'x:', contDet.x, 'y:', contDet.y,
    'layoutMode:', contDet.layoutMode);
}

main().catch(e => console.error('KRİTİK HATA:', e.message));

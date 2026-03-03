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

// hex string → Figma RGB object
function hex(h) {
  const v = h.replace('#', '');
  return {
    r: parseInt(v.substring(0, 2), 16) / 255,
    g: parseInt(v.substring(2, 4), 16) / 255,
    b: parseInt(v.substring(4, 6), 16) / 255,
  };
}

// BtcTurk Kripto Dark renk paleti
const COLOR = {
  surface:    hex('#161B2E'), // frame/container arka planı
  trackBg:    hex('#1E2640'), // slider ray arka planı
  trackFill:  hex('#3B5BD3'), // slider dolu kısım (mavi aksan)
  thumb:      hex('#4F6FE8'), // knob
  thumbInner: hex('#FFFFFF'), // knob iç nokta
  textPrimary:hex('#FFFFFF'),
  textSecond: hex('#8A8FA8'), // gri — ikincil
  textBlue:   hex('#4F6FE8'), // değer etiketi (mavi)
  separator:  hex('#252B45'), // ince divider
};

const FRAME    = '39:52681'; // Frame 3B
const PARENT   = FRAME;

// Easy Calculation alanının frame içi konumu
// Concent(16,96) + Price(0,70) + EasyCalc(0,56) = x:16, y:222, w:343, h:32
const EC_X = 16;
const EC_Y = 222;
const EC_W = 343;

// Slider bileşeni toplam yüksekliği: 68px
// Row1 (y+0 ): label "Fiyat Sapması" + değer "0,00 %"   h:18
// Row2 (y+22): slider ray + knob                          h:24
// Row3 (y+50): -20%  ....  0%  ....  +20%               h:18
const SL_Y   = EC_Y - 2;   // biraz yukarıdan başla
const SL_H   = 72;
const SL_W   = EC_W;
const SL_X   = EC_X;

// Slider track
const TRACK_Y      = SL_Y + 30;   // Row2 merkezi
const TRACK_H      = 4;
const TRACK_RADIUS = 2;
const FILL_PCT     = 0.5;          // 0% = ortada → fill %50
const FILL_W       = Math.round(SL_W * FILL_PCT);

// Thumb (knob)
const THUMB_D      = 22;           // çap
const THUMB_R      = THUMB_D / 2;
const THUMB_X      = SL_X + FILL_W - THUMB_R;
const THUMB_Y      = TRACK_Y - THUMB_R + TRACK_H / 2;

// İç nokta
const DOT_D        = 8;
const DOT_R        = DOT_D / 2;

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function addRect({ name, x, y, w, h, fill, radius = 0, opacity = 1 }) {
  const r = await cmd('add_rectangle', {
    name, width: w, height: h, x, y,
    fillColor: fill,
    cornerRadius: radius,
    parentFrameId: PARENT,
    opacity,
  });
  console.log(' rect', name, '→', r.nodeId);
  await delay(250);
  return r;
}

async function addText({ name, text, x, y, fontSize, fill, align = 'LEFT', bold = false }) {
  const r = await cmd('add_text', {
    name, text, x, y,
    fontSize,
    fillColor: fill,
    parentFrameId: PARENT,
    textAlign: align,
    fontWeight: bold ? 600 : 400,
  });
  console.log(' text', name, '→', r.nodeId);
  await delay(200);
  return r;
}

async function main() {
  console.log('=== Slider inşa ediliyor (Frame 3B) ===\n');

  // ── 0. Arka plan kaplama (Easy Calculation + biraz fazla) ──────────────
  console.log('0. Arka plan kaplama');
  await addRect({
    name: 'SliderBg',
    x: SL_X - 2, y: SL_Y - 4,
    w: SL_W + 4, h: SL_H + 8,
    fill: COLOR.surface,
  });

  // ── 1. Label: "Fiyat Sapması"  ────────────────────────────────────────
  console.log('\n1. Label');
  await addText({
    name: 'SliderLabel',
    text: 'Fiyat Sapması',
    x: SL_X, y: SL_Y + 2,
    fontSize: 12,
    fill: COLOR.textSecond,
  });

  // ── 2. Değer etiketi: "0,00 %"  ───────────────────────────────────────
  console.log('\n2. Değer etiketi');
  await addText({
    name: 'SliderValue',
    text: '0,00 %',
    x: SL_X + SL_W - 56, y: SL_Y + 1,
    fontSize: 13,
    fill: COLOR.textBlue,
    bold: true,
  });

  // ── 3. Track arka plan (tam genişlik) ─────────────────────────────────
  console.log('\n3. Track bg');
  await addRect({
    name: 'SliderTrackBg',
    x: SL_X, y: TRACK_Y,
    w: SL_W, h: TRACK_H,
    fill: COLOR.trackBg,
    radius: TRACK_RADIUS,
  });

  // ── 4. Sol negatif dolgu (kırmızımsı — sol yarı) ──────────────────────
  // Slider ortada 0% → sol: negatif alan (kırmızı/nötr), sağ: pozitif (yeşil)
  // Tasarım basitliği için tek renk fill (mavi) kullanalım, ortaya hizalı
  // sol dolgu (negatif taraf) — şimdilik 0'da olduğu için göstermiyoruz
  // sadece sağ tarafta küçük bir highlight
  await addRect({
    name: 'SliderTrackFill',
    x: SL_X + Math.round(SL_W * 0.5), y: TRACK_Y,
    w: 0, h: TRACK_H,
    fill: COLOR.trackFill,
    radius: TRACK_RADIUS,
  });

  // ── 5. Center tick (0% işareti) ───────────────────────────────────────
  console.log('\n5. Center tick');
  await addRect({
    name: 'SliderCenterTick',
    x: SL_X + Math.round(SL_W * 0.5) - 1,
    y: TRACK_Y - 4,
    w: 2, h: TRACK_H + 8,
    fill: COLOR.separator,
  });

  // ── 6. Thumb (ana daire) ───────────────────────────────────────────────
  console.log('\n6. Thumb dış');
  await addRect({
    name: 'SliderThumb',
    x: SL_X + Math.round(SL_W * 0.5) - THUMB_R,
    y: TRACK_Y - THUMB_R + TRACK_H / 2,
    w: THUMB_D, h: THUMB_D,
    fill: COLOR.thumb,
    radius: THUMB_R,
  });

  // ── 7. Thumb iç (beyaz nokta) ─────────────────────────────────────────
  console.log('\n7. Thumb iç');
  await addRect({
    name: 'SliderThumbDot',
    x: SL_X + Math.round(SL_W * 0.5) - DOT_R,
    y: TRACK_Y - DOT_R + TRACK_H / 2,
    w: DOT_D, h: DOT_D,
    fill: COLOR.thumbInner,
    radius: DOT_R,
  });

  // ── 8. Tick işaretleri (−20%, −10%, 0, +10%, +20%) ───────────────────
  console.log('\n8. Tick işaretleri');
  const tickPositions = [0, 0.25, 0.5, 0.75, 1.0];
  for (const pct of tickPositions) {
    if (pct === 0.5) continue; // center tick ayrıca çizildi
    await addRect({
      name: 'Tick_' + Math.round(pct * 100),
      x: SL_X + Math.round(SL_W * pct) - 1,
      y: TRACK_Y + TRACK_H + 2,
      w: 2, h: 4,
      fill: COLOR.separator,
    });
  }

  // ── 9. Alt etiketler ──────────────────────────────────────────────────
  console.log('\n9. Alt etiketler');
  const labels = [
    { text: '−20%', pct: 0,    align: 'LEFT'   },
    { text: '−10%', pct: 0.25, align: 'CENTER' },
    { text: '0%',   pct: 0.5,  align: 'CENTER' },
    { text: '+10%', pct: 0.75, align: 'CENTER' },
    { text: '+20%', pct: 1.0,  align: 'RIGHT'  },
  ];

  for (const l of labels) {
    const lx = SL_X + Math.round(SL_W * l.pct) - (l.align === 'CENTER' ? 16 : l.align === 'RIGHT' ? 32 : 0);
    await addText({
      name: 'RangeLabel_' + l.text,
      text: l.text,
      x: lx,
      y: SL_Y + 52,
      fontSize: 10,
      fill: l.pct === 0.5 ? COLOR.textPrimary : COLOR.textSecond,
      align: l.align,
    });
  }

  // ── 10. Üst ayırıcı çizgi ─────────────────────────────────────────────
  console.log('\n10. Üst separator');
  await addRect({
    name: 'SliderSeparatorTop',
    x: SL_X, y: SL_Y - 6,
    w: SL_W, h: 1,
    fill: COLOR.separator,
  });

  console.log('\n=== Slider tamamlandı ===');
  console.log('Frame 3B:', FRAME);
}

main().catch(e => console.error('KRITIK HATA:', e.message));

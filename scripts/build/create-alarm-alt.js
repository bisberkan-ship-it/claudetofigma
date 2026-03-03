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

// Mevcut 6 frame → en son x: 2350, genişlik: 375
// Yeni alternatif frame → x: 2805 (2350 + 375 + 80)
const ALT_FRAME_X = 2805;

// Level/surface token key (daha önce bulunmuştu)
const SURFACE_KEY = '4503d4627b553f04a8182e9278b607be03a15d28';

function hex(h) {
  const v = h.replace('#', '');
  return {
    r: parseInt(v.substring(0, 2), 16) / 255,
    g: parseInt(v.substring(2, 4), 16) / 255,
    b: parseInt(v.substring(4, 6), 16) / 255,
  };
}

// FK-Chips keys
const CHIP_SOLID_XSMALL = '3d30af69889e32ff781f16703a282456db58ee3a'; // X-Small Solid (seçili)
const CHIP_LINE_XSMALL  = 'fe87f308ddfb1511187faf9b442297805339dccb'; // X-Small Line (seçili değil)

// Create Alarm Page - Default key (local library)
const CREATE_ALARM_DEFAULT_KEY = '72074a821cf19bccf9c274cd905d42a79f973329';

// Mevcut Easy Calculation bölgesinin frame içi konumu (incelemeden)
// Create Alarm Page (0,0) → Create Alarm (0,0) → Concent (16,96) → Price (0,70) → Easy Calculation (0,56)
// Absolute: x=16, y=96+70+56=222, w=343, h=32
const EASY_CALC = { x: 16, y: 222, w: 343, h: 32 };

async function main() {
  console.log('Alternatif frame olusturuluyor...');

  // 1. Ana frame
  const frame = await cmd('create_frame', {
    name: '3B — Alarm Oluştur (Alternatif %)',
    width: 375, height: 812,
    x: ALT_FRAME_X, y: 0,
  });
  console.log('Frame:', frame.nodeId);

  // 2. level/surface background
  await cmd('bind_variable', { nodeId: frame.nodeId, variableKey: SURFACE_KEY, field: 'fills' });
  console.log('Background token bağlandı');
  await new Promise(r => setTimeout(r, 400));

  // 3. Create Alarm Page (Default) import et
  console.log('Create Alarm Page import ediliyor...');
  const alarmPage = await cmd('import_component_by_key', {
    key: CREATE_ALARM_DEFAULT_KEY,
    x: 0, y: 0,
    parentFrameId: frame.nodeId,
  });
  console.log('Alarm page:', alarmPage.nodeId, alarmPage.width + 'x' + alarmPage.height);
  await new Promise(r => setTimeout(r, 600));

  // 4. Easy Calculation alanını kapatan overlay container
  // Arkası level/elevation token rengiyle (#1E2235 Kripto Dark yaklaşık)
  const overlayBg = await cmd('add_rectangle', {
    width: EASY_CALC.w,
    height: 88, // genişletilmiş alan: 2 satır chip + padding
    x: EASY_CALC.x,
    y: EASY_CALC.y - 4,
    fillColor: hex('#161B2E'),
    parentFrameId: frame.nodeId,
  });
  console.log('Overlay bg:', overlayBg.nodeId);
  await new Promise(r => setTimeout(r, 300));

  // 5. Yüzde seçim başlığı
  const label = await cmd('add_text', {
    text: 'Hızlı Yüzde Seçimi',
    fontSize: 11,
    x: EASY_CALC.x,
    y: EASY_CALC.y - 2,
    fillColor: hex('#8A8FA8'),
    parentFrameId: frame.nodeId,
  });
  console.log('Label:', label.nodeId);
  await new Promise(r => setTimeout(r, 300));

  // 6. Chip'leri iki satır halinde ekle
  // Satır 1: -10% | -5% | -2%  (Line = seçili değil, ilk chip selected = Solid)
  // Satır 2: +2%  | +5% | +10%

  const chipW = 54;
  const chipH = 28;
  const chipGap = 8;
  const row1Y = EASY_CALC.y + 16;
  const row2Y = row1Y + chipH + 8;

  const row1Labels = ['-10%', '-5%', '-2%'];
  const row2Labels = ['+2%', '+5%', '+10%'];

  // Satır 1 — hepsi Line (seçili değil)
  for (let i = 0; i < row1Labels.length; i++) {
    console.log('Chip import: ' + row1Labels[i]);
    try {
      const chip = await cmd('import_component_by_key', {
        key: CHIP_LINE_XSMALL,
        x: EASY_CALC.x + i * (chipW + chipGap),
        y: row1Y,
        parentFrameId: frame.nodeId,
      });
      console.log('  OK:', chip.nodeId, chip.width + 'x' + chip.height);
    } catch(e) {
      console.error('  HATA:', e.message);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // Satır 2 — +2% Solid (seçili), diğerleri Line
  for (let i = 0; i < row2Labels.length; i++) {
    const isSelected = i === 0; // +2% seçili göster
    const chipKey = isSelected ? CHIP_SOLID_XSMALL : CHIP_LINE_XSMALL;
    console.log('Chip import: ' + row2Labels[i] + (isSelected ? ' (seçili)' : ''));
    try {
      const chip = await cmd('import_component_by_key', {
        key: chipKey,
        x: EASY_CALC.x + i * (chipW + chipGap),
        y: row2Y,
        parentFrameId: frame.nodeId,
      });
      console.log('  OK:', chip.nodeId, chip.width + 'x' + chip.height);
    } catch(e) {
      console.error('  HATA:', e.message);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // 7. "Özel" chip (en sağda, Line style)
  console.log('Özel chip ekleniyor...');
  try {
    const customChip = await cmd('import_component_by_key', {
      key: CHIP_LINE_XSMALL,
      x: EASY_CALC.x + 3 * (chipW + chipGap),
      y: row1Y,
      parentFrameId: frame.nodeId,
    });
    console.log('  OK:', customChip.nodeId);
  } catch(e) {
    console.error('  HATA:', e.message);
  }

  // 8. Alternatif açıklama etiketi (sol alt, fark belirtmek için)
  await new Promise(r => setTimeout(r, 400));
  await cmd('add_text', {
    text: '● Alternatif Tasarım — Preset Chip Seçimi',
    fontSize: 10,
    x: 16,
    y: 790,
    fillColor: hex('#5B8DEF'),
    parentFrameId: frame.nodeId,
  });

  console.log('\nAlternatif frame tamamlandi:', frame.nodeId);
  console.log('Konum: x=' + ALT_FRAME_X);
}

main().catch(e => console.error('KRITIK HATA:', e.message));

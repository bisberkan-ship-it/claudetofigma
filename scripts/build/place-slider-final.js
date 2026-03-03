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

// Konumlar (Frame 3B içi, abs):
// Price FKInput: y=166, h=54 → ends at y=220
// Easy Calculation: y=222, h=32 → ends at y=254 (bu slider'ın kapladığı alan)
// FKButton (instance iç): abs y=270, h=44

const FRAME_3B    = '39:52681';
const CONTAINER   = '39:53616';
const FK_BTN_INST = 'I39:52682;10995:25473;10774:509'; // instance içindeki button

// Slider: Easy Calculation alanından başla
const SLIDER_Y    = 222;
const SLIDER_H    = 100;   // mevcut auto-layout yüksekliği
const BTN_GAP     = 16;
const BTN_NEW_Y   = SLIDER_Y + SLIDER_H + BTN_GAP; // 222+100+16 = 338

async function main() {
  console.log('=== Slider son konumlandırma ===\n');

  // 1. Instance içindeki FKButton'u gizle
  console.log('1. Instance FKButton gizleniyor...');
  try {
    await cmd('update_node', { nodeId: FK_BTN_INST, visible: false });
    console.log('  ✓ FKButton gizlendi');
  } catch (e) {
    console.error('  ✗ gizleme başarısız:', e.message.substring(0, 80));
  }
  await delay(300);

  // 2. FKButton'u klonla → Frame 3B içine taşı
  console.log('\n2. FKButton klonlanıyor...');
  let btnCloneId = null;
  try {
    const clone = await cmd('clone_node', {
      nodeId: FK_BTN_INST,
      x: 16,
      y: BTN_NEW_Y,
    });
    console.log('  Klon nodeId:', clone.nodeId, '| x:', clone.x, 'y:', clone.y);
    btnCloneId = clone.nodeId;

    // Klonu Frame 3B'ye taşı
    await cmd('move_node', {
      nodeId: clone.nodeId,
      parentId: FRAME_3B,
      x: 16,
      y: BTN_NEW_Y,
    });
    // Klon visible yap
    await cmd('update_node', { nodeId: clone.nodeId, visible: true });
    console.log('  ✓ Klon Frame 3B içine taşındı: y=' + BTN_NEW_Y);
  } catch (e) {
    console.error('  ✗ klonlama/taşıma:', e.message.substring(0, 100));
  }
  await delay(300);

  // 3. SliderContainer'ı doğru konuma yerleştir
  console.log('\n3. Slider konumlandırılıyor...');
  // x=16 (Concent margin), y=SLIDER_Y (Easy Calc başlangıcı)
  await cmd('update_node', { nodeId: CONTAINER, x: 16, y: SLIDER_Y });
  console.log('  ✓ Slider → x=16, y=' + SLIDER_Y);
  await delay(200);

  // 4. Doğrulama
  console.log('\n=== Sonuç ===');
  const sc = await cmd('get_node_details', { nodeId: CONTAINER });
  console.log('SliderContainer: x=', sc.x, 'y=', sc.y, 'w=', sc.width, 'h=', sc.height);
  console.log('Slider kapsar: y=' + sc.y + ' → y=' + (sc.y + sc.height));
  if (btnCloneId) {
    const bc = await cmd('get_node_details', { nodeId: btnCloneId });
    console.log('Button klon: y=', bc.y, 'w=', bc.width, 'h=', bc.height);
  }
  console.log('\nLayout:');
  console.log('  Price FKInput:   y=166 → y=220');
  console.log('  [SliderContainer] y=' + sc.y + ' → y=' + (sc.y + sc.height));
  console.log('  [FKButton klon]  y=' + BTN_NEW_Y + ' → y=' + (BTN_NEW_Y + 44));
  console.log('\nTamamlandı.');
}

main().catch(e => console.error('KRİTİK HATA:', e.message));

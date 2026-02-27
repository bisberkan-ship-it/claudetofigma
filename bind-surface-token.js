const https = require('https');
const http = require('http');
const fs = require('fs');

const TOKEN = fs.readFileSync('.env', 'utf8').match(/FIGMA_TOKEN=(.*)/)[1].trim();
const LIB_FILE_KEY = 'aXNHzdXZaGSv4dlnVBhPND'; // 100 / Local Library
const FRAME_ID = '32:1293';

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.figma.com', path, method: 'GET',
      headers: { 'X-Figma-Token': TOKEN }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) reject(new Error(res.statusCode + ': ' + data.substring(0, 200)));
        else resolve(JSON.parse(data));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function cmd(action, params = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ action, params });
    const req = http.request({
      hostname: 'localhost', port: 9001, path: '/command', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.error) reject(new Error(parsed.error));
        else resolve(parsed.result);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // REST API ile 100 / Local Library variables al
  console.log('Library variables REST API ile aliniyor...');
  const varsData = await apiGet('/v1/files/' + LIB_FILE_KEY + '/variables/local');
  const variables = varsData.meta?.variables || {};
  const collections = varsData.meta?.variableCollections || {};

  console.log('Toplam variable:', Object.keys(variables).length);
  console.log('Collections:', Object.values(collections).map(c => c.name).join(', '));

  // 01-Color Tokens collection'ındaki level variable'larını bul
  const colorTokenCol = Object.values(collections).find(c => c.name === '01-Color Tokens');
  if (!colorTokenCol) {
    console.error('01-Color Tokens collection bulunamadi!');
    return;
  }
  console.log('\n01-Color Tokens modes:', colorTokenCol.modes.map(m => m.name).join(', '));

  // level/ ile başlayan variable'ları listele
  const levelVars = Object.values(variables).filter(v =>
    v.variableCollectionId === colorTokenCol.id &&
    v.name.startsWith('level/')
  );

  console.log('\nLevel variables:');
  levelVars.forEach(v => console.log(' ', v.name, '| key:', v.key, '| id:', v.id));

  // level/surface bul
  const surfaceVar = levelVars.find(v => v.name === 'level/surface');
  if (!surfaceVar) {
    console.error('level/surface bulunamadi!');
    levelVars.forEach(v => console.log('Mevcut:', v.name));
    return;
  }

  console.log('\nlevel/surface KEY:', surfaceVar.key);
  console.log('level/surface ID:', surfaceVar.id);

  // Kripto Dark modundaki değeri de göster
  const kriptoDarkMode = colorTokenCol.modes.find(m =>
    m.name.toLowerCase().includes('kripto dark') ||
    m.name.toLowerCase().includes('dark')
  );
  if (kriptoDarkMode) {
    const modeValue = surfaceVar.valuesByMode?.[kriptoDarkMode.modeId];
    if (modeValue?.type === 'VARIABLE_ALIAS') {
      console.log('Kripto Dark value: references another variable:', modeValue.id);
    } else if (modeValue?.r !== undefined) {
      const toHex = v => Math.round(v * 255).toString(16).padStart(2, '0');
      const hex = '#' + toHex(modeValue.r) + toHex(modeValue.g) + toHex(modeValue.b);
      console.log('Kripto Dark value:', hex);
    }
  }

  // Plugin üzerinden import et ve frame'e bağla
  console.log('\nPlugin ile import ediliyor...');
  try {
    const imported = await cmd('import_variable_by_key', { key: surfaceVar.key });
    console.log('Import OK:', imported.name, '| id:', imported.id);

    // Frame fill'ine bağla
    console.log('\nFrame fill\'ine baglanıyor...');
    const bound = await cmd('bind_variable', {
      nodeId: FRAME_ID,
      variableKey: surfaceVar.key,
      field: 'fills'
    });
    console.log('BASARILI! Bound variable:', bound.boundVariable, '| field:', bound.field);
  } catch (e) {
    console.error('Import/bind HATA:', e.message);

    // Fallback: level/surface Kripto Dark değerini resolve et
    console.log('\nFallback: Renk değeri direkt uygulanıyor...');
    // level/surface genellikle en koyu arka plan değil, surface katmanı
    // Kripto Dark mode'da level/surface ≈ #1F1F26
    await cmd('update_node', { nodeId: FRAME_ID, fillColor: '#1F1F26' });
    console.log('Renk #1F1F26 uygulandı (level/surface Kripto Dark yaklaşık değeri)');
  }

  // Final kontrol
  console.log('\n=== FINAL ===');
  const frame = await cmd('get_node_details', { nodeId: FRAME_ID });
  console.log('Frame:', frame.width + 'x' + frame.height);
  console.log('Fill:', JSON.stringify(frame.fills?.slice(0, 1)));
}

main().catch(e => console.error('HATA:', e.message));

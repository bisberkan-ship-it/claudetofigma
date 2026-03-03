const https = require('https');
const fs = require('fs');

const TOKEN = fs.readFileSync('.env', 'utf8').match(/FIGMA_TOKEN=(.*)/)[1].trim();
const FILE_KEY = 'aXNHzdXZaGSv4dlnVBhPND';

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.figma.com', path, method: 'GET',
      headers: { 'X-Figma-Token': TOKEN }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) reject(new Error(res.statusCode + ': ' + data.substring(0, 300)));
        else resolve(JSON.parse(data));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function rgbToHex(r, g, b) {
  const toHex = v => Math.round(v * 255).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

async function main() {
  console.log('Dosya bilgisi alınıyor...');
  const file = await apiGet('/v1/files/' + FILE_KEY + '?depth=1');
  console.log('Dosya:', file.name);
  console.log('Son güncelleme:', file.lastModified);

  // 1. Tüm componentler
  console.log('\nComponent\'ler alınıyor...');
  const compsData = await apiGet('/v1/files/' + FILE_KEY + '/components');
  const components = compsData.meta?.components || [];
  console.log('Toplam component:', components.length);

  // Component setleri
  const compSetsData = await apiGet('/v1/files/' + FILE_KEY + '/component_sets');
  const componentSets = compSetsData.meta?.component_sets || [];
  console.log('Toplam component set:', componentSets.length);

  // 2. Stiller
  console.log('\nStiller alınıyor...');
  const stylesData = await apiGet('/v1/files/' + FILE_KEY + '/styles');
  const styles = stylesData.meta?.styles || [];
  console.log('Toplam stil:', styles.length);

  // Gruplama
  const byType = {};
  styles.forEach(s => {
    byType[s.style_type] = byType[s.style_type] || [];
    byType[s.style_type].push(s);
  });

  // 3. Detaylı node analizi (ilk page, önemli node'lar)
  console.log('\nPage yapısı alınıyor...');
  const pages = file.document?.children || [];

  // Component'leri kategorilere ayır
  const categories = {};
  components.forEach(c => {
    const frame = c.containing_frame?.name || 'Uncategorized';
    const pageName = c.containing_frame?.pageName || 'Unknown Page';
    const key = pageName + ' / ' + frame;
    if (!categories[key]) categories[key] = [];
    categories[key].push({
      key: c.key,
      name: c.name,
      description: c.description,
      id: c.node_id,
    });
  });

  // Component set'leri kategorilere ayır
  const setCats = {};
  componentSets.forEach(cs => {
    const frame = cs.containing_frame?.name || 'Uncategorized';
    const pageName = cs.containing_frame?.pageName || 'Unknown Page';
    const key = pageName + ' / ' + frame;
    if (!setCats[key]) setCats[key] = [];
    setCats[key].push({
      key: cs.key,
      name: cs.name,
      description: cs.description,
      id: cs.node_id,
    });
  });

  // Sonuçları hazırla
  const analysis = {
    file: {
      key: FILE_KEY,
      name: file.name,
      lastModified: file.lastModified,
    },
    summary: {
      totalComponents: components.length,
      totalComponentSets: componentSets.length,
      totalStyles: styles.length,
      stylesByType: Object.fromEntries(
        Object.entries(byType).map(([type, arr]) => [type, arr.length])
      ),
      categories: Object.keys(categories).length,
    },
    components: {
      byCategory: categories,
      all: components.map(c => ({
        key: c.key,
        name: c.name,
        frame: c.containing_frame?.name,
        page: c.containing_frame?.pageName,
        description: c.description,
        nodeId: c.node_id,
      })),
    },
    componentSets: {
      byCategory: setCats,
      all: componentSets.map(cs => ({
        key: cs.key,
        name: cs.name,
        frame: cs.containing_frame?.name,
        page: cs.containing_frame?.pageName,
        description: cs.description,
        nodeId: cs.node_id,
      })),
    },
    styles: {
      byType: byType,
      all: styles.map(s => ({
        key: s.key,
        name: s.name,
        type: s.style_type,
        description: s.description,
        nodeId: s.node_id,
      })),
    },
  };

  // Kaydet
  fs.writeFileSync('local-library-analysis.json', JSON.stringify(analysis, null, 2));
  console.log('\nAnaliz kaydedildi: local-library-analysis.json');

  // Özet yazdır
  console.log('\n=== OZET ===');
  console.log('Components:', analysis.summary.totalComponents);
  console.log('Component Sets:', analysis.summary.totalComponentSets);
  console.log('Styles:', analysis.summary.totalStyles, '|', JSON.stringify(analysis.summary.stylesByType));
  console.log('\nKategoriler:');
  Object.entries(categories).slice(0, 30).forEach(([cat, items]) => {
    console.log(' ', cat, '(' + items.length + ' component)');
  });
  console.log('\nStil tipleri:');
  Object.entries(byType).forEach(([type, items]) => {
    console.log(' ', type + ':', items.length);
    items.slice(0, 5).forEach(s => console.log('    -', s.name));
  });
}

main().catch(e => {
  console.error('HATA:', e.message);
  process.exit(1);
});

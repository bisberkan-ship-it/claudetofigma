const https = require('https');
const fs = require('fs');
const TOKEN = fs.readFileSync('.env', 'utf8').match(/FIGMA_TOKEN=(.*)/)[1].trim();

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.figma.com', path, method: 'GET',
      headers: { 'X-Figma-Token': TOKEN }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode !== 200) reject(new Error(res.statusCode + ': ' + d.substring(0, 200)));
        else resolve(JSON.parse(d));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Known FellowKit file keys from previous sessions
const FK_FILES = [
  { key: 'aJtIIFR51thwzjYAAhf6H6', name: 'FK-Chips' },
  { key: 'k6PMBkpjwmpKnwCdevrNA9', name: 'FK-Segmented Control' },
];

// Local Library
const LOCAL_LIB = 'aXNHzdXZaGSv4dlnVBhPND';

const SLIDER_KEYWORDS = ['slider', 'range', 'slide', 'scrub', 'progress bar', 'knob', 'thumb'];

async function searchComponents(fileKey, fileName) {
  console.log(`\n=== ${fileName} (${fileKey}) ===`);
  try {
    const data = await apiGet(`/v1/files/${fileKey}/components`);
    const comps = data.meta?.components || [];
    console.log(`Toplam: ${comps.length} bileşen`);

    const found = comps.filter(c =>
      SLIDER_KEYWORDS.some(k => c.name.toLowerCase().includes(k))
    );

    if (found.length === 0) {
      console.log('Slider/Range bulunamadı');
      // Show all component names for manual review
      const unique = [...new Set(comps.map(c => c.containing_frame?.name || c.name))];
      console.log('Frame/kategori listesi (ilk 40):', unique.slice(0, 40).join(' | '));
    } else {
      found.forEach(c => console.log(' FOUND:', c.name, '| key:', c.key));
    }
  } catch (e) {
    console.error('HATA:', e.message);
  }
}

async function main() {
  // Search local lib
  await searchComponents(LOCAL_LIB, '100 / Local Library');

  // Search FK files
  for (const f of FK_FILES) {
    await searchComponents(f.key, f.name);
  }

  // Also search local lib by component set names
  console.log('\n=== Local Library — Component Set adları ===');
  try {
    const data = await apiGet(`/v1/files/${LOCAL_LIB}/component_sets`);
    const sets = data.meta?.component_sets || [];
    console.log('Toplam set:', sets.length);
    const sliderSets = sets.filter(c =>
      SLIDER_KEYWORDS.some(k => c.name.toLowerCase().includes(k))
    );
    if (sliderSets.length === 0) {
      console.log('Slider set bulunamadı');
      // show all set names
      sets.slice(0, 60).forEach(s => console.log(' -', s.name, '| key:', s.key));
    } else {
      sliderSets.forEach(s => console.log(' FOUND SET:', s.name, '| key:', s.key));
    }
  } catch (e) {
    console.error('HATA:', e.message);
  }
}

main().catch(e => console.error('KRITIK HATA:', e.message));

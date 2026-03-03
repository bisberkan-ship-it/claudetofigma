const fs = require('fs');
const https = require('https');
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

const data = JSON.parse(fs.readFileSync('local-library-analysis.json', 'utf8'));
const all = data.components.all;

// Trade / Orderbook / Inputs section — might have amount slider
const tradeKw = ['order', 'trade', 'amount', 'quantity', 'percent', 'ratio', 'leverage', 'easy', 'calc'];
const tradeComps = all.filter(c => c.name && tradeKw.some(k => c.name.toLowerCase().includes(k)));
console.log('=== Trade/Amount bileşenleri ===');
tradeComps.forEach(c => console.log(' -', c.name, '| key:', c.key));

// Filter components
const filterKw = ['filter', 'pair', 'range', 'date'];
const filterComps = all.filter(c => c.name && filterKw.some(k => c.name.toLowerCase().includes(k)));
console.log('\n=== Filter bileşenleri ===');
filterComps.forEach(c => console.log(' -', c.name, '| key:', c.key));

// Check "Alarms / Create Alarm" category
const alarmCat = data.components.byCategory['      ↪ Alarms / Create Alarm'] || [];
console.log('\n=== Alarms / Create Alarm kategori ===');
alarmCat.forEach(c => console.log(' -', c.name, '| key:', c.key));

// Orderbook category
Object.keys(data.components.byCategory).forEach(cat => {
  if (cat.toLowerCase().includes('order') || cat.toLowerCase().includes('trade')) {
    const items = data.components.byCategory[cat];
    console.log('\n=== Category:', cat, '===');
    items.forEach(c => console.log(' -', c.name, '| key:', c.key));
  }
});

async function main() {
  // Try looking for slider in the main design file
  console.log('\n=== Checking FK files for Slider ===');
  // Try FK-Input/Form files (possible file keys based on naming patterns)
  const possibleFKFiles = [
    'hZfzPUuv2bGOBqkRLtUyxV', // FK-Input (guessing)
    'wkSuEn0dPP5h3yrEi7FLTE', // FK-Forms
  ];
  // Just check what we know exists
  // FK-Atoms / Foundation usually has basic form elements

  // Actually let me search the local library API for slider-related component sets
  try {
    const localSets = await apiGet('/v1/files/aXNHzdXZaGSv4dlnVBhPND/component_sets');
    const sets = localSets.meta?.component_sets || [];
    const sliderSets = sets.filter(s =>
      ['slider', 'range', 'track', 'progress', 'percent', 'stepper', 'amount', 'quantity'].some(k =>
        s.name.toLowerCase().includes(k)
      )
    );
    console.log('Local lib slider-like sets:', sliderSets.length);
    sliderSets.forEach(s => console.log(' -', s.name, '| key:', s.key));

    // Also find "Order" or "Trade" component sets
    const tradeSets = sets.filter(s =>
      ['order', 'trade', 'easy', 'calc', 'quick', 'fast'].some(k =>
        s.name.toLowerCase().includes(k)
      )
    );
    console.log('\nTrade/Order sets:', tradeSets.length);
    tradeSets.forEach(s => console.log(' -', s.name, '| key:', s.key));

    // Broader: any set with "filter" or "input"
    const inputSets = sets.filter(s =>
      ['filter', 'input', 'form', 'FK'].some(k =>
        s.name.includes(k)
      )
    );
    console.log('\nInput/Filter sets (relevant):', inputSets.length);
    inputSets.forEach(s => console.log(' -', s.name, '| key:', s.key));
  } catch(e) {
    console.error('API error:', e.message);
  }
}

main().catch(e => console.error(e.message));

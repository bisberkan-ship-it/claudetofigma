const https = require('https');
const fs = require('fs');
const TOKEN = fs.readFileSync('.env', 'utf8').match(/FIGMA_TOKEN=(.*)/)[1].trim();
const LIB = 'aXNHzdXZaGSv4dlnVBhPND';

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'api.figma.com', path, method: 'GET',
      headers: { 'X-Figma-Token': TOKEN }
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => res.statusCode === 200 ? resolve(JSON.parse(d)) : reject(new Error(d.substring(0, 200))));
    }); req.on('error', reject); req.end();
  });
}

async function main() {
  const data = await apiGet(`/v1/files/${LIB}/variables/local`);
  const vars = data.meta?.variables || {};
  const cols = data.meta?.variableCollections || {};

  // 01-Color Tokens collection
  const col = Object.values(cols).find(c => c.name === '01-Color Tokens');
  const darkMode = col?.modes.find(m => m.name.toLowerCase().includes('kripto dark'));
  console.log('Collection:', col?.name, '| Kripto Dark modeId:', darkMode?.modeId);

  // level/* variables
  const levelVars = Object.values(vars).filter(v =>
    v.variableCollectionId === col?.id && v.name.startsWith('level/')
  );
  console.log('\n=== level/ variables ===');
  levelVars.forEach(v => {
    const val = v.valuesByMode?.[darkMode?.modeId];
    const display = val?.type === 'VARIABLE_ALIAS' ? `→ alias(${val.id})` :
      val ? `#${[val.r,val.g,val.b].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('')}` : '?';
    console.log(' ', v.name, '| key:', v.key, '|', display);
  });

  // text/* or content/*
  const textVars = Object.values(vars).filter(v =>
    v.variableCollectionId === col?.id &&
    (v.name.startsWith('text/') || v.name.startsWith('content/') || v.name.startsWith('icon/'))
  );
  console.log('\n=== text/content/icon variables ===');
  textVars.forEach(v => {
    const val = v.valuesByMode?.[darkMode?.modeId];
    const display = val?.type === 'VARIABLE_ALIAS' ? `→ alias(${val.id})` :
      val ? `#${[val.r,val.g,val.b].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('')}` : '?';
    console.log(' ', v.name, '| key:', v.key, '|', display);
  });

  // brand/* or primary/*
  const brandVars = Object.values(vars).filter(v =>
    v.variableCollectionId === col?.id &&
    (v.name.includes('brand') || v.name.includes('primary') || v.name.includes('accent') ||
     v.name.includes('action') || v.name.includes('interactive'))
  );
  console.log('\n=== brand/primary variables ===');
  brandVars.forEach(v => {
    const val = v.valuesByMode?.[darkMode?.modeId];
    const display = val?.type === 'VARIABLE_ALIAS' ? `→ alias(${val.id})` :
      val ? `#${[val.r,val.g,val.b].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('')}` : '?';
    console.log(' ', v.name, '| key:', v.key, '|', display);
  });

  // separator/divider/stroke
  const sepVars = Object.values(vars).filter(v =>
    v.variableCollectionId === col?.id &&
    (v.name.includes('separator') || v.name.includes('divider') || v.name.includes('stroke') || v.name.includes('border') || v.name.includes('outline'))
  );
  console.log('\n=== separator/stroke variables ===');
  sepVars.forEach(v => {
    const val = v.valuesByMode?.[darkMode?.modeId];
    const display = val?.type === 'VARIABLE_ALIAS' ? `→ alias(${val.id})` :
      val ? `#${[val.r,val.g,val.b].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('')}` : '?';
    console.log(' ', v.name, '| key:', v.key, '|', display);
  });

  // All variable names (for reference)
  const allNames = Object.values(vars)
    .filter(v => v.variableCollectionId === col?.id)
    .map(v => v.name).sort();
  console.log('\n=== Tüm 01-Color token adları ===');
  allNames.forEach(n => console.log(' ', n));
}

main().catch(e => console.error(e.message));

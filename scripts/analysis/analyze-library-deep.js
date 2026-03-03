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

async function main() {
  const existing = JSON.parse(fs.readFileSync('local-library-analysis.json', 'utf8'));
  const components = existing.components.all;
  const componentSets = existing.componentSets.all;

  // --- Variables ---
  console.log('Variables alınıyor...');
  let variables = { variables: {}, variableCollections: {} };
  try {
    variables = await apiGet('/v1/files/' + FILE_KEY + '/variables/local');
    const varCount = Object.keys(variables.meta?.variables || {}).length;
    const colCount = Object.keys(variables.meta?.variableCollections || {}).length;
    console.log('Variables:', varCount, '| Collections:', colCount);
  } catch(e) {
    console.log('Variables HATA:', e.message.substring(0, 100));
  }

  // --- Unique sayfa ve frame grupları ---
  const pages = {};
  components.forEach(c => {
    const page = c.page || 'Unknown';
    if (!pages[page]) pages[page] = new Set();
    pages[page].add(c.frame || 'Uncategorized');
  });
  componentSets.forEach(cs => {
    const page = cs.page || 'Unknown';
    if (!pages[page]) pages[page] = new Set();
    pages[page].add(cs.frame || 'Uncategorized');
  });

  // --- Component Set analizi (variant grupları) ---
  // İsimlerden ortak prefix'leri bul
  const prefixGroups = {};
  componentSets.forEach(cs => {
    // "Button/Primary", "Button/Secondary" -> "Button"
    const parts = cs.name.split('/');
    const prefix = parts[0].trim();
    if (!prefixGroups[prefix]) prefixGroups[prefix] = [];
    prefixGroups[prefix].push(cs.name);
  });

  // --- Variable analizi ---
  const varMeta = variables.meta || {};
  const varCollections = varMeta.variableCollections || {};
  const varItems = varMeta.variables || {};

  const collectionSummary = Object.values(varCollections).map(col => ({
    id: col.id,
    name: col.name,
    modes: col.modes?.map(m => m.name) || [],
    variableCount: col.variableIds?.length || 0,
  }));

  // Renk variable'larını çöz
  const colorVars = Object.values(varItems)
    .filter(v => v.resolvedType === 'COLOR')
    .map(v => ({
      name: v.name,
      collection: varCollections[v.variableCollectionId]?.name,
      modes: v.valuesByMode,
    }))
    .slice(0, 100);

  const floatVars = Object.values(varItems)
    .filter(v => v.resolvedType === 'FLOAT')
    .map(v => ({ name: v.name, collection: varCollections[v.variableCollectionId]?.name }))
    .slice(0, 50);

  const stringVars = Object.values(varItems)
    .filter(v => v.resolvedType === 'STRING')
    .map(v => ({ name: v.name, collection: varCollections[v.variableCollectionId]?.name }))
    .slice(0, 50);

  // --- Özet Yapı ---
  const deepAnalysis = {
    pages: Object.fromEntries(
      Object.entries(pages).map(([p, frames]) => [p, [...frames]])
    ),
    componentSetGroups: Object.fromEntries(
      Object.entries(prefixGroups)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 50)
        .map(([prefix, items]) => [prefix, items.length])
    ),
    variables: {
      collections: collectionSummary,
      totalVariables: Object.keys(varItems).length,
      byType: {
        COLOR: Object.values(varItems).filter(v => v.resolvedType === 'COLOR').length,
        FLOAT: Object.values(varItems).filter(v => v.resolvedType === 'FLOAT').length,
        STRING: Object.values(varItems).filter(v => v.resolvedType === 'STRING').length,
        BOOLEAN: Object.values(varItems).filter(v => v.resolvedType === 'BOOLEAN').length,
      },
      colorSamples: colorVars.slice(0, 30),
      floatSamples: floatVars.slice(0, 20),
    },
    topComponentSets: componentSets.slice(0, 50).map(cs => ({
      name: cs.name,
      key: cs.key,
      nodeId: cs.nodeId,
      frame: cs.frame,
      page: cs.page,
    })),
  };

  // Birleştir ve kaydet
  const full = { ...existing, deepAnalysis };
  fs.writeFileSync('local-library-analysis.json', JSON.stringify(full, null, 2));
  console.log('Guncellendi: local-library-analysis.json');

  // Konsol özeti
  console.log('\n=== SAYFA YAPISI ===');
  Object.entries(deepAnalysis.pages).forEach(([page, frames]) => {
    console.log('\nSayfa:', page);
    frames.slice(0, 10).forEach(f => console.log('  -', f));
    if (frames.length > 10) console.log('  ... ve', frames.length - 10, 'daha');
  });

  console.log('\n=== COMPONENT SET GRUPLARI (en çok variant) ===');
  Object.entries(deepAnalysis.componentSetGroups).slice(0, 20).forEach(([name, count]) => {
    console.log(' ', name, '(', count, 'variant set)');
  });

  console.log('\n=== VARIABLES ===');
  console.log('Toplam:', deepAnalysis.variables.totalVariables);
  console.log('Tipler:', JSON.stringify(deepAnalysis.variables.byType));
  deepAnalysis.variables.collections.forEach(col => {
    console.log(' ', col.name, '| Modes:', col.modes.join(', '), '| Vars:', col.variableCount);
  });

  if (colorVars.length > 0) {
    console.log('\nÖrnek renk variable\'ları:');
    colorVars.slice(0, 15).forEach(v => console.log(' ', v.collection + '/' + v.name));
  }
}

main().catch(e => {
  console.error('HATA:', e.message);
  process.exit(1);
});

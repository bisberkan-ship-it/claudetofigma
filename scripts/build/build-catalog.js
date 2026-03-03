const fs = require('fs');
const data = JSON.parse(fs.readFileSync('local-library-analysis.json', 'utf8'));

// Component setleri page göre grupla
const byPage = {};
data.componentSets.all.forEach(cs => {
  const page = (cs.page || 'Unknown').trim().replace(/[↪►•]/g, '').trim();
  if (!byPage[page]) byPage[page] = [];
  byPage[page].push({
    name: cs.name,
    key: cs.key,
    nodeId: cs.nodeId,
    frame: cs.frame
  });
});

// Component'leri de grupla
const compByPage = {};
data.components.all.forEach(c => {
  const page = (c.page || 'Unknown').trim().replace(/[↪►•]/g, '').trim();
  if (!compByPage[page]) compByPage[page] = 0;
  compByPage[page]++;
});

// Variables - color tokens
const varData = data.deepAnalysis.variables;
const colorTokens = varData.colorSamples.map(v => v.name);

// Katalog oluştur
const catalog = {
  meta: {
    fileKey: 'aXNHzdXZaGSv4dlnVBhPND',
    fileName: '100 / Local Library',
    lastModified: '2026-02-17T12:48:41Z',
    totalComponents: data.summary.totalComponents,
    totalComponentSets: data.summary.totalComponentSets,
  },
  colorTokens: {
    collection: '01-Color Tokens',
    modes: ['Kripto Dark', 'Kripto Light', 'Hisse Dark', 'Hisse Light', 'Global Dark', 'Global Light'],
    tokens: colorTokens,
  },
  typography: {
    collection: 'Typography',
    modes: ['Mobile', 'Desktop'],
    varCount: 17,
  },
  screens: Object.fromEntries(
    Object.entries(byPage).map(([page, sets]) => [
      page,
      {
        componentSetCount: sets.length,
        componentCount: compByPage[page] || 0,
        componentSets: sets.map(s => ({
          name: s.name,
          key: s.key,
          nodeId: s.nodeId,
        })),
      }
    ])
  ),
  usageGuide: {
    importByKey: 'import_component_by_key aracini kullan - key parametresi ile',
    bindVariable: 'bind_variable - variableKey ile renk token bagla',
    listComponents: 'search_components - local componentleri ara',
    exampleFlow: [
      '1. search_components ile component bul',
      '2. create_instance ile frame icine yerlestir',
      '3. bind_variable ile renk tokeni bagla',
      '4. set_auto_layout ile responsive duzen uygula',
    ],
  },
};

fs.writeFileSync('local-library-catalog.json', JSON.stringify(catalog, null, 2));
console.log('Katalog kaydedildi: local-library-catalog.json');
console.log('\nEkran sayisi:', Object.keys(byPage).length);
Object.entries(byPage).forEach(([page, sets]) => {
  console.log('\n' + page + ' (' + sets.length + ' component set):');
  sets.slice(0, 8).forEach(s => {
    console.log('  [' + s.key.substring(0,12) + '...] ' + s.name);
  });
  if (sets.length > 8) console.log('  ... ve', sets.length - 8, ' daha');
});

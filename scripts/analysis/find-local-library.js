const https = require('https');
const fs = require('fs');

const TOKEN = fs.readFileSync('.env', 'utf8').match(/FIGMA_TOKEN=(.*)/)[1].trim();

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.figma.com', path, method: 'GET',
      headers: { 'X-Figma-Token': TOKEN }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) resolve({ _status: res.statusCode, _err: data.substring(0, 200) });
        else resolve(JSON.parse(data));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== Strateji 1: /v1/me ===');
  const me = await apiGet('/v1/me');
  console.log('User:', me.handle, me.id);

  console.log('\n=== Strateji 2: Bilinen dosyadan proje/team bul ===');
  // Register dosyası: AvviE6CV0aUug9xfQgqgNi
  const regFile = await apiGet('/v1/files/AvviE6CV0aUug9xfQgqgNi?branch_data=true');
  console.log('Register keys:', Object.keys(regFile).join(', '));
  if (regFile.branches) console.log('Branches:', regFile.branches);

  console.log('\n=== Strateji 3: library_content endpointleri ===');
  const libEndpoints = [
    '/v1/files/AvviE6CV0aUug9xfQgqgNi/libraries',
    '/v1/files/AvviE6CV0aUug9xfQgqgNi/published_components',
  ];
  for (const ep of libEndpoints) {
    const r = await apiGet(ep);
    if (!r._status) console.log(ep, '->', JSON.stringify(r).substring(0, 200));
    else console.log(ep, '-> ERROR', r._status, r._err.substring(0, 80));
  }

  console.log('\n=== Strateji 4: component key uzerinden file key bul ===');
  // Bilinen bir FK component key'i - 1foGqXD8NLxXLs97OXRjy5 FK-Icons dosyasından
  // Register dosyasındaki componentleri listele
  const comps = await apiGet('/v1/files/AvviE6CV0aUug9xfQgqgNi/components');
  if (!comps._status) {
    console.log('Register components:', comps.meta?.components?.length || 0);
    // Hangi dosyalardan import ediliyor?
    const remoteSources = new Set();
    (comps.meta?.components || []).forEach(c => {
      if (c.remote && c.containing_frame) remoteSources.add(c.file_key);
    });
    console.log('Remote sources:', [...remoteSources].slice(0, 10));
  }

  console.log('\n=== Strateji 5: component sets ===');
  const compSets = await apiGet('/v1/files/AvviE6CV0aUug9xfQgqgNi/component_sets');
  if (!compSets._status) {
    console.log('Component sets:', compSets.meta?.component_sets?.length || 0);
  }

  // Tüm bilinen file keyleri dene: hangisi Local Library?
  console.log('\n=== Strateji 6: Library endpoint ile bilinen file keyleri sorgula ===');
  const knownFileKeys = [
    '1foGqXD8NLxXLs97OXRjy5', // FK-Icons
    'Nlit2JQKPm0l2Z5fWMD983', // FK-Button
    'moFa24gGdMnmyNzJyscO0O', // FK-Table Header
  ];
  for (const fk of knownFileKeys) {
    const r = await apiGet('/v1/files/' + fk + '/components');
    if (!r._status) {
      const fileInfo = await apiGet('/v1/files/' + fk + '?depth=1');
      console.log(fk, ':', fileInfo.name, '| components:', r.meta?.components?.length);
    }
    await new Promise(r => setTimeout(r, 200));
  }
}

main().catch(console.error);

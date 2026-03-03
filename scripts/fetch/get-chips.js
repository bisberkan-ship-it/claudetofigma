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
        if (res.statusCode !== 200) reject(new Error(res.statusCode + ': ' + d.substring(0, 150)));
        else resolve(JSON.parse(d));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== FK-Chips ===');
  const chips = await apiGet('/v1/files/aJtIIFR51thwzjYAAhf6H6/components');
  chips.meta.components.forEach(c =>
    console.log(c.name, '| key:', c.key)
  );

  console.log('\n=== FK-Segmented Control ===');
  const seg = await apiGet('/v1/files/k6PMBkpjwmpKnwCdevrNA9/components');
  seg.meta.components.forEach(c =>
    console.log(c.name, '| key:', c.key)
  );
}

main().catch(e => console.error(e.message));

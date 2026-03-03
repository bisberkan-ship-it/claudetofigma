const http = require('http');

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
  // Tam property adını kullan (hash dahil)
  const result = await cmd('set_variant', {
    nodeId: '34:4788',
    variantProperties: { 'Show Search#10774:5': false }
  });
  console.log('Properties:', JSON.stringify(result.componentProperties));
}

main().catch(e => console.error('HATA:', e.message));

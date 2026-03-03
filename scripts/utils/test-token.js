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
        if (res.statusCode !== 200) reject(new Error(res.statusCode + ': ' + data.substring(0, 400)));
        else resolve(JSON.parse(data));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // 1. Kullanıcı bilgisi
  try {
    const me = await apiGet('/v1/me');
    console.log('Kullanici:', me.handle, '|', me.email);
    console.log('ID:', me.id);

    // 2. Team listesi - user ID gerekiyor
    if (me.id) {
      try {
        const teams = await apiGet('/v1/users/' + me.id + '/teams');
        console.log('Teams:', JSON.stringify(teams, null, 2));
      } catch(e) {
        console.log('/v1/users/teams HATA:', e.message.substring(0,200));
      }
    }
  } catch(e) {
    console.log('/v1/me HATA:', e.message.substring(0,300));
  }
}

main();

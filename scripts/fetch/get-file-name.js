const https = require('https');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const TOKEN = env.match(/FIGMA_TOKEN=(.*)/)[1].trim();
const FILE_KEY = 'aXNHzdXZaGSv4dlnVBhPND';

function apiGet(path) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.figma.com',
            path: path,
            method: 'GET',
            headers: { 'X-Figma-Token': TOKEN }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode !== 200) resolve(null);
                else try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function main() {
    const file = await apiGet(`/v1/files/${FILE_KEY}?depth=1`);
    if (file) {
        console.log(`FILE NAME: ${file.name}`);
    } else {
        console.log('Failed to fetch file.');
    }
}
main();

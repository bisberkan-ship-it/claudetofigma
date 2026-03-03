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
    console.log(`Fetching file ${FILE_KEY} pages...`);
    const file = await apiGet(`/v1/files/${FILE_KEY}?depth=2`);

    if (!file) {
        console.log('Failed to fetch file');
        return;
    }

    console.log(`File: ${file.name}`);
    console.log(`Last Modified: ${file.lastModified}`);

    console.log('\nPages:');
    file.document.children.forEach(page => {
        console.log(`- ${page.name} (${page.id})`);
    });

    // Check node 0:1 specifically if it exists in the children
    const node01 = file.document.children.find(p => p.id === '0:1');
    if (node01) {
        console.log(`\nNode 0:1 is page: "${node01.name}"`);
    }
}

main();

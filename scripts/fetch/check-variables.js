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
                if (res.statusCode !== 200) {
                    console.log(`Error ${res.statusCode}: ${data.substring(0, 100)}`);
                    resolve(null);
                }
                else try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function main() {
    console.log(`Fetching variables for file ${FILE_KEY}...`);
    const data = await apiGet(`/v1/files/${FILE_KEY}/variables/local`);

    if (!data || !data.meta || !data.meta.variableCollections) {
        console.log('No variables found or failed to fetch.');
        return;
    }

    console.log('Variable Collections:');
    const collections = data.meta.variableCollections;
    for (const [id, col] of Object.entries(collections)) {
        console.log(`- ${col.name} (id: ${id})`);
        if (col.name.toLowerCase().includes("local library") || col.name.startsWith("100")) {
            console.log(`  !!! FOUND MATCH: ${col.name} !!!`);
        }
    }
}

main();

const https = require('https');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const tokenMatch = env.match(/FIGMA_TOKEN=(.*)/);
const TOKEN = tokenMatch ? tokenMatch[1].trim() : '';

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
                console.log(`[${res.statusCode}] ${path}`);
                if (res.statusCode !== 200) {
                    console.log('Error body:', data);
                } else {
                    try {
                        const json = JSON.parse(data);
                        console.log('Response:', JSON.stringify(json, null, 2));
                    } catch (e) {
                        console.log('Body:', data);
                    }
                }
                resolve();
            });
        });
        req.on('error', (e) => {
            console.error(e);
            resolve();
        });
        req.end();
    });
}

async function main() {
    console.log('Checking token...');
    await apiGet('/v1/me');

    // Try to access the first file key found previously if any, or a known public file?
    // I'll try one of the keys from the previous log: 1foGqXD8NLxXLs97OXRjy5
    console.log('\nChecking file access for 1foGqXD8NLxXLs97OXRjy5...');
    await apiGet('/v1/files/1foGqXD8NLxXLs97OXRjy5?depth=1');
}

main();

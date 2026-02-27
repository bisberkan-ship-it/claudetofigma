const https = require('https');
const fs = require('fs');

// Read token from .env
const env = fs.readFileSync('.env', 'utf8');
const tokenMatch = env.match(/FIGMA_TOKEN=(.*)/);
const TOKEN = tokenMatch ? tokenMatch[1].trim() : '';

if (!TOKEN) {
    console.error('No ID found in .env');
    process.exit(1);
}

const keysData = JSON.parse(fs.readFileSync('external_keys.json', 'utf8'));
const keys = keysData.result.keys;

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
                if (res.statusCode === 429) {
                    console.error(`Status 429: Rate limit exceeded for path ${path}`);
                    reject(new Error('Rate limit exceeded'));
                    return;
                }
                if (res.statusCode !== 200) {
                    console.error(`Status ${res.statusCode} for path ${path}: ${data.substring(0, 100)}`);
                    resolve(null);
                    return;
                }
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    console.error(`JSON Parse error for path ${path}`);
                    resolve(null);
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function main() {
    console.log(`Resolving ${keys.length} keys...`);

    const fileKeys = new Set();
    const fileInfos = new Map(); // fileKey -> { name, lastModified, thumbnailUrl }

    // 1. Resolve component keys to file keys
    // processing in batches of 5 to avoid rate limits
    for (let i = 0; i < keys.length; i += 5) {
        const batch = keys.slice(i, i + 5);
        await Promise.all(batch.map(async (key) => {
            try {
                const comp = await apiGet(`/v1/components/${key}`);
                if (comp && comp.meta && comp.meta.file_key) {
                    fileKeys.add(comp.meta.file_key);
                }
            } catch (e) {
                console.error(`Error resolving key ${key}: ${e.message}`);
            }
        }));
        // Small delay between batches
        await new Promise(r => setTimeout(r, 200));
        process.stdout.write('.');
    }
    console.log('\nFound file keys:', fileKeys.size);

    // 2. Resolve file info
    for (const fileKey of fileKeys) {
        try {
            // We can use GET /v1/files/:key to get name and lastModified
            // But fetching the whole file is heavy. 
            // GET /v1/projects/:project_id/files lists files, but we don't know project id.
            // However, GET /v1/files/:key metadata is usually near the top.
            // Actually, GET /v1/files/:key returns the document.
            // Is there a lighter endpoint? 
            // GET /v1/files/:key?depth=1 is lighter.
            const file = await apiGet(`/v1/files/${fileKey}?depth=1`);
            if (file) {
                fileInfos.set(fileKey, {
                    name: file.name,
                    lastModified: file.lastModified,
                    thumbnailUrl: file.thumbnailUrl,
                    editorType: file.editorType
                });
            }
        } catch (e) {
            console.error(`Error resolving file ${fileKey}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 200));
    }

    console.log('\n\n=== External Files ===');
    const results = Array.from(fileInfos.values());
    console.log(JSON.stringify(results, null, 2));
}

main();

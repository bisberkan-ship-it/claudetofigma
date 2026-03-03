const https = require('https');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const tokenMatch = env.match(/FIGMA_TOKEN=(.*)/);
const TOKEN = tokenMatch ? tokenMatch[1].trim() : '';

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
                if (res.statusCode !== 200) {
                    resolve(null);
                    return;
                }
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(null);
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

function findNode(node, name) {
    if (node.name && node.name.toLowerCase().includes(name.toLowerCase())) return node;
    if (node.children) {
        for (const child of node.children) {
            const found = findNode(child, name);
            if (found) return found;
        }
    }
    return null;
}

async function main() {
    console.log(`Resolving file keys for ${keys.length} components...`);

    const fileKeys = new Set();

    // 1. Resolve component keys to file keys
    for (let i = 0; i < keys.length; i += 10) {
        const batch = keys.slice(i, i + 10);
        await Promise.all(batch.map(async (key) => {
            try {
                const comp = await apiGet(`/v1/components/${key}`);
                if (comp && comp.meta && comp.meta.file_key) {
                    fileKeys.add(comp.meta.file_key);
                }
            } catch (e) { }
        }));
        await new Promise(r => setTimeout(r, 200));
    }

    console.log(`Found ${fileKeys.size} unique file keys.`);
    console.log('Searching for "100 / Local Library" in all files...');

    for (const fileKey of fileKeys) {
        process.stdout.write(`Checking file ${fileKey}... `);
        const file = await apiGet(`/v1/files/${fileKey}?depth=3`);

        if (file) {
            console.log(`[${file.name}]`);
            const target = findNode(file.document, "Local Library");
            if (target) {
                console.log(`\n!!! FOUND MATCH in file: ${file.name} !!!`);
                console.log(`Node ID: ${target.id}`);
                console.log(`Type: ${target.type}`);

                // Analyze it immediately
                analyzeNode(target);
                return; // Stop after finding first match? Or keep looking? Let's stop.
            }
        } else {
            console.log('failed to fetch');
        }
        await new Promise(r => setTimeout(r, 200));
    }
    console.log('\nDone.');
}

function analyzeNode(node) {
    console.log(`\nAnalysis of ${node.name}:`);
    console.log(`Type: ${node.type}`);
    if (node.children) {
        console.log(`Children count: ${node.children.length}`);
        node.children.forEach(c => {
            console.log(`- ${c.name} (${c.type})`);
            if (c.children) {
                c.children.forEach(cc => console.log(`  - ${cc.name} (${cc.type})`));
            }
        });
    }
}

main();

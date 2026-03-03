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
                    console.log(`Error ${res.statusCode}: ${data.substring(0, 200)}`);
                    resolve(null);
                } else {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        console.log('JSON parse error');
                        resolve(null);
                    }
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
    console.log(`Fetching file ${FILE_KEY} structure...`);
    // depth=2 to see pages and their direct children (frames)
    const file = await apiGet(`/v1/files/${FILE_KEY}?depth=2`);

    if (!file) {
        console.log('Failed to fetch file');
        return;
    }

    // Check components and styles metadata
    console.log(`Checking ${Object.keys(file.components || {}).length} components...`);
    for (const [key, comp] of Object.entries(file.components || {})) {
        if (comp.name.toLowerCase().includes("local library")) {
            console.log(`FOUND Component: ${comp.name} (key: ${key}, nodeId: ${comp.nodeId})`);
        }
    }

    console.log(`Checking ${Object.keys(file.componentSets || {}).length} component sets...`);
    for (const [key, set] of Object.entries(file.componentSets || {})) {
        if (set.name.toLowerCase().includes("local library")) {
            console.log(`FOUND ComponentSet: ${set.name} (key: ${key}, nodeId: ${set.nodeId})`);
        }
    }

    console.log(`Checking ${Object.keys(file.styles || {}).length} styles...`);
    for (const [key, style] of Object.entries(file.styles || {})) {
        if (style.name.toLowerCase().includes("local library")) {
            console.log(`FOUND Style: ${style.name} (key: ${key}, nodeId: ${style.nodeId})`);
        }
    }

    /*
    const targetName = "Local Library";
    const target = findNode(file.document, targetName);

    if (target) {
        console.log(`\nFound Node: "${targetName}"`);
        console.log(`ID: ${target.id}`);
        console.log(`Type: ${target.type}`);
        // ...
    } else {
       // ...
    }
    */
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


const https = require('https');
const { readFileSync } = require('fs');
const { resolve } = require('path');

// Load .env
const envPath = resolve(__dirname, '.env');
try {
    const envContent = readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
        const [key, ...vals] = line.split('=');
        if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
    }
} catch { }

const TOKEN = process.env.FIGMA_TOKEN; // Fallback to provided token
const FILE_KEY = 'AvviE6CV0aUug9xfQgqgNi';

const options = {
    hostname: 'api.figma.com',
    path: `/v1/files/${FILE_KEY}`, // Fetch entire file
    method: 'GET',
    headers: {
        'X-Figma-Token': TOKEN
    }
};

console.log('Fetching file...');

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        if (res.statusCode !== 200) {
            console.error(`Error: ${res.statusCode} - ${data}`);
            return;
        }

        try {
            const json = JSON.parse(data);
            const document = json.document;

            console.log(`Document: ${json.name}`);
            console.log('Searching for "FRegister"...');

            const found = findNodeByName(document, 'FRegister');
            if (found) {
                console.log('Found "FRegister":');
                printNodeSummary(found);
            } else {
                console.log('Node "FRegister" not found in this file.');
                // List top level pages to be helpful
                console.log('Top level pages:');
                document.children.forEach(c => console.log(` - ${c.name} (${c.id})`));
            }

        } catch (e) {
            console.error('Failed to parse response:', e);
        }
    });
});

req.on('error', (e) => {
    console.error(`Request error: ${e.message}`);
});

req.end();

function findNodeByName(node, name) {
    if (node.name.includes(name)) return node;
    if (node.children) {
        for (const child of node.children) {
            const found = findNodeByName(child, name);
            if (found) return found;
        }
    }
    return null;
}

function printNodeSummary(node, depth = 0) {
    const indent = '  '.repeat(depth);
    const typeEmoji = node.type === 'COMPONENT' ? 'Cb' : node.type === 'INSTANCE' ? 'I' : node.type === 'FRAME' ? '#' : '-';

    console.log(`${indent}${typeEmoji} [${node.id}] ${node.name} (${node.type})`);

    if (node.children && depth < 3) { // Limit depth
        node.children.forEach(child => printNodeSummary(child, depth + 1));
    }
}

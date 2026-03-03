const http = require('http');

function sendCommand(action, params) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ action, params });
        const req = http.request({
            hostname: 'localhost',
            port: 9001,
            path: '/run',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.error) reject(json.error);
                    else resolve(json.result);
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

function findNodeRecursive(node, name) {
    if (node.name === name) return node;
    if (node.children) {
        for (const child of node.children) {
            const found = findNodeRecursive(child, name);
            if (found) return found;
        }
    }
    return null;
}

function findTextNodeWithChars(node, chars) {
    if (node.type === "TEXT" && node.characters === chars) return node;
    if (node.children) {
        for (const child of node.children) {
            const found = findTextNodeWithChars(child, chars);
            if (found) return found;
        }
    }
    return null;
}

async function main() {
    console.log('Finding "Deneme" frame...');
    const result = await sendCommand('find_node_by_name', { query: "Deneme" });

    if (!result || !result.nodes || result.nodes.length === 0) {
        console.log('Frame "Deneme" not found.');
        return;
    }

    const denemeNode = result.nodes[0];
    console.log(`Found Deneme: ${denemeNode.nodeId}`);

    // Get full details of Deneme to see children
    console.log('Fetching Deneme children...');
    const denemeDetails = await sendCommand('get_node_details', { nodeId: denemeNode.nodeId });

    // Find "FKTopNavigation ½" inside Deneme
    let header = null;
    if (denemeDetails.children) {
        header = denemeDetails.children.find(c => c.name === "FKTopNavigation ½");
    }

    if (!header) {
        console.log('Header "FKTopNavigation ½" not found in Deneme.');
        // Fallback: search recursively in Deneme for "Title"
    } else {
        console.log(`Found Header: ${header.name} (${header.nodeId})`);
    }

    // Now need to find "Title" text node within the header (or Deneme if header not found)
    // We need to get children of the header, which might require another call if not fully populated
    // get_node_details usually returns immediate children.
    // If "FKTopNavigation ½" is an INSTANCE, we might need to dig into it.

    // We have the header nodeId. Let's strictly search inside it.
    if (!header) {
        console.log('Header not found, cannot proceed safely.');
        return;
    }

    console.log(`Searching for "Title" inside header ${header.nodeId}...`);
    // Pass true for recursive child fetch if needed, or just standard BFS/DFS client side
    // We already have a findTitleInNode function below, let's use it.

    const targetNodeId = await findTitleInNode(header.nodeId);

    if (targetNodeId) {
        console.log(`Found Title node: ${targetNodeId}. Updating text...`);
        const updateRes = await sendCommand('update_text', {
            nodeId: targetNodeId,
            text: "Üyelik"
        });
        console.log('Update result:', updateRes);
    } else {
        console.log('Title node NOT found in header.');

        // Debug: list children of header
        console.log('Listing header children for debug:');
        const headerDetails = await sendCommand('get_node_details', { nodeId: header.nodeId });
        if (headerDetails && headerDetails.children) {
            headerDetails.children.forEach(c => console.log(`- ${c.name} (${c.type}) id:${c.nodeId}`));
        }
    }
}

// Updated recursive finder using get_node_details
// This fetches details (including children summary)
async function findTitleInNode(nodeId) {
    // console.log(`Checking node ${nodeId}...`);
    const details = await sendCommand('get_node_details', { nodeId });
    if (!details) return null;

    // Check match
    if (details.type === "TEXT") {
        if (details.name === "Title" || details.characters === "Title") {
            return details.nodeId;
        }
    }

    // Recurse
    if (details.children) {
        for (const child of details.children) {
            // Optimization: check child name before fetching details if possible?
            // details.children gives {id, name, type}
            if (child.type === "TEXT" && (child.name === "Title")) {
                // Potential match, verify chars?
                // Or just assume name match is enough?
                // Let's verify details to be sure.
                const childDetails = await sendCommand('get_node_details', { nodeId: child.nodeId });
                if (childDetails.characters === "Title") return child.nodeId;
                // If name is Title but chars are not, maybe still valid? 
                // User said "replace Title with Üyelik", implying content is Title.
                if (childDetails.name === "Title") return child.nodeId;
            }

            // If child is container, recurse
            if (["FRAME", "GROUP", "INSTANCE", "COMPONENT", "SECTION"].includes(child.type)) {
                const found = await findTitleInNode(child.nodeId);
                if (found) return found;
            }
        }
    }
    return null;
}

main();

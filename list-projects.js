const https = require('https');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const TOKEN = env.match(/FIGMA_TOKEN=(.*)/)[1].trim();

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
                } else {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(null);
                    }
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function main() {
    console.log('Fetching User ID...');
    const me = await apiGet('/v1/me');
    if (!me) return;

    console.log(`User: ${me.handle} (${me.id})`); // Fixed: use me.id

    // Try to get teams
    // Note: /v1/users/:id/teams is the endpoint
    console.log('Fetching Teams...');
    const teamsData = await apiGet(`/v1/users/${me.id}/teams`);

    if (!teamsData || !teamsData.teams) {
        console.log('Could not fetch teams.');
        return;
    }

    for (const team of teamsData.teams) {
        console.log(`Team: ${team.name} (${team.id})`);
        if (team.name.includes("Mobile")) {
            console.log(`  -> Found "Mobile" team! Listing projects...`);
            const projectsData = await apiGet(`/v1/teams/${team.id}/projects`);
            if (projectsData && projectsData.projects) {
                for (const project of projectsData.projects) {
                    console.log(`  Project: ${project.name} (${project.id})`);

                    // List files in project
                    const filesData = await apiGet(`/v1/projects/${project.id}/files`);
                    if (filesData && filesData.files) {
                        for (const file of filesData.files) {
                            console.log(`    File: ${file.name} (${file.key})`);
                            if (file.name === "Kripto Main") {
                                console.log(`\n!!! FOUND Kripto Main: key=${file.key} !!!`);
                                // We can save this key or trigger analysis
                            }
                        }
                    }
                }
            }
        }
    }
}

main();

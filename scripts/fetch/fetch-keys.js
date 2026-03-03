const https = require('https');
const TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = 'AvviE6CV0aUug9xfQgqgNi';

// All Kripto variant IDs
const ids = [
  '1:10716', '1:10752', '1:10788', '1:10824',
  '1:10860', '1:10896', '1:10932', '1:10968',
  '1:11004', '1:11040', '1:11076'
];

const idsParam = ids.join(',');

const req = https.request({
  hostname: 'api.figma.com',
  path: `/v1/files/${FILE_KEY}/components`,
  method: 'GET',
  headers: { 'X-Figma-Token': TOKEN }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.log('Error:', res.statusCode, data.substring(0, 500));
      return;
    }
    const json = JSON.parse(data);
    // Filter for our Kripto SSO Account components
    const filtered = json.meta.components.filter(c =>
      c.containing_frame &&
      c.containing_frame.name === 'Register -> SSO Account' &&
      c.name.includes('Kripto')
    );
    filtered.forEach(c => {
      console.log(`KEY: ${c.key} | ID: ${c.node_id} | Name: ${c.name}`);
    });
    if (filtered.length === 0) {
      // Show all SSO related
      const sso = json.meta.components.filter(c =>
        c.containing_frame &&
        c.containing_frame.name &&
        c.containing_frame.name.includes('SSO')
      );
      console.log('All SSO components found:', sso.length);
      sso.forEach(c => {
        console.log(`KEY: ${c.key} | ID: ${c.node_id} | Name: ${c.name}`);
      });
    }
  });
});
req.on('error', e => console.error(e));
req.end();

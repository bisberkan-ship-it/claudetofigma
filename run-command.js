const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ host: '0.0.0.0', port: 9000 });
let reqId = 0;

console.log('WS server listening on 9000, waiting for Figma plugin...');

wss.on('connection', (ws) => {
  console.log('Figma plugin connected!');

  function send(action, params) {
    return new Promise((resolve, reject) => {
      const id = String(++reqId);
      const timeout = setTimeout(() => reject('Timeout'), 10000);
      function handler(data) {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.id === id) {
            ws.removeListener('message', handler);
            clearTimeout(timeout);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        } catch(e) {}
      }
      ws.on('message', handler);
      ws.send(JSON.stringify({ id, action, params }));
    });
  }

  (async () => {
    try {
      console.log('\n=== Creating frame 375x812 ===');
      const frame = await send('create_frame', {
        name: 'Frame',
        width: 375,
        height: 812,
        x: 0,
        y: 0
      });
      console.log(JSON.stringify(frame, null, 2));
      console.log('\n=== SUCCESS ===');
    } catch(e) {
      console.log('ERROR:', e);
    }
    process.exit(0);
  })();
});

setTimeout(() => { console.log('No Figma connection received'); process.exit(1); }, 60000);

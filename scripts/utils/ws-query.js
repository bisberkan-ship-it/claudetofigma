const WebSocket = require('ws');

const ws = new WebSocket('ws://127.0.0.1:9000');
let reqId = 0;

function send(action, params = {}) {
  return new Promise((resolve, reject) => {
    const id = String(++reqId);
    const timeout = setTimeout(() => reject(new Error('Timeout 30s')), 30000);
    ws.on('message', function handler(data) {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        clearTimeout(timeout);
        ws.off('message', handler);
        if (msg.error) reject(new Error(msg.error));
        else resolve(msg.result);
      }
    });
    ws.send(JSON.stringify({ id, action, params }));
  });
}

ws.on('open', async () => {
  console.log('WS connected');
  try {
    console.log('\n--- Mevcut dosya ---');
    const fi = await send('get_file_info', {});
    console.log(JSON.stringify(fi));

    console.log('\n--- Library variables (team library) ---');
    const lv = await send('list_library_variables', { resolvedType: 'COLOR' });
    if (lv.collections) {
      for (const col of lv.collections) {
        console.log('  Library:', col.libraryName, '| Collection:', col.name, '| Vars:', col.variables.length);
      }
    }

    console.log('\n--- Local variables ---');
    const localVars = await send('list_variables', {});
    if (localVars.collections) {
      for (const col of localVars.collections) {
        console.log('  Collection:', col.name, '| Vars:', col.variables.length);
      }
    }

    console.log('\n--- Library components (ilk 20) ---');
    const lc = await send('list_library_components', {});
    if (lc.components) {
      console.log('Toplam:', lc.components.length);
      lc.components.slice(0, 20).forEach(c => console.log(' -', c.name));
    }

  } catch(e) {
    console.error('HATA:', e.message);
  } finally {
    ws.close();
  }
});

ws.on('error', e => console.error('WS HATA:', e.message));

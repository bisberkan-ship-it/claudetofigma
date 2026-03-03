const WebSocket = require('ws');

const ws = new WebSocket('ws://127.0.0.1:9000');

ws.on('open', () => {
  // First list variables to verify
  const listMsg = JSON.stringify({
    id: '1',
    action: 'list_variables',
    params: { resolvedType: 'COLOR' }
  });
  ws.send(listMsg);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());

  if (msg.id === '1') {
    console.log('=== COLOR Variables ===');
    const collections = msg.result?.collections || [];
    for (const col of collections) {
      console.log(`\nCollection: ${col.name}`);
      console.log(`Modes: ${col.modes.map(m => m.name).join(', ')}`);
      for (const v of col.variables) {
        console.log(`  ${v.name} (${v.id})`);
      }
    }

    // Now bind level/surface to the Register frame
    const bindMsg = JSON.stringify({
      id: '2',
      action: 'bind_variable',
      params: {
        nodeId: '3:4561',
        variableName: 'level/surface',
        field: 'fills'
      }
    });
    ws.send(bindMsg);
  }

  if (msg.id === '2') {
    if (msg.error) {
      console.log('\nBind error:', msg.error);
    } else {
      console.log('\n✓ Variable bound successfully!');
      console.log(JSON.stringify(msg.result, null, 2));
    }
    ws.close();
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message);
  // Try alternative port
  console.log('Trying to connect as a client to the MCP WS server...');
});

setTimeout(() => {
  console.log('Timeout - closing');
  ws.close();
  process.exit(0);
}, 10000);

import WebSocket from 'ws';

console.log('Attempting to connect to ws://localhost:9000...');
const ws = new WebSocket('ws://localhost:9000');

ws.on('open', function open() {
    console.log('Connected!');
    ws.close();
    process.exit(0);
});

ws.on('error', function error(err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
});

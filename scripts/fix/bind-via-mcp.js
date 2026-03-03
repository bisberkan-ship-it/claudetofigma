// This script acts as a mini MCP client that sends a request through stdio
// to the MCP server, which then forwards to the Figma plugin

const { spawn } = require('child_process');
const path = require('path');

// We need to send JSON-RPC messages to the MCP server via stdio
// The MCP server is already running as part of Claude Code
// So instead, let's connect directly to the WebSocket that the Figma plugin connects to

// The architecture is:
// Claude Code <-> MCP Server (stdio) <-> WebSocket Server (port 9000) <-> Figma Plugin
// We can't inject into the MCP<->Claude pipe, but the WS server accepts connections

// Actually the WS server in mcp-server/index.ts replaces figmaSocket on each new connection
// So if we connect, we'd disconnect the plugin. That's not what we want.

// Better approach: spawn a separate tiny WS server that the plugin can also talk to
// OR modify the existing code to accept multiple commands

// Simplest approach: Use the MCP server's tool call mechanism
// by spawning a new instance just for this one call

const { McpClient } = require('@modelcontextprotocol/sdk/client/index.js') || {};

// Actually, let's just use a raw JSON-RPC approach over stdin/stdout
const server = spawn('npx', ['tsx', path.join(__dirname, 'mcp-server/index.ts')], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: __dirname
});

let responseBuffer = '';

server.stdout.on('data', (data) => {
  responseBuffer += data.toString();
  // Try to parse JSON-RPC responses
  const lines = responseBuffer.split('\n');
  for (const line of lines) {
    if (line.trim()) {
      try {
        const msg = JSON.parse(line);
        console.log('Response:', JSON.stringify(msg, null, 2));
      } catch(e) {
        // Not complete JSON yet
      }
    }
  }
});

server.stderr.on('data', (data) => {
  const str = data.toString();
  if (str.includes('connected')) {
    console.log('Plugin status:', str.trim());
  }
});

// Wait for server to start, then send tool call
setTimeout(() => {
  // JSON-RPC call to list_variables
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'bind_variable',
      arguments: {
        nodeId: '3:4561',
        variableName: 'level/surface',
        field: 'fills'
      }
    }
  };

  const msg = JSON.stringify(request);
  const header = `Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n`;
  server.stdin.write(header + msg);
}, 3000);

setTimeout(() => {
  server.kill();
  process.exit(0);
}, 15000);

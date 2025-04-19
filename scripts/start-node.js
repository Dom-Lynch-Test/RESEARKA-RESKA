// Script to start a Hardhat node in the background
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting Hardhat node in the background...');

// Create logs directory if it doesn't exist
const logsDir = path.resolve(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Start Hardhat node with output redirected to files
const outLog = fs.openSync(path.resolve(logsDir, 'node-output.log'), 'w');
const errLog = fs.openSync(path.resolve(logsDir, 'node-error.log'), 'w');

const node = spawn('npx', ['hardhat', 'node', '--hostname', '127.0.0.1'], {
  detached: true,
  stdio: ['ignore', outLog, errLog]
});

// Detach the process so it continues running in the background
node.unref();

console.log('Hardhat node started in the background (PID:', node.pid, ')');
console.log('Logs are being written to logs/node-output.log and logs/node-error.log');
console.log('Wait a few seconds for the node to initialize before running tests...');

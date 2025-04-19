// Custom compile script to avoid EPIPE errors
const { execSync } = require('child_process');
const fs = require('fs');

console.log('Compiling contracts...');

try {
  // Run hardhat compile with output redirected to a file
  execSync('npx hardhat compile', { 
    stdio: ['ignore', fs.openSync('compile-output.log', 'w'), fs.openSync('compile-error.log', 'w')]
  });
  console.log('Compilation successful! See compile-output.log for details.');
} catch (error) {
  console.error('Compilation failed. See compile-error.log for details.');
  process.exit(1);
}

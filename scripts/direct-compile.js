// Direct compilation script using solc
const fs = require('fs');
const path = require('path');
const solc = require('solc');

function findImports(importPath) {
  // Handle OpenZeppelin imports
  if (importPath.startsWith('@openzeppelin/')) {
    const npmPath = path.resolve(__dirname, '../node_modules', importPath);
    try {
      return { contents: fs.readFileSync(npmPath, 'utf8') };
    } catch (e) {
      console.error(`Error reading import file ${npmPath}:`, e);
      return { error: `File not found: ${importPath}` };
    }
  }
  
  // Handle local imports
  try {
    const localPath = path.resolve(__dirname, '../contracts', importPath);
    return { contents: fs.readFileSync(localPath, 'utf8') };
  } catch (e) {
    return { error: `File not found: ${importPath}` };
  }
}

// Read the contract source
const contractPath = path.resolve(__dirname, '../contracts/ReskaToken.sol');
const source = fs.readFileSync(contractPath, 'utf8');

// Prepare compiler input
const input = {
  language: 'Solidity',
  sources: {
    'ReskaToken.sol': {
      content: source
    }
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['*']
      }
    },
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};

console.log('Compiling ReskaToken.sol...');

try {
  // Compile the contract
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  
  // Check for errors
  if (output.errors) {
    const hasError = output.errors.some(error => error.severity === 'error');
    if (hasError) {
      console.error('Compilation errors:');
      output.errors.forEach(error => {
        console.error(error.formattedMessage);
      });
      process.exit(1);
    } else {
      console.warn('Compilation warnings:');
      output.errors.forEach(warning => {
        console.warn(warning.formattedMessage);
      });
    }
  }
  
  // Create artifacts directory if it doesn't exist
  const artifactsDir = path.resolve(__dirname, '../artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }
  
  // Write the compiled output to a file
  const compiledOutput = JSON.stringify(output, null, 2);
  fs.writeFileSync(path.resolve(artifactsDir, 'ReskaToken.json'), compiledOutput);
  
  console.log('Compilation successful! Output saved to artifacts/ReskaToken.json');
} catch (error) {
  console.error('Compilation failed:', error);
  process.exit(1);
}

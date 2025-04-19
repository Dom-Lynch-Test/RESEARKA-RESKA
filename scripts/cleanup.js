/**
 * Cleanup script to remove generated artifacts and cache files
 * This helps keep the repository clean and prevents bloat
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Directories to clean
const directoriesToClean = [
  'artifacts',
  'cache',
  'coverage',
  'typechain',
  'typechain-types'
];

// Files to clean
const filesToClean = [
  'coverage.json',
  'compile-output.log',
  'compile-error.log'
];

console.log('🧹 Starting cleanup process...');

// Clean directories
directoriesToClean.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (fs.existsSync(dirPath)) {
    console.log(`Removing directory: ${dir}`);
    try {
      if (process.platform === 'win32') {
        // On Windows, use rimraf for recursive deletion
        execSync(`npx rimraf "${dirPath}"`);
      } else {
        // On Unix-like systems, use rm -rf
        execSync(`rm -rf "${dirPath}"`);
      }
      console.log(`✅ Successfully removed ${dir}`);
    } catch (error) {
      console.error(`❌ Error removing ${dir}: ${error.message}`);
    }
  } else {
    console.log(`Directory not found: ${dir} (skipping)`);
  }
});

// Clean files
filesToClean.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`Removing file: ${file}`);
    try {
      fs.unlinkSync(filePath);
      console.log(`✅ Successfully removed ${file}`);
    } catch (error) {
      console.error(`❌ Error removing ${file}: ${error.message}`);
    }
  } else {
    console.log(`File not found: ${file} (skipping)`);
  }
});

console.log('🎉 Cleanup completed!');

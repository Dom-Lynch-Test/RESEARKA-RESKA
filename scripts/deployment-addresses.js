// Utility script to save and retrieve deployment addresses
const fs = require('fs');
const path = require('path');

// File path where addresses will be stored
const ADDRESS_FILE = path.join(__dirname, '../.deployment-addresses.json');

// Save contract addresses to a file
function saveContractAddress(network, addresses) {
  try {
    let deployments = {};
    
    // Read existing deployments if file exists
    if (fs.existsSync(ADDRESS_FILE)) {
      const data = fs.readFileSync(ADDRESS_FILE, 'utf8');
      deployments = JSON.parse(data);
    }
    
    // Update with new addresses
    deployments[network] = {
      ...deployments[network],
      ...addresses,
      timestamp: new Date().toISOString()
    };
    
    // Write back to file
    fs.writeFileSync(
      ADDRESS_FILE,
      JSON.stringify(deployments, null, 2),
      'utf8'
    );
    
    console.log(`Deployment addresses saved for network ${network}`);
    return true;
  } catch (error) {
    console.error('Error saving contract addresses:', error);
    return false;
  }
}

// Get contract addresses from file
function getContractAddress(network) {
  try {
    if (!fs.existsSync(ADDRESS_FILE)) {
      throw new Error('Deployment file does not exist');
    }
    
    const data = fs.readFileSync(ADDRESS_FILE, 'utf8');
    const deployments = JSON.parse(data);
    
    if (!deployments[network]) {
      throw new Error(`No deployments found for network ${network}`);
    }
    
    return deployments[network];
  } catch (error) {
    console.error(`Error retrieving addresses for ${network}:`, error.message);
    throw error;
  }
}

// List all deployments
function listDeployments() {
  try {
    if (!fs.existsSync(ADDRESS_FILE)) {
      console.log('No deployments found');
      return [];
    }
    
    const data = fs.readFileSync(ADDRESS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error listing deployments:', error);
    return [];
  }
}

module.exports = {
  saveContractAddress,
  getContractAddress,
  listDeployments
};

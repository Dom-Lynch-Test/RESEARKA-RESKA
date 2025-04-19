// Custom test runner to avoid EPIPE errors
const { runHardhatCommand } = require("hardhat/internal/cli/cli");

// Run the test command with minimal output
async function main() {
  try {
    process.env.HARDHAT_NETWORK = 'hardhat';
    process.env.MOCHA_REPORTER = 'min';
    
    console.log("Running tests with custom runner...");
    await runHardhatCommand("test");
    console.log("Tests completed successfully!");
  } catch (error) {
    console.error("Test execution failed:", error.message);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

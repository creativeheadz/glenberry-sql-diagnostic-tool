#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');

const WebServer = require('./web/WebServer');
const Logger = require('./utils/Logger');
const ConfigManager = require('./utils/ConfigManager');

const program = new Command();

program
  .name('sql-diagnostic-tool')
  .description('Portable SQL Server Diagnostic Tool with Web Interface')
  .version('1.0.0');

program
  .option('-p, --port <port>', 'Web server port', '3000')
  .option('-h, --host <host>', 'Web server host', 'localhost')
  .option('--https', 'Enable HTTPS')
  .option('--cert <cert>', 'SSL certificate file path')
  .option('--key <key>', 'SSL private key file path')
  .option('--data-dir <dir>', 'Data directory for reports and config', './data')
  .option('--no-ai', 'Disable AI features')
  .option('--verbose', 'Enable verbose logging')
  .option('--no-browser', 'Don\'t open browser automatically');

program.parse();

const options = program.opts();

async function main() {
  const logger = new Logger(options.verbose);

  try {
    // Display banner
    console.log(chalk.blue.bold('\n🔍 SQL Server Diagnostic Tool'));
    console.log(chalk.gray('Portable web-based diagnostic tool for SQL Server\n'));

    // Ensure data directory exists
    await fs.ensureDir(options.dataDir);

    // Load configuration
    const configPath = path.join(options.dataDir, 'config.json');
    const config = await ConfigManager.loadWebConfig(configPath, options);

    // Initialize web server
    const webServer = new WebServer(config, logger);

    // Start the server
    const serverInfo = await webServer.start();

    console.log(chalk.green.bold('✅ Server started successfully!'));
    console.log(chalk.cyan(`🌐 Web Interface: ${serverInfo.url}`));
    console.log(chalk.gray(`📁 Data Directory: ${options.dataDir}`));

    if (serverInfo.https) {
      console.log(chalk.yellow('🔒 HTTPS enabled'));
    }

    console.log(chalk.gray('\nPress Ctrl+C to stop the server'));

    // Open browser if not disabled
    if (!options.noBrowser) {
      const open = require('open');
      setTimeout(() => {
        open(serverInfo.url).catch(() => {
          console.log(chalk.yellow('Could not open browser automatically'));
        });
      }, 1000);
    }

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n🛑 Shutting down server...'));
      await webServer.stop();
      console.log(chalk.green('✅ Server stopped'));
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log(chalk.yellow('\n🛑 Shutting down server...'));
      await webServer.stop();
      console.log(chalk.green('✅ Server stopped'));
      process.exit(0);
    });

  } catch (error) {
    console.error(chalk.red.bold('\n❌ Error:'), error.message);

    if (options.verbose) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(error.stack);
    }

    logger.error('Application error', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  process.exit(1);
});

// Run the application
if (require.main === module) {
  main();
}

module.exports = { main };

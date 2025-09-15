#!/usr/bin/env node

// This is the main entry point for the portable web server
const { main } = require('./index');

// Run the application
main().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

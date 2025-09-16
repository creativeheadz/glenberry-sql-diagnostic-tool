# SQL Server Diagnostic Tool

A portable, self-contained SQL Server diagnostic tool that runs Glen Berry's diagnostic queries with a built-in web interface and AI-powered analysis.

## Features

- **🚀 Portable & Self-Contained**: Single executable with built-in web server - no installation required
- **🌐 Web Interface**: Modern web UI for easy configuration and report viewing
- **📊 Comprehensive Diagnostics**: Uses Glenn Berry's official diagnostic queries from his Dropbox (80+ queries per version)
- **🔍 Version Detection**: Automatically detects SQL Server version (2005-2025) and uses appropriate query pack
- **📦 Pre-bundled Query Packs**: All query versions included for offline operation
- **🤖 AI-Powered Analysis**: Integrates with OpenAI and Ollama for intelligent suggestions and recommendations
- **📱 Responsive Design**: Works on desktop, tablet, and mobile devices
- **🔐 Multiple Authentication**: Supports both SQL Server authentication and Windows authentication
- **⚡ Real-time Progress**: Live progress updates during query execution
- **📈 Interactive Reports**: Beautiful, interactive HTML reports with charts and navigation
- **💾 Export Options**: Export results to CSV, JSON, or Excel formats

## Quick Start

### Option 1: Portable Executable (Recommended)
```bash
# Download the portable executable for your platform
# Windows
curl -L -o sql-diagnostic-tool.exe https://github.com/creativeheadz/glenberry-sql-diagnostic-tool/releases/latest/download/sql-diagnostic-tool-win.exe

# Linux
curl -L -o sql-diagnostic-tool https://github.com/creativeheadz/glenberry-sql-diagnostic-tool/releases/latest/download/sql-diagnostic-tool-linux

# macOS
curl -L -o sql-diagnostic-tool https://github.com/creativeheadz/glenberry-sql-diagnostic-tool/releases/latest/download/sql-diagnostic-tool-macos

# Run the tool
./sql-diagnostic-tool

# Open your browser to http://localhost:3000
```

### Option 2: Node.js (Development)
```bash
# Clone and install
git clone https://github.com/creativeheadz/glenberry-sql-diagnostic-tool.git
cd glenberry-sql-diagnostic-tool
npm install

# Start the web server
npm start

# Open your browser to http://localhost:3000
```

## Web Interface

Once started, open your browser to `http://localhost:3000` to access the web interface:

1. **Connection Setup**: Configure your SQL Server connection details
2. **AI Configuration**: Optionally configure OpenAI or Ollama for intelligent analysis
3. **Run Diagnostics**: Execute the diagnostic queries with real-time progress
4. **View Reports**: Browse interactive reports with charts and recommendations
5. **Export Data**: Download results in various formats

## Command Line Options

```bash
# Custom port
./sql-diagnostic-tool --port 8080

# Custom host (for remote access)
./sql-diagnostic-tool --host 0.0.0.0 --port 3000

# Enable HTTPS
./sql-diagnostic-tool --https --cert ./cert.pem --key ./key.pem

# Disable AI features
./sql-diagnostic-tool --no-ai

# Verbose logging
./sql-diagnostic-tool --verbose

# Custom data directory
./sql-diagnostic-tool --data-dir ./my-data
```

## Configuration

The tool stores configuration in a local `config.json` file. You can also configure everything through the web interface:

- **Server Connection**: Server name, authentication method, database
- **AI Integration**: OpenAI API key or Ollama endpoint
- **Report Settings**: Output formats, retention policy
- **Query Settings**: Timeouts, retry logic, parallel execution

## Architecture

The tool is organized into several key modules:

- **Connection Manager**: Handles SQL Server connections with different authentication methods
- **Query Parser**: Parses and organizes Glen Berry's diagnostic queries by version and section
- **Execution Engine**: Safely executes queries with proper error handling and timeouts
- **AI Analyzer**: Integrates with AI providers to analyze results and provide recommendations
- **Report Generator**: Creates beautiful HTML reports with navigation and styling
- **CLI Interface**: Command-line interface for easy usage

## Query Sections

The tool automatically downloads and organizes Glen Berry's diagnostic queries into logical sections:

1. **Instance Information**: Server properties, version info, configuration (5 queries)
2. **Hardware & OS**: CPU, memory, NUMA, system information (10 queries)
3. **Database Objects**: Tables, indexes, files, statistics (23 queries)
4. **Performance**: Wait stats, expensive queries, execution plans (8 queries)
5. **Maintenance**: Backups, fragmentation, statistics updates (8 queries)
6. **SQL Server Agent**: Jobs, alerts, schedules (2 queries)
7. **High Availability**: AlwaysOn, clustering, replication (1 query)
8. **General**: Miscellaneous diagnostic information (24 queries)

**Total: 81+ diagnostic queries automatically executed based on your SQL Server version**

## AI Analysis

When AI analysis is enabled, the tool provides:

- **Performance Recommendations**: Suggestions for improving query performance
- **Configuration Advice**: Recommendations for SQL Server configuration settings
- **Maintenance Suggestions**: Advice on index maintenance, statistics updates
- **Capacity Planning**: Insights on storage and memory usage trends
- **Security Recommendations**: Security best practices and potential issues

## Output

The tool generates comprehensive HTML reports with:

- **Executive Summary**: High-level overview of system health
- **Detailed Sections**: Organized results by diagnostic category
- **AI Insights**: Intelligent analysis and recommendations (when enabled)
- **Navigation**: Easy-to-use table of contents and section links
- **Export Options**: Raw data export capabilities

## Requirements

- Node.js 16 or higher
- SQL Server 2012 or higher
- Network access to SQL Server instance
- Optional: OpenAI API key or Ollama installation for AI features

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please read CONTRIBUTING.md for guidelines.

## Acknowledgments

- Glen Berry for his comprehensive SQL Server diagnostic queries
- The SQL Server community for continuous improvements and feedback

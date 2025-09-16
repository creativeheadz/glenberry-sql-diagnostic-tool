# Query Packs System

This document explains how the Glenn Berry diagnostic query packs are managed in the SQL Diagnostic Tool.

## Overview

The tool now uses **pre-downloaded query packs** instead of downloading queries on-demand. This makes the application truly portable and eliminates dependency on internet connectivity during runtime.

## How It Works

### 1. Query Pack Download
- Query packs are downloaded during the build process using `npm run download-queries`
- All SQL Server versions are downloaded from Glenn Berry's official Dropbox links
- Files are stored in `data/query-packs/` directory
- A manifest file tracks download metadata

### 2. Automatic Version Detection
- When connecting to SQL Server, the tool queries `SERVERPROPERTY('ProductMajorVersion')`
- This returns the internal version number (e.g., 15 for SQL Server 2019, 16 for SQL Server 2022)
- The QueryParser maps this to the appropriate query pack file

### 3. Query Pack Loading
- **Local First**: Tries to load from pre-downloaded files in `data/query-packs/`
- **Fallback**: If local file doesn't exist, attempts online download
- **Closest Match**: If exact version not found, uses the closest older version

## Supported SQL Server Versions

| SQL Server Version | Internal Version | Query Pack File |
|-------------------|------------------|-----------------|
| SQL Server 2025   | 17               | sql-server-2025-queries.sql |
| SQL Server 2022   | 16               | sql-server-2022-queries.sql |
| SQL Server 2019   | 15               | sql-server-2019-queries.sql |
| SQL Server 2017   | 14               | sql-server-2017-queries.sql |
| SQL Server 2016   | 13               | sql-server-2016-queries.sql |
| SQL Server 2014   | 12               | sql-server-2014-queries.sql |
| SQL Server 2012   | 11               | sql-server-2012-queries.sql |
| SQL Server 2008 R2| 10               | sql-server-2008-queries.sql |
| SQL Server 2008   | 10               | sql-server-2008STD-queries.sql |
| SQL Server 2005   | 9                | sql-server-2005-queries.sql |

## Commands

### Download Query Packs
```bash
npm run download-queries
```
Downloads all query packs from Glenn Berry's official Dropbox links.

### Build with Query Packs
```bash
npm run build
```
Automatically runs `download-queries` before building (via `prebuild` script).

## File Structure

```
data/
└── query-packs/
    ├── manifest.json                    # Download metadata
    ├── sql-server-2005-queries.sql
    ├── sql-server-2008-queries.sql
    ├── sql-server-2008R2-queries.sql
    ├── sql-server-2008STD-queries.sql
    ├── sql-server-2012-queries.sql
    ├── sql-server-2014-queries.sql
    ├── sql-server-2016-queries.sql
    ├── sql-server-2016SP2-queries.sql
    ├── sql-server-2017-queries.sql
    ├── sql-server-2019-queries.sql
    ├── sql-server-2022-queries.sql
    └── sql-server-2025-queries.sql
```

## API Endpoints

### Get Queries for Version
```
GET /api/queries/{version}
```
Returns diagnostic queries for the specified SQL Server version.

Example:
```bash
curl http://localhost:3000/api/queries/2019
```

Response:
```json
{
  "version": "2019",
  "count": 80,
  "queries": [
    {
      "id": "glen-berry-1",
      "name": "Version Info",
      "section": "Instance Information",
      "description": "Version Info",
      "estimatedDuration": 500
    }
  ]
}
```

## Benefits

1. **Portability**: No internet required during runtime
2. **Reliability**: Always uses official Glenn Berry queries
3. **Performance**: Instant query loading from local files
4. **Offline Support**: Works in air-gapped environments
5. **Version Accuracy**: Automatic detection ensures correct query pack

## Troubleshooting

### Query Pack Not Found
If a specific version's query pack is missing:
1. The tool will attempt online download as fallback
2. If that fails, it uses the closest older version available
3. As last resort, it falls back to built-in sample queries

### Re-download Query Packs
To refresh query packs with latest versions:
```bash
npm run download-queries
```

### Check Available Versions
The tool automatically detects which query packs are available locally and chooses the best match for your SQL Server version.

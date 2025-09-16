#!/usr/bin/env node

/**
 * Script to download all Glenn Berry diagnostic query packs
 * This should be run during build/setup to pre-bundle all query files
 */

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const QUERY_PACKS_DIR = path.join(__dirname, '..', 'data', 'query-packs');

// Official Glenn Berry Dropbox URLs
const QUERY_PACK_URLS = {
  2025: 'https://www.dropbox.com/scl/fi/8qtdi3w5ix2bra8ytk7oy/SQL-Server-2025-Diagnostic-Information-Queries.sql?rlkey=kv1t4fdwe60nkd7fl0jukhnnq&dl=1',
  2022: 'https://www.dropbox.com/s/6rb2f97ocvkq7fw/SQL%20Server%202022%20Diagnostic%20Information%20Queries.sql?dl=1',
  2019: 'https://www.dropbox.com/s/k1vauzxxhyh1fnb/SQL%20Server%202019%20Diagnostic%20Information%20Queries.sql?dl=1',
  2017: 'https://www.dropbox.com/scl/fi/0q4sbb7xb3x3vmbhkdga3/SQL-Server-2017-Diagnostic-Information-Queries.sql?rlkey=nli5q22tgqqw7oxvoqyeujmmc&dl=1',
  2016: 'https://www.dropbox.com/s/w6gi8j76k64fgbg/SQL%20Server%202016%20SP1%20Diagnostic%20Information%20Queries.sql?dl=1',
  '2016SP2': 'https://www.dropbox.com/s/pkpxihdkq3odgbj/SQL%20Server%202016%20SP2%20Diagnostic%20Information%20Queries.sql?dl=1',
  2014: 'https://www.dropbox.com/s/uttp0843e5078vs/SQL%20Server%202014%20Diagnostic%20Information%20Queries.sql?dl=1',
  2012: 'https://www.dropbox.com/s/3l4yotzedk45xeh/SQL%20Server%202012%20Diagnostic%20Information%20Queries.sql?dl=1',
  2008: 'https://www.dropbox.com/s/fq6hyw899fe3crv/SQL%20Server%202008%20R2%20Diagnostic%20Information%20Queries.sql?dl=1',
  '2008R2': 'https://www.dropbox.com/s/fq6hyw899fe3crv/SQL%20Server%202008%20R2%20Diagnostic%20Information%20Queries.sql?dl=1',
  '2008STD': 'https://www.dropbox.com/s/mjxw1w9tgw7eo6g/SQL%20Server%202008%20Diagnostic%20Information%20Queries.sql?dl=1',
  2005: 'https://www.dropbox.com/s/3kkskuheyzauih9/SQL%20Server%202005%20Diagnostic%20Information%20Queries.sql?dl=1'
};

async function downloadQueryPack(version, url) {
  try {
    console.log(`📥 Downloading SQL Server ${version} query pack...`);
    
    const response = await axios.get(url, {
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const filename = `sql-server-${version}-queries.sql`;
    const filepath = path.join(QUERY_PACKS_DIR, filename);
    
    await fs.writeFile(filepath, response.data, 'utf8');
    
    const sizeKB = Math.round(response.data.length / 1024);
    console.log(`✅ Downloaded SQL Server ${version} (${sizeKB} KB) -> ${filename}`);
    
    return {
      version,
      filename,
      size: response.data.length,
      downloadedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ Failed to download SQL Server ${version}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🔍 Glenn Berry SQL Server Diagnostic Query Pack Downloader\n');
  
  // Ensure query packs directory exists
  await fs.ensureDir(QUERY_PACKS_DIR);
  
  const results = [];
  const versions = Object.keys(QUERY_PACK_URLS);
  
  console.log(`📦 Downloading ${versions.length} query packs...\n`);
  
  // Download all query packs
  for (const version of versions) {
    const url = QUERY_PACK_URLS[version];
    const result = await downloadQueryPack(version, url);
    if (result) {
      results.push(result);
    }
    
    // Small delay between downloads to be respectful
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Create manifest file
  const manifest = {
    downloadedAt: new Date().toISOString(),
    totalPacks: results.length,
    packs: results.reduce((acc, pack) => {
      acc[pack.version] = {
        filename: pack.filename,
        size: pack.size,
        downloadedAt: pack.downloadedAt
      };
      return acc;
    }, {})
  };
  
  const manifestPath = path.join(QUERY_PACKS_DIR, 'manifest.json');
  await fs.writeJson(manifestPath, manifest, { spaces: 2 });
  
  console.log(`\n📋 Created manifest: ${manifestPath}`);
  console.log(`✅ Successfully downloaded ${results.length}/${versions.length} query packs`);
  
  if (results.length < versions.length) {
    console.log(`⚠️  ${versions.length - results.length} downloads failed`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Download failed:', error);
    process.exit(1);
  });
}

module.exports = { downloadQueryPack, QUERY_PACK_URLS };

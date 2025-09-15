const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

class QueryParser {
  constructor(logger) {
    this.logger = logger;
    this.queries = [];
    this.sections = new Map();
    this.glenBerryUrls = {
      2022: 'https://raw.githubusercontent.com/Ratithoglys/GlennBerry_DMV_Queries/master/2022sql',
      2019: 'https://raw.githubusercontent.com/Ratithoglys/GlennBerry_DMV_Queries/master/2019.sql',
      2017: 'https://raw.githubusercontent.com/Ratithoglys/GlennBerry_DMV_Queries/master/2017.sql',
      2016: 'https://raw.githubusercontent.com/Ratithoglys/GlennBerry_DMV_Queries/master/2016.sql',
      2014: 'https://raw.githubusercontent.com/Ratithoglys/GlennBerry_DMV_Queries/master/2014.sql',
      2012: 'https://raw.githubusercontent.com/Ratithoglys/GlennBerry_DMV_Queries/master/2012.sql'
    };
  }

  async loadQueries(sqlServerVersion) {
    try {
      // Try to load Glen Berry's actual queries first
      const queries = await this.loadGlenBerryQueries(sqlServerVersion);

      if (queries.length > 0) {
        this.queries = queries;
      } else {
        // Fallback to sample queries if Glen Berry queries can't be loaded
        this.logger.warn('Could not load Glen Berry queries, using sample queries');
        this.queries = this.getSampleQueries(sqlServerVersion);
      }

      this.organizeSections();

      this.logger.info(`Loaded ${this.queries.length} queries for SQL Server ${sqlServerVersion}`);
      return this.queries;

    } catch (error) {
      this.logger.error('Failed to load queries', error);
      throw new Error(`Failed to load queries: ${error.message}`);
    }
  }

  async loadGlenBerryQueries(sqlServerVersion) {
    try {
      // Map version to the closest available version
      const versionKey = this.mapVersionToKey(sqlServerVersion);
      const url = this.glenBerryUrls[versionKey];

      if (!url) {
        this.logger.warn(`No Glen Berry queries available for SQL Server ${sqlServerVersion}, using version 2019`);
        return await this.loadGlenBerryQueries(2019);
      }

      this.logger.info(`Downloading Glen Berry queries from: ${url}`);

      const response = await axios.get(url, { timeout: 30000 });
      const sqlContent = response.data;

      return this.parseGlenBerryQueries(sqlContent, sqlServerVersion);

    } catch (error) {
      this.logger.error('Failed to download Glen Berry queries', error);
      return [];
    }
  }

  mapVersionToKey(version) {
    const versionNum = parseInt(version);

    if (versionNum >= 16) return 2022;  // SQL Server 2022 is version 16
    if (versionNum >= 15) return 2019;  // SQL Server 2019 is version 15
    if (versionNum >= 14) return 2017;  // SQL Server 2017 is version 14
    if (versionNum >= 13) return 2016;  // SQL Server 2016 is version 13
    if (versionNum >= 12) return 2014;  // SQL Server 2014 is version 12
    if (versionNum >= 11) return 2012;  // SQL Server 2012 is version 11

    return 2019; // Default fallback
  }

  parseGlenBerryQueries(sqlContent, version) {
    const queries = [];

    try {
      // Split the content by the query separator (------)
      const queryBlocks = sqlContent.split(/^------$/gm);

      let queryNumber = 1;

      for (let i = 0; i < queryBlocks.length - 1; i++) {
        const block = queryBlocks[i].trim();

        if (!block || block.length < 50) continue; // Skip very short blocks

        // Extract query information using regex patterns
        const queryInfo = this.extractQueryInfo(block, queryNumber);

        if (queryInfo && queryInfo.query) {
          queries.push({
            id: `glen-berry-${queryNumber}`,
            name: queryInfo.name,
            section: queryInfo.section,
            description: queryInfo.description,
            query: queryInfo.query,
            estimatedDuration: this.estimateQueryDuration(queryInfo.query),
            queryNumber: queryNumber
          });

          queryNumber++;
        }
      }

      this.logger.info(`Parsed ${queries.length} Glen Berry queries`);
      return queries;

    } catch (error) {
      this.logger.error('Failed to parse Glen Berry queries', error);
      return [];
    }
  }

  extractQueryInfo(block, queryNumber) {
    try {
      // Look for query pattern: -- Comment (Query X) (Description)
      const queryPattern = /--.*?\(Query\s+(\d+)\)\s*\(([^)]+)\)/i;
      const match = block.match(queryPattern);

      let name = `Query ${queryNumber}`;
      let section = 'General';
      let description = 'SQL Server diagnostic query';

      if (match) {
        description = match[2].trim();
        name = description;
        section = this.categorizeQuery(description, block);
      }

      // Extract the actual SQL query (everything after the comments)
      const lines = block.split('\n');
      const sqlLines = [];
      let inQuery = false;

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Skip comment lines and empty lines at the start
        if (!inQuery && (trimmedLine.startsWith('--') || trimmedLine === '')) {
          continue;
        }

        // Start collecting SQL when we hit the first non-comment line
        if (!inQuery && trimmedLine.length > 0) {
          inQuery = true;
        }

        if (inQuery) {
          sqlLines.push(line);
        }
      }

      const query = sqlLines.join('\n').trim();

      // Skip if no actual query found
      if (!query || query.length < 10) {
        return null;
      }

      return {
        name,
        section,
        description,
        query
      };

    } catch (error) {
      this.logger.warn(`Failed to extract query info for query ${queryNumber}`, error);
      return null;
    }
  }

  categorizeQuery(description, block) {
    const desc = description.toLowerCase();
    const content = block.toLowerCase();

    // Instance-level queries
    if (desc.includes('version') || desc.includes('server properties') || desc.includes('configuration')) {
      return 'Instance Information';
    }

    if (desc.includes('memory') || desc.includes('hardware') || desc.includes('cpu') || desc.includes('numa')) {
      return 'Hardware & OS';
    }

    if (desc.includes('backup') || desc.includes('maintenance') || desc.includes('statistics') || desc.includes('fragmentation')) {
      return 'Maintenance';
    }

    if (desc.includes('wait') || desc.includes('performance') || desc.includes('execution') || desc.includes('expensive')) {
      return 'Performance';
    }

    if (desc.includes('database') || desc.includes('file') || desc.includes('table') || desc.includes('index')) {
      return 'Database Objects';
    }

    if (desc.includes('security') || desc.includes('login') || desc.includes('permission')) {
      return 'Security';
    }

    if (desc.includes('alwayson') || desc.includes('cluster') || desc.includes('availability')) {
      return 'High Availability';
    }

    if (desc.includes('job') || desc.includes('agent') || desc.includes('alert')) {
      return 'SQL Server Agent';
    }

    // Check content for additional clues
    if (content.includes('sys.dm_os_wait_stats') || content.includes('sys.dm_exec_query_stats')) {
      return 'Performance';
    }

    if (content.includes('sys.databases') || content.includes('sys.master_files')) {
      return 'Database Objects';
    }

    if (content.includes('msdb.dbo.backupset') || content.includes('dbcc')) {
      return 'Maintenance';
    }

    return 'General';
  }

  estimateQueryDuration(query) {
    const queryLower = query.toLowerCase();

    // Quick queries (< 1 second)
    if (queryLower.includes('@@version') || queryLower.includes('serverproperty') ||
        queryLower.includes('sys.configurations')) {
      return 500;
    }

    // Medium queries (1-3 seconds)
    if (queryLower.includes('sys.dm_os_wait_stats') || queryLower.includes('sys.dm_exec_query_stats') ||
        queryLower.includes('sys.dm_db_index_usage_stats')) {
      return 2000;
    }

    // Longer queries (3-10 seconds)
    if (queryLower.includes('sys.dm_db_index_physical_stats') || queryLower.includes('sys.dm_os_buffer_descriptors')) {
      return 5000;
    }

    // Very long queries (10+ seconds)
    if (queryLower.includes('cross apply') && queryLower.includes('sys.dm_exec_sql_text')) {
      return 10000;
    }

    return 3000; // Default estimate
  }

  getSampleQueries(version) {
    // Sample diagnostic queries based on Glen Berry's structure
    return [
      {
        id: 'version-info',
        name: 'SQL and OS Version Information',
        section: 'Instance Information',
        description: 'Get SQL Server and OS version information',
        query: `SELECT @@SERVERNAME AS [Server Name], @@VERSION AS [SQL Server and OS Version Info];`,
        estimatedDuration: 1000
      },
      {
        id: 'server-properties',
        name: 'Server Properties',
        section: 'Instance Information',
        description: 'Get selected server properties',
        query: `
          SELECT SERVERPROPERTY('MachineName') AS [MachineName], 
          SERVERPROPERTY('ServerName') AS [ServerName],  
          SERVERPROPERTY('InstanceName') AS [Instance], 
          SERVERPROPERTY('IsClustered') AS [IsClustered], 
          SERVERPROPERTY('Edition') AS [Edition], 
          SERVERPROPERTY('ProductLevel') AS [ProductLevel],
          SERVERPROPERTY('ProductVersion') AS [ProductVersion],
          SERVERPROPERTY('Collation') AS [Collation];
        `,
        estimatedDuration: 1000
      },
      {
        id: 'configuration-values',
        name: 'Configuration Values',
        section: 'Instance Information',
        description: 'Get instance-level configuration values',
        query: `
          SELECT name, value, value_in_use, minimum, maximum, [description], is_dynamic, is_advanced
          FROM sys.configurations WITH (NOLOCK)
          ORDER BY name;
        `,
        estimatedDuration: 2000
      },
      {
        id: 'hardware-info',
        name: 'Hardware Information',
        section: 'Hardware & OS',
        description: 'Get hardware information from SQL Server',
        query: `
          SELECT cpu_count AS [Logical CPU Count], 
          scheduler_count, 
          physical_memory_kb/1024 AS [Physical Memory (MB)], 
          max_workers_count AS [Max Workers Count], 
          affinity_type_desc AS [Affinity Type], 
          sqlserver_start_time AS [SQL Server Start Time],
          DATEDIFF(hour, sqlserver_start_time, GETDATE()) AS [SQL Server Up Time (hrs)],
          virtual_machine_type_desc AS [Virtual Machine Type]
          FROM sys.dm_os_sys_info WITH (NOLOCK);
        `,
        estimatedDuration: 1000
      },
      {
        id: 'memory-usage',
        name: 'Memory Usage',
        section: 'Hardware & OS',
        description: 'Get memory usage information',
        query: `
          SELECT total_physical_memory_kb/1024 AS [Physical Memory (MB)], 
          available_physical_memory_kb/1024 AS [Available Memory (MB)], 
          total_page_file_kb/1024 AS [Page File Commit Limit (MB)],
          available_page_file_kb/1024 AS [Available Page File (MB)], 
          system_cache_kb/1024 AS [System Cache (MB)],
          system_memory_state_desc AS [System Memory State]
          FROM sys.dm_os_sys_memory WITH (NOLOCK);
        `,
        estimatedDuration: 1000
      },
      {
        id: 'database-files',
        name: 'Database Files',
        section: 'Database Files',
        description: 'File names and paths for all databases',
        query: `
          SELECT DB_NAME([database_id]) AS [Database Name], 
          [file_id], [name], physical_name, [type_desc], state_desc,
          is_percent_growth, growth, 
          CONVERT(bigint, growth/128.0) AS [Growth in MB], 
          CONVERT(bigint, size/128.0) AS [Total Size in MB], max_size
          FROM sys.master_files WITH (NOLOCK)
          ORDER BY DB_NAME([database_id]), [file_id];
        `,
        estimatedDuration: 2000
      },
      {
        id: 'wait-stats',
        name: 'Wait Statistics',
        section: 'Performance',
        description: 'Get wait statistics since last restart',
        query: `
          SELECT TOP(50) wait_type, 
          wait_time_ms, 
          signal_wait_time_ms,
          wait_time_ms - signal_wait_time_ms AS resource_wait_time_ms,
          waiting_tasks_count,
          wait_time_ms / waiting_tasks_count AS avg_wait_time_ms
          FROM sys.dm_os_wait_stats WITH (NOLOCK)
          WHERE waiting_tasks_count > 0
          AND wait_type NOT IN (
            'BROKER_EVENTHANDLER', 'BROKER_RECEIVE_WAITFOR', 'BROKER_TASK_STOP',
            'BROKER_TO_FLUSH', 'BROKER_TRANSMITTER', 'CHECKPOINT_QUEUE',
            'CHKPT', 'CLR_AUTO_EVENT', 'CLR_MANUAL_EVENT', 'CLR_SEMAPHORE',
            'DBMIRROR_DBM_EVENT', 'DBMIRROR_EVENTS_QUEUE', 'DBMIRROR_WORKER_QUEUE',
            'DBMIRRORING_CMD', 'DIRTY_PAGE_POLL', 'DISPATCHER_QUEUE_SEMAPHORE',
            'EXECSYNC', 'FSAGENT', 'FT_IFTS_SCHEDULER_IDLE_WAIT', 'FT_IFTSHC_MUTEX',
            'HADR_CLUSAPI_CALL', 'HADR_FILESTREAM_IOMGR_IOCOMPLETION', 'HADR_LOGCAPTURE_WAIT',
            'HADR_NOTIFICATION_DEQUEUE', 'HADR_TIMER_TASK', 'HADR_WORK_QUEUE',
            'KSOURCE_WAKEUP', 'LAZYWRITER_SLEEP', 'LOGMGR_QUEUE', 'ONDEMAND_TASK_QUEUE',
            'PWAIT_ALL_COMPONENTS_INITIALIZED', 'QDS_PERSIST_TASK_MAIN_LOOP_SLEEP',
            'QDS_CLEANUP_STALE_QUERIES_TASK_MAIN_LOOP_SLEEP', 'REQUEST_FOR_DEADLOCK_SEARCH',
            'RESOURCE_QUEUE', 'SERVER_IDLE_CHECK', 'SLEEP_BPOOL_FLUSH', 'SLEEP_DBSTARTUP',
            'SLEEP_DCOMSTARTUP', 'SLEEP_MASTERDBREADY', 'SLEEP_MASTERMDREADY',
            'SLEEP_MASTERUPGRADED', 'SLEEP_MSDBSTARTUP', 'SLEEP_SYSTEMTASK', 'SLEEP_TASK',
            'SLEEP_TEMPDBSTARTUP', 'SNI_HTTP_ACCEPT', 'SP_SERVER_DIAGNOSTICS_SLEEP',
            'SQLTRACE_BUFFER_FLUSH', 'SQLTRACE_INCREMENTAL_FLUSH_SLEEP', 'SQLTRACE_WAIT_ENTRIES',
            'WAIT_FOR_RESULTS', 'WAITFOR', 'WAITFOR_TASKSHUTDOWN', 'WAIT_XTP_HOST_WAIT',
            'WAIT_XTP_OFFLINE_CKPT_NEW_LOG', 'WAIT_XTP_CKPT_CLOSE', 'XE_DISPATCHER_JOIN',
            'XE_DISPATCHER_WAIT', 'XE_TIMER_EVENT'
          )
          ORDER BY wait_time_ms DESC;
        `,
        estimatedDuration: 3000
      },
      {
        id: 'backup-history',
        name: 'Backup History',
        section: 'Maintenance',
        description: 'Last backup information by database',
        query: `
          SELECT ISNULL(d.[name], bs.[database_name]) AS [Database], 
          d.recovery_model_desc AS [Recovery Model], 
          d.log_reuse_wait_desc AS [Log Reuse Wait Desc],
          MAX(CASE WHEN [type] = 'D' THEN bs.backup_finish_date ELSE NULL END) AS [Last Full Backup],
          MAX(CASE WHEN [type] = 'I' THEN bs.backup_finish_date ELSE NULL END) AS [Last Differential Backup],
          MAX(CASE WHEN [type] = 'L' THEN bs.backup_finish_date ELSE NULL END) AS [Last Log Backup]
          FROM sys.databases AS d WITH (NOLOCK)
          LEFT OUTER JOIN msdb.dbo.backupset AS bs WITH (NOLOCK)
          ON bs.[database_name] = d.[name]
          AND bs.backup_finish_date > GETDATE()- 30
          WHERE d.name <> N'tempdb'
          GROUP BY ISNULL(d.[name], bs.[database_name]), d.recovery_model_desc, d.log_reuse_wait_desc, d.[name] 
          ORDER BY d.recovery_model_desc, d.[name];
        `,
        estimatedDuration: 2000
      }
    ];
  }

  organizeSections() {
    this.sections.clear();
    
    for (const query of this.queries) {
      if (!this.sections.has(query.section)) {
        this.sections.set(query.section, []);
      }
      this.sections.get(query.section).push(query);
    }
  }

  async getSections(version) {
    if (this.sections.size === 0) {
      await this.loadQueries(version);
    }

    const sectionsArray = [];
    for (const [name, queries] of this.sections) {
      sectionsArray.push({
        name,
        queryCount: queries.length,
        estimatedDuration: queries.reduce((sum, q) => sum + q.estimatedDuration, 0)
      });
    }

    return sectionsArray;
  }

  getSectionCount() {
    return this.sections.size;
  }
}

module.exports = QueryParser;

const sql = require('mssql');

class ConnectionManager {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.pool = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const connectionConfig = {
        server: this.config.server,
        database: this.config.database || 'master',
        requestTimeout: this.config.queries?.timeout || 30000,
        connectionTimeout: 15000,
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000
        }
      };

      // Configure authentication
      if (this.config.authentication.type === 'sql') {
        connectionConfig.user = this.config.authentication.username;
        connectionConfig.password = this.config.authentication.password;
        connectionConfig.options = {
          encrypt: false, // Set to true for Azure
          trustServerCertificate: true
        };
      } else {
        // Windows authentication
        connectionConfig.options = {
          trustedConnection: true,
          encrypt: false,
          trustServerCertificate: true
        };
      }

      this.pool = await sql.connect(connectionConfig);
      this.isConnected = true;
      
      this.logger.info('Connected to SQL Server', {
        server: this.config.server,
        database: this.config.database
      });

    } catch (error) {
      this.logger.error('Failed to connect to SQL Server', error);
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  async getServerInfo() {
    if (!this.isConnected) {
      throw new Error('Not connected to SQL Server');
    }

    try {
      const result = await this.pool.request().query(`
        SELECT 
          @@SERVERNAME as serverName,
          @@VERSION as version,
          SERVERPROPERTY('ProductVersion') as productVersion,
          SERVERPROPERTY('ProductMajorVersion') as majorVersion,
          SERVERPROPERTY('Edition') as edition,
          SERVERPROPERTY('EngineEdition') as engineEdition
      `);

      const serverInfo = result.recordset[0];
      
      this.logger.debug('Retrieved server info', serverInfo);
      
      return {
        serverName: serverInfo.serverName,
        version: serverInfo.version,
        productVersion: serverInfo.productVersion,
        majorVersion: parseInt(serverInfo.majorVersion),
        edition: serverInfo.edition,
        engineEdition: serverInfo.engineEdition
      };

    } catch (error) {
      this.logger.error('Failed to get server info', error);
      throw new Error(`Failed to get server info: ${error.message}`);
    }
  }

  async executeQuery(query, timeout = null) {
    if (!this.isConnected) {
      throw new Error('Not connected to SQL Server');
    }

    try {
      const request = this.pool.request();
      
      if (timeout) {
        request.timeout = timeout;
      }

      const result = await request.query(query);
      return result.recordset;

    } catch (error) {
      this.logger.error('Query execution failed', { query: query.substring(0, 100), error: error.message });
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      try {
        await this.pool.close();
        this.isConnected = false;
        this.logger.info('Disconnected from SQL Server');
      } catch (error) {
        this.logger.error('Error during disconnect', error);
      }
    }
  }

  isConnectionActive() {
    return this.isConnected && this.pool && this.pool.connected;
  }
}

module.exports = ConnectionManager;

const moment = require('moment');

class ExecutionEngine {
  constructor(connectionManager, config, logger) {
    this.connectionManager = connectionManager;
    this.config = config;
    this.logger = logger;
  }

  async executeQueries(queries, progressCallback = null) {
    const startTime = Date.now();
    const results = {
      data: [],
      successful: 0,
      failed: 0,
      executionTime: 0
    };

    this.logger.info(`Starting execution of ${queries.length} queries`);

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      
      try {
        // Update progress
        if (progressCallback) {
          progressCallback({
            completed: i,
            total: queries.length,
            currentQuery: query.name
          });
        }

        this.logger.debug(`Executing query: ${query.name}`);
        
        const queryStartTime = Date.now();
        const queryResult = await this.executeQuery(query);
        const queryEndTime = Date.now();

        // Handle different types of query results
        const rowCount = queryResult && Array.isArray(queryResult) ? queryResult.length :
                        queryResult && queryResult.recordset ? queryResult.recordset.length : 0;
        const resultData = queryResult && Array.isArray(queryResult) ? queryResult :
                          queryResult && queryResult.recordset ? queryResult.recordset : [];

        results.data.push({
          id: query.id,
          name: query.name,
          section: query.section,
          description: query.description,
          success: true,
          executionTime: queryEndTime - queryStartTime,
          rowCount: rowCount,
          data: resultData,
          timestamp: new Date().toISOString()
        });

        results.successful++;
        this.logger.debug(`Query completed: ${query.name} (${rowCount} rows)`);

      } catch (error) {
        this.logger.error(`Query failed: ${query.name}`, error);
        
        results.data.push({
          id: query.id,
          name: query.name,
          section: query.section,
          description: query.description,
          success: false,
          error: error.message,
          executionTime: 0,
          rowCount: 0,
          data: [],
          timestamp: new Date().toISOString()
        });

        results.failed++;

        // Continue on error if configured to do so
        if (!this.config.continueOnError) {
          throw error;
        }
      }
    }

    // Final progress update
    if (progressCallback) {
      progressCallback({
        completed: queries.length,
        total: queries.length,
        currentQuery: 'Complete'
      });
    }

    results.executionTime = Date.now() - startTime;
    
    this.logger.info(`Query execution completed: ${results.successful} successful, ${results.failed} failed, ${results.executionTime}ms total`);
    
    return results;
  }

  async executeQuery(query) {
    const timeout = this.config.timeout || 30000;
    let retries = 0;
    const maxRetries = this.config.maxRetries || 3;
    const retryDelay = this.config.retryDelay || 1000;

    while (retries <= maxRetries) {
      try {
        const result = await this.connectionManager.executeQuery(query.query, timeout);
        return result;

      } catch (error) {
        retries++;
        
        if (retries > maxRetries) {
          throw error;
        }

        this.logger.warn(`Query retry ${retries}/${maxRetries} for ${query.name}: ${error.message}`);
        
        // Wait before retry
        if (retryDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
  }

  async testConnection() {
    try {
      const result = await this.connectionManager.executeQuery('SELECT 1 as test', 5000);
      return result.length > 0;
    } catch (error) {
      this.logger.error('Connection test failed', error);
      return false;
    }
  }
}

module.exports = ExecutionEngine;

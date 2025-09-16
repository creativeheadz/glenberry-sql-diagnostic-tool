const express = require('express');
const fs = require('fs-extra');
const path = require('path');

const ConnectionManager = require('../../core/ConnectionManager');
const QueryParser = require('../../core/QueryParser');
const ReportGenerator = require('../../reports/ReportGenerator');

class ApiRoutes {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // Health check
    this.router.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // Configuration endpoints
    this.router.get('/config', this.getConfig.bind(this));
    this.router.post('/config', this.saveConfig.bind(this));

    // Connection testing
    this.router.post('/test-connection', this.testConnection.bind(this));

    // Query information
    this.router.get('/queries/:version', this.getQueries.bind(this));
    this.router.get('/queries/:version/sections', this.getQuerySections.bind(this));

    // Reports
    this.router.get('/reports', this.getReports.bind(this));
    this.router.get('/reports/latest', this.getLatestReport.bind(this));
    this.router.get('/reports/:id', this.getReport.bind(this));
    this.router.delete('/reports/:id', this.deleteReport.bind(this));
    this.router.post('/reports/:id/export', this.exportReport.bind(this));

    // Report export routes (GET for direct download links)
    this.router.get('/reports/latest/export/html', this.exportLatestReportHTML.bind(this));
    this.router.get('/reports/latest/export/csv', this.exportLatestReportCSV.bind(this));
    this.router.get('/reports/latest/export/json', this.exportLatestReportJSON.bind(this));
    this.router.get('/reports/:id/export/html', this.exportReportHTML.bind(this));
    this.router.get('/reports/:id/export/csv', this.exportReportCSV.bind(this));
    this.router.get('/reports/:id/export/json', this.exportReportJSON.bind(this));

    // AI providers
    this.router.get('/ai/providers', this.getAIProviders.bind(this));
    this.router.post('/ai/test', this.testAIConnection.bind(this));
  }

  async getConfig(req, res) {
    try {
      const configPath = path.join(this.config.dataDir, 'config.json');
      
      if (await fs.pathExists(configPath)) {
        const config = await fs.readJson(configPath);
        // Remove sensitive information
        const safeConfig = { ...config };
        if (safeConfig.authentication && safeConfig.authentication.password) {
          safeConfig.authentication.password = '***';
        }
        if (safeConfig.ai && safeConfig.ai.openai && safeConfig.ai.openai.apiKey) {
          safeConfig.ai.openai.apiKey = '***';
        }
        res.json(safeConfig);
      } else {
        res.json({});
      }
    } catch (error) {
      this.logger.error('Failed to get config', error);
      res.status(500).json({ error: 'Failed to load configuration' });
    }
  }

  async saveConfig(req, res) {
    try {
      const configPath = path.join(this.config.dataDir, 'config.json');
      await fs.writeJson(configPath, req.body, { spaces: 2 });
      res.json({ success: true });
    } catch (error) {
      this.logger.error('Failed to save config', error);
      res.status(500).json({ error: 'Failed to save configuration' });
    }
  }

  async testConnection(req, res) {
    try {
      const { server, database, authentication } = req.body;
      
      if (!server) {
        return res.status(400).json({ error: 'Server is required' });
      }

      const connectionConfig = {
        server,
        database: database || 'master',
        authentication
      };

      const connectionManager = new ConnectionManager(connectionConfig, this.logger);
      await connectionManager.connect();
      const serverInfo = await connectionManager.getServerInfo();
      await connectionManager.disconnect();

      res.json({
        success: true,
        serverInfo
      });
    } catch (error) {
      this.logger.error('Connection test failed', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getQueries(req, res) {
    try {
      const { version } = req.params;
      const queryParser = new QueryParser(this.logger);
      const queries = await queryParser.loadQueries(version);
      
      res.json({
        version,
        count: queries.length,
        queries: queries.map(q => ({
          id: q.id,
          name: q.name,
          section: q.section,
          description: q.description,
          estimatedDuration: q.estimatedDuration
        }))
      });
    } catch (error) {
      this.logger.error('Failed to get queries', error);
      res.status(500).json({ error: 'Failed to load queries' });
    }
  }

  async getQuerySections(req, res) {
    try {
      const { version } = req.params;
      const queryParser = new QueryParser(this.logger);
      const sections = await queryParser.getSections(version);
      
      res.json({
        version,
        sections
      });
    } catch (error) {
      this.logger.error('Failed to get query sections', error);
      res.status(500).json({ error: 'Failed to load query sections' });
    }
  }

  async getReports(req, res) {
    try {
      const reportsDir = path.join(this.config.dataDir, 'reports');
      
      if (!await fs.pathExists(reportsDir)) {
        return res.json([]);
      }

      const files = await fs.readdir(reportsDir);
      const reports = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const reportPath = path.join(reportsDir, file);
            const report = await fs.readJson(reportPath);
            const stats = await fs.stat(reportPath);
            
            reports.push({
              id: path.basename(file, '.json'),
              serverName: report.serverInfo?.serverName,
              version: report.serverInfo?.version,
              timestamp: report.timestamp,
              size: stats.size,
              queryCount: report.executionSummary?.totalQueries,
              hasAI: !!report.aiInsights
            });
          } catch (error) {
            this.logger.warn(`Failed to read report ${file}`, error);
          }
        }
      }

      // Sort by timestamp descending
      reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      res.json(reports);
    } catch (error) {
      this.logger.error('Failed to get reports', error);
      res.status(500).json({ error: 'Failed to load reports' });
    }
  }

  async getReport(req, res) {
    try {
      const { id } = req.params;
      const reportPath = path.join(this.config.dataDir, 'reports', `${id}.json`);
      
      if (!await fs.pathExists(reportPath)) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const report = await fs.readJson(reportPath);
      res.json(report);
    } catch (error) {
      this.logger.error('Failed to get report', error);
      res.status(500).json({ error: 'Failed to load report' });
    }
  }

  async deleteReport(req, res) {
    try {
      const { id } = req.params;
      const reportPath = path.join(this.config.dataDir, 'reports', `${id}.json`);
      
      if (!await fs.pathExists(reportPath)) {
        return res.status(404).json({ error: 'Report not found' });
      }

      await fs.remove(reportPath);
      
      // Also remove HTML report if it exists
      const htmlPath = path.join(this.config.dataDir, 'reports', `${id}.html`);
      if (await fs.pathExists(htmlPath)) {
        await fs.remove(htmlPath);
      }

      res.json({ success: true });
    } catch (error) {
      this.logger.error('Failed to delete report', error);
      res.status(500).json({ error: 'Failed to delete report' });
    }
  }

  async exportReport(req, res) {
    try {
      const { id } = req.params;
      const { format } = req.body;
      
      const reportPath = path.join(this.config.dataDir, 'reports', `${id}.json`);
      
      if (!await fs.pathExists(reportPath)) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const report = await fs.readJson(reportPath);
      const reportGenerator = new ReportGenerator(this.config, this.logger);
      
      let exportPath;
      let contentType;
      let filename;

      switch (format) {
        case 'html':
          exportPath = await reportGenerator.generateHTML(report);
          contentType = 'text/html';
          filename = `diagnostic-report-${id}.html`;
          break;
        case 'csv':
          exportPath = await reportGenerator.generateCSV(report);
          contentType = 'text/csv';
          filename = `diagnostic-report-${id}.csv`;
          break;
        case 'excel':
          exportPath = await reportGenerator.generateExcel(report);
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          filename = `diagnostic-report-${id}.xlsx`;
          break;
        default:
          return res.status(400).json({ error: 'Invalid export format' });
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      const fileStream = fs.createReadStream(exportPath);
      fileStream.pipe(res);
      
      // Clean up temporary file after sending
      fileStream.on('end', () => {
        fs.remove(exportPath).catch(err => {
          this.logger.warn('Failed to clean up export file', err);
        });
      });

    } catch (error) {
      this.logger.error('Failed to export report', error);
      res.status(500).json({ error: 'Failed to export report' });
    }
  }

  async getLatestReport(req, res) {
    try {
      const reportsDir = path.join(this.config.dataDir, 'reports');

      if (!await fs.pathExists(reportsDir)) {
        return res.status(404).json({ error: 'No reports found' });
      }

      const files = await fs.readdir(reportsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (jsonFiles.length === 0) {
        return res.status(404).json({ error: 'No reports found' });
      }

      // Sort by filename (which includes timestamp) to get the latest
      jsonFiles.sort().reverse();
      const latestFile = jsonFiles[0];
      const reportPath = path.join(reportsDir, latestFile);

      const report = await fs.readJson(reportPath);
      res.json(report);

    } catch (error) {
      this.logger.error('Failed to get latest report', error);
      res.status(500).json({ error: 'Failed to get latest report' });
    }
  }

  async exportLatestReportHTML(req, res) {
    try {
      const latestId = await this.getLatestReportId();
      if (!latestId) {
        return res.status(404).json({ error: 'No reports found' });
      }

      const reportPath = path.join(this.config.dataDir, 'reports', `${latestId}.json`);
      const report = await fs.readJson(reportPath);
      const reportGenerator = new ReportGenerator(this.config, this.logger);

      // Generate HTML content
      const htmlContent = reportGenerator.buildHTMLReport(report);

      // Check if download is requested via query parameter
      const forceDownload = req.query.download === 'true';

      if (forceDownload) {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename="diagnostic-report-latest.html"`);
      } else {
        // Serve inline for viewing in browser
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
      }

      res.send(htmlContent);
    } catch (error) {
      this.logger.error('Failed to export latest HTML report', error);
      res.status(500).json({ error: 'Failed to export latest HTML report' });
    }
  }

  async exportLatestReportCSV(req, res) {
    try {
      const latestId = await this.getLatestReportId();
      if (!latestId) {
        return res.status(404).json({ error: 'No reports found' });
      }
      await this.handleReportExport(req, res, latestId, 'csv');
    } catch (error) {
      this.logger.error('Failed to export latest CSV report', error);
      res.status(500).json({ error: 'Failed to export latest CSV report' });
    }
  }

  async exportLatestReportJSON(req, res) {
    try {
      const latestId = await this.getLatestReportId();
      if (!latestId) {
        return res.status(404).json({ error: 'No reports found' });
      }
      const reportPath = path.join(this.config.dataDir, 'reports', `${latestId}.json`);
      const report = await fs.readJson(reportPath);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="diagnostic-report-latest.json"`);
      res.json(report);

    } catch (error) {
      this.logger.error('Failed to export latest JSON report', error);
      res.status(500).json({ error: 'Failed to export latest JSON report' });
    }
  }

  async getLatestReportId() {
    try {
      const reportsDir = path.join(this.config.dataDir, 'reports');

      if (!await fs.pathExists(reportsDir)) {
        return null;
      }

      const files = await fs.readdir(reportsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (jsonFiles.length === 0) {
        return null;
      }

      // Sort by filename to get the latest
      jsonFiles.sort().reverse();
      const latestFile = jsonFiles[0];
      return path.basename(latestFile, '.json');

    } catch (error) {
      this.logger.error('Failed to get latest report ID', error);
      return null;
    }
  }

  async exportReportHTML(req, res) {
    try {
      const { id } = req.params;
      const reportPath = path.join(this.config.dataDir, 'reports', `${id}.json`);

      if (!await fs.pathExists(reportPath)) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const report = await fs.readJson(reportPath);
      const reportGenerator = new ReportGenerator(this.config, this.logger);

      // Generate HTML content
      const htmlContent = reportGenerator.buildHTMLReport(report);

      // Check if download is requested via query parameter
      const forceDownload = req.query.download === 'true';

      if (forceDownload) {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename="diagnostic-report-${id}.html"`);
      } else {
        // Serve inline for viewing in browser
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
      }

      res.send(htmlContent);
    } catch (error) {
      this.logger.error('Failed to export HTML report', error);
      res.status(500).json({ error: 'Failed to export HTML report' });
    }
  }

  async exportReportCSV(req, res) {
    try {
      const { id } = req.params;
      await this.handleReportExport(req, res, id, 'csv');
    } catch (error) {
      this.logger.error('Failed to export CSV report', error);
      res.status(500).json({ error: 'Failed to export CSV report' });
    }
  }

  async exportReportJSON(req, res) {
    try {
      const { id } = req.params;
      const reportPath = path.join(this.config.dataDir, 'reports', `${id}.json`);

      if (!await fs.pathExists(reportPath)) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const report = await fs.readJson(reportPath);

      // Check if download is requested via query parameter
      const forceDownload = req.query.download === 'true';

      res.setHeader('Content-Type', 'application/json');
      if (forceDownload) {
        res.setHeader('Content-Disposition', `attachment; filename="diagnostic-report-${id}.json"`);
      }

      res.json(report);

    } catch (error) {
      this.logger.error('Failed to export JSON report', error);
      res.status(500).json({ error: 'Failed to export JSON report' });
    }
  }

  async handleReportExport(req, res, id, format) {
    const reportPath = path.join(this.config.dataDir, 'reports', `${id}.json`);

    if (!await fs.pathExists(reportPath)) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = await fs.readJson(reportPath);
    const reportGenerator = new ReportGenerator(this.config, this.logger);

    let exportPath;
    let contentType;
    let filename;

    switch (format) {
      case 'html':
        exportPath = await reportGenerator.generateHTML(report);
        contentType = 'text/html';
        filename = `diagnostic-report-${id}.html`;
        break;
      case 'csv':
        exportPath = await reportGenerator.generateCSV(report);
        contentType = 'text/csv';
        filename = `diagnostic-report-${id}.csv`;
        break;
      default:
        return res.status(400).json({ error: 'Invalid export format' });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const fileStream = fs.createReadStream(exportPath);
    fileStream.pipe(res);

    // Clean up temporary file after sending
    fileStream.on('end', () => {
      fs.remove(exportPath).catch(err => {
        this.logger.warn('Failed to clean up export file', err);
      });
    });
  }

  getAIProviders(req, res) {
    res.json([
      {
        id: 'none',
        name: 'None',
        description: 'Disable AI analysis'
      },
      {
        id: 'openai',
        name: 'OpenAI',
        description: 'Use OpenAI GPT models for analysis',
        requiresApiKey: true
      },
      {
        id: 'ollama',
        name: 'Ollama',
        description: 'Use local Ollama models for analysis',
        requiresUrl: true
      }
    ]);
  }

  async testAIConnection(req, res) {
    try {
      const { provider, config } = req.body;
      
      const AIAnalyzer = require('../../ai/AIAnalyzer');
      const aiAnalyzer = new AIAnalyzer({ provider, ...config }, this.logger);
      
      const testResult = await aiAnalyzer.testConnection();
      
      res.json({
        success: true,
        ...testResult
      });
    } catch (error) {
      this.logger.error('AI connection test failed', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  getRouter() {
    return this.router;
  }
}

module.exports = ApiRoutes;

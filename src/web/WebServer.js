const express = require('express');
const http = require('http');
const https = require('https');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs-extra');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const ApiRoutes = require('./routes/ApiRoutes');
const WebRoutes = require('./routes/WebRoutes');

class WebServer {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.app = express();
    this.server = null;
    this.io = null;
    this.isRunning = false;
  }

  async start() {
    try {
      await this.setupMiddleware();
      await this.setupRoutes();

      const serverInfo = await this.startServer();
      await this.setupSocketIO();

      this.isRunning = true;

      return serverInfo;
    } catch (error) {
      this.logger.error('Failed to start web server', error);
      throw error;
    }
  }

  async setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"]
        }
      }
    }));

    // CORS
    this.app.use(cors({
      origin: this.config.web.corsOrigins || ['http://localhost:3000'],
      credentials: true
    }));

    // Compression
    this.app.use(compression());

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP'
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Static files
    const clientPath = path.join(__dirname, '../../client/dist');
    if (await fs.pathExists(clientPath)) {
      this.app.use(express.static(clientPath));
    } else {
      // Fallback to embedded client files
      const embeddedClientPath = path.join(__dirname, '../../embedded-client');
      this.app.use(express.static(embeddedClientPath));
    }

    // Logging middleware
    this.app.use((req, res, next) => {
      this.logger.debug(`${req.method} ${req.url}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  async setupRoutes() {
    // API routes
    const apiRoutes = new ApiRoutes(this.config, this.logger);
    this.app.use('/api', apiRoutes.getRouter());

    // Web routes (for serving the SPA)
    const webRoutes = new WebRoutes(this.config, this.logger);
    this.app.use('/', webRoutes.getRouter());

    // Error handling
    this.app.use((error, req, res, next) => {
      this.logger.error('Express error', error);
      res.status(500).json({
        error: 'Internal server error',
        message: this.config.web.showErrors ? error.message : 'Something went wrong'
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.url} not found`
      });
    });
  }

  async setupSocketIO() {
    this.io = socketIo(this.server, {
      cors: {
        origin: this.config.web.corsOrigins || ['http://localhost:3000'],
        methods: ['GET', 'POST']
      },
      serveClient: true,
      path: '/socket.io'
    });

    this.io.on('connection', (socket) => {
      this.logger.debug('Client connected', { socketId: socket.id });

      socket.on('disconnect', () => {
        this.logger.debug('Client disconnected', { socketId: socket.id });
      });

      // Handle diagnostic execution requests
      socket.on('start-diagnostic', async (data) => {
        try {
          await this.handleDiagnosticExecution(socket, data);
        } catch (error) {
          this.logger.error('Diagnostic execution error', error);
          socket.emit('diagnostic-error', {
            error: error.message
          });
        }
      });
    });
  }

  async startServer() {
    const port = this.config.web.port;
    const host = this.config.web.host;

    if (this.config.web.https && this.config.web.cert && this.config.web.key) {
      // HTTPS server
      const cert = await fs.readFile(this.config.web.cert);
      const key = await fs.readFile(this.config.web.key);
      
      this.server = https.createServer({ cert, key }, this.app);
      
      return new Promise((resolve, reject) => {
        this.server.listen(port, host, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve({
              url: `https://${host}:${port}`,
              port,
              host,
              https: true
            });
          }
        });
      });
    } else {
      // HTTP server
      this.server = http.createServer(this.app);
      
      return new Promise((resolve, reject) => {
        this.server.listen(port, host, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve({
              url: `http://${host}:${port}`,
              port,
              host,
              https: false
            });
          }
        });
      });
    }
  }

  async handleDiagnosticExecution(socket, data) {
    const { connectionConfig, aiConfig, queryOptions } = data;
    
    // Import diagnostic modules dynamically to avoid circular dependencies
    const ConnectionManager = require('../core/ConnectionManager');
    const QueryParser = require('../core/QueryParser');
    const ExecutionEngine = require('../core/ExecutionEngine');
    const AIAnalyzer = require('../ai/AIAnalyzer');
    const ReportGenerator = require('../reports/ReportGenerator');

    try {
      // Test connection
      socket.emit('diagnostic-progress', {
        stage: 'connecting',
        message: 'Connecting to SQL Server...'
      });

      const connectionManager = new ConnectionManager(connectionConfig, this.logger);
      await connectionManager.connect();
      const serverInfo = await connectionManager.getServerInfo();

      socket.emit('diagnostic-progress', {
        stage: 'connected',
        message: `Connected to ${serverInfo.serverName} (${serverInfo.version})`,
        serverInfo
      });

      // Load queries
      socket.emit('diagnostic-progress', {
        stage: 'loading-queries',
        message: 'Loading diagnostic queries...'
      });

      const queryParser = new QueryParser(this.logger);
      const queries = await queryParser.loadQueries(serverInfo.majorVersion);

      socket.emit('diagnostic-progress', {
        stage: 'queries-loaded',
        message: `Loaded ${queries.length} diagnostic queries`,
        queryCount: queries.length
      });

      // Execute queries
      socket.emit('diagnostic-progress', {
        stage: 'executing',
        message: 'Executing diagnostic queries...'
      });

      const executionEngine = new ExecutionEngine(connectionManager, queryOptions, this.logger);
      const results = await executionEngine.executeQueries(queries, (progress) => {
        socket.emit('diagnostic-progress', {
          stage: 'executing',
          message: `Executing queries... (${progress.completed}/${progress.total})`,
          progress: {
            completed: progress.completed,
            total: progress.total,
            percentage: Math.round((progress.completed / progress.total) * 100)
          }
        });
      });

      // AI Analysis (if enabled)
      let aiInsights = null;
      if (aiConfig && aiConfig.provider !== 'none') {
        socket.emit('diagnostic-progress', {
          stage: 'ai-analysis',
          message: 'Analyzing results with AI...'
        });

        const aiAnalyzer = new AIAnalyzer(aiConfig, this.logger);
        aiInsights = await aiAnalyzer.analyzeResults(results.data, serverInfo);
      }

      // Generate Report
      socket.emit('diagnostic-progress', {
        stage: 'generating-report',
        message: 'Generating diagnostic report...'
      });

      const reportGenerator = new ReportGenerator(this.config, this.logger);
      const reportData = {
        serverInfo,
        queryResults: results.data,
        aiInsights,
        executionSummary: {
          totalQueries: queries.length,
          successful: results.successful,
          failed: results.failed,
          executionTime: results.executionTime
        },
        timestamp: new Date().toISOString()
      };

      const reportInfo = await reportGenerator.generateReport(reportData);

      // Complete
      socket.emit('diagnostic-complete', {
        reportId: reportInfo.id,
        serverInfo,
        results: results.data,
        aiInsights,
        executionSummary: {
          totalQueries: queries.length,
          successful: results.successful,
          failed: results.failed,
          executionTime: results.executionTime
        }
      });

    } catch (error) {
      socket.emit('diagnostic-error', {
        error: error.message,
        stack: this.config.web.showErrors ? error.stack : undefined
      });
    }
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    return new Promise((resolve) => {
      if (this.io) {
        this.io.close();
      }
      
      if (this.server) {
        this.server.close(() => {
          this.isRunning = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getSocketIO() {
    return this.io;
  }
}

module.exports = WebServer;

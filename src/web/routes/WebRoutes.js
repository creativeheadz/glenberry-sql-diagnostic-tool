const express = require('express');
const path = require('path');
const fs = require('fs-extra');

class WebRoutes {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // Serve the main application for all non-API and non-Socket.IO routes
    this.router.get(/^(?!\/socket\.io).*/, this.serveApp.bind(this));
  }

  async serveApp(req, res) {
    try {
      // Check for built client files first
      const clientPath = path.join(__dirname, '../../../client/dist');
      let indexPath = path.join(clientPath, 'index.html');
      
      if (!await fs.pathExists(indexPath)) {
        // Fallback to embedded client
        const embeddedClientPath = path.join(__dirname, '../../../embedded-client');
        indexPath = path.join(embeddedClientPath, 'index.html');
        
        if (!await fs.pathExists(indexPath)) {
          // Generate a simple HTML page if no client is available
          return this.serveSimpleApp(req, res);
        }
      }

      // Read and serve the index.html file
      const html = await fs.readFile(indexPath, 'utf8');
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
      
    } catch (error) {
      this.logger.error('Failed to serve app', error);
      this.serveSimpleApp(req, res);
    }
  }

  serveSimpleApp(req, res) {
    // Generate a simple embedded HTML application
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SQL Server Diagnostic Tool</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            padding: 2rem;
            max-width: 800px;
            width: 90%;
        }
        
        .header {
            text-align: center;
            margin-bottom: 2rem;
        }
        
        .header h1 {
            color: #333;
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
        }
        
        .header p {
            color: #666;
            font-size: 1.1rem;
        }
        
        .form-group {
            margin-bottom: 1.5rem;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 600;
            color: #333;
        }
        
        .form-group input, .form-group select {
            width: 100%;
            padding: 0.75rem;
            border: 2px solid #e1e5e9;
            border-radius: 6px;
            font-size: 1rem;
            transition: border-color 0.3s;
        }
        
        .form-group input:focus, .form-group select:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
        }
        
        .btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 1rem 2rem;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
            width: 100%;
        }
        
        .btn:hover {
            transform: translateY(-2px);
        }
        
        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        
        .progress {
            margin-top: 1rem;
            display: none;
        }
        
        .progress-bar {
            width: 100%;
            height: 8px;
            background: #e1e5e9;
            border-radius: 4px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            width: 0%;
            transition: width 0.3s;
        }
        
        .progress-text {
            margin-top: 0.5rem;
            text-align: center;
            color: #666;
        }
        
        .results {
            margin-top: 2rem;
            display: none;
        }
        
        .alert {
            padding: 1rem;
            border-radius: 6px;
            margin-bottom: 1rem;
        }
        
        .alert-success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .alert-error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }

        .report-links {
            margin: 20px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }

        .button-group {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .btn {
            padding: 10px 20px;
            border-radius: 5px;
            text-decoration: none;
            font-weight: bold;
            display: inline-block;
            transition: all 0.3s ease;
        }

        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        .btn-secondary {
            background: #6c757d;
            color: white;
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }

        .section-summary {
            margin: 10px 0;
            padding: 10px;
            background: #e9ecef;
            border-radius: 5px;
        }

        .section-summary h4 {
            margin: 0 0 5px 0;
            color: #495057;
        }

        .query-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            margin: 5px 0;
            border-radius: 4px;
            border-left: 4px solid #28a745;
        }

        .query-item.error {
            border-left-color: #dc3545;
            background: #f8d7da;
        }

        .query-item.success {
            background: #d4edda;
        }

        .query-stats {
            font-size: 0.9em;
            color: #6c757d;
        }

        .form-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 10px;
        }

        .form-buttons .btn {
            flex: 1;
            min-width: 200px;
        }

        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        }

        .notification-success {
            background: #28a745;
        }

        .notification-info {
            background: #17a2b8;
        }

        .notification-error {
            background: #dc3545;
        }

        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 SQL Server Diagnostic Tool</h1>
            <p>Portable diagnostic tool with AI-powered analysis</p>
        </div>
        
        <form id="diagnosticForm">
            <div class="form-group">
                <label for="server">SQL Server Instance</label>
                <input type="text" id="server" name="server" placeholder="localhost" required>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="database">Database</label>
                    <input type="text" id="database" name="database" value="master">
                </div>
                
                <div class="form-group">
                    <label for="authType">Authentication</label>
                    <select id="authType" name="authType">
                        <option value="sql">SQL Server Authentication</option>
                        <option value="windows">Windows Authentication</option>
                    </select>
                </div>
            </div>
            
            <div id="sqlAuth">
                <div class="form-row">
                    <div class="form-group">
                        <label for="username">Username</label>
                        <input type="text" id="username" name="username" placeholder="sa">
                    </div>
                    
                    <div class="form-group">
                        <label for="password">Password</label>
                        <input type="password" id="password" name="password">
                    </div>
                </div>
            </div>
            
            <div class="form-buttons">
                <button type="submit" class="btn btn-primary" id="runBtn">
                    🚀 Run Diagnostic Analysis
                </button>
                <button type="button" class="btn btn-secondary" id="clearBtn" onclick="clearSavedFormValues(); location.reload();">
                    🗑️ Clear Saved Values
                </button>
            </div>
            
            <div class="progress" id="progress">
                <div class="progress-bar">
                    <div class="progress-fill" id="progressFill"></div>
                </div>
                <div class="progress-text" id="progressText">Initializing...</div>
            </div>
        </form>
        
        <div class="results" id="results"></div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        const form = document.getElementById('diagnosticForm');
        const runBtn = document.getElementById('runBtn');
        const progress = document.getElementById('progress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const results = document.getElementById('results');
        const authType = document.getElementById('authType');
        const sqlAuth = document.getElementById('sqlAuth');
        
        // Load saved form values
        loadFormValues();

        // Toggle authentication fields
        authType.addEventListener('change', function() {
            sqlAuth.style.display = this.value === 'sql' ? 'block' : 'none';
            saveFormValues(); // Save when auth type changes
        });

        // Save form values when they change
        ['server', 'database', 'username', 'password'].forEach(fieldName => {
            const field = document.getElementById(fieldName);
            if (field) {
                field.addEventListener('input', saveFormValues);
                field.addEventListener('change', saveFormValues);
            }
        });
        
        // Handle form submission
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(form);
            const connectionConfig = {
                server: formData.get('server'),
                database: formData.get('database') || 'master',
                authentication: {
                    type: formData.get('authType')
                }
            };
            
            if (formData.get('authType') === 'sql') {
                connectionConfig.authentication.username = formData.get('username');
                connectionConfig.authentication.password = formData.get('password');
            }
            
            startDiagnostic(connectionConfig);
        });
        
        function startDiagnostic(connectionConfig) {
            runBtn.disabled = true;
            runBtn.textContent = '⏳ Running...';
            progress.style.display = 'block';
            results.style.display = 'none';
            
            socket.emit('start-diagnostic', {
                connectionConfig,
                aiConfig: { provider: 'none' },
                queryOptions: { timeout: 30000 }
            });
        }
        
        // Socket event handlers
        socket.on('diagnostic-progress', function(data) {
            progressText.textContent = data.message;
            
            if (data.progress) {
                progressFill.style.width = data.progress.percentage + '%';
            }
        });
        
        socket.on('diagnostic-complete', function(data) {
            runBtn.disabled = false;
            runBtn.textContent = '🚀 Run Diagnostic Analysis';
            progress.style.display = 'none';
            
            showResults(data);
        });
        
        socket.on('diagnostic-error', function(data) {
            runBtn.disabled = false;
            runBtn.textContent = '🚀 Run Diagnostic Analysis';
            progress.style.display = 'none';
            
            showError(data.error);
        });
        
        function showResults(data) {
            const sections = groupResultsBySection(data.results);
            const sectionsHtml = Object.keys(sections).map(sectionName => {
                const sectionQueries = sections[sectionName];
                const successCount = sectionQueries.filter(q => q.success).length;
                const totalRows = sectionQueries.reduce((sum, q) => sum + (q.rowCount || 0), 0);

                return \`
                    <div class="section-summary">
                        <h4>\${sectionName}</h4>
                        <p>\${successCount}/\${sectionQueries.length} queries successful, \${totalRows} total rows</p>
                    </div>
                \`;
            }).join('');

            results.innerHTML = \`
                <div class="alert alert-success">
                    <strong>✅ Diagnostic completed successfully!</strong><br>
                    Server: \${data.serverInfo.serverName} (\${data.serverInfo.version})<br>
                    Queries executed: \${data.executionSummary.successful}/\${data.executionSummary.totalQueries}<br>
                    Execution time: \${Math.round(data.executionSummary.executionTime / 1000)}s
                </div>

                <div class="report-links">
                    <h3>📊 View Reports</h3>
                    <div class="button-group">
                        <a href="/api/reports/\${data.reportId}/export/html" target="_blank" class="btn btn-primary">
                            📄 View HTML Report
                        </a>
                        <a href="/api/reports/\${data.reportId}/export/csv" class="btn btn-secondary">
                            📊 Download CSV
                        </a>
                        <a href="/api/reports/\${data.reportId}" class="btn btn-secondary">
                            🔍 View JSON Data
                        </a>
                    </div>
                </div>

                <div class="results-summary">
                    <h3>📋 Results Summary</h3>
                    \${sectionsHtml}
                </div>

                <div class="query-details">
                    <h3>🔍 Query Details</h3>
                    <div class="query-list">
                        \${data.results.slice(0, 10).map(query => \`
                            <div class="query-item \${query.success ? 'success' : 'error'}">
                                <strong>\${query.name}</strong> (\${query.section})
                                <span class="query-stats">\${query.rowCount || 0} rows, \${query.executionTime}ms</span>
                            </div>
                        \`).join('')}
                        \${data.results.length > 10 ? \`<p><em>... and \${data.results.length - 10} more queries</em></p>\` : ''}
                    </div>
                </div>
            \`;
            results.style.display = 'block';
        }

        function groupResultsBySection(results) {
            return results.reduce((sections, query) => {
                const section = query.section || 'General';
                if (!sections[section]) {
                    sections[section] = [];
                }
                sections[section].push(query);
                return sections;
            }, {});
        }

        function saveFormValues() {
            const formData = {
                server: document.getElementById('server').value,
                database: document.getElementById('database').value,
                authType: document.getElementById('authType').value,
                username: document.getElementById('username').value,
                // Note: We don't save password for security reasons
            };

            localStorage.setItem('sqlDiagnosticFormData', JSON.stringify(formData));
        }

        function loadFormValues() {
            try {
                const savedData = localStorage.getItem('sqlDiagnosticFormData');
                if (savedData) {
                    const formData = JSON.parse(savedData);

                    // Restore form values
                    if (formData.server) document.getElementById('server').value = formData.server;
                    if (formData.database) document.getElementById('database').value = formData.database;
                    if (formData.authType) {
                        document.getElementById('authType').value = formData.authType;
                        // Trigger the change event to show/hide SQL auth fields
                        document.getElementById('authType').dispatchEvent(new Event('change'));
                    }
                    if (formData.username) document.getElementById('username').value = formData.username;

                    // Show a brief notification
                    showNotification('✅ Form values restored from previous session', 'success');
                    console.log('✅ Form values restored from previous session');
                }
            } catch (error) {
                console.warn('Could not load saved form values:', error);
            }
        }

        function clearSavedFormValues() {
            localStorage.removeItem('sqlDiagnosticFormData');
            showNotification('🗑️ Saved form values cleared', 'info');
            console.log('🗑️ Saved form values cleared');
        }

        function showNotification(message, type = 'info') {
            // Create notification element
            const notification = document.createElement('div');
            notification.className = \`notification notification-\${type}\`;
            notification.textContent = message;

            // Add to page
            document.body.appendChild(notification);

            // Auto-remove after 3 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        }
        
        function showError(error) {
            results.innerHTML = \`
                <div class="alert alert-error">
                    <strong>❌ Error:</strong> \${error}
                </div>
            \`;
            results.style.display = 'block';
        }
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  getRouter() {
    return this.router;
  }
}

module.exports = WebRoutes;

const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');

class ReportGenerator {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  async generateReport(reportData) {
    try {
      const reportId = this.generateReportId();
      const reportsDir = path.join(this.config.dataDir || './data', 'reports');
      
      // Ensure reports directory exists
      await fs.ensureDir(reportsDir);

      // Prepare report data
      const report = {
        id: reportId,
        timestamp: new Date().toISOString(),
        ...reportData
      };

      // Save JSON report
      const jsonPath = path.join(reportsDir, `${reportId}.json`);
      await fs.writeJson(jsonPath, report, { spaces: 2 });

      // Generate HTML report
      const htmlPath = await this.generateHTML(report);

      this.logger.info(`Report generated: ${reportId}`, {
        jsonPath,
        htmlPath
      });

      return {
        id: reportId,
        jsonPath,
        htmlPath
      };

    } catch (error) {
      this.logger.error('Failed to generate report', error);
      throw new Error(`Report generation failed: ${error.message}`);
    }
  }

  generateReportId() {
    return `diagnostic-${moment().format('YYYYMMDD-HHmmss')}-${Math.random().toString(36).substr(2, 6)}`;
  }

  async generateHTML(report) {
    const reportsDir = path.join(this.config.dataDir || './data', 'reports');
    const htmlPath = path.join(reportsDir, `${report.id}.html`);

    const html = this.buildHTMLReport(report);
    await fs.writeFile(htmlPath, html, 'utf8');

    return htmlPath;
  }

  buildHTMLReport(report) {
    const { serverInfo, queryResults, aiInsights, executionSummary } = report;
    
    // Group results by section
    const sections = new Map();
    for (const result of queryResults) {
      if (!sections.has(result.section)) {
        sections.set(result.section, []);
      }
      sections.get(result.section).push(result);
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SQL Server Diagnostic Report - ${serverInfo.serverName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; border-radius: 12px; margin-bottom: 2rem; }
        .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .header p { font-size: 1.1rem; opacity: 0.9; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .summary-card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .summary-card h3 { color: #667eea; margin-bottom: 0.5rem; }
        .summary-card .value { font-size: 2rem; font-weight: bold; color: #333; }
        .summary-card .label { color: #666; font-size: 0.9rem; }
        .section { background: white; margin-bottom: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .section-header { background: #f8f9fa; padding: 1rem 1.5rem; border-bottom: 1px solid #e9ecef; }
        .section-header h2 { color: #333; font-size: 1.3rem; }
        .section-content { padding: 1.5rem; }
        .query-result { margin-bottom: 2rem; }
        .query-result h4 { color: #667eea; margin-bottom: 0.5rem; }
        .query-result .meta { color: #666; font-size: 0.9rem; margin-bottom: 1rem; }
        .data-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        .data-table th, .data-table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e9ecef; }
        .data-table th { background: #f8f9fa; font-weight: 600; color: #333; }
        .data-table tr:hover { background: #f8f9fa; }
        .success { color: #28a745; }
        .error { color: #dc3545; }
        .ai-section { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .ai-section .section-header { background: rgba(255,255,255,0.1); color: white; border-bottom: 1px solid rgba(255,255,255,0.2); }
        .ai-content { white-space: pre-wrap; line-height: 1.8; }
        .nav { position: sticky; top: 20px; background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 2rem; }
        .nav ul { list-style: none; display: flex; flex-wrap: wrap; gap: 1rem; }
        .nav a { color: #667eea; text-decoration: none; padding: 0.5rem 1rem; border-radius: 4px; transition: background 0.2s; }
        .nav a:hover { background: #f8f9fa; }
        @media (max-width: 768px) { .summary-grid { grid-template-columns: 1fr; } .nav ul { flex-direction: column; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 SQL Server Diagnostic Report</h1>
            <p>Generated on ${moment(report.timestamp).format('MMMM Do YYYY, h:mm:ss a')}</p>
        </div>

        <div class="nav">
            <ul>
                <li><a href="#overview">Overview</a></li>
                ${Array.from(sections.keys()).map(section => 
                    `<li><a href="#${section.toLowerCase().replace(/\s+/g, '-')}">${section}</a></li>`
                ).join('')}
                ${aiInsights ? '<li><a href="#ai-analysis">AI Analysis</a></li>' : ''}
            </ul>
        </div>

        <div id="overview" class="summary-grid">
            <div class="summary-card">
                <h3>Server</h3>
                <div class="value">${serverInfo.serverName}</div>
                <div class="label">${serverInfo.version}</div>
            </div>
            <div class="summary-card">
                <h3>Queries Executed</h3>
                <div class="value">${executionSummary.totalQueries}</div>
                <div class="label">${executionSummary.successful} successful, ${executionSummary.failed} failed</div>
            </div>
            <div class="summary-card">
                <h3>Execution Time</h3>
                <div class="value">${Math.round(executionSummary.executionTime / 1000)}s</div>
                <div class="label">Total runtime</div>
            </div>
            <div class="summary-card">
                <h3>Edition</h3>
                <div class="value">${serverInfo.edition}</div>
                <div class="label">SQL Server ${serverInfo.majorVersion}</div>
            </div>
        </div>

        ${Array.from(sections.entries()).map(([sectionName, sectionResults]) => `
            <div id="${sectionName.toLowerCase().replace(/\s+/g, '-')}" class="section">
                <div class="section-header">
                    <h2>${sectionName}</h2>
                </div>
                <div class="section-content">
                    ${sectionResults.map(result => `
                        <div class="query-result">
                            <h4>${result.name} ${result.success ? '<span class="success">✓</span>' : '<span class="error">✗</span>'}</h4>
                            <div class="meta">
                                ${result.description} | 
                                ${result.success ? `${result.rowCount} rows` : `Error: ${result.error}`} | 
                                ${result.executionTime}ms
                            </div>
                            ${result.success && result.data && result.data.length > 0 ? `
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            ${Object.keys(result.data[0]).map(key => `<th>${key}</th>`).join('')}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${result.data.slice(0, 10).map(row => `
                                            <tr>
                                                ${Object.values(row).map(value => `<td>${value !== null ? value : 'NULL'}</td>`).join('')}
                                            </tr>
                                        `).join('')}
                                        ${result.data.length > 10 ? `<tr><td colspan="${Object.keys(result.data[0]).length}"><em>... and ${result.data.length - 10} more rows</em></td></tr>` : ''}
                                    </tbody>
                                </table>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('')}

        ${aiInsights ? `
            <div id="ai-analysis" class="section ai-section">
                <div class="section-header">
                    <h2>🤖 AI Analysis</h2>
                </div>
                <div class="section-content">
                    <div class="ai-content">${aiInsights.analysis}</div>
                </div>
            </div>
        ` : ''}
    </div>
</body>
</html>`;
  }

  async generateCSV(report) {
    // Implementation for CSV export
    const reportsDir = path.join(this.config.dataDir || './data', 'reports');
    const csvPath = path.join(reportsDir, `${report.id}.csv`);
    
    // Simple CSV implementation - in a full version, this would be more comprehensive
    let csv = 'Section,Query,Success,Rows,ExecutionTime,Error\n';
    
    for (const result of report.queryResults) {
      csv += `"${result.section}","${result.name}",${result.success},${result.rowCount || 0},${result.executionTime},"${result.error || ''}"\n`;
    }
    
    await fs.writeFile(csvPath, csv, 'utf8');
    return csvPath;
  }

  async generateExcel(report) {
    // Placeholder for Excel export - would use a library like exceljs
    const reportsDir = path.join(this.config.dataDir || './data', 'reports');
    const excelPath = path.join(reportsDir, `${report.id}.xlsx`);
    
    // For now, just copy the CSV as a placeholder
    const csvPath = await this.generateCSV(report);
    await fs.copy(csvPath, excelPath);
    
    return excelPath;
  }
}

module.exports = ReportGenerator;

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

  // Helper methods to load static assets as base64
  getBootstrapCSS() {
    try {
      const cssPath = path.join(__dirname, '..', 'web', 'static', 'css', 'bootstrap.min.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      return Buffer.from(css).toString('base64');
    } catch (error) {
      this.logger.warn('Failed to load Bootstrap CSS, using CDN fallback');
      return '';
    }
  }

  getDataTablesCSS() {
    try {
      const cssPath = path.join(__dirname, '..', 'web', 'static', 'css', 'datatables.min.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      return Buffer.from(css).toString('base64');
    } catch (error) {
      this.logger.warn('Failed to load DataTables CSS, using CDN fallback');
      return '';
    }
  }

  getJQuery() {
    try {
      const jsPath = path.join(__dirname, '..', 'web', 'static', 'js', 'jquery.min.js');
      const js = fs.readFileSync(jsPath, 'utf8');
      return Buffer.from(js).toString('base64');
    } catch (error) {
      this.logger.warn('Failed to load jQuery, using CDN fallback');
      return '';
    }
  }

  getBootstrapJS() {
    try {
      const jsPath = path.join(__dirname, '..', 'web', 'static', 'js', 'bootstrap.bundle.min.js');
      const js = fs.readFileSync(jsPath, 'utf8');
      return Buffer.from(js).toString('base64');
    } catch (error) {
      this.logger.warn('Failed to load Bootstrap JS, using CDN fallback');
      return '';
    }
  }

  getDataTablesJS() {
    try {
      const corePath = path.join(__dirname, '..', 'web', 'static', 'js', 'datatables.core.min.js');
      const bootstrapPath = path.join(__dirname, '..', 'web', 'static', 'js', 'datatables.min.js');
      const coreJS = fs.readFileSync(corePath, 'utf8');
      const bootstrapJS = fs.readFileSync(bootstrapPath, 'utf8');
      const combined = coreJS + '\n' + bootstrapJS;
      return Buffer.from(combined).toString('base64');
    } catch (error) {
      this.logger.warn('Failed to load DataTables JS, using CDN fallback');
      return '';
    }
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

    <!-- Bootstrap CSS -->
    ${this.getBootstrapCSS() ? `<link href="data:text/css;base64,${this.getBootstrapCSS()}" rel="stylesheet">` : '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">'}

    <!-- DataTables CSS -->
    ${this.getDataTablesCSS() ? `<link href="data:text/css;base64,${this.getDataTablesCSS()}" rel="stylesheet">` : '<link href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css" rel="stylesheet">'}

    <style>
        /* Custom styles for diagnostic report */
        body { background: #f8f9fa; }

        .report-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 3rem 0;
            margin-bottom: 2rem;
            border-radius: 12px;
        }
        .report-header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .report-header p { font-size: 1.1rem; opacity: 0.9; }

        .summary-card {
            background: white;
            border: none;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.2s;
            border-radius: 8px;
            margin-bottom: 1rem;
        }
        .summary-card:hover { transform: translateY(-2px); }
        .summary-card .card-body { padding: 1.5rem; }
        .summary-card .value { font-size: 2rem; font-weight: bold; color: #667eea; }
        .summary-card .label { color: #6c757d; font-size: 0.9rem; }

        /* Version information styling */
        .version-details { margin-top: 0.5rem; }
        .version-text {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            padding: 1rem;
            font-size: 0.85rem;
            line-height: 1.4;
            color: #495057;
            margin: 0;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .section-card {
            background: white;
            border: none;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
            border-radius: 8px;
        }
        .section-header {
            background: #667eea;
            color: white;
            padding: 1rem 1.5rem;
            border-bottom: none;
            border-radius: 8px 8px 0 0;
        }
        .section-header h2 { font-size: 1.5rem; margin: 0; }

        .query-result {
            margin-bottom: 2rem;
            padding: 1rem;
            border-left: 4px solid #667eea;
            background: #f8f9fa;
            border-radius: 4px;
        }
        .query-result h4 { color: #667eea; margin-bottom: 0.5rem; }
        .query-result .meta { color: #6c757d; font-size: 0.9rem; margin-bottom: 1rem; }

        .success { color: #28a745; }
        .error { color: #dc3545; }

        .ai-section {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 8px;
        }
        .ai-section .section-header {
            background: rgba(255,255,255,0.1);
            color: white;
        }
        .ai-content {
            white-space: pre-wrap;
            line-height: 1.8;
            padding: 1.5rem;
        }

        /* DataTables customization */
        .dataTables_wrapper .dataTables_length,
        .dataTables_wrapper .dataTables_filter,
        .dataTables_wrapper .dataTables_info,
        .dataTables_wrapper .dataTables_paginate {
            margin: 0.5rem 0;
        }

        .table-responsive {
            margin-top: 1rem;
        }

        /* Sticky navigation */
        .nav-pills {
            position: sticky;
            top: 20px;
            z-index: 1000;
            background: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }
    </style>
</head>
<body>
    <div class="container-fluid">
        <div class="report-header text-center">
            <div class="container">
                <h1>🔍 SQL Server Diagnostic Report</h1>
                <p>Generated on ${moment(report.timestamp).format('MMMM Do YYYY, h:mm:ss a')}</p>
            </div>
        </div>

        <div class="container">
            <!-- Navigation -->
            <nav class="nav-pills">
                <ul class="nav nav-pills justify-content-center">
                    <li class="nav-item"><a class="nav-link" href="#overview">Overview</a></li>
                    ${Array.from(sections.keys()).map(section =>
                        `<li class="nav-item"><a class="nav-link" href="#${section.toLowerCase().replace(/\s+/g, '-')}">${section}</a></li>`
                    ).join('')}
                    ${aiInsights ? '<li class="nav-item"><a class="nav-link" href="#ai-analysis">🤖 AI Analysis</a></li>' : ''}
                </ul>
            </nav>

            <!-- Server Information Card - Full Width -->
            <div id="overview" class="row mb-4">
                <div class="col-12">
                    <div class="summary-card">
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-3 text-center">
                                    <h5 class="card-title">Server Instance</h5>
                                    <div class="value">${serverInfo.serverName}</div>
                                </div>
                                <div class="col-md-9">
                                    <h5 class="card-title">Version Information</h5>
                                    <div class="version-details">
                                        <pre class="version-text">${serverInfo.version}</pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Summary Statistics Cards -->
            <div class="row mb-4">
                <div class="col-md-4 col-sm-6">
                    <div class="summary-card">
                        <div class="card-body text-center">
                            <h5 class="card-title">Queries Executed</h5>
                            <div class="value">${executionSummary.totalQueries}</div>
                            <div class="label">${executionSummary.successful} successful, ${executionSummary.failed} failed</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 col-sm-6">
                    <div class="summary-card">
                        <div class="card-body text-center">
                            <h5 class="card-title">Execution Time</h5>
                            <div class="value">${Math.round(executionSummary.executionTime / 1000)}s</div>
                            <div class="label">Total runtime</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 col-sm-6">
                    <div class="summary-card">
                        <div class="card-body text-center">
                            <h5 class="card-title">Edition</h5>
                            <div class="value">${serverInfo.edition}</div>
                            <div class="label">SQL Server ${serverInfo.majorVersion}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Diagnostic Sections -->
            ${Array.from(sections.entries()).map(([sectionName, sectionResults]) => `
                <div id="${sectionName.toLowerCase().replace(/\s+/g, '-')}" class="section-card">
                    <div class="section-header">
                        <h2>${sectionName}</h2>
                    </div>
                    <div class="p-3">
                    ${sectionResults.map(result => `
                        <div class="query-result">
                            <h4>${result.name} ${result.success ? '<span class="success">✓</span>' : '<span class="error">✗</span>'}</h4>
                            <div class="meta">
                                ${result.description} | 
                                ${result.success ? `${result.rowCount} rows` : `Error: ${result.error}`} | 
                                ${result.executionTime}ms
                            </div>
                            ${result.success && result.data && result.data.length > 0 ? `
                                <div class="table-responsive">
                                    <table class="table table-striped table-hover diagnostic-table" data-query-id="${result.id}">
                                        <thead class="table-dark">
                                            <tr>
                                                ${Object.keys(result.data[0]).map(key => `<th>${key}</th>`).join('')}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${result.data.map(row => `
                                                <tr>
                                                    ${Object.values(row).map(value => `<td>${value !== null ? value : 'NULL'}</td>`).join('')}
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('')}

            ${aiInsights ? `
                <div id="ai-analysis" class="ai-section section-card">
                    <div class="section-header">
                        <h2>🤖 AI Analysis</h2>
                    </div>
                    <div class="ai-content">${aiInsights.analysis}</div>
                </div>
            ` : ''}
        </div>
    </div>

    <!-- JavaScript Libraries -->
    <!-- jQuery -->
    ${this.getJQuery() ? `<script src="data:text/javascript;base64,${this.getJQuery()}"></script>` : '<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>'}

    <!-- Bootstrap JS -->
    ${this.getBootstrapJS() ? `<script src="data:text/javascript;base64,${this.getBootstrapJS()}"></script>` : '<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>'}

    <!-- DataTables JS -->
    ${this.getDataTablesJS() ? `<script src="data:text/javascript;base64,${this.getDataTablesJS()}"></script>` : '<script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script><script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>'}

    <script>
        $(document).ready(function() {
            // Initialize DataTables for all diagnostic tables
            $('.diagnostic-table').each(function() {
                $(this).DataTable({
                    responsive: true,
                    pageLength: 25,
                    lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "All"]],
                    order: [],
                    columnDefs: [
                        { targets: '_all', className: 'text-nowrap' }
                    ],
                    language: {
                        search: "Filter results:",
                        lengthMenu: "Show _MENU_ entries per page",
                        info: "Showing _START_ to _END_ of _TOTAL_ entries",
                        infoEmpty: "No entries found",
                        infoFiltered: "(filtered from _MAX_ total entries)",
                        paginate: {
                            first: "First",
                            last: "Last",
                            next: "Next",
                            previous: "Previous"
                        }
                    },
                    dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>' +
                         '<"row"<"col-sm-12"tr>>' +
                         '<"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>',
                    initComplete: function() {
                        // Add custom styling after initialization
                        $(this).closest('.dataTables_wrapper').addClass('mt-3');
                    }
                });
            });

            // Smooth scrolling for navigation links
            $('a[href^="#"]').on('click', function(e) {
                e.preventDefault();
                var target = $(this.getAttribute('href'));
                if (target.length) {
                    $('html, body').stop().animate({
                        scrollTop: target.offset().top - 100
                    }, 1000);
                }
            });

            // Highlight active navigation item on scroll
            $(window).scroll(function() {
                var scrollPos = $(document).scrollTop();
                $('.nav-link').each(function() {
                    var currLink = $(this);
                    var refElement = $(currLink.attr("href"));
                    if (refElement.position() && refElement.position().top <= scrollPos + 150 && refElement.position().top + refElement.height() > scrollPos) {
                        $('.nav-link').removeClass("active");
                        currLink.addClass("active");
                    }
                });
            });
        });
    </script>
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

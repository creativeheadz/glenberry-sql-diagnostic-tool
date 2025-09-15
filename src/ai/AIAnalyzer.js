const axios = require('axios');
const OpenAI = require('openai');

class AIAnalyzer {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.provider = config.provider || 'none';
    
    if (this.provider === 'openai') {
      this.openai = new OpenAI({
        apiKey: config.openai.apiKey
      });
    }
  }

  async analyzeResults(queryResults, serverInfo) {
    if (this.provider === 'none') {
      return null;
    }

    try {
      this.logger.info(`Starting AI analysis with ${this.provider}`);
      
      const analysisPrompt = this.buildAnalysisPrompt(queryResults, serverInfo);
      let analysis;

      switch (this.provider) {
        case 'openai':
          analysis = await this.analyzeWithOpenAI(analysisPrompt);
          break;
        case 'ollama':
          analysis = await this.analyzeWithOllama(analysisPrompt);
          break;
        default:
          throw new Error(`Unsupported AI provider: ${this.provider}`);
      }

      this.logger.info('AI analysis completed');
      return analysis;

    } catch (error) {
      this.logger.error('AI analysis failed', error);
      return {
        error: error.message,
        summary: 'AI analysis failed. Please check the configuration and try again.'
      };
    }
  }

  buildAnalysisPrompt(queryResults, serverInfo) {
    const successfulResults = queryResults.filter(r => r.success);
    const failedResults = queryResults.filter(r => !r.success);

    let prompt = `You are a SQL Server database expert analyzing diagnostic query results. Please provide insights and recommendations based on the following data:

SERVER INFORMATION:
- Server: ${serverInfo.serverName}
- Version: ${serverInfo.version}
- Edition: ${serverInfo.edition}
- Major Version: ${serverInfo.majorVersion}

EXECUTION SUMMARY:
- Total Queries: ${queryResults.length}
- Successful: ${successfulResults.length}
- Failed: ${failedResults.length}

QUERY RESULTS BY SECTION:
`;

    // Group results by section
    const sections = new Map();
    for (const result of successfulResults) {
      if (!sections.has(result.section)) {
        sections.set(result.section, []);
      }
      sections.get(result.section).push(result);
    }

    // Add key data points from each section
    for (const [sectionName, sectionResults] of sections) {
      prompt += `\n${sectionName.toUpperCase()}:\n`;
      
      for (const result of sectionResults.slice(0, 3)) { // Limit to first 3 queries per section
        prompt += `- ${result.name}: ${result.rowCount} rows\n`;
        
        // Add sample data for key queries
        if (result.data && result.data.length > 0) {
          const sampleData = result.data.slice(0, 5); // First 5 rows
          prompt += `  Sample data: ${JSON.stringify(sampleData, null, 2)}\n`;
        }
      }
    }

    if (failedResults.length > 0) {
      prompt += `\nFAILED QUERIES:\n`;
      for (const result of failedResults) {
        prompt += `- ${result.name}: ${result.error}\n`;
      }
    }

    prompt += `\nPlease provide:
1. EXECUTIVE SUMMARY: Overall health assessment of the SQL Server instance
2. KEY FINDINGS: Most important discoveries from the diagnostic data
3. PERFORMANCE RECOMMENDATIONS: Specific suggestions to improve performance
4. CONFIGURATION RECOMMENDATIONS: Settings that should be reviewed or changed
5. MAINTENANCE RECOMMENDATIONS: Backup, index, and maintenance suggestions
6. SECURITY RECOMMENDATIONS: Security-related findings and suggestions
7. CAPACITY PLANNING: Storage, memory, and growth recommendations
8. PRIORITY ACTIONS: Top 3-5 actions that should be taken immediately

Keep recommendations specific and actionable. Focus on the most impactful improvements.`;

    return prompt;
  }

  async analyzeWithOpenAI(prompt) {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.openai.model || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert SQL Server database administrator with deep knowledge of performance tuning, configuration optimization, and best practices.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.config.openai.maxTokens || 4000,
        temperature: this.config.openai.temperature || 0.1
      });

      const analysis = response.choices[0].message.content;
      
      return {
        provider: 'openai',
        model: this.config.openai.model,
        analysis: analysis,
        summary: this.extractSummary(analysis),
        recommendations: this.extractRecommendations(analysis),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`OpenAI analysis failed: ${error.message}`);
    }
  }

  async analyzeWithOllama(prompt) {
    try {
      const response = await axios.post(`${this.config.ollama.url}/api/generate`, {
        model: this.config.ollama.model || 'llama2',
        prompt: prompt,
        stream: false
      }, {
        timeout: this.config.ollama.timeout || 60000
      });

      const analysis = response.data.response;
      
      return {
        provider: 'ollama',
        model: this.config.ollama.model,
        analysis: analysis,
        summary: this.extractSummary(analysis),
        recommendations: this.extractRecommendations(analysis),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Ollama analysis failed: ${error.message}`);
    }
  }

  extractSummary(analysis) {
    // Extract the executive summary section
    const summaryMatch = analysis.match(/EXECUTIVE SUMMARY[:\s]*(.*?)(?=\n\d+\.|$)/is);
    if (summaryMatch) {
      return summaryMatch[1].trim();
    }
    
    // Fallback: return first paragraph
    const firstParagraph = analysis.split('\n\n')[0];
    return firstParagraph.length > 500 ? firstParagraph.substring(0, 500) + '...' : firstParagraph;
  }

  extractRecommendations(analysis) {
    const recommendations = [];
    
    // Extract different recommendation sections
    const sections = [
      'PERFORMANCE RECOMMENDATIONS',
      'CONFIGURATION RECOMMENDATIONS', 
      'MAINTENANCE RECOMMENDATIONS',
      'SECURITY RECOMMENDATIONS',
      'CAPACITY PLANNING',
      'PRIORITY ACTIONS'
    ];

    for (const section of sections) {
      const regex = new RegExp(`${section}[:\\s]*(.*?)(?=\\n\\d+\\.|\\n[A-Z]+ RECOMMENDATIONS|$)`, 'is');
      const match = analysis.match(regex);
      
      if (match) {
        recommendations.push({
          category: section.toLowerCase().replace(' recommendations', '').replace(' ', '_'),
          content: match[1].trim()
        });
      }
    }

    return recommendations;
  }

  async testConnection() {
    try {
      switch (this.provider) {
        case 'openai':
          const response = await this.openai.chat.completions.create({
            model: this.config.openai.model || 'gpt-4',
            messages: [{ role: 'user', content: 'Hello' }],
            max_tokens: 10
          });
          return {
            success: true,
            model: this.config.openai.model,
            provider: 'openai'
          };

        case 'ollama':
          const ollamaResponse = await axios.post(`${this.config.ollama.url}/api/generate`, {
            model: this.config.ollama.model,
            prompt: 'Hello',
            stream: false
          }, { timeout: 10000 });
          
          return {
            success: true,
            model: this.config.ollama.model,
            provider: 'ollama',
            url: this.config.ollama.url
          };

        default:
          throw new Error(`Unsupported provider: ${this.provider}`);
      }
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }
}

module.exports = AIAnalyzer;

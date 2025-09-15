const fs = require('fs-extra');
const path = require('path');

class ConfigManager {
  static async load(configPath, cliOptions = {}) {
    let config = this.getDefaultConfig();

    // Load config file if it exists
    if (configPath && await fs.pathExists(configPath)) {
      try {
        const fileConfig = await fs.readJson(configPath);
        config = this.mergeConfig(config, fileConfig);
      } catch (error) {
        throw new Error(`Failed to load config file ${configPath}: ${error.message}`);
      }
    }

    // Override with CLI options
    config = this.mergeConfig(config, this.mapCliOptions(cliOptions));

    // Validate configuration
    this.validateConfig(config);

    return config;
  }

  static getDefaultConfig() {
    return {
      server: null,
      database: 'master',
      authentication: {
        type: 'sql', // 'sql' or 'windows'
        username: null,
        password: null
      },
      ai: {
        provider: 'none', // 'openai', 'ollama', 'none'
        openai: {
          apiKey: null,
          model: 'gpt-4',
          maxTokens: 4000,
          temperature: 0.1
        },
        ollama: {
          url: 'http://localhost:11434',
          model: 'llama2',
          timeout: 60000
        }
      },
      output: {
        directory: './reports',
        format: 'html',
        includeRawData: true,
        timestamp: true
      },
      queries: {
        timeout: 30000,
        maxRetries: 3,
        retryDelay: 1000,
        continueOnError: true
      },
      logging: {
        level: 'info',
        file: './logs/diagnostic.log',
        console: true
      }
    };
  }

  static getDefaultWebConfig() {
    return {
      dataDir: './data',
      web: {
        port: 3000,
        host: 'localhost',
        https: false,
        cert: null,
        key: null,
        corsOrigins: ['http://localhost:3000'],
        showErrors: false
      },
      ai: {
        provider: 'none',
        openai: {
          apiKey: null,
          model: 'gpt-4',
          maxTokens: 4000,
          temperature: 0.1
        },
        ollama: {
          url: 'http://localhost:11434',
          model: 'llama2',
          timeout: 60000
        }
      },
      queries: {
        timeout: 30000,
        maxRetries: 3,
        retryDelay: 1000,
        continueOnError: true
      },
      logging: {
        level: 'info',
        file: './logs/diagnostic.log',
        console: true
      }
    };
  }

  static async loadWebConfig(configPath, cliOptions = {}) {
    let config = this.getDefaultWebConfig();

    // Load config file if it exists
    if (configPath && await fs.pathExists(configPath)) {
      try {
        const fileConfig = await fs.readJson(configPath);
        config = this.mergeConfig(config, fileConfig);
      } catch (error) {
        throw new Error(`Failed to load config file ${configPath}: ${error.message}`);
      }
    }

    // Override with CLI options
    config = this.mergeConfig(config, this.mapWebCliOptions(cliOptions));

    // Validate configuration
    this.validateWebConfig(config);

    return config;
  }

  static mapCliOptions(cliOptions) {
    const mapped = {};

    if (cliOptions.server) mapped.server = cliOptions.server;
    if (cliOptions.database) mapped.database = cliOptions.database;
    if (cliOptions.output) mapped.output = { directory: cliOptions.output };
    if (cliOptions.timeout) mapped.queries = { timeout: parseInt(cliOptions.timeout) };

    // Authentication
    if (cliOptions.trusted) {
      mapped.authentication = { type: 'windows' };
    } else if (cliOptions.username || cliOptions.password) {
      mapped.authentication = {
        type: 'sql',
        username: cliOptions.username,
        password: cliOptions.password
      };
    }

    // AI configuration
    if (cliOptions.ai) {
      mapped.ai = { provider: cliOptions.ai };

      if (cliOptions.ai === 'openai' && cliOptions.apiKey) {
        mapped.ai.openai = { apiKey: cliOptions.apiKey };
      }

      if (cliOptions.ai === 'ollama') {
        mapped.ai.ollama = {};
        if (cliOptions.ollamaUrl) mapped.ai.ollama.url = cliOptions.ollamaUrl;
        if (cliOptions.ollamaModel) mapped.ai.ollama.model = cliOptions.ollamaModel;
      }
    }

    // Logging
    if (cliOptions.verbose) {
      mapped.logging = { level: 'debug' };
    }

    return mapped;
  }

  static mapWebCliOptions(cliOptions) {
    const mapped = {};

    if (cliOptions.port) mapped.web = { port: parseInt(cliOptions.port) };
    if (cliOptions.host) mapped.web = { ...mapped.web, host: cliOptions.host };
    if (cliOptions.dataDir) mapped.dataDir = cliOptions.dataDir;

    // HTTPS configuration
    if (cliOptions.https) {
      mapped.web = {
        ...mapped.web,
        https: true,
        cert: cliOptions.cert,
        key: cliOptions.key
      };
    }

    // AI configuration
    if (cliOptions.noAi) {
      mapped.ai = { provider: 'none' };
    }

    // Logging
    if (cliOptions.verbose) {
      mapped.logging = { level: 'debug' };
    }

    return mapped;
  }

  static mergeConfig(base, override) {
    const result = { ...base };

    for (const [key, value] of Object.entries(override)) {
      if (value !== null && value !== undefined) {
        if (typeof value === 'object' && !Array.isArray(value) && typeof base[key] === 'object') {
          result[key] = this.mergeConfig(base[key] || {}, value);
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  }

  static validateConfig(config) {
    // Required fields
    if (!config.server) {
      throw new Error('Server configuration is required');
    }

    // Authentication validation
    if (config.authentication.type === 'sql') {
      if (!config.authentication.username) {
        throw new Error('Username is required for SQL Server authentication');
      }
      if (!config.authentication.password) {
        throw new Error('Password is required for SQL Server authentication');
      }
    }

    // AI validation
    if (config.ai.provider === 'openai' && !config.ai.openai.apiKey) {
      throw new Error('OpenAI API key is required when using OpenAI provider');
    }

    // Numeric validations
    if (config.queries.timeout < 1000) {
      throw new Error('Query timeout must be at least 1000ms');
    }

    if (config.queries.maxRetries < 0) {
      throw new Error('Max retries cannot be negative');
    }

    return true;
  }

  static validateWebConfig(config) {
    // Web server validation
    if (config.web.port < 1 || config.web.port > 65535) {
      throw new Error('Port must be between 1 and 65535');
    }

    // HTTPS validation
    if (config.web.https) {
      if (!config.web.cert) {
        throw new Error('SSL certificate file is required for HTTPS');
      }
      if (!config.web.key) {
        throw new Error('SSL private key file is required for HTTPS');
      }
    }

    // AI validation
    if (config.ai.provider === 'openai' && !config.ai.openai.apiKey) {
      throw new Error('OpenAI API key is required when using OpenAI provider');
    }

    // Numeric validations
    if (config.queries.timeout < 1000) {
      throw new Error('Query timeout must be at least 1000ms');
    }

    if (config.queries.maxRetries < 0) {
      throw new Error('Max retries cannot be negative');
    }

    return true;
  }

  static async save(config, filePath) {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeJson(filePath, config, { spaces: 2 });
  }
}

module.exports = ConfigManager;

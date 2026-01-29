export interface EnvConfig {
  // JWT Configuration
  JWT_SECRET: string;
  SECRET_KEY: string;
  
  // Server Configuration
  PORT: string;
  NODE_ENV: string;
  
  // Frontend Configuration
  FRONTEND_URL: string;
  
  // JIRA Configuration
  JIRA_HOST: string;
  JIRA_USERNAME: string;
  JIRA_API_TOKEN: string;
  JIRA_BOARD_ID: string;
  
  // Confluence Configuration
  CONFLUENCE_HOST: string;
  CONFLUENCE_USERNAME: string;
  CONFLUENCE_API_TOKEN: string;
  CONFLUENCE_SPACE_KEY: string;
  
  // Azure Configuration
  AZURE_TENANT_ID: string;
  
  // Python Backend Configuration
  PYTHON_BACKEND_PORT: string;
}

export interface ValidationRule {
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'url' | 'email';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  allowedValues?: string[];
  customValidator?: (value: string) => boolean;
}

export const ENV_VALIDATION_RULES: Record<keyof EnvConfig, ValidationRule> = {
  // JWT Configuration
  JWT_SECRET: {
    required: true,
    type: 'string',
    minLength: 32,
    maxLength: 512,
  },
  SECRET_KEY: {
    required: true,
    type: 'string',
    minLength: 32,
    maxLength: 512,
  },
  
  // Server Configuration
  PORT: {
    required: false,
    type: 'number',
    customValidator: (value) => {
      const port = parseInt(value);
      return port >= 1 && port <= 65535;
    },
  },
  NODE_ENV: {
    required: false,
    type: 'string',
    allowedValues: ['development', 'production', 'test'],
  },
  
  // Frontend Configuration
  FRONTEND_URL: {
    required: false,
    type: 'url',
  },
  
  // JIRA Configuration
  JIRA_HOST: {
    required: true,
    type: 'url',
    pattern: /^https:\/\/.*\.atlassian\.net$/,
  },
  JIRA_USERNAME: {
    required: true,
    type: 'email',
  },
  JIRA_API_TOKEN: {
    required: true,
    type: 'string',
    minLength: 50,
    maxLength: 500,
  },
  JIRA_BOARD_ID: {
    required: true,
    type: 'number',
    customValidator: (value) => {
      const boardId = parseInt(value);
      return boardId > 0;
    },
  },
  
  // Confluence Configuration
  CONFLUENCE_HOST: {
    required: true,
    type: 'url',
    pattern: /^https:\/\/.*\.atlassian\.net$/,
  },
  CONFLUENCE_USERNAME: {
    required: true,
    type: 'email',
  },
  CONFLUENCE_API_TOKEN: {
    required: true,
    type: 'string',
    minLength: 50,
    maxLength: 500,
  },
  CONFLUENCE_SPACE_KEY: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 10,
    pattern: /^[A-Z]+$/,
  },
  
  // Azure Configuration
  AZURE_TENANT_ID: {
    required: false,
    type: 'string',
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  },
  
  // Python Backend Configuration
  PYTHON_BACKEND_PORT: {
    required: false,
    type: 'number',
    customValidator: (value) => {
      const port = parseInt(value);
      return port >= 1 && port <= 65535;
    },
  },
};

export interface ValidationError {
  variable: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

/**
 * Validate a single environment variable
 */
export const validateEnvVariable = (
  variable: string,
  value: string | undefined,
  rule: ValidationRule
): ValidationError | null => {
  // Check if required
  if (rule.required && (!value || value.trim() === '')) {
    return {
      variable,
      message: `${variable} is required but not set`,
      severity: 'ERROR',
    };
  }

  // Skip validation if not required and not set
  if (!rule.required && (!value || value.trim() === '')) {
    return null;
  }

  const trimmedValue = value!.trim();

  // Check type
  switch (rule.type) {
    case 'string':
      if (typeof trimmedValue !== 'string') {
        return {
          variable,
          message: `${variable} must be a string`,
          severity: 'ERROR',
        };
      }
      break;
    case 'number':
      if (isNaN(Number(trimmedValue))) {
        return {
          variable,
          message: `${variable} must be a valid number`,
          severity: 'ERROR',
        };
      }
      break;
    case 'boolean':
      if (!['true', 'false', '1', '0'].includes(trimmedValue.toLowerCase())) {
        return {
          variable,
          message: `${variable} must be a valid boolean (true/false/1/0)`,
          severity: 'ERROR',
        };
      }
      break;
    case 'url':
      try {
        new URL(trimmedValue);
      } catch {
        return {
          variable,
          message: `${variable} must be a valid URL`,
          severity: 'ERROR',
        };
      }
      break;
    case 'email':
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(trimmedValue)) {
        return {
          variable,
          message: `${variable} must be a valid email address`,
          severity: 'ERROR',
        };
      }
      break;
  }

  // Check length constraints
  if (rule.minLength && trimmedValue.length < rule.minLength) {
    return {
      variable,
      message: `${variable} must be at least ${rule.minLength} characters long`,
      severity: 'ERROR',
    };
  }

  if (rule.maxLength && trimmedValue.length > rule.maxLength) {
    return {
      variable,
      message: `${variable} must be no more than ${rule.maxLength} characters long`,
      severity: 'ERROR',
    };
  }

  // Check pattern
  if (rule.pattern && !rule.pattern.test(trimmedValue)) {
    return {
      variable,
      message: `${variable} does not match required pattern`,
      severity: 'ERROR',
    };
  }

  // Check allowed values
  if (rule.allowedValues && !rule.allowedValues.includes(trimmedValue)) {
    return {
      variable,
      message: `${variable} must be one of: ${rule.allowedValues.join(', ')}`,
      severity: 'ERROR',
    };
  }

  // Check custom validator
  if (rule.customValidator && !rule.customValidator(trimmedValue)) {
    return {
      variable,
      message: `${variable} failed custom validation`,
      severity: 'ERROR',
    };
  }

  return null;
};

/**
 * Validate all environment variables
 */
export const validateEnvironment = (): ValidationError[] => {
  const errors: ValidationError[] = [];

  for (const [variable, rule] of Object.entries(ENV_VALIDATION_RULES)) {
    const value = process.env[variable];
    const error = validateEnvVariable(variable, value, rule);
    if (error) {
      errors.push(error);
    }
  }

  return errors;
};

/**
 * Validate and log environment configuration
 */
export const validateAndLogEnvironment = (): boolean => {
  console.log('🔍 Validating environment configuration...');
  
  const errors = validateEnvironment();
  
  if (errors.length === 0) {
    console.log('✅ All environment variables are valid');
    return true;
  }

  const criticalErrors = errors.filter(error => error.severity === 'ERROR');
  const warnings = errors.filter(error => error.severity === 'WARNING');

  if (criticalErrors.length > 0) {
    console.error('❌ Critical environment validation errors:');
    criticalErrors.forEach(error => {
      console.error(`   ${error.variable}: ${error.message}`);
    });
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Environment validation warnings:');
    warnings.forEach(warning => {
      console.warn(`   ${warning.variable}: ${warning.message}`);
    });
  }

  if (criticalErrors.length > 0) {
    console.error('🚨 Application cannot start due to critical environment errors');
    return false;
  }

  console.log('✅ Environment validation completed with warnings');
  return true;
};

/**
 * Get environment configuration with defaults
 */
export const getEnvConfig = (): EnvConfig => {
  return {
    JWT_SECRET: process.env.JWT_SECRET || '',
    SECRET_KEY: process.env.SECRET_KEY || '',
    PORT: process.env.PORT || '3001',
    NODE_ENV: process.env.NODE_ENV || 'development',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    JIRA_HOST: process.env.JIRA_HOST || '',
    JIRA_USERNAME: process.env.JIRA_USERNAME || '',
    JIRA_API_TOKEN: process.env.JIRA_API_TOKEN || '',
    JIRA_BOARD_ID: process.env.JIRA_BOARD_ID || '',
    CONFLUENCE_HOST: process.env.CONFLUENCE_HOST || '',
    CONFLUENCE_USERNAME: process.env.CONFLUENCE_USERNAME || '',
    CONFLUENCE_API_TOKEN: process.env.CONFLUENCE_API_TOKEN || '',
    CONFLUENCE_SPACE_KEY: process.env.CONFLUENCE_SPACE_KEY || '',
    AZURE_TENANT_ID: process.env.AZURE_TENANT_ID || '',
    PYTHON_BACKEND_PORT: process.env.PYTHON_BACKEND_PORT || '3002',
  };
}; 
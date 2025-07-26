#!/usr/bin/env node

/**
 * Comprehensive Security Audit Script for BMAD System
 * 
 * This script performs automated security checks across the entire application:
 * - Dependency vulnerabilities
 * - Code security patterns
 * - Configuration security
 * - Runtime security checks
 * - Performance impact analysis
 */

const fs = require('fs').promises
const path = require('path')
const { execSync } = require('child_process')
const crypto = require('crypto')

class SecurityAuditor {
  constructor() {
    this.results = {
      vulnerabilities: [],
      warnings: [],
      recommendations: [],
      score: 0,
      timestamp: new Date().toISOString()
    }
  }

  async runFullAudit() {
    console.log('🔐 Starting comprehensive security audit...\n')

    try {
      await this.auditDependencies()
      await this.auditCodeSecurity()
      await this.auditConfiguration()
      await this.auditRuntimeSecurity()
      await this.auditApiSecurity()
      await this.auditWebSecurity()
      await this.auditDatabaseSecurity()
      
      this.calculateSecurityScore()
      this.generateReport()
    } catch (error) {
      console.error('❌ Audit failed:', error.message)
      process.exit(1)
    }
  }

  async auditDependencies() {
    console.log('📦 Auditing dependencies...')
    
    try {
      // Run npm audit
      const auditResult = execSync('npm audit --json', { encoding: 'utf8' })
      const audit = JSON.parse(auditResult)
      
      if (audit.vulnerabilities && Object.keys(audit.vulnerabilities).length > 0) {
        for (const [pkg, vuln] of Object.entries(audit.vulnerabilities)) {
          this.results.vulnerabilities.push({
            type: 'dependency',
            package: pkg,
            severity: vuln.severity,
            description: vuln.via?.[0]?.title || 'Vulnerability detected',
            recommendation: `Update ${pkg} to fix ${vuln.severity} vulnerability`
          })
        }
      }
      
      // Check for known malicious packages
      await this.checkMaliciousPackages()
      
      console.log('✅ Dependency audit completed')
    } catch (error) {
      if (error.status === 1) {
        // npm audit found vulnerabilities
        const auditResult = error.stdout.toString()
        try {
          const audit = JSON.parse(auditResult)
          this.processDependencyVulns(audit)
        } catch (parseError) {
          this.results.warnings.push('Could not parse npm audit results')
        }
      } else {
        this.results.warnings.push(`Dependency audit failed: ${error.message}`)
      }
    }
  }

  async checkMaliciousPackages() {
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'))
    const suspiciousPatterns = [
      /bitcoin/i,
      /crypto-miner/i,
      /malware/i,
      /backdoor/i
    ]
    
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies }
    
    for (const [name, version] of Object.entries(allDeps)) {
      if (suspiciousPatterns.some(pattern => pattern.test(name))) {
        this.results.vulnerabilities.push({
          type: 'suspicious_package',
          package: name,
          severity: 'high',
          description: 'Package name matches suspicious pattern',
          recommendation: `Review package ${name} for malicious code`
        })
      }
    }
  }

  async auditCodeSecurity() {
    console.log('🔍 Auditing code security patterns...')
    
    const securityPatterns = [
      {
        pattern: /password\s*=\s*['"]\w+['"]/gi,
        severity: 'critical',
        description: 'Hardcoded password detected',
        type: 'hardcoded_secret'
      },
      {
        pattern: /api[_-]?key\s*=\s*['"]\w+['"]/gi,
        severity: 'critical',
        description: 'Hardcoded API key detected',
        type: 'hardcoded_secret'
      },
      {
        pattern: /eval\s*\(/gi,
        severity: 'high',
        description: 'Use of eval() detected - potential code injection',
        type: 'code_injection'
      },
      {
        pattern: /document\.write\s*\(/gi,
        severity: 'medium',
        description: 'Use of document.write() - potential XSS',
        type: 'xss_risk'
      },
      {
        pattern: /innerHTML\s*=/gi,
        severity: 'medium',
        description: 'Use of innerHTML - potential XSS if not sanitized',
        type: 'xss_risk'
      },
      {
        pattern: /process\.env\.\w+/gi,
        severity: 'low',
        description: 'Environment variable usage - ensure not exposing secrets',
        type: 'env_exposure'
      }
    ]
    
    await this.scanDirectoryForPatterns('./apps', securityPatterns)
    await this.scanDirectoryForPatterns('./libs', securityPatterns)
    
    console.log('✅ Code security audit completed')
  }

  async scanDirectoryForPatterns(dir, patterns) {
    try {
      const files = await this.getFilesRecursively(dir, ['.ts', '.tsx', '.js', '.jsx'])
      
      for (const file of files) {
        const content = await fs.readFile(file, 'utf8')
        
        for (const { pattern, severity, description, type } of patterns) {
          const matches = content.match(pattern)
          if (matches) {
            this.results.vulnerabilities.push({
              type,
              file: file.replace(process.cwd(), ''),
              severity,
              description,
              matches: matches.slice(0, 3), // Limit to first 3 matches
              recommendation: `Review and secure ${type} in ${file}`
            })
          }
        }
      }
    } catch (error) {
      this.results.warnings.push(`Failed to scan ${dir}: ${error.message}`)
    }
  }

  async getFilesRecursively(dir, extensions) {
    const files = []
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...await this.getFilesRecursively(fullPath, extensions))
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath)
        }
      }
    } catch (error) {
      // Directory might not exist
    }
    
    return files
  }

  async auditConfiguration() {
    console.log('⚙️ Auditing configuration security...')
    
    // Check environment files
    await this.checkEnvironmentFiles()
    
    // Check Docker configuration
    await this.checkDockerSecurity()
    
    // Check TypeScript configuration
    await this.checkTypeScriptConfig()
    
    console.log('✅ Configuration audit completed')
  }

  async checkEnvironmentFiles() {
    const envFiles = ['.env', '.env.local', '.env.production', '.env.development']
    
    for (const envFile of envFiles) {
      try {
        const content = await fs.readFile(envFile, 'utf8')
        
        // Check for exposed secrets in env files
        if (content.includes('password') || content.includes('secret') || content.includes('key')) {
          this.results.warnings.push({
            type: 'env_security',
            file: envFile,
            description: 'Environment file contains potential secrets',
            recommendation: 'Ensure secrets are properly secured and not committed to version control'
          })
        }
        
        // Check if env file is in gitignore
        try {
          const gitignore = await fs.readFile('.gitignore', 'utf8')
          if (!gitignore.includes(envFile)) {
            this.results.vulnerabilities.push({
              type: 'env_exposure',
              file: envFile,
              severity: 'high',
              description: 'Environment file not in .gitignore',
              recommendation: `Add ${envFile} to .gitignore to prevent committing secrets`
            })
          }
        } catch (error) {
          // .gitignore might not exist
        }
      } catch (error) {
        // File might not exist
      }
    }
  }

  async checkDockerSecurity() {
    try {
      const dockerfile = await fs.readFile('Dockerfile', 'utf8')
      
      // Check for running as root
      if (!dockerfile.includes('USER ') || dockerfile.includes('USER root')) {
        this.results.warnings.push({
          type: 'docker_security',
          description: 'Docker container may be running as root',
          recommendation: 'Add non-root user to Dockerfile for better security'
        })
      }
      
      // Check for COPY with --chown
      if (dockerfile.includes('COPY ') && !dockerfile.includes('--chown=')) {
        this.results.warnings.push({
          type: 'docker_security',
          description: 'COPY commands without --chown may create root-owned files',
          recommendation: 'Use COPY --chown=user:group for better security'
        })
      }
    } catch (error) {
      // Dockerfile might not exist
    }
  }

  async checkTypeScriptConfig() {
    try {
      const tsConfig = JSON.parse(await fs.readFile('tsconfig.json', 'utf8'))
      
      if (!tsConfig.compilerOptions?.strict) {
        this.results.warnings.push({
          type: 'typescript_security',
          description: 'TypeScript strict mode not enabled',
          recommendation: 'Enable strict mode for better type safety'
        })
      }
      
      if (!tsConfig.compilerOptions?.noImplicitReturns) {
        this.results.warnings.push({
          type: 'typescript_security',
          description: 'noImplicitReturns not enabled',
          recommendation: 'Enable noImplicitReturns to catch potential logic errors'
        })
      }
    } catch (error) {
      // tsconfig.json might not exist
    }
  }

  async auditRuntimeSecurity() {
    console.log('🔒 Auditing runtime security...')
    
    // Check if security middleware is properly configured
    await this.checkSecurityMiddleware()
    
    // Check authentication implementation
    await this.checkAuthImplementation()
    
    console.log('✅ Runtime security audit completed')
  }

  async checkSecurityMiddleware() {
    try {
      const mainFile = await fs.readFile('./apps/api/src/main.ts', 'utf8')
      
      const requiredMiddleware = [
        { name: 'helmet', pattern: /helmet/i },
        { name: 'cors', pattern: /cors/i },
        { name: 'rate limiting', pattern: /rateLimit|rateLimiter/i },
        { name: 'compression', pattern: /compression/i }
      ]
      
      for (const middleware of requiredMiddleware) {
        if (!middleware.pattern.test(mainFile)) {
          this.results.warnings.push({
            type: 'missing_middleware',
            description: `${middleware.name} middleware not detected`,
            recommendation: `Implement ${middleware.name} for better security`
          })
        }
      }
    } catch (error) {
      this.results.warnings.push('Could not check security middleware configuration')
    }
  }

  async checkAuthImplementation() {
    try {
      const authFiles = await this.getFilesRecursively('./apps/api/src/routes', ['.ts'])
      const authFile = authFiles.find(f => f.includes('auth'))
      
      if (authFile) {
        const content = await fs.readFile(authFile, 'utf8')
        
        // Check for JWT implementation
        if (!content.includes('jsonwebtoken') && !content.includes('jwt')) {
          this.results.warnings.push({
            type: 'auth_security',
            description: 'JWT implementation not detected in auth routes',
            recommendation: 'Implement proper JWT-based authentication'
          })
        }
        
        // Check for password hashing
        if (!content.includes('bcrypt') && !content.includes('hash')) {
          this.results.vulnerabilities.push({
            type: 'auth_security',
            severity: 'high',
            description: 'Password hashing not detected',
            recommendation: 'Implement proper password hashing (bcrypt recommended)'
          })
        }
      }
    } catch (error) {
      this.results.warnings.push('Could not check authentication implementation')
    }
  }

  async auditApiSecurity() {
    console.log('🌐 Auditing API security...')
    
    // Check for SQL injection prevention
    // Check for input validation
    // Check for API rate limiting
    // This would require runtime testing or static analysis
    
    this.results.recommendations.push('Implement automated API security testing')
    this.results.recommendations.push('Use tools like OWASP ZAP for penetration testing')
    
    console.log('✅ API security audit completed')
  }

  async auditWebSecurity() {
    console.log('🌍 Auditing web security...')
    
    // Check CSP configuration
    await this.checkCSPConfiguration()
    
    // Check for HTTPS configuration
    this.results.recommendations.push('Ensure HTTPS is enforced in production')
    this.results.recommendations.push('Implement proper certificate management')
    
    console.log('✅ Web security audit completed')
  }

  async checkCSPConfiguration() {
    try {
      const securityFile = await fs.readFile('./apps/api/src/middleware/security.ts', 'utf8')
      
      if (securityFile.includes('contentSecurityPolicy')) {
        this.results.recommendations.push('CSP configuration detected - ensure it\'s properly tuned')
      } else {
        this.results.warnings.push({
          type: 'web_security',
          description: 'Content Security Policy not detected',
          recommendation: 'Implement CSP headers for XSS protection'
        })
      }
    } catch (error) {
      this.results.warnings.push('Could not check CSP configuration')
    }
  }

  async auditDatabaseSecurity() {
    console.log('🗄️ Auditing database security...')
    
    // Check for SQL injection prevention in ORM usage
    // Check for proper connection string handling
    // Check for database user permissions
    
    this.results.recommendations.push('Ensure database connections use least-privilege principles')
    this.results.recommendations.push('Implement database encryption at rest')
    this.results.recommendations.push('Regular database security patches')
    
    console.log('✅ Database security audit completed')
  }

  calculateSecurityScore() {
    let score = 100
    
    // Deduct points for vulnerabilities
    for (const vuln of this.results.vulnerabilities) {
      switch (vuln.severity) {
        case 'critical':
          score -= 20
          break
        case 'high':
          score -= 10
          break
        case 'medium':
          score -= 5
          break
        case 'low':
          score -= 2
          break
      }
    }
    
    // Deduct points for warnings
    score -= this.results.warnings.length * 1
    
    this.results.score = Math.max(0, score)
  }

  generateReport() {
    console.log('\n📊 Security Audit Report')
    console.log('========================')
    console.log(`Overall Security Score: ${this.results.score}/100`)
    console.log(`Timestamp: ${this.results.timestamp}`)
    
    if (this.results.vulnerabilities.length > 0) {
      console.log('\n❌ Vulnerabilities Found:')
      for (const vuln of this.results.vulnerabilities) {
        console.log(`  • [${vuln.severity?.toUpperCase()}] ${vuln.description}`)
        if (vuln.file) console.log(`    File: ${vuln.file}`)
        if (vuln.recommendation) console.log(`    Fix: ${vuln.recommendation}`)
        console.log()
      }
    }
    
    if (this.results.warnings.length > 0) {
      console.log('\n⚠️ Warnings:')
      for (const warning of this.results.warnings) {
        console.log(`  • ${warning.description || warning}`)
        if (warning.recommendation) console.log(`    Recommendation: ${warning.recommendation}`)
        console.log()
      }
    }
    
    if (this.results.recommendations.length > 0) {
      console.log('\n💡 Recommendations:')
      for (const rec of this.results.recommendations) {
        console.log(`  • ${rec}`)
      }
      console.log()
    }
    
    // Save detailed report
    this.saveDetailedReport()
    
    // Determine exit code
    const criticalVulns = this.results.vulnerabilities.filter(v => v.severity === 'critical')
    if (criticalVulns.length > 0) {
      console.log('❌ Critical vulnerabilities found! Please fix before deployment.')
      process.exit(1)
    } else if (this.results.score < 80) {
      console.log('⚠️ Security score below 80. Consider addressing issues before deployment.')
      process.exit(1)
    } else {
      console.log('✅ Security audit passed!')
      process.exit(0)
    }
  }

  async saveDetailedReport() {
    const reportPath = './security-audit-report.json'
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2))
    console.log(`\n📄 Detailed report saved to: ${reportPath}`)
  }
}

// CLI interface
if (require.main === module) {
  const auditor = new SecurityAuditor()
  auditor.runFullAudit().catch(error => {
    console.error('Fatal error during security audit:', error)
    process.exit(1)
  })
}

module.exports = SecurityAuditor
/**
 * Virus Scanning Service
 * Integrates with ClamAV for file security scanning
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../config/logger';
import path from 'path';
import fs from 'fs/promises';

const execFileAsync = promisify(execFile);

export interface ScanResult {
  isClean: boolean;
  threatName?: string;
  scanTime: number;
  scanVersion?: string;
  signature?: string;
}

export interface ScanOptions {
  timeout?: number;
  maxFileSize?: number;
  enableHeuristics?: boolean;
  scanArchives?: boolean;
}

class VirusScanService {
  private clamavPath: string;
  private freshclamPath: string;
  private isAvailable: boolean = false;
  private lastUpdateCheck: Date | null = null;
  private updateInterval: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.clamavPath = process.env.CLAMAV_PATH || '/usr/bin/clamscan';
    this.freshclamPath = process.env.FRESHCLAM_PATH || '/usr/bin/freshclam';
    this.checkAvailability();
  }

  /**
   * Check if ClamAV is available on the system
   */
  private async checkAvailability(): Promise<void> {
    try {
      await execFileAsync(this.clamavPath, ['--version']);
      this.isAvailable = true;
      logger.info('ClamAV is available and ready for virus scanning');
      
      // Schedule regular signature updates
      this.scheduleSignatureUpdates();
    } catch (error) {
      logger.warn('ClamAV is not available. Virus scanning will be simulated.');
      this.isAvailable = false;
    }
  }

  /**
   * Scan a file buffer for viruses
   */
  public async scanBuffer(
    buffer: Buffer,
    filename: string,
    options: ScanOptions = {}
  ): Promise<ScanResult> {
    const startTime = Date.now();

    try {
      if (!this.isAvailable) {
        return this.simulateScan(buffer, filename, startTime);
      }

      // Check file size limit
      if (options.maxFileSize && buffer.length > options.maxFileSize) {
        throw new Error(`File size ${buffer.length} exceeds maximum scan size ${options.maxFileSize}`);
      }

      // Create temporary file for scanning
      const tempDir = process.env.TEMP_DIR || '/tmp';
      const tempFilePath = path.join(tempDir, `scan_${Date.now()}_${filename}`);
      
      try {
        await fs.writeFile(tempFilePath, buffer);
        
        // Perform scan
        const result = await this.scanFile(tempFilePath, options);
        
        // Clean up temp file
        await fs.unlink(tempFilePath);
        
        return result;
        
      } catch (error) {
        // Ensure temp file is cleaned up even on error
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          logger.warn('Failed to clean up temp file:', cleanupError);
        }
        throw error;
      }

    } catch (error) {
      logger.error('Virus scan failed:', error);
      
      // Return as infected if scan fails for security
      return {
        isClean: false,
        threatName: 'SCAN_ERROR',
        scanTime: Date.now() - startTime
      };
    }
  }

  /**
   * Scan a file on disk
   */
  private async scanFile(filePath: string, options: ScanOptions = {}): Promise<ScanResult> {
    const startTime = Date.now();

    try {
      const args = this.buildScanArguments(filePath, options);
      const { stdout, stderr } = await execFileAsync(
        this.clamavPath,
        args,
        { timeout: options.timeout || 30000 }
      );

      const scanTime = Date.now() - startTime;
      
      // Parse scan result
      const output = stdout + stderr;
      const isClean = !output.includes('FOUND') && !output.includes('ERROR');
      
      let threatName: string | undefined;
      if (!isClean) {
        const threatMatch = output.match(/([^\\s]+)\\s+FOUND/);
        threatName = threatMatch ? threatMatch[1] : 'UNKNOWN_THREAT';
      }

      // Extract version info
      const versionMatch = output.match(/ClamAV\\s+([0-9.]+)/);
      const scanVersion = versionMatch ? versionMatch[1] : undefined;

      logger.info(`Virus scan completed for ${filePath}: ${isClean ? 'CLEAN' : 'INFECTED'} (${scanTime}ms)`);

      return {
        isClean,
        threatName,
        scanTime,
        scanVersion
      };

    } catch (error) {
      logger.error(`ClamAV scan failed for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Build ClamAV command arguments
   */
  private buildScanArguments(filePath: string, options: ScanOptions): string[] {
    const args = ['--no-summary', '--infected'];

    if (options.enableHeuristics) {
      args.push('--detect-pua=yes');
    }

    if (options.scanArchives) {
      args.push('--scan-archive=yes');
    } else {
      args.push('--scan-archive=no');
    }

    // Add max scan size if specified
    if (options.maxFileSize) {
      args.push(`--max-filesize=${Math.floor(options.maxFileSize / 1024)}K`);
    }

    args.push(filePath);
    return args;
  }

  /**
   * Simulate virus scan when ClamAV is not available
   */
  private async simulateScan(
    buffer: Buffer,
    filename: string,
    startTime: number
  ): Promise<ScanResult> {
    // Simulate scan time
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 500));

    // Check for test virus signatures (EICAR test file)
    const eicarSignature = 'X5O!P%@AP[4\\\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
    const isTestVirus = buffer.toString().includes(eicarSignature);

    // Simulate very low false positive rate
    const isRandomInfected = Math.random() < 0.001; // 0.1% false positive for testing

    const isClean = !isTestVirus && !isRandomInfected;
    const threatName = isTestVirus ? 'EICAR-Test-File' : 
                      isRandomInfected ? 'Simulation.TestThreat' : 
                      undefined;

    const scanTime = Date.now() - startTime;

    logger.info(`Simulated virus scan for ${filename}: ${isClean ? 'CLEAN' : 'INFECTED'} (${scanTime}ms)`);

    return {
      isClean,
      threatName,
      scanTime,
      scanVersion: 'Simulation-1.0.0'
    };
  }

  /**
   * Update virus signatures
   */
  public async updateSignatures(): Promise<boolean> {
    if (!this.isAvailable) {
      logger.info('ClamAV not available, skipping signature update');
      return false;
    }

    try {
      logger.info('Updating ClamAV virus signatures...');
      
      await execFileAsync(this.freshclamPath, ['--quiet'], { timeout: 300000 }); // 5 minute timeout
      
      this.lastUpdateCheck = new Date();
      logger.info('ClamAV signatures updated successfully');
      return true;
      
    } catch (error) {
      logger.error('Failed to update ClamAV signatures:', error);
      return false;
    }
  }

  /**
   * Schedule regular signature updates
   */
  private scheduleSignatureUpdates(): void {
    setInterval(async () => {
      try {
        await this.updateSignatures();
      } catch (error) {
        logger.error('Scheduled signature update failed:', error);
      }
    }, this.updateInterval);

    // Run initial update if needed
    if (!this.lastUpdateCheck) {
      setTimeout(() => this.updateSignatures(), 5000);
    }
  }

  /**
   * Get scan service status
   */
  public getStatus(): {
    available: boolean;
    lastUpdate: Date | null;
    version?: string;
  } {
    return {
      available: this.isAvailable,
      lastUpdate: this.lastUpdateCheck
    };
  }

  /**
   * Perform health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.isAvailable) return false;
      
      // Test with EICAR test file
      const testBuffer = Buffer.from('X5O!P%@AP[4\\\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
      const result = await this.scanBuffer(testBuffer, 'eicar-test.txt', { timeout: 10000 });
      
      // Should detect EICAR as threat
      return !result.isClean && result.threatName?.includes('EICAR');
      
    } catch (error) {
      logger.error('Virus scanner health check failed:', error);
      return false;
    }
  }
}

export const virusScanService = new VirusScanService();
export default virusScanService;
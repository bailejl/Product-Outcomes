import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

export interface CDNConfig {
  enabled: boolean;
  baseUrl: string;
  regions: string[];
  defaultTtl: number;
  compressionEnabled: boolean;
  webpEnabled: boolean;
  avifEnabled: boolean;
  brotliEnabled: boolean;
  minifyEnabled: boolean;
}

export interface AssetConfig {
  path: string;
  type: 'image' | 'script' | 'style' | 'font' | 'document';
  compression: boolean;
  minification: boolean;
  ttl: number;
  variants: AssetVariant[];
  headers: Record<string, string>;
}

export interface AssetVariant {
  format: string;
  quality?: number;
  width?: number;
  height?: number;
  suffix: string;
}

export interface OptimizationResult {
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  format: string;
  url: string;
  cacheKey: string;
}

@Injectable()
export class CDNOptimizationService {
  private readonly logger = new Logger(CDNOptimizationService.name);
  private assetManifest: Map<string, AssetConfig> = new Map();
  private optimizationCache: Map<string, OptimizationResult> = new Map();

  constructor(private config: CDNConfig) {
    this.initializeAssetConfigs();
  }

  async optimizeAsset(
    assetPath: string,
    options: {
      format?: string;
      quality?: number;
      width?: number;
      height?: number;
      compression?: boolean;
      minification?: boolean;
    } = {}
  ): Promise<OptimizationResult> {
    const cacheKey = this.generateCacheKey(assetPath, options);
    
    // Check cache first
    if (this.optimizationCache.has(cacheKey)) {
      return this.optimizationCache.get(cacheKey)!;
    }

    const assetConfig = this.getAssetConfig(assetPath);
    const optimizedAsset = await this.processAsset(assetPath, assetConfig, options);
    
    // Cache result
    this.optimizationCache.set(cacheKey, optimizedAsset);
    
    this.logger.debug(
      `Optimized asset ${assetPath}: ${optimizedAsset.compressionRatio.toFixed(2)}% reduction`
    );
    
    return optimizedAsset;
  }

  async optimizeImageSrcSet(
    imagePath: string,
    breakpoints: number[] = [480, 768, 1024, 1280, 1920]
  ): Promise<{
    srcSet: string;
    sizes: string;
    fallback: string;
  }> {
    const imageConfig = this.getAssetConfig(imagePath);
    const srcSetEntries: string[] = [];
    
    // Generate responsive images
    for (const width of breakpoints) {
      const optimized = await this.optimizeAsset(imagePath, {
        width,
        format: 'webp',
        quality: 80
      });
      
      srcSetEntries.push(`${optimized.url} ${width}w`);
    }
    
    // Generate fallback image
    const fallback = await this.optimizeAsset(imagePath, {
      format: 'jpg',
      quality: 85
    });
    
    return {
      srcSet: srcSetEntries.join(', '),
      sizes: this.generateSizesAttribute(breakpoints),
      fallback: fallback.url
    };
  }

  async optimizeCriticalCSS(
    cssPath: string,
    criticalSelectors: string[]
  ): Promise<{
    critical: string;
    remaining: string;
    inlined: string;
  }> {
    try {
      // Read CSS file content
      const cssContent = await this.readAssetContent(cssPath);
      
      // Extract critical CSS
      const criticalCSS = this.extractCriticalCSS(cssContent, criticalSelectors);
      const remainingCSS = this.extractNonCriticalCSS(cssContent, criticalSelectors);
      
      // Minify critical CSS
      const minifiedCritical = this.minifyCSS(criticalCSS);
      
      // Generate inlined version
      const inlinedCSS = `<style>${minifiedCritical}</style>`;
      
      // Optimize remaining CSS and upload to CDN
      const optimizedRemaining = await this.optimizeAsset(cssPath, {
        minification: true
      });
      
      return {
        critical: minifiedCritical,
        remaining: optimizedRemaining.url,
        inlined: inlinedCSS
      };
    } catch (error) {
      this.logger.error(`Error optimizing critical CSS for ${cssPath}:`, error);
      throw error;
    }
  }

  async preloadAssets(assetPaths: string[]): Promise<string[]> {
    const preloadLinks: string[] = [];
    
    for (const assetPath of assetPaths) {
      const assetConfig = this.getAssetConfig(assetPath);
      const optimized = await this.optimizeAsset(assetPath);
      
      const rel = this.getPreloadRel(assetConfig.type);
      const crossorigin = this.shouldUseCrossorigin(optimized.url) ? ' crossorigin' : '';
      const as = this.getAsAttribute(assetConfig.type);
      
      preloadLinks.push(
        `<link rel="${rel}" href="${optimized.url}" as="${as}"${crossorigin}>`
      );
    }
    
    return preloadLinks;
  }

  async generateServiceWorkerPrecache(): Promise<{
    precacheManifest: Array<{ url: string; revision: string }>;
    runtimeCaching: Array<{ urlPattern: string; handler: string; options: any }>;
  }> {
    const precacheManifest: Array<{ url: string; revision: string }> = [];
    const runtimeCaching: Array<{ urlPattern: string; handler: string; options: any }> = [];
    
    // Generate precache manifest for static assets
    for (const [path, config] of this.assetManifest) {
      if (config.type === 'script' || config.type === 'style') {
        const optimized = await this.optimizeAsset(path);
        precacheManifest.push({
          url: optimized.url,
          revision: optimized.cacheKey
        });
      }
    }
    
    // Generate runtime caching strategies
    runtimeCaching.push(
      {
        urlPattern: `${this.config.baseUrl}/images/.*`,
        handler: 'CacheFirst',
        options: {
          cacheName: 'images',
          expiration: {
            maxEntries: 60,
            maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
          },
          cacheKeyWillBeUsed: async ({ request }: any) => {
            // Use optimized image URL as cache key
            return this.getOptimizedImageUrl(request.url);
          }
        }
      },
      {
        urlPattern: `${this.config.baseUrl}/api/.*`,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 5 * 60 // 5 minutes
          }
        }
      }
    );
    
    return { precacheManifest, runtimeCaching };
  }

  async generateResourceHints(
    criticalAssets: string[],
    preconnectDomains: string[] = []
  ): Promise<string[]> {
    const hints: string[] = [];
    
    // Add preconnect hints for external domains
    const domains = [this.config.baseUrl, ...preconnectDomains];
    for (const domain of domains) {
      hints.push(`<link rel="preconnect" href="${domain}" crossorigin>`);
      hints.push(`<link rel="dns-prefetch" href="${domain}">`);
    }
    
    // Add preload hints for critical assets
    const preloadHints = await this.preloadAssets(criticalAssets);
    hints.push(...preloadHints);
    
    return hints;
  }

  getBestImageFormat(userAgent: string, hasAlphaChannel: boolean = false): string {
    // Check for AVIF support
    if (this.config.avifEnabled && this.supportsAVIF(userAgent)) {
      return 'avif';
    }
    
    // Check for WebP support
    if (this.config.webpEnabled && this.supportsWebP(userAgent)) {
      return 'webp';
    }
    
    // Fallback to JPEG or PNG
    return hasAlphaChannel ? 'png' : 'jpg';
  }

  async generateResponsiveImageHTML(
    imagePath: string,
    alt: string,
    lazyLoad: boolean = true
  ): Promise<string> {
    const { srcSet, sizes, fallback } = await this.optimizeImageSrcSet(imagePath);
    
    const loading = lazyLoad ? ' loading="lazy"' : '';
    const decoding = ' decoding="async"';
    
    return `
      <picture>
        <source srcset="${srcSet}" sizes="${sizes}" type="image/webp">
        <img src="${fallback}" 
             alt="${alt}"
             ${loading}
             ${decoding}>
      </picture>
    `.trim();
  }

  async purgeCache(patterns: string[]): Promise<{
    success: boolean;
    purgedUrls: string[];
    errors: string[];
  }> {
    const purgedUrls: string[] = [];
    const errors: string[] = [];
    
    try {
      for (const pattern of patterns) {
        // Implementation would call CDN API to purge cache
        // This is a placeholder for the actual CDN integration
        
        const matchingAssets = this.findMatchingAssets(pattern);
        for (const asset of matchingAssets) {
          try {
            await this.purgeCDNCache(asset);
            purgedUrls.push(asset);
          } catch (error) {
            errors.push(`Failed to purge ${asset}: ${error.message}`);
          }
        }
      }
      
      this.logger.log(`Purged ${purgedUrls.length} assets from CDN cache`);
      
      return {
        success: errors.length === 0,
        purgedUrls,
        errors
      };
    } catch (error) {
      this.logger.error('Error purging CDN cache:', error);
      return {
        success: false,
        purgedUrls,
        errors: [error.message]
      };
    }
  }

  private initializeAssetConfigs(): void {
    const defaultConfigs: AssetConfig[] = [
      // Images
      {
        path: '/images/*',
        type: 'image',
        compression: true,
        minification: false,
        ttl: 86400 * 30, // 30 days
        variants: [
          { format: 'webp', quality: 80, suffix: '.webp' },
          { format: 'avif', quality: 75, suffix: '.avif' },
          { format: 'jpg', quality: 85, suffix: '.jpg' }
        ],
        headers: {
          'Cache-Control': 'public, max-age=2592000, immutable',
          'Vary': 'Accept'
        }
      },
      
      // JavaScript
      {
        path: '/js/*',
        type: 'script',
        compression: true,
        minification: true,
        ttl: 86400 * 365, // 1 year
        variants: [
          { format: 'js', suffix: '.min.js' }
        ],
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Encoding': 'gzip'
        }
      },
      
      // CSS
      {
        path: '/css/*',
        type: 'style',
        compression: true,
        minification: true,
        ttl: 86400 * 365, // 1 year
        variants: [
          { format: 'css', suffix: '.min.css' }
        ],
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Encoding': 'gzip'
        }
      },
      
      // Fonts
      {
        path: '/fonts/*',
        type: 'font',
        compression: true,
        minification: false,
        ttl: 86400 * 365, // 1 year
        variants: [
          { format: 'woff2', suffix: '.woff2' }
        ],
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*'
        }
      }
    ];
    
    defaultConfigs.forEach(config => {
      this.assetManifest.set(config.path, config);
    });
  }

  private getAssetConfig(assetPath: string): AssetConfig {
    // Find matching config pattern
    for (const [pattern, config] of this.assetManifest) {
      if (this.matchesPattern(assetPath, pattern)) {
        return config;
      }
    }
    
    // Return default config
    return {
      path: assetPath,
      type: 'document',
      compression: false,
      minification: false,
      ttl: 3600,
      variants: [],
      headers: {}
    };
  }

  private matchesPattern(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    return new RegExp(`^${regexPattern}$`).test(path);
  }

  private async processAsset(
    assetPath: string,
    config: AssetConfig,
    options: any
  ): Promise<OptimizationResult> {
    // Simulate asset processing
    const originalSize = 100000; // Would get actual file size
    let optimizedSize = originalSize;
    
    // Apply compression
    if (config.compression || options.compression) {
      optimizedSize *= 0.7; // 30% compression
    }
    
    // Apply minification
    if (config.minification || options.minification) {
      optimizedSize *= 0.8; // 20% minification
    }
    
    // Apply image optimization
    if (config.type === 'image') {
      optimizedSize *= 0.6; // 40% image optimization
    }
    
    const compressionRatio = ((originalSize - optimizedSize) / originalSize) * 100;
    const format = options.format || this.getDefaultFormat(config.type);
    const optimizedUrl = this.buildCDNUrl(assetPath, options);
    const cacheKey = this.generateCacheKey(assetPath, options);
    
    return {
      originalSize,
      optimizedSize,
      compressionRatio,
      format,
      url: optimizedUrl,
      cacheKey
    };
  }

  private buildCDNUrl(assetPath: string, options: any): string {
    const baseUrl = this.config.baseUrl.replace(/\/$/, '');
    const cleanPath = assetPath.replace(/^\//, '');
    
    // Build optimization parameters
    const params: string[] = [];
    
    if (options.width) params.push(`w=${options.width}`);
    if (options.height) params.push(`h=${options.height}`);
    if (options.quality) params.push(`q=${options.quality}`);
    if (options.format) params.push(`f=${options.format}`);
    
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    
    return `${baseUrl}/${cleanPath}${queryString}`;
  }

  private generateCacheKey(assetPath: string, options: any): string {
    const optionsString = JSON.stringify(options);
    return createHash('md5').update(assetPath + optionsString).digest('hex');
  }

  private getDefaultFormat(assetType: string): string {
    switch (assetType) {
      case 'image': return 'webp';
      case 'script': return 'js';
      case 'style': return 'css';
      case 'font': return 'woff2';
      default: return 'original';
    }
  }

  private async readAssetContent(assetPath: string): Promise<string> {
    // Implementation would read actual file content
    return '';
  }

  private extractCriticalCSS(cssContent: string, selectors: string[]): string {
    // Implementation would extract CSS rules matching critical selectors
    return '';
  }

  private extractNonCriticalCSS(cssContent: string, selectors: string[]): string {
    // Implementation would extract remaining CSS rules
    return '';
  }

  private minifyCSS(cssContent: string): string {
    // Implementation would minify CSS
    return cssContent.replace(/\s+/g, ' ').trim();
  }

  private generateSizesAttribute(breakpoints: number[]): string {
    const sizes = breakpoints.map((bp, index) => {
      if (index === breakpoints.length - 1) {
        return `${bp}px`;
      }
      return `(max-width: ${bp}px) ${bp}px`;
    });
    
    return sizes.join(', ');
  }

  private getPreloadRel(assetType: string): string {
    return assetType === 'font' ? 'preload' : 'preload';
  }

  private shouldUseCrossorigin(url: string): boolean {
    return !url.startsWith(window.location.origin);
  }

  private getAsAttribute(assetType: string): string {
    switch (assetType) {
      case 'script': return 'script';
      case 'style': return 'style';
      case 'font': return 'font';
      case 'image': return 'image';
      default: return '';
    }
  }

  private supportsAVIF(userAgent: string): boolean {
    // Simplified AVIF support detection
    return userAgent.includes('Chrome/85') || userAgent.includes('Firefox/93');
  }

  private supportsWebP(userAgent: string): boolean {
    // Simplified WebP support detection
    return userAgent.includes('Chrome') || 
           userAgent.includes('Firefox') || 
           userAgent.includes('Safari/14');
  }

  private getOptimizedImageUrl(originalUrl: string): string {
    // Implementation would return optimized image URL
    return originalUrl;
  }

  private findMatchingAssets(pattern: string): string[] {
    // Implementation would find assets matching the pattern
    return [];
  }

  private async purgeCDNCache(assetUrl: string): Promise<void> {
    // Implementation would call actual CDN API
    this.logger.debug(`Purging CDN cache for: ${assetUrl}`);
  }
}
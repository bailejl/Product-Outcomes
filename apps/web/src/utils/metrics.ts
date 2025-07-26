// Frontend metrics collection for web application
class WebMetrics {
  private apiEndpoint: string;
  private sessionId: string;
  private userId?: string;
  private organizationId?: string;
  private performanceEntries: PerformanceEntry[] = [];
  private customMetrics: Map<string, number> = new Map();

  constructor(apiEndpoint: string = '/api/frontend-metrics') {
    this.apiEndpoint = apiEndpoint;
    this.sessionId = this.generateSessionId();
    this.initializePerformanceObserver();
    this.setupNavigationMetrics();
    this.setupUserInteractionMetrics();
  }

  private generateSessionId(): string {
    return `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializePerformanceObserver() {
    if ('PerformanceObserver' in window) {
      // Observe navigation timing
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordNavigationMetrics(entry as PerformanceNavigationTiming);
        }
      });
      navObserver.observe({ entryTypes: ['navigation'] });

      // Observe resource timing
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordResourceMetrics(entry as PerformanceResourceTiming);
        }
      });
      resourceObserver.observe({ entryTypes: ['resource'] });

      // Observe largest contentful paint
      const lcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordLCPMetric(entry);
        }
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // Observe first input delay
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordFIDMetric(entry);
        }
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
    }
  }

  private setupNavigationMetrics() {
    // Track page navigation
    let currentPath = window.location.pathname;
    
    const trackNavigation = () => {
      const newPath = window.location.pathname;
      if (newPath !== currentPath) {
        this.recordCustomMetric('page_navigation', {
          from: currentPath,
          to: newPath,
          timestamp: Date.now()
        });
        currentPath = newPath;
      }
    };

    // Listen for navigation changes (for SPAs)
    window.addEventListener('popstate', trackNavigation);
    
    // Override pushState and replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      trackNavigation();
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      trackNavigation();
    };
  }

  private setupUserInteractionMetrics() {
    // Track clicks on important elements
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      
      // Track button clicks
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        const button = target.tagName === 'BUTTON' ? target : target.closest('button');
        this.recordUserInteraction('button_click', {
          buttonText: button?.textContent?.trim() || 'unknown',
          buttonId: button?.id || '',
          buttonClass: button?.className || ''
        });
      }
      
      // Track form submissions
      if (target.type === 'submit') {
        const form = target.closest('form');
        this.recordUserInteraction('form_submit', {
          formId: form?.id || '',
          formAction: form?.action || ''
        });
      }
      
      // Track link clicks
      if (target.tagName === 'A' || target.closest('a')) {
        const link = target.tagName === 'A' ? target : target.closest('a');
        this.recordUserInteraction('link_click', {
          href: (link as HTMLAnchorElement)?.href || '',
          text: link?.textContent?.trim() || ''
        });
      }
    });

    // Track errors
    window.addEventListener('error', (event) => {
      this.recordError('javascript_error', {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack
      });
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.recordError('unhandled_rejection', {
        reason: event.reason?.toString() || 'Unknown rejection',
        stack: event.reason?.stack
      });
    });
  }

  private recordNavigationMetrics(entry: PerformanceNavigationTiming) {
    const metrics = {
      dns_lookup: entry.domainLookupEnd - entry.domainLookupStart,
      tcp_connect: entry.connectEnd - entry.connectStart,
      tls_handshake: entry.secureConnectionStart > 0 ? entry.connectEnd - entry.secureConnectionStart : 0,
      request_time: entry.responseStart - entry.requestStart,
      response_time: entry.responseEnd - entry.responseStart,
      dom_load: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
      total_load_time: entry.loadEventEnd - entry.navigationStart,
      first_paint: this.getFirstPaint(),
      first_contentful_paint: this.getFirstContentfulPaint()
    };

    this.sendMetrics('navigation_timing', metrics);
  }

  private recordResourceMetrics(entry: PerformanceResourceTiming) {
    // Only track significant resources
    if (entry.transferSize > 1000 || entry.duration > 100) {
      const metrics = {
        name: entry.name,
        type: this.getResourceType(entry.name),
        duration: entry.duration,
        size: entry.transferSize,
        cached: entry.transferSize === 0 && entry.decodedBodySize > 0
      };

      this.sendMetrics('resource_timing', metrics);
    }
  }

  private recordLCPMetric(entry: PerformanceEntry) {
    this.sendMetrics('largest_contentful_paint', {
      value: entry.startTime,
      element: (entry as any).element?.tagName || 'unknown'
    });
  }

  private recordFIDMetric(entry: PerformanceEntry) {
    this.sendMetrics('first_input_delay', {
      value: (entry as any).processingStart - entry.startTime,
      event_type: (entry as any).name
    });
  }

  private recordUserInteraction(type: string, data: any) {
    this.sendMetrics('user_interaction', {
      interaction_type: type,
      timestamp: Date.now(),
      page: window.location.pathname,
      ...data
    });
  }

  private recordError(type: string, data: any) {
    this.sendMetrics('frontend_error', {
      error_type: type,
      timestamp: Date.now(),
      page: window.location.pathname,
      user_agent: navigator.userAgent,
      ...data
    });
  }

  private recordCustomMetric(name: string, data: any) {
    this.sendMetrics('custom_metric', {
      metric_name: name,
      timestamp: Date.now(),
      page: window.location.pathname,
      ...data
    });
  }

  private getFirstPaint(): number {
    const paintEntries = performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
    return firstPaint?.startTime || 0;
  }

  private getFirstContentfulPaint(): number {
    const paintEntries = performance.getEntriesByType('paint');
    const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return firstContentfulPaint?.startTime || 0;
  }

  private getResourceType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    if (['js', 'mjs'].includes(extension || '')) return 'script';
    if (['css'].includes(extension || '')) return 'stylesheet';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(extension || '')) return 'image';
    if (['woff', 'woff2', 'ttf', 'otf'].includes(extension || '')) return 'font';
    if (url.includes('/api/')) return 'api';
    return 'other';
  }

  public setUserContext(userId: string, organizationId?: string) {
    this.userId = userId;
    this.organizationId = organizationId;
  }

  public recordPageView(page: string, additionalData?: any) {
    this.sendMetrics('page_view', {
      page,
      timestamp: Date.now(),
      referrer: document.referrer,
      ...additionalData
    });
  }

  public recordBusinessEvent(eventType: string, data: any) {
    this.sendMetrics('business_event', {
      event_type: eventType,
      timestamp: Date.now(),
      page: window.location.pathname,
      ...data
    });
  }

  public startTimer(name: string): () => void {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      this.sendMetrics('custom_timing', {
        timer_name: name,
        duration,
        timestamp: Date.now()
      });
    };
  }

  private async sendMetrics(type: string, data: any) {
    try {
      const payload = {
        type,
        data,
        session_id: this.sessionId,
        user_id: this.userId,
        organization_id: this.organizationId,
        timestamp: Date.now(),
        url: window.location.href,
        user_agent: navigator.userAgent
      };

      // Use sendBeacon for better reliability, fallback to fetch
      if (navigator.sendBeacon) {
        navigator.sendBeacon(this.apiEndpoint, JSON.stringify(payload));
      } else {
        await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          keepalive: true
        });
      }
    } catch (error) {
      console.warn('Failed to send metrics:', error);
    }
  }
}

// Export singleton instance
export const webMetrics = new WebMetrics();

// Export for manual usage
export { WebMetrics };
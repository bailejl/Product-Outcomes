interface PerformanceMetrics {
  fcp: number // First Contentful Paint
  lcp: number // Largest Contentful Paint
  fid: number // First Input Delay
  cls: number // Cumulative Layout Shift
  ttfb: number // Time to First Byte
  networkSpeed: string
  deviceMemory: number
  connection: string
}

interface PerformanceBudget {
  fcp: number // Target: < 1.8s
  lcp: number // Target: < 2.5s
  fid: number // Target: < 100ms
  cls: number // Target: < 0.1
  ttfb: number // Target: < 800ms
  bundleSize: number // Target: < 1MB
  chunkSize: number // Target: < 250KB
}

const DEFAULT_BUDGET: PerformanceBudget = {
  fcp: 1800, // 1.8 seconds
  lcp: 2500, // 2.5 seconds
  fid: 100,  // 100ms
  cls: 0.1,  // 0.1 CLS score
  ttfb: 800, // 800ms
  bundleSize: 1024 * 1024, // 1MB
  chunkSize: 256 * 1024    // 256KB
}

class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {}
  private budget: PerformanceBudget
  private violations: string[] = []
  private observers: PerformanceObserver[] = []

  constructor(budget: Partial<PerformanceBudget> = {}) {
    this.budget = { ...DEFAULT_BUDGET, ...budget }
    this.initializeMonitoring()
  }

  private initializeMonitoring() {
    // Only run in browser environment
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return
    }

    this.observeWebVitals()
    this.observeResourceMetrics()
    this.observeNavigationTiming()
    this.observeLongTasks()
  }

  private observeWebVitals() {
    // First Contentful Paint (FCP)
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          this.metrics.fcp = entry.startTime
          this.checkBudget('fcp', entry.startTime)
        }
      }
    }).observe({ entryTypes: ['paint'] })

    // Largest Contentful Paint (LCP)
    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1]
      this.metrics.lcp = lastEntry.startTime
      this.checkBudget('lcp', lastEntry.startTime)
    }).observe({ entryTypes: ['largest-contentful-paint'] })

    // First Input Delay (FID)
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.metrics.fid = (entry as any).processingStart - entry.startTime
        this.checkBudget('fid', this.metrics.fid)
      }
    }).observe({ entryTypes: ['first-input'] })

    // Cumulative Layout Shift (CLS)
    let clsValue = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value
          this.metrics.cls = clsValue
          this.checkBudget('cls', clsValue)
        }
      }
    }).observe({ entryTypes: ['layout-shift'] })
  }

  private observeResourceMetrics() {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const resourceEntry = entry as PerformanceResourceTiming
        
        // Check bundle sizes
        if (resourceEntry.name.includes('chunks/') || resourceEntry.name.includes('entry/')) {
          this.checkResourceSize(resourceEntry)
        }
        
        // Check critical resource timing
        if (this.isCriticalResource(resourceEntry.name)) {
          this.analyzeCriticalResource(resourceEntry)
        }
      }
    }).observe({ entryTypes: ['resource'] })
  }

  private observeNavigationTiming() {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const navEntry = entry as PerformanceNavigationTiming
        
        // Time to First Byte
        this.metrics.ttfb = navEntry.responseStart - navEntry.requestStart
        this.checkBudget('ttfb', this.metrics.ttfb)
        
        // Collect connection info
        if ('connection' in navigator) {
          const connection = (navigator as any).connection
          this.metrics.networkSpeed = connection.effectiveType
          this.metrics.connection = connection.type
        }
        
        // Device memory
        if ('deviceMemory' in navigator) {
          this.metrics.deviceMemory = (navigator as any).deviceMemory
        }
      }
    }).observe({ entryTypes: ['navigation'] })
  }

  private observeLongTasks() {
    if ('PerformanceObserver' in window && 'PerformanceLongTaskTiming' in window) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.warn('Long task detected:', {
            duration: entry.duration,
            startTime: entry.startTime,
            name: entry.name
          })
          
          if (entry.duration > 50) { // Tasks > 50ms are problematic
            this.violations.push(`Long task: ${entry.duration.toFixed(2)}ms`)
          }
        }
      }).observe({ entryTypes: ['longtask'] })
    }
  }

  private checkBudget(metric: keyof PerformanceBudget, value: number) {
    const budget = this.budget[metric]
    if (value > budget) {
      const violation = `${metric.toUpperCase()} budget exceeded: ${value.toFixed(2)} > ${budget}`
      this.violations.push(violation)
      console.warn('Performance budget violation:', violation)
      
      // Send to analytics or monitoring service
      this.reportViolation(metric, value, budget)
    }
  }

  private checkResourceSize(resource: PerformanceResourceTiming) {
    const transferSize = resource.transferSize || 0
    const decodedSize = resource.decodedBodySize || 0
    
    // Check individual chunk size
    if (transferSize > this.budget.chunkSize) {
      const violation = `Large chunk detected: ${(transferSize / 1024).toFixed(2)}KB`
      this.violations.push(violation)
      console.warn('Bundle size violation:', violation, resource.name)
    }
    
    // Calculate compression ratio
    const compressionRatio = decodedSize > 0 ? transferSize / decodedSize : 1
    if (compressionRatio > 0.8) { // Poor compression
      console.warn('Poor compression detected:', {
        resource: resource.name,
        transferSize: transferSize,
        decodedSize: decodedSize,
        ratio: compressionRatio
      })
    }
  }

  private isCriticalResource(url: string): boolean {
    return url.includes('entry/') || 
           url.includes('react-vendor') || 
           url.includes('apollo-vendor') ||
           url.endsWith('.css')
  }

  private analyzeCriticalResource(resource: PerformanceResourceTiming) {
    const loadTime = resource.responseEnd - resource.requestStart
    const downloadTime = resource.responseEnd - resource.responseStart
    
    // Check if critical resource takes too long
    if (loadTime > 1000) { // 1 second
      console.warn('Slow critical resource:', {
        resource: resource.name,
        loadTime: loadTime.toFixed(2),
        downloadTime: downloadTime.toFixed(2)
      })
    }
  }

  private reportViolation(metric: string, actual: number, budget: number) {
    // Send to monitoring service (e.g., Sentry, DataDog, custom analytics)
    if (window.gtag) {
      window.gtag('event', 'performance_budget_violation', {
        custom_parameter_metric: metric,
        custom_parameter_actual: actual,
        custom_parameter_budget: budget,
        custom_parameter_device: this.getDeviceInfo()
      })
    }
    
    // Send to custom analytics endpoint
    fetch('/api/analytics/performance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'budget_violation',
        metric,
        actual,
        budget,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        url: window.location.href,
        deviceInfo: this.getDeviceInfo()
      })
    }).catch(() => {
      // Silently fail for analytics
    })
  }

  private getDeviceInfo() {
    return {
      memory: this.metrics.deviceMemory,
      connection: this.metrics.networkSpeed,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      pixelRatio: window.devicePixelRatio
    }
  }

  // Public methods
  getMetrics(): PerformanceMetrics {
    return this.metrics as PerformanceMetrics
  }

  getViolations(): string[] {
    return [...this.violations]
  }

  getBudget(): PerformanceBudget {
    return { ...this.budget }
  }

  updateBudget(newBudget: Partial<PerformanceBudget>) {
    this.budget = { ...this.budget, ...newBudget }
  }

  generateReport(): PerformanceReport {
    const score = this.calculatePerformanceScore()
    const recommendations = this.getRecommendations()
    
    return {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      budget: this.budget,
      violations: this.violations,
      score,
      recommendations,
      deviceInfo: this.getDeviceInfo()
    }
  }

  private calculatePerformanceScore(): number {
    const scores: number[] = []
    
    // FCP score (0-100)
    if (this.metrics.fcp) {
      const fcpScore = Math.max(0, 100 - (this.metrics.fcp / this.budget.fcp) * 50)
      scores.push(fcpScore)
    }
    
    // LCP score (0-100)
    if (this.metrics.lcp) {
      const lcpScore = Math.max(0, 100 - (this.metrics.lcp / this.budget.lcp) * 50)
      scores.push(lcpScore)
    }
    
    // FID score (0-100)
    if (this.metrics.fid) {
      const fidScore = Math.max(0, 100 - (this.metrics.fid / this.budget.fid) * 50)
      scores.push(fidScore)
    }
    
    // CLS score (0-100)
    if (this.metrics.cls) {
      const clsScore = Math.max(0, 100 - (this.metrics.cls / this.budget.cls) * 50)
      scores.push(clsScore)
    }
    
    return scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 0
  }

  private getRecommendations(): string[] {
    const recommendations: string[] = []
    
    if (this.metrics.fcp && this.metrics.fcp > this.budget.fcp) {
      recommendations.push('Optimize First Contentful Paint: Consider reducing CSS blocking time and optimizing fonts')
    }
    
    if (this.metrics.lcp && this.metrics.lcp > this.budget.lcp) {
      recommendations.push('Optimize Largest Contentful Paint: Optimize images and reduce server response times')
    }
    
    if (this.metrics.fid && this.metrics.fid > this.budget.fid) {
      recommendations.push('Optimize First Input Delay: Reduce JavaScript execution time and defer non-critical scripts')
    }
    
    if (this.metrics.cls && this.metrics.cls > this.budget.cls) {
      recommendations.push('Optimize Cumulative Layout Shift: Add size attributes to images and avoid dynamic content injection')
    }
    
    if (this.violations.some(v => v.includes('Long task'))) {
      recommendations.push('Break up long-running JavaScript tasks using code splitting or web workers')
    }
    
    return recommendations
  }

  // Cleanup method
  disconnect() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
  }
}

interface PerformanceReport {
  timestamp: string
  metrics: Partial<PerformanceMetrics>
  budget: PerformanceBudget
  violations: string[]
  score: number
  recommendations: string[]
  deviceInfo: any
}

// Singleton instance
let performanceMonitor: PerformanceMonitor | null = null

export const initializePerformanceMonitoring = (budget?: Partial<PerformanceBudget>) => {
  if (!performanceMonitor && typeof window !== 'undefined') {
    performanceMonitor = new PerformanceMonitor(budget)
    
    // Log report on page unload
    window.addEventListener('beforeunload', () => {
      const report = performanceMonitor?.generateReport()
      if (report) {
        console.log('Performance Report:', report)
        
        // Send final report
        navigator.sendBeacon('/api/analytics/performance', JSON.stringify({
          type: 'page_unload_report',
          ...report
        }))
      }
    })
  }
  
  return performanceMonitor
}

export const getPerformanceMonitor = () => performanceMonitor

// React hook for performance monitoring
export const usePerformanceMonitoring = (budget?: Partial<PerformanceBudget>) => {
  const [metrics, setMetrics] = React.useState<Partial<PerformanceMetrics>>({})
  const [violations, setViolations] = React.useState<string[]>([])
  
  React.useEffect(() => {
    const monitor = initializePerformanceMonitoring(budget)
    
    if (monitor) {
      // Update metrics periodically
      const interval = setInterval(() => {
        setMetrics(monitor.getMetrics())
        setViolations(monitor.getViolations())
      }, 1000)
      
      return () => {
        clearInterval(interval)
      }
    }
  }, [budget])
  
  return { metrics, violations }
}

// Bundle analyzer for development
export const analyzeBundleSize = async () => {
  if (process.env.NODE_ENV !== 'production') {
    try {
      const response = await fetch('/dist/web/stats.json')
      const stats = await response.json()
      
      console.group('Bundle Analysis')
      console.log('Total size:', stats.assets?.reduce((sum: number, asset: any) => sum + asset.size, 0))
      console.log('Chunks:', stats.chunks?.length)
      console.log('Assets:', stats.assets?.map((asset: any) => ({
        name: asset.name,
        size: `${(asset.size / 1024).toFixed(2)}KB`
      })))
      console.groupEnd()
    } catch (error) {
      console.warn('Bundle analysis not available:', error)
    }
  }
}

export default PerformanceMonitor

// Type declarations for global objects
declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
  
  interface Navigator {
    connection?: {
      effectiveType: string
      type: string
    }
    deviceMemory?: number
  }
}

export type { PerformanceMetrics, PerformanceBudget, PerformanceReport }
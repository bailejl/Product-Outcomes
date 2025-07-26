// Mobile metrics collection for React Native application
import { Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MetricData {
  type: string;
  data: any;
  session_id: string;
  user_id?: string;
  organization_id?: string;
  timestamp: number;
  platform: string;
  app_version: string;
  device_info: any;
}

class MobileMetrics {
  private apiEndpoint: string;
  private sessionId: string;
  private userId?: string;
  private organizationId?: string;
  private appVersion: string;
  private deviceInfo: any;
  private metricsQueue: MetricData[] = [];
  private isOnline: boolean = true;

  constructor(apiEndpoint: string = '/api/mobile-metrics', appVersion: string = '1.0.0') {
    this.apiEndpoint = apiEndpoint;
    this.appVersion = appVersion;
    this.sessionId = this.generateSessionId();
    this.deviceInfo = this.getDeviceInfo();
    this.initializeMetrics();
  }

  private generateSessionId(): string {
    return `mobile_${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDeviceInfo() {
    const { width, height } = Dimensions.get('window');
    const { width: screenWidth, height: screenHeight } = Dimensions.get('screen');
    
    return {
      platform: Platform.OS,
      platform_version: Platform.Version,
      screen_width: screenWidth,
      screen_height: screenHeight,
      window_width: width,
      window_height: height,
      is_tablet: width >= 768,
      pixel_ratio: Dimensions.get('window').scale
    };
  }

  private async initializeMetrics() {
    // Load any queued metrics from storage
    try {
      const queuedMetrics = await AsyncStorage.getItem('metrics_queue');
      if (queuedMetrics) {
        this.metricsQueue = JSON.parse(queuedMetrics);
        await this.flushMetrics();
      }
    } catch (error) {
      console.warn('Failed to load queued metrics:', error);
    }

    // Set up periodic flushing
    setInterval(() => {
      this.flushMetrics();
    }, 30000); // Flush every 30 seconds
  }

  public setUserContext(userId: string, organizationId?: string) {
    this.userId = userId;
    this.organizationId = organizationId;
  }

  public setNetworkStatus(isOnline: boolean) {
    this.isOnline = isOnline;
    if (isOnline && this.metricsQueue.length > 0) {
      this.flushMetrics();
    }
  }

  // Screen navigation metrics
  public recordScreenView(screenName: string, params?: any) {
    this.recordMetric('screen_view', {
      screen_name: screenName,
      params,
      timestamp: Date.now()
    });
  }

  public recordScreenLoad(screenName: string, loadTime: number) {
    this.recordMetric('screen_load', {
      screen_name: screenName,
      load_time: loadTime,
      timestamp: Date.now()
    });
  }

  // User interaction metrics
  public recordButtonPress(buttonName: string, screenName: string, additionalData?: any) {
    this.recordMetric('button_press', {
      button_name: buttonName,
      screen_name: screenName,
      timestamp: Date.now(),
      ...additionalData
    });
  }

  public recordFormSubmission(formName: string, screenName: string, success: boolean, errorMessage?: string) {
    this.recordMetric('form_submission', {
      form_name: formName,
      screen_name: screenName,
      success,
      error_message: errorMessage,
      timestamp: Date.now()
    });
  }

  public recordSearchQuery(query: string, resultsCount: number, screenName: string) {
    this.recordMetric('search_query', {
      query: query.length > 100 ? query.substring(0, 100) + '...' : query, // Truncate long queries
      results_count: resultsCount,
      screen_name: screenName,
      timestamp: Date.now()
    });
  }

  // Business event metrics
  public recordOKREvent(eventType: 'create' | 'update' | 'complete' | 'view', okrId: string, additionalData?: any) {
    this.recordMetric('okr_event', {
      event_type: eventType,
      okr_id: okrId,
      timestamp: Date.now(),
      ...additionalData
    });
  }

  public recordAuthEvent(eventType: 'login' | 'logout' | 'register' | 'password_reset', method?: string) {
    this.recordMetric('auth_event', {
      event_type: eventType,
      auth_method: method,
      timestamp: Date.now()
    });
  }

  public recordNotificationEvent(eventType: 'received' | 'opened' | 'dismissed', notificationType?: string) {
    this.recordMetric('notification_event', {
      event_type: eventType,
      notification_type: notificationType,
      timestamp: Date.now()
    });
  }

  // Performance metrics
  public recordAPICall(endpoint: string, method: string, duration: number, statusCode: number, error?: string) {
    this.recordMetric('api_call', {
      endpoint,
      method,
      duration,
      status_code: statusCode,
      success: statusCode >= 200 && statusCode < 300,
      error_message: error,
      timestamp: Date.now()
    });
  }

  public recordAppLaunch(launchTime: number, isFirstLaunch: boolean) {
    this.recordMetric('app_launch', {
      launch_time: launchTime,
      is_first_launch: isFirstLaunch,
      timestamp: Date.now()
    });
  }

  public recordAppStateChange(newState: 'active' | 'background' | 'inactive') {
    this.recordMetric('app_state_change', {
      new_state: newState,
      timestamp: Date.now()
    });
  }

  // Error metrics
  public recordError(errorType: string, errorMessage: string, stackTrace?: string, screenName?: string) {
    this.recordMetric('mobile_error', {
      error_type: errorType,
      error_message: errorMessage,
      stack_trace: stackTrace,
      screen_name: screenName,
      timestamp: Date.now()
    });
  }

  public recordCrash(crashType: string, crashMessage: string, stackTrace?: string) {
    this.recordMetric('app_crash', {
      crash_type: crashType,
      crash_message: crashMessage,
      stack_trace: stackTrace,
      timestamp: Date.now()
    });
  }

  // Custom metrics
  public recordCustomEvent(eventName: string, properties: Record<string, any>) {
    this.recordMetric('custom_event', {
      event_name: eventName,
      properties,
      timestamp: Date.now()
    });
  }

  public startTimer(name: string): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.recordMetric('custom_timing', {
        timer_name: name,
        duration,
        timestamp: Date.now()
      });
    };
  }

  // Feature usage metrics
  public recordFeatureUsage(featureName: string, usageType: 'started' | 'completed' | 'abandoned') {
    this.recordMetric('feature_usage', {
      feature_name: featureName,
      usage_type: usageType,
      timestamp: Date.now()
    });
  }

  private recordMetric(type: string, data: any) {
    const metric: MetricData = {
      type,
      data,
      session_id: this.sessionId,
      user_id: this.userId,
      organization_id: this.organizationId,
      timestamp: Date.now(),
      platform: Platform.OS,
      app_version: this.appVersion,
      device_info: this.deviceInfo
    };

    this.metricsQueue.push(metric);

    // Auto-flush if queue gets too large or we're online
    if (this.metricsQueue.length >= 50 || this.isOnline) {
      this.flushMetrics();
    }
  }

  private async flushMetrics() {
    if (this.metricsQueue.length === 0 || !this.isOnline) {
      return;
    }

    const metricsToSend = [...this.metricsQueue];
    this.metricsQueue = [];

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ metrics: metricsToSend })
      });

      if (!response.ok) {
        // If sending failed, add metrics back to queue
        this.metricsQueue.unshift(...metricsToSend);
        throw new Error(`Failed to send metrics: ${response.status}`);
      }

      // Clear any stored metrics on successful send
      await AsyncStorage.removeItem('metrics_queue');
    } catch (error) {
      console.warn('Failed to send metrics:', error);
      
      // Store failed metrics for later retry
      try {
        await AsyncStorage.setItem('metrics_queue', JSON.stringify(this.metricsQueue));
      } catch (storageError) {
        console.warn('Failed to store metrics queue:', storageError);
      }
    }
  }

  // Public method to manually flush metrics
  public async flush() {
    await this.flushMetrics();
  }

  // Method to clear all queued metrics (use with caution)
  public async clearQueue() {
    this.metricsQueue = [];
    await AsyncStorage.removeItem('metrics_queue');
  }
}

// Export singleton instance
export const mobileMetrics = new MobileMetrics();

// Export class for custom instances
export { MobileMetrics };
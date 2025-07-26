import { Injectable, Logger } from '@nestjs/common';
import { RedisCacheService } from '../redis/cache-service';
import { createHash, randomBytes } from 'crypto';

export interface SessionData {
  userId: string;
  email?: string;
  roles: string[];
  permissions: string[];
  lastActivity: number;
  createdAt: number;
  metadata: Record<string, any>;
}

export interface SessionConfig {
  defaultTtl: number;
  maxIdleTime: number;
  slidingExpiration: boolean;
  secureOnly: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  cleanupInterval: number;
}

@Injectable()
export class SessionCacheService {
  private readonly logger = new Logger(SessionCacheService.name);
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private cacheService: RedisCacheService,
    private config: SessionConfig
  ) {
    this.startCleanupProcess();
  }

  async createSession(
    userId: string,
    sessionData: Partial<SessionData>,
    customTtl?: number
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    const now = Date.now();
    
    const session: SessionData = {
      userId,
      email: sessionData.email,
      roles: sessionData.roles || [],
      permissions: sessionData.permissions || [],
      lastActivity: now,
      createdAt: now,
      metadata: sessionData.metadata || {}
    };

    const ttl = customTtl || this.config.defaultTtl;
    
    try {
      const success = await this.cacheService.set(sessionId, session, {
        ttl,
        prefix: 'session',
        tags: [`user:${userId}`, 'session']
      });

      if (success) {
        // Track active session for user
        await this.addUserSession(userId, sessionId, ttl);
        
        this.logger.debug(`Created session ${sessionId} for user ${userId}`);
        return sessionId;
      } else {
        throw new Error('Failed to create session in cache');
      }
    } catch (error) {
      this.logger.error(`Error creating session for user ${userId}:`, error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const session = await this.cacheService.get<SessionData>(sessionId, {
        prefix: 'session'
      });

      if (!session) {
        return null;
      }

      // Check if session is expired based on last activity
      const now = Date.now();
      const timeSinceLastActivity = now - session.lastActivity;
      
      if (timeSinceLastActivity > this.config.maxIdleTime * 1000) {
        this.logger.debug(`Session ${sessionId} expired due to inactivity`);
        await this.destroySession(sessionId);
        return null;
      }

      // Update last activity if sliding expiration is enabled
      if (this.config.slidingExpiration) {
        await this.updateLastActivity(sessionId, session);
      }

      return session;
    } catch (error) {
      this.logger.error(`Error retrieving session ${sessionId}:`, error);
      return null;
    }
  }

  async updateSession(
    sessionId: string,
    updates: Partial<SessionData>
  ): Promise<boolean> {
    try {
      const existingSession = await this.getSession(sessionId);
      if (!existingSession) {
        return false;
      }

      const updatedSession: SessionData = {
        ...existingSession,
        ...updates,
        lastActivity: Date.now()
      };

      const ttl = await this.cacheService.ttl(sessionId, 'session');
      const success = await this.cacheService.set(sessionId, updatedSession, {
        ttl: ttl > 0 ? ttl : this.config.defaultTtl,
        prefix: 'session',
        tags: [`user:${updatedSession.userId}`, 'session']
      });

      if (success) {
        this.logger.debug(`Updated session ${sessionId}`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Error updating session ${sessionId}:`, error);
      return false;
    }
  }

  async destroySession(sessionId: string): Promise<boolean> {
    try {
      const session = await this.cacheService.get<SessionData>(sessionId, {
        prefix: 'session'
      });

      const success = await this.cacheService.del(sessionId, 'session');
      
      if (success && session) {
        // Remove from user's active sessions
        await this.removeUserSession(session.userId, sessionId);
        
        this.logger.debug(`Destroyed session ${sessionId} for user ${session.userId}`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Error destroying session ${sessionId}:`, error);
      return false;
    }
  }

  async destroyAllUserSessions(userId: string): Promise<number> {
    try {
      const userSessionsKey = `user_sessions:${userId}`;
      const sessionIds = await this.cacheService.get<string[]>(userSessionsKey, {
        prefix: 'session'
      });

      if (!sessionIds || sessionIds.length === 0) {
        return 0;
      }

      let destroyedCount = 0;
      for (const sessionId of sessionIds) {
        const success = await this.destroySession(sessionId);
        if (success) {
          destroyedCount++;
        }
      }

      // Clear user sessions list
      await this.cacheService.del(userSessionsKey, 'session');

      this.logger.log(`Destroyed ${destroyedCount} sessions for user ${userId}`);
      return destroyedCount;
    } catch (error) {
      this.logger.error(`Error destroying all sessions for user ${userId}:`, error);
      return 0;
    }
  }

  async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const userSessionsKey = `user_sessions:${userId}`;
      const sessionIds = await this.cacheService.get<string[]>(userSessionsKey, {
        prefix: 'session'
      });

      if (!sessionIds || sessionIds.length === 0) {
        return [];
      }

      const sessions: SessionData[] = [];
      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session) {
          sessions.push(session);
        }
      }

      return sessions;
    } catch (error) {
      this.logger.error(`Error retrieving sessions for user ${userId}:`, error);
      return [];
    }
  }

  async extendSession(sessionId: string, additionalTtl: number): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      const success = await this.cacheService.extend(sessionId, additionalTtl, 'session');
      
      if (success) {
        this.logger.debug(`Extended session ${sessionId} by ${additionalTtl} seconds`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Error extending session ${sessionId}:`, error);
      return false;
    }
  }

  async getSessionStats(): Promise<{
    totalActiveSessions: number;
    activeUsers: number;
    averageSessionAge: number;
  }> {
    try {
      // This is a simplified implementation
      // In production, you might want to maintain counters for better performance
      
      const pattern = 'cache:session:*';
      // Note: Use SCAN in production instead of KEYS
      
      return {
        totalActiveSessions: 0,
        activeUsers: 0,
        averageSessionAge: 0
      };
    } catch (error) {
      this.logger.error('Error retrieving session stats:', error);
      return {
        totalActiveSessions: 0,
        activeUsers: 0,
        averageSessionAge: 0
      };
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      let cleanedCount = 0;
      const now = Date.now();
      
      // This would be more efficiently implemented with Lua scripts in production
      // For now, this is a simplified cleanup process
      
      this.logger.debug(`Cleaned up ${cleanedCount} expired sessions`);
      return cleanedCount;
    } catch (error) {
      this.logger.error('Error during session cleanup:', error);
      return 0;
    }
  }

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = randomBytes(16).toString('hex');
    return `${timestamp}-${randomPart}`;
  }

  private async updateLastActivity(sessionId: string, session: SessionData): Promise<void> {
    try {
      const updatedSession = {
        ...session,
        lastActivity: Date.now()
      };

      const currentTtl = await this.cacheService.ttl(sessionId, 'session');
      await this.cacheService.set(sessionId, updatedSession, {
        ttl: currentTtl > 0 ? Math.max(currentTtl, this.config.defaultTtl) : this.config.defaultTtl,
        prefix: 'session',
        tags: [`user:${session.userId}`, 'session']
      });
    } catch (error) {
      this.logger.error(`Error updating last activity for session ${sessionId}:`, error);
    }
  }

  private async addUserSession(userId: string, sessionId: string, ttl: number): Promise<void> {
    try {
      const userSessionsKey = `user_sessions:${userId}`;
      const existingSessions = await this.cacheService.get<string[]>(userSessionsKey, {
        prefix: 'session'
      }) || [];

      const updatedSessions = [...existingSessions, sessionId];
      
      await this.cacheService.set(userSessionsKey, updatedSessions, {
        ttl: ttl + 300, // Keep user session list slightly longer
        prefix: 'session',
        tags: [`user:${userId}`]
      });
    } catch (error) {
      this.logger.error(`Error adding session to user ${userId}:`, error);
    }
  }

  private async removeUserSession(userId: string, sessionId: string): Promise<void> {
    try {
      const userSessionsKey = `user_sessions:${userId}`;
      const existingSessions = await this.cacheService.get<string[]>(userSessionsKey, {
        prefix: 'session'
      }) || [];

      const updatedSessions = existingSessions.filter(id => id !== sessionId);
      
      if (updatedSessions.length > 0) {
        const currentTtl = await this.cacheService.ttl(userSessionsKey, 'session');
        await this.cacheService.set(userSessionsKey, updatedSessions, {
          ttl: currentTtl > 0 ? currentTtl : this.config.defaultTtl,
          prefix: 'session',
          tags: [`user:${userId}`]
        });
      } else {
        await this.cacheService.del(userSessionsKey, 'session');
      }
    } catch (error) {
      this.logger.error(`Error removing session from user ${userId}:`, error);
    }
  }

  private startCleanupProcess(): void {
    if (this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(
        () => this.cleanupExpiredSessions(),
        this.config.cleanupInterval * 1000
      );
      
      this.logger.log(`Started session cleanup process with ${this.config.cleanupInterval}s interval`);
    }
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.logger.log('Stopped session cleanup process');
    }
  }
}
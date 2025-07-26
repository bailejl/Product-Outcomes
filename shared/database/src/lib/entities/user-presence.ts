import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm'
import { User } from './user'

export enum PresenceStatus {
  ONLINE = 'online',
  AWAY = 'away',
  BUSY = 'busy',
  OFFLINE = 'offline',
  INVISIBLE = 'invisible',
}

export enum ActivityType {
  VIEWING_OKR = 'viewing_okr',
  EDITING_OKR = 'editing_okr',
  COMMENTING = 'commenting',
  BROWSING = 'browsing',
  IDLE = 'idle',
}

@Entity('user_presence')
@Index(['user', 'lastSeen'])
@Index(['status', 'lastSeen'])
export class UserPresence {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'user_id', unique: true })
  userId: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  @Column({
    type: 'enum',
    enum: PresenceStatus,
    default: PresenceStatus.OFFLINE,
  })
  status: PresenceStatus

  @Column({
    type: 'enum',
    enum: ActivityType,
    default: ActivityType.IDLE,
  })
  currentActivity: ActivityType

  @Column({ name: 'activity_context', nullable: true, length: 255 })
  activityContext?: string // e.g., OKR ID being viewed/edited

  @Column({ name: 'last_seen' })
  lastSeen: Date

  @Column({ name: 'socket_id', nullable: true, length: 255 })
  socketId?: string

  @Column({ name: 'ip_address', nullable: true, length: 45 })
  ipAddress?: string

  @Column({ name: 'user_agent', nullable: true, type: 'text' })
  userAgent?: string

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  // Update presence status
  updateStatus(status: PresenceStatus, activity?: ActivityType, context?: string): void {
    this.status = status
    this.lastSeen = new Date()
    
    if (activity) {
      this.currentActivity = activity
    }
    
    if (context) {
      this.activityContext = context
    }

    // Clear activity context if going offline
    if (status === PresenceStatus.OFFLINE) {
      this.currentActivity = ActivityType.IDLE
      this.activityContext = undefined
      this.socketId = undefined
    }
  }

  // Check if user is active (online, away, or busy)
  get isActive(): boolean {
    return [PresenceStatus.ONLINE, PresenceStatus.AWAY, PresenceStatus.BUSY].includes(this.status)
  }

  // Check if user is currently online
  get isOnline(): boolean {
    return this.status === PresenceStatus.ONLINE
  }

  // Check if user was recently active (within 5 minutes)
  get isRecentlyActive(): boolean {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    return this.lastSeen > fiveMinutesAgo
  }

  // Get time since last seen for display
  get lastSeenDisplay(): string {
    if (this.isOnline) return 'online'
    
    const now = new Date()
    const diffMs = now.getTime() - this.lastSeen.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return this.lastSeen.toLocaleDateString()
  }

  // Get activity display text
  get activityDisplay(): string {
    switch (this.currentActivity) {
      case ActivityType.VIEWING_OKR:
        return `viewing ${this.activityContext || 'OKR'}`
      case ActivityType.EDITING_OKR:
        return `editing ${this.activityContext || 'OKR'}`
      case ActivityType.COMMENTING:
        return 'commenting'
      case ActivityType.BROWSING:
        return 'browsing'
      case ActivityType.IDLE:
      default:
        return ''
    }
  }

  // Get status color for UI
  get statusColor(): string {
    switch (this.status) {
      case PresenceStatus.ONLINE:
        return 'green'
      case PresenceStatus.AWAY:
        return 'yellow'
      case PresenceStatus.BUSY:
        return 'red'
      case PresenceStatus.OFFLINE:
      case PresenceStatus.INVISIBLE:
        return 'gray'
      default:
        return 'gray'
    }
  }
}
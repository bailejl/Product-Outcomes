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

export enum NotificationType {
  OKR_UPDATE = 'okr_update',
  OKR_COMMENT = 'okr_comment',
  OKR_ASSIGNED = 'okr_assigned',
  OKR_DUE_SOON = 'okr_due_soon',
  OKR_COMPLETED = 'okr_completed',
  USER_MENTIONED = 'user_mentioned',
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
  COLLABORATION_INVITE = 'collaboration_invite',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('notifications')
@Index(['recipient', 'isRead'])
@Index(['type', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType

  @Column({ length: 255 })
  title: string

  @Column({ type: 'text' })
  message: string

  @Column({
    type: 'enum',
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
  })
  priority: NotificationPriority

  @Column({ name: 'is_read', default: false })
  isRead: boolean

  @Column({ name: 'read_at', nullable: true })
  readAt?: Date

  @Column({ name: 'action_url', nullable: true, length: 500 })
  actionUrl?: string

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>

  @Column({ name: 'recipient_id' })
  recipientId: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_id' })
  recipient: User

  @Column({ name: 'sender_id', nullable: true })
  senderId?: string

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sender_id' })
  sender?: User

  @Column({ name: 'expires_at', nullable: true })
  expiresAt?: Date

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  // Mark notification as read
  markAsRead(): void {
    this.isRead = true
    this.readAt = new Date()
  }

  // Check if notification is expired
  get isExpired(): boolean {
    return !!(this.expiresAt && this.expiresAt < new Date())
  }

  // Get display priority
  get displayPriority(): number {
    switch (this.priority) {
      case NotificationPriority.URGENT:
        return 4
      case NotificationPriority.HIGH:
        return 3
      case NotificationPriority.MEDIUM:
        return 2
      case NotificationPriority.LOW:
        return 1
      default:
        return 2
    }
  }
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { OKR } from './okr'
import { User } from './user'

export enum KeyResultType {
  NUMERIC = 'numeric',
  PERCENTAGE = 'percentage',
  BOOLEAN = 'boolean',
  MILESTONE = 'milestone',
}

export enum KeyResultStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  AT_RISK = 'at_risk',
  BLOCKED = 'blocked',
}

@Entity('key_results')
@Index(['title'])
@Index(['status'])
@Index(['type'])
export class KeyResult {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 255 })
  title: string

  @Column({ length: 500, nullable: true })
  description?: string

  @Column({
    type: 'enum',
    enum: KeyResultType,
    default: KeyResultType.NUMERIC,
  })
  type: KeyResultType

  @Column({
    type: 'enum',
    enum: KeyResultStatus,
    default: KeyResultStatus.NOT_STARTED,
  })
  status: KeyResultStatus

  @Column({ name: 'start_value', type: 'decimal', precision: 15, scale: 2, default: 0 })
  startValue: number

  @Column({ name: 'target_value', type: 'decimal', precision: 15, scale: 2 })
  targetValue: number

  @Column({ name: 'current_value', type: 'decimal', precision: 15, scale: 2, default: 0 })
  currentValue: number

  @Column({ length: 50, nullable: true })
  unit?: string

  @Column({ name: 'due_date', nullable: true })
  dueDate?: Date

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    priority?: 'low' | 'medium' | 'high' | 'critical'
    tags?: string[]
    notes?: string
    checkpoints?: Array<{
      id: string
      title: string
      value: number
      date: Date
      note?: string
    }>
    links?: Array<{
      id: string
      title: string
      url: string
      type: 'document' | 'dashboard' | 'external'
    }>
  }

  @ManyToOne(() => OKR, okr => okr.keyResults, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'okr_id' })
  okr: OKR

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'assignee_id' })
  assignee?: User

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  // Computed properties
  get progressPercentage(): number {
    switch (this.type) {
      case KeyResultType.BOOLEAN:
        return this.currentValue > 0 ? 100 : 0
      case KeyResultType.MILESTONE:
        return this.status === KeyResultStatus.COMPLETED ? 100 : 0
      case KeyResultType.PERCENTAGE:
        return Math.min(Math.max(Number(this.currentValue), 0), 100)
      case KeyResultType.NUMERIC:
      default:
        if (this.targetValue === this.startValue) return 100
        const range = Number(this.targetValue) - Number(this.startValue)
        const current = Number(this.currentValue) - Number(this.startValue)
        return Math.min(Math.max((current / range) * 100, 0), 100)
    }
  }

  get isCompleted(): boolean {
    return this.status === KeyResultStatus.COMPLETED || this.progressPercentage >= 100
  }

  get isOverdue(): boolean {
    return !!(this.dueDate && this.dueDate < new Date() && !this.isCompleted)
  }

  get isAtRisk(): boolean {
    return this.status === KeyResultStatus.AT_RISK || this.status === KeyResultStatus.BLOCKED
  }

  get daysRemaining(): number | null {
    if (!this.dueDate) return null
    const now = new Date()
    const diffTime = this.dueDate.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  get formattedValue(): string {
    const current = Number(this.currentValue)
    const target = Number(this.targetValue)
    
    switch (this.type) {
      case KeyResultType.BOOLEAN:
        return current > 0 ? 'Completed' : 'Not Completed'
      case KeyResultType.MILESTONE:
        return this.isCompleted ? 'Completed' : 'In Progress'
      case KeyResultType.PERCENTAGE:
        return `${current.toFixed(1)}% / ${target.toFixed(1)}%`
      case KeyResultType.NUMERIC:
      default:
        const unit = this.unit ? ` ${this.unit}` : ''
        return `${current.toLocaleString()}${unit} / ${target.toLocaleString()}${unit}`
    }
  }

  // Update current value and auto-update status
  updateProgress(newValue: number, note?: string): void {
    this.currentValue = newValue
    
    // Auto-update status based on progress
    if (this.progressPercentage >= 100) {
      this.status = KeyResultStatus.COMPLETED
    } else if (this.progressPercentage > 0) {
      this.status = KeyResultStatus.IN_PROGRESS
    }

    // Add checkpoint if note provided
    if (note) {
      this.addCheckpoint(newValue, note)
    }
  }

  // Add progress checkpoint
  addCheckpoint(value: number, note?: string): void {
    if (!this.metadata) this.metadata = {}
    if (!this.metadata.checkpoints) this.metadata.checkpoints = []
    
    this.metadata.checkpoints.push({
      id: crypto.randomUUID(),
      title: `Progress Update`,
      value,
      date: new Date(),
      note,
    })
  }

  // Add link/resource
  addLink(title: string, url: string, type: 'document' | 'dashboard' | 'external' = 'external'): void {
    if (!this.metadata) this.metadata = {}
    if (!this.metadata.links) this.metadata.links = []
    
    this.metadata.links.push({
      id: crypto.randomUUID(),
      title,
      url,
      type,
    })
  }

  // Update metadata
  updateMetadata(newMetadata: Partial<typeof KeyResult.prototype.metadata>): void {
    this.metadata = {
      ...this.metadata,
      ...newMetadata,
    }
  }

  // Mark as completed
  markCompleted(): void {
    this.status = KeyResultStatus.COMPLETED
    if (this.type === KeyResultType.BOOLEAN || this.type === KeyResultType.MILESTONE) {
      this.currentValue = 1
    } else if (this.type === KeyResultType.PERCENTAGE) {
      this.currentValue = 100
    } else {
      this.currentValue = this.targetValue
    }
  }

  // Mark as at risk
  markAtRisk(): void {
    this.status = KeyResultStatus.AT_RISK
  }

  // Mark as blocked
  markBlocked(): void {
    this.status = KeyResultStatus.BLOCKED
  }
}
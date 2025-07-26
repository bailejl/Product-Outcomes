import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm'
import { User } from './user'
import { Organization } from './organization'
import { KeyResult } from './key-result'
import { OKRComment } from './okr-comment'

export enum OKRStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum OKRPeriod {
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
  CUSTOM = 'custom',
}

export enum OKRVisibility {
  PUBLIC = 'public',
  ORGANIZATION = 'organization',
  TEAM = 'team',
  PRIVATE = 'private',
}

@Entity('okrs')
@Index(['title'])
@Index(['status'])
@Index(['period'])
@Index(['startDate', 'endDate'])
export class OKR {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 255 })
  title: string

  @Column({ length: 1000, nullable: true })
  description?: string

  @Column({
    type: 'enum',
    enum: OKRStatus,
    default: OKRStatus.DRAFT,
  })
  status: OKRStatus

  @Column({
    type: 'enum',
    enum: OKRPeriod,
    default: OKRPeriod.QUARTERLY,
  })
  period: OKRPeriod

  @Column({
    type: 'enum',
    enum: OKRVisibility,
    default: OKRVisibility.ORGANIZATION,
  })
  visibility: OKRVisibility

  @Column({ name: 'start_date' })
  startDate: Date

  @Column({ name: 'end_date' })
  endDate: Date

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  progress: number

  @Column({ name: 'target_progress', type: 'decimal', precision: 5, scale: 2, default: 100 })
  targetProgress: number

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    tags?: string[]
    priority?: 'low' | 'medium' | 'high' | 'critical'
    category?: string
    department?: string
    stakeholders?: string[]
    milestones?: Array<{
      id: string
      title: string
      dueDate: Date
      completed: boolean
    }>
  }

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'owner_id' })
  owner: User

  @ManyToOne(() => Organization, org => org.okrs, { eager: true })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization

  @OneToMany(() => KeyResult, keyResult => keyResult.okr, { 
    lazy: true, 
    cascade: true 
  })
  keyResults: Promise<KeyResult[]>

  @OneToMany(() => OKRComment, comment => comment.okr, { 
    lazy: true, 
    cascade: true 
  })
  comments: Promise<OKRComment[]>

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  // Computed properties
  get isActive(): boolean {
    return this.status === OKRStatus.ACTIVE
  }

  get isCompleted(): boolean {
    return this.status === OKRStatus.COMPLETED
  }

  get isOverdue(): boolean {
    return this.endDate < new Date() && !this.isCompleted
  }

  get daysRemaining(): number {
    const now = new Date()
    const diffTime = this.endDate.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  get progressPercentage(): number {
    return Math.min(Math.max(Number(this.progress), 0), 100)
  }

  // Calculate overall progress from key results
  async calculateProgress(): Promise<number> {
    const keyResults = await this.keyResults
    if (keyResults.length === 0) return this.progressPercentage

    const totalProgress = keyResults.reduce((sum, kr) => sum + kr.progressPercentage, 0)
    const averageProgress = totalProgress / keyResults.length
    
    this.progress = averageProgress
    return averageProgress
  }

  // Get key results count
  async getKeyResultsCount(): Promise<number> {
    const keyResults = await this.keyResults
    return keyResults.length
  }

  // Get completed key results count
  async getCompletedKeyResultsCount(): Promise<number> {
    const keyResults = await this.keyResults
    return keyResults.filter(kr => kr.isCompleted).length
  }

  // Get comments count
  async getCommentsCount(): Promise<number> {
    const comments = await this.comments
    return comments.length
  }

  // Check if user can view this OKR
  canUserView(userId: string, userOrgId?: string): boolean {
    switch (this.visibility) {
      case OKRVisibility.PUBLIC:
        return true
      case OKRVisibility.ORGANIZATION:
        return userOrgId === this.organization.id
      case OKRVisibility.TEAM:
        // For now, treat team same as organization
        return userOrgId === this.organization.id
      case OKRVisibility.PRIVATE:
        return this.owner.id === userId
      default:
        return false
    }
  }

  // Check if user can edit this OKR
  canUserEdit(userId: string): boolean {
    return this.owner.id === userId
  }

  // Update metadata
  updateMetadata(newMetadata: Partial<typeof OKR.prototype.metadata>): void {
    this.metadata = {
      ...this.metadata,
      ...newMetadata,
    }
  }

  // Add milestone
  addMilestone(title: string, dueDate: Date): void {
    if (!this.metadata) this.metadata = {}
    if (!this.metadata.milestones) this.metadata.milestones = []
    
    this.metadata.milestones.push({
      id: crypto.randomUUID(),
      title,
      dueDate,
      completed: false,
    })
  }

  // Complete milestone
  completeMilestone(milestoneId: string): void {
    if (!this.metadata?.milestones) return
    
    const milestone = this.metadata.milestones.find(m => m.id === milestoneId)
    if (milestone) {
      milestone.completed = true
    }
  }
}
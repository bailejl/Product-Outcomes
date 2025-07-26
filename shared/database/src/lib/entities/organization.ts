import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm'
import { User } from './user'
import { OKR } from './okr'

export enum OrganizationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
}

@Entity('organizations')
@Index(['name'], { unique: true })
@Index(['slug'], { unique: true })
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true, length: 255 })
  name: string

  @Column({ unique: true, length: 100 })
  slug: string

  @Column({ length: 500, nullable: true })
  description?: string

  @Column({ name: 'website_url', length: 255, nullable: true })
  websiteUrl?: string

  @Column({ name: 'logo_url', length: 500, nullable: true })
  logoUrl?: string

  @Column({
    type: 'enum',
    enum: OrganizationStatus,
    default: OrganizationStatus.ACTIVE,
  })
  status: OrganizationStatus

  @Column({ name: 'max_members', default: 100 })
  maxMembers: number

  @Column({ name: 'subscription_tier', default: 'basic', length: 50 })
  subscriptionTier: string

  @Column({ name: 'subscription_expires_at', nullable: true })
  subscriptionExpiresAt?: Date

  @Column({ type: 'jsonb', nullable: true })
  settings?: {
    allowPublicOKRs?: boolean
    requireApprovalForOKRs?: boolean
    defaultOKRCycle?: string
    notifications?: {
      email?: boolean
      slack?: boolean
      teams?: boolean
    }
    branding?: {
      primaryColor?: string
      secondaryColor?: string
      customCss?: string
    }
  }

  @ManyToMany(() => User, { lazy: true })
  @JoinTable({
    name: 'organization_members',
    joinColumn: { name: 'organization_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  members: Promise<User[]>

  @OneToMany(() => OKR, okr => okr.organization, { lazy: true })
  okrs: Promise<OKR[]>

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  // Helper methods
  get isActive(): boolean {
    return this.status === OrganizationStatus.ACTIVE
  }

  get isSubscriptionActive(): boolean {
    if (!this.subscriptionExpiresAt) return true
    return this.subscriptionExpiresAt > new Date()
  }

  get displayName(): string {
    return this.name
  }

  // Generate slug from name
  static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  // Check if user is member
  async isMember(userId: string): Promise<boolean> {
    const members = await this.members
    return members.some(member => member.id === userId)
  }

  // Get member count
  async getMemberCount(): Promise<number> {
    const members = await this.members
    return members.length
  }

  // Check if organization can add more members
  async canAddMembers(): Promise<boolean> {
    const memberCount = await this.getMemberCount()
    return memberCount < this.maxMembers
  }

  // Get OKR count
  async getOKRCount(): Promise<number> {
    const okrs = await this.okrs
    return okrs.length
  }

  // Update settings
  updateSettings(newSettings: Partial<typeof Organization.prototype.settings>): void {
    this.settings = {
      ...this.settings,
      ...newSettings,
    }
  }
}
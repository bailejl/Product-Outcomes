import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm'
import { OKR } from './okr'
import { User } from './user'

export enum CommentType {
  GENERAL = 'general',
  PROGRESS_UPDATE = 'progress_update',
  CONCERN = 'concern',
  QUESTION = 'question',
  MILESTONE = 'milestone',
  BLOCKER = 'blocker',
}

@Entity('okr_comments')
@Index(['type'])
@Index(['createdAt'])
export class OKRComment {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 2000 })
  content: string

  @Column({
    type: 'enum',
    enum: CommentType,
    default: CommentType.GENERAL,
  })
  type: CommentType

  @Column({ name: 'is_resolved', default: false })
  isResolved: boolean

  @Column({ name: 'is_edited', default: false })
  isEdited: boolean

  @Column({ name: 'edit_reason', length: 255, nullable: true })
  editReason?: string

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    mentions?: string[] // User IDs mentioned in the comment
    attachments?: Array<{
      id: string
      fileName: string
      fileUrl: string
      fileSize: number
      mimeType: string
    }>
    reactions?: Array<{
      userId: string
      emoji: string
      timestamp: Date
    }>
    tags?: string[]
    priority?: 'low' | 'medium' | 'high' | 'urgent'
  }

  @ManyToOne(() => OKR, okr => okr.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'okr_id' })
  okr: OKR

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'author_id' })
  author: User

  @ManyToOne(() => OKRComment, { nullable: true })
  @JoinColumn({ name: 'parent_comment_id' })
  parentComment?: OKRComment

  @OneToMany(() => OKRComment, comment => comment.parentComment, { lazy: true })
  replies: Promise<OKRComment[]>

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  // Computed properties
  get isReply(): boolean {
    return !!this.parentComment
  }

  get hasReplies(): Promise<boolean> {
    return this.replies.then(replies => replies.length > 0)
  }

  get replyCount(): Promise<number> {
    return this.replies.then(replies => replies.length)
  }

  get isQuestionType(): boolean {
    return this.type === CommentType.QUESTION
  }

  get isConcernType(): boolean {
    return this.type === CommentType.CONCERN
  }

  get isBlockerType(): boolean {
    return this.type === CommentType.BLOCKER
  }

  get needsAttention(): boolean {
    return (
      this.isQuestionType ||
      this.isConcernType ||
      this.isBlockerType
    ) && !this.isResolved
  }

  // Check if user can edit this comment
  canUserEdit(userId: string): boolean {
    return this.author.id === userId
  }

  // Check if user can resolve this comment
  canUserResolve(userId: string, okrOwnerId: string): boolean {
    return this.author.id === userId || userId === okrOwnerId
  }

  // Resolve comment
  resolve(): void {
    this.isResolved = true
  }

  // Unresolve comment
  unresolve(): void {
    this.isResolved = false
  }

  // Edit comment
  edit(newContent: string, reason?: string): void {
    this.content = newContent
    this.isEdited = true
    this.editReason = reason
  }

  // Add reaction
  addReaction(userId: string, emoji: string): void {
    if (!this.metadata) this.metadata = {}
    if (!this.metadata.reactions) this.metadata.reactions = []
    
    // Remove existing reaction from this user with same emoji
    this.metadata.reactions = this.metadata.reactions.filter(
      r => !(r.userId === userId && r.emoji === emoji)
    )
    
    // Add new reaction
    this.metadata.reactions.push({
      userId,
      emoji,
      timestamp: new Date(),
    })
  }

  // Remove reaction
  removeReaction(userId: string, emoji: string): void {
    if (!this.metadata?.reactions) return
    
    this.metadata.reactions = this.metadata.reactions.filter(
      r => !(r.userId === userId && r.emoji === emoji)
    )
  }

  // Get reactions grouped by emoji
  getReactionsSummary(): Array<{ emoji: string; count: number; users: string[] }> {
    if (!this.metadata?.reactions) return []
    
    const reactionMap = new Map<string, string[]>()
    
    this.metadata.reactions.forEach(reaction => {
      const users = reactionMap.get(reaction.emoji) || []
      users.push(reaction.userId)
      reactionMap.set(reaction.emoji, users)
    })
    
    return Array.from(reactionMap.entries()).map(([emoji, users]) => ({
      emoji,
      count: users.length,
      users,
    }))
  }

  // Add mention
  addMention(userId: string): void {
    if (!this.metadata) this.metadata = {}
    if (!this.metadata.mentions) this.metadata.mentions = []
    
    if (!this.metadata.mentions.includes(userId)) {
      this.metadata.mentions.push(userId)
    }
  }

  // Add attachment
  addAttachment(fileName: string, fileUrl: string, fileSize: number, mimeType: string): void {
    if (!this.metadata) this.metadata = {}
    if (!this.metadata.attachments) this.metadata.attachments = []
    
    this.metadata.attachments.push({
      id: crypto.randomUUID(),
      fileName,
      fileUrl,
      fileSize,
      mimeType,
    })
  }

  // Update metadata
  updateMetadata(newMetadata: Partial<typeof OKRComment.prototype.metadata>): void {
    this.metadata = {
      ...this.metadata,
      ...newMetadata,
    }
  }
}
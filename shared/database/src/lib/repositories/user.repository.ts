import { Repository } from 'typeorm'
import { User, UserRole } from '../entities/user'
import { AppDataSource } from '../database'

export class UserRepository {
  private repository: Repository<User>

  constructor() {
    this.repository = AppDataSource.getRepository(User)
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return await this.repository.findOne({
      where: { email: email.toLowerCase() },
    })
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    return await this.repository.findOne({
      where: { id },
    })
  }

  /**
   * Find user by email verification token
   */
  async findByEmailVerificationToken(token: string): Promise<User | null> {
    return await this.repository.findOne({
      where: { emailVerificationToken: token },
    })
  }

  /**
   * Find user by password reset token
   */
  async findByPasswordResetToken(token: string): Promise<User | null> {
    return await this.repository.findOne({
      where: { passwordResetToken: token },
    })
  }

  /**
   * Create a new user
   */
  async create(
    userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<User> {
    // Check if user with email already exists
    const existingUser = await this.findByEmail(userData.email)
    if (existingUser) {
      throw new Error('User with this email already exists')
    }

    const user = this.repository.create({
      ...userData,
      email: userData.email.toLowerCase(),
    })

    return await this.repository.save(user)
  }

  /**
   * Update user
   */
  async update(id: string, updates: Partial<User>): Promise<User> {
    const user = await this.findById(id)
    if (!user) {
      throw new Error('User not found')
    }

    // If email is being updated, check for uniqueness
    if (updates.email && updates.email !== user.email) {
      const existingUser = await this.findByEmail(updates.email)
      if (existingUser) {
        throw new Error('User with this email already exists')
      }
      updates.email = updates.email.toLowerCase()
    }

    Object.assign(user, updates)
    return await this.repository.save(user)
  }

  /**
   * Delete user (soft delete by setting isActive to false)
   */
  async softDelete(id: string): Promise<void> {
    await this.update(id, { isActive: false })
  }

  /**
   * Hard delete user
   */
  async delete(id: string): Promise<void> {
    const result = await this.repository.delete(id)
    if (result.affected === 0) {
      throw new Error('User not found')
    }
  }

  /**
   * Find all users with pagination
   */
  async findAll(
    options: {
      page?: number
      limit?: number
      role?: UserRole
      isActive?: boolean
      searchTerm?: string
    } = {}
  ): Promise<{
    users: User[]
    total: number
    page: number
    totalPages: number
  }> {
    const { page = 1, limit = 10, role, isActive, searchTerm } = options

    const queryBuilder = this.repository.createQueryBuilder('user')

    // Apply filters
    if (role) {
      queryBuilder.andWhere('user.role = :role', { role })
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive })
    }

    if (searchTerm) {
      queryBuilder.andWhere(
        '(user.firstName ILIKE :searchTerm OR user.lastName ILIKE :searchTerm OR user.email ILIKE :searchTerm)',
        { searchTerm: `%${searchTerm}%` }
      )
    }

    // Get total count
    const total = await queryBuilder.getCount()

    // Apply pagination
    const offset = (page - 1) * limit
    queryBuilder.orderBy('user.createdAt', 'DESC').skip(offset).take(limit)

    const users = await queryBuilder.getMany()

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Update last login time
   */
  async updateLastLogin(id: string): Promise<void> {
    const user = await this.findById(id)
    if (user) {
      user.resetLoginAttempts()
      await this.repository.save(user)
    }
  }

  /**
   * Increment login attempts
   */
  async incrementLoginAttempts(email: string): Promise<void> {
    const user = await this.findByEmail(email)
    if (user) {
      user.incrementLoginAttempts()
      await this.repository.save(user)
    }
  }

  /**
   * Verify user email
   */
  async verifyEmail(token: string): Promise<User> {
    const user = await this.findByEmailVerificationToken(token)
    if (!user) {
      throw new Error('Invalid email verification token')
    }

    user.verifyEmail()
    return await this.repository.save(user)
  }

  /**
   * Change user password with reset token
   */
  async resetPassword(token: string, newPassword: string): Promise<User> {
    const user = await this.findByPasswordResetToken(token)
    if (!user || !user.isPasswordResetTokenValid(token)) {
      throw new Error('Invalid or expired password reset token')
    }

    user.password = newPassword // Should be hashed by the service layer
    user.clearPasswordResetToken()
    return await this.repository.save(user)
  }

  /**
   * Get user statistics
   */
  async getStatistics(): Promise<{
    totalUsers: number
    activeUsers: number
    verifiedUsers: number
    adminUsers: number
    recentRegistrations: number
  }> {
    const totalUsers = await this.repository.count()
    const activeUsers = await this.repository.count({
      where: { isActive: true },
    })
    const verifiedUsers = await this.repository.count({
      where: { emailVerified: true },
    })
    const adminUsers = await this.repository.count({
      where: { role: UserRole.ADMIN },
    })

    // Users registered in the last 7 days
    const lastWeek = new Date()
    lastWeek.setDate(lastWeek.getDate() - 7)
    const recentRegistrations = await this.repository.count({
      where: {
        createdAt: { $gte: lastWeek } as any,
      },
    })

    return {
      totalUsers,
      activeUsers,
      verifiedUsers,
      adminUsers,
      recentRegistrations,
    }
  }

  /**
   * Find users by role
   */
  async findByRole(role: UserRole): Promise<User[]> {
    return await this.repository.find({
      where: { role, isActive: true },
      order: { createdAt: 'DESC' },
    })
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const user = await this.findByEmail(email)
    return !!user
  }
}

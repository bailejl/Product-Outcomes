import { MigrationInterface, QueryRunner, Table, Index, ForeignKey } from 'typeorm'

export class AddRbacSystem1701000000001 implements MigrationInterface {
  name = 'AddRbacSystem1701000000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create user_roles table
    await queryRunner.createTable(
      new Table({
        name: 'user_roles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isUnique: true,
          },
          {
            name: 'description',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'permissions',
            type: 'text[]',
            default: "'{}'",
          },
          {
            name: 'is_system_role',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    )

    // Create index on role name
    await queryRunner.createIndex(
      'user_roles',
      {
        name: 'IDX_user_roles_name',
        columnNames: ['name'],
        isUnique: true,
      } as Index
    )

    // Create user_role_assignments junction table
    await queryRunner.createTable(
      new Table({
        name: 'user_role_assignments',
        columns: [
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'role_id',
            type: 'uuid',
          },
          {
            name: 'assigned_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'assigned_by',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true
    )

    // Create composite primary key for user_role_assignments
    await queryRunner.createPrimaryKey('user_role_assignments', ['user_id', 'role_id'])

    // Create foreign key constraints
    await queryRunner.createForeignKey(
      'user_role_assignments',
      new ForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      })
    )

    await queryRunner.createForeignKey(
      'user_role_assignments',
      new ForeignKey({
        columnNames: ['role_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user_roles',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      })
    )

    await queryRunner.createForeignKey(
      'user_role_assignments',
      new ForeignKey({
        columnNames: ['assigned_by'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      })
    )

    // Modify users table to add new role-related columns
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN "legacy_role" varchar CHECK ("legacy_role" IN ('admin', 'user', 'moderator')) DEFAULT 'user'
    `)

    // Update existing legacy_role column to be nullable
    await queryRunner.query(`
      ALTER TABLE "users" 
      ALTER COLUMN "legacy_role" DROP NOT NULL
    `)

    // Insert default system roles
    await queryRunner.query(`
      INSERT INTO "user_roles" (name, description, permissions, is_system_role, is_active) VALUES
      (
        'Administrator',
        'Full system access with all permissions',
        ARRAY[
          'create:user', 'read:user', 'update:user', 'delete:user',
          'create:role', 'read:role', 'update:role', 'delete:role', 'assign:role',
          'create:message', 'read:message', 'update:message', 'delete:message', 'moderate:message',
          'system:config', 'system:logs', 'system:backup',
          'create:organization', 'read:organization', 'update:organization', 'delete:organization',
          'view:reports', 'export:data'
        ],
        true,
        true
      ),
      (
        'Moderator',
        'Content moderation and user management capabilities',
        ARRAY[
          'read:user', 'update:user',
          'read:message', 'update:message', 'delete:message', 'moderate:message',
          'view:reports'
        ],
        true,
        true
      ),
      (
        'User',
        'Standard user with basic permissions',
        ARRAY[
          'read:user', 'update:user',
          'create:message', 'read:message', 'update:message'
        ],
        true,
        true
      ),
      (
        'Viewer',
        'Read-only access to system',
        ARRAY[
          'read:user', 'read:message'
        ],
        true,
        true
      )
    `)

    // Migrate existing users to the new role system
    await queryRunner.query(`
      INSERT INTO "user_role_assignments" (user_id, role_id)
      SELECT 
        u.id,
        r.id
      FROM "users" u
      CROSS JOIN "user_roles" r
      WHERE 
        (u.role = 'admin' AND r.name = 'Administrator') OR
        (u.role = 'moderator' AND r.name = 'Moderator') OR
        (u.role = 'user' AND r.name = 'User')
    `)

    // Update users table to set legacy_role based on existing role
    await queryRunner.query(`
      UPDATE "users" 
      SET "legacy_role" = "role"
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraints
    const table = await queryRunner.getTable('user_role_assignments')
    if (table) {
      const foreignKeys = table.foreignKeys
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('user_role_assignments', foreignKey)
      }
    }

    // Drop tables
    await queryRunner.dropTable('user_role_assignments', true)
    await queryRunner.dropTable('user_roles', true)

    // Remove new columns from users table
    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN IF EXISTS "legacy_role"
    `)
  }
}
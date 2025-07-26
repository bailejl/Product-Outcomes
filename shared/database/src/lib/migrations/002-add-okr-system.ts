import { MigrationInterface, QueryRunner, Table, ForeignKey, Index } from 'typeorm'

export class AddOKRSystem1732638000000 implements MigrationInterface {
  name = 'AddOKRSystem1732638000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create organizations table
    await queryRunner.createTable(
      new Table({
        name: 'organizations',
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
            length: '255',
            isUnique: true,
          },
          {
            name: 'slug',
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
            name: 'website_url',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'logo_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'inactive', 'pending', 'suspended'],
            default: "'active'",
          },
          {
            name: 'max_members',
            type: 'integer',
            default: 100,
          },
          {
            name: 'subscription_tier',
            type: 'varchar',
            length: '50',
            default: "'basic'",
          },
          {
            name: 'subscription_expires_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'settings',
            type: 'jsonb',
            isNullable: true,
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
        indices: [
          new Index('IDX_organizations_name', ['name']),
          new Index('IDX_organizations_slug', ['slug']),
          new Index('IDX_organizations_status', ['status']),
        ],
      }),
      true
    )

    // Create organization_members junction table
    await queryRunner.createTable(
      new Table({
        name: 'organization_members',
        columns: [
          {
            name: 'organization_id',
            type: 'uuid',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'joined_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          new Index('IDX_organization_members_org_user', ['organization_id', 'user_id'], { isUnique: true }),
        ],
      }),
      true
    )

    // Create foreign keys for organization_members
    await queryRunner.createForeignKey(
      'organization_members',
      new ForeignKey({
        columnNames: ['organization_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
      })
    )

    await queryRunner.createForeignKey(
      'organization_members',
      new ForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      })
    )

    // Create OKRs table
    await queryRunner.createTable(
      new Table({
        name: 'okrs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'description',
            type: 'varchar',
            length: '1000',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['draft', 'active', 'paused', 'completed', 'cancelled'],
            default: "'draft'",
          },
          {
            name: 'period',
            type: 'enum',
            enum: ['quarterly', 'annual', 'custom'],
            default: "'quarterly'",
          },
          {
            name: 'visibility',
            type: 'enum',
            enum: ['public', 'organization', 'team', 'private'],
            default: "'organization'",
          },
          {
            name: 'start_date',
            type: 'date',
          },
          {
            name: 'end_date',
            type: 'date',
          },
          {
            name: 'progress',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'target_progress',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 100,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'owner_id',
            type: 'uuid',
          },
          {
            name: 'organization_id',
            type: 'uuid',
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
        indices: [
          new Index('IDX_okrs_title', ['title']),
          new Index('IDX_okrs_status', ['status']),
          new Index('IDX_okrs_period', ['period']),
          new Index('IDX_okrs_visibility', ['visibility']),
          new Index('IDX_okrs_dates', ['start_date', 'end_date']),
          new Index('IDX_okrs_owner', ['owner_id']),
          new Index('IDX_okrs_organization', ['organization_id']),
        ],
      }),
      true
    )

    // Create foreign keys for OKRs
    await queryRunner.createForeignKey(
      'okrs',
      new ForeignKey({
        columnNames: ['owner_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      })
    )

    await queryRunner.createForeignKey(
      'okrs',
      new ForeignKey({
        columnNames: ['organization_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
      })
    )

    // Create key_results table
    await queryRunner.createTable(
      new Table({
        name: 'key_results',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'description',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['numeric', 'percentage', 'boolean', 'milestone'],
            default: "'numeric'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['not_started', 'in_progress', 'completed', 'at_risk', 'blocked'],
            default: "'not_started'",
          },
          {
            name: 'start_value',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'target_value',
            type: 'decimal',
            precision: 15,
            scale: 2,
          },
          {
            name: 'current_value',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'unit',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'due_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'okr_id',
            type: 'uuid',
          },
          {
            name: 'assignee_id',
            type: 'uuid',
            isNullable: true,
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
        indices: [
          new Index('IDX_key_results_title', ['title']),
          new Index('IDX_key_results_status', ['status']),
          new Index('IDX_key_results_type', ['type']),
          new Index('IDX_key_results_okr', ['okr_id']),
          new Index('IDX_key_results_assignee', ['assignee_id']),
        ],
      }),
      true
    )

    // Create foreign keys for key_results
    await queryRunner.createForeignKey(
      'key_results',
      new ForeignKey({
        columnNames: ['okr_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'okrs',
        onDelete: 'CASCADE',
      })
    )

    await queryRunner.createForeignKey(
      'key_results',
      new ForeignKey({
        columnNames: ['assignee_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      })
    )

    // Create okr_comments table
    await queryRunner.createTable(
      new Table({
        name: 'okr_comments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'content',
            type: 'varchar',
            length: '2000',
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['general', 'progress_update', 'concern', 'question', 'milestone', 'blocker'],
            default: "'general'",
          },
          {
            name: 'is_resolved',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_edited',
            type: 'boolean',
            default: false,
          },
          {
            name: 'edit_reason',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'okr_id',
            type: 'uuid',
          },
          {
            name: 'author_id',
            type: 'uuid',
          },
          {
            name: 'parent_comment_id',
            type: 'uuid',
            isNullable: true,
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
        indices: [
          new Index('IDX_okr_comments_type', ['type']),
          new Index('IDX_okr_comments_created_at', ['created_at']),
          new Index('IDX_okr_comments_okr', ['okr_id']),
          new Index('IDX_okr_comments_author', ['author_id']),
          new Index('IDX_okr_comments_parent', ['parent_comment_id']),
        ],
      }),
      true
    )

    // Create foreign keys for okr_comments
    await queryRunner.createForeignKey(
      'okr_comments',
      new ForeignKey({
        columnNames: ['okr_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'okrs',
        onDelete: 'CASCADE',
      })
    )

    await queryRunner.createForeignKey(
      'okr_comments',
      new ForeignKey({
        columnNames: ['author_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      })
    )

    await queryRunner.createForeignKey(
      'okr_comments',
      new ForeignKey({
        columnNames: ['parent_comment_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'okr_comments',
        onDelete: 'CASCADE',
      })
    )

    // Create updated_at triggers for automatic timestamp updates
    const tables = ['organizations', 'okrs', 'key_results', 'okr_comments']
    
    for (const table of tables) {
      await queryRunner.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `)

      await queryRunner.query(`
        CREATE TRIGGER update_${table}_updated_at 
        BEFORE UPDATE ON ${table} 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers first
    const tables = ['organizations', 'okrs', 'key_results', 'okr_comments']
    
    for (const table of tables) {
      await queryRunner.query(`DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};`)
    }
    
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column();`)

    // Drop tables in reverse order due to foreign key constraints
    await queryRunner.dropTable('okr_comments')
    await queryRunner.dropTable('key_results')
    await queryRunner.dropTable('okrs')
    await queryRunner.dropTable('organization_members')
    await queryRunner.dropTable('organizations')
  }
}
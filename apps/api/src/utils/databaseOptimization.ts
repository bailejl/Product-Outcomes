import { DataSource, QueryRunner } from 'typeorm'
import { AppDataSource } from '@product-outcomes/database'

interface QueryAnalysis {
  query: string
  executionTime: number
  rowsAffected: number
  planCost: number
  indexesUsed: string[]
  recommendations: string[]
}

interface IndexRecommendation {
  table: string
  columns: string[]
  type: 'btree' | 'hash' | 'gin' | 'gist'
  reason: string
  estimatedImprovement: string
}

export class DatabaseOptimizer {
  private dataSource: DataSource
  private queryStats = new Map<string, QueryAnalysis[]>()

  constructor(dataSource: DataSource = AppDataSource) {
    this.dataSource = dataSource
  }

  /**
   * Analyze query performance and suggest optimizations
   */
  async analyzeQuery(query: string, parameters?: any[]): Promise<QueryAnalysis> {
    const queryRunner = this.dataSource.createQueryRunner()
    
    try {
      await queryRunner.connect()
      
      // Get query execution plan
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`
      const startTime = Date.now()
      
      const [planResult] = await queryRunner.query(explainQuery, parameters)
      const executionTime = Date.now() - startTime
      
      const plan = planResult['QUERY PLAN'][0]
      
      // Extract performance metrics
      const analysis: QueryAnalysis = {
        query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
        executionTime,
        rowsAffected: plan['Plan']['Actual Rows'] || 0,
        planCost: plan['Plan']['Total Cost'] || 0,
        indexesUsed: this.extractIndexesFromPlan(plan),
        recommendations: this.generateRecommendations(plan, query)
      }

      // Store for tracking
      const queryHash = this.hashQuery(query)
      if (!this.queryStats.has(queryHash)) {
        this.queryStats.set(queryHash, [])
      }
      this.queryStats.get(queryHash)!.push(analysis)

      return analysis
    } finally {
      await queryRunner.release()
    }
  }

  /**
   * Get slow query recommendations
   */
  async getSlowQueryRecommendations(thresholdMs = 1000): Promise<QueryAnalysis[]> {
    const slowQueries: QueryAnalysis[] = []
    
    for (const analyses of this.queryStats.values()) {
      const avgTime = analyses.reduce((sum, a) => sum + a.executionTime, 0) / analyses.length
      if (avgTime > thresholdMs) {
        slowQueries.push(analyses[analyses.length - 1]) // Get latest analysis
      }
    }
    
    return slowQueries.sort((a, b) => b.executionTime - a.executionTime)
  }

  /**
   * Analyze database indexes and suggest improvements
   */
  async analyzeIndexes(): Promise<IndexRecommendation[]> {
    const queryRunner = this.dataSource.createQueryRunner()
    const recommendations: IndexRecommendation[] = []
    
    try {
      await queryRunner.connect()
      
      // Get unused indexes
      const unusedIndexes = await queryRunner.query(`
        SELECT 
          schemaname, tablename, indexname, idx_scan
        FROM pg_stat_user_indexes 
        WHERE idx_scan = 0 AND schemaname = 'public'
      `)

      // Get table stats for missing indexes
      const tableStats = await queryRunner.query(`
        SELECT 
          schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del, seq_scan, idx_scan
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
      `)

      // Analyze missing indexes on frequently queried tables
      for (const table of tableStats) {
        if (table.seq_scan > table.idx_scan && table.seq_scan > 1000) {
          // This table has many sequential scans, might need indexes
          const missingIndexes = await this.findMissingIndexes(table.tablename, queryRunner)
          recommendations.push(...missingIndexes)
        }
      }

      // Check for duplicate indexes
      const duplicateIndexes = await queryRunner.query(`
        SELECT 
          t1.tablename,
          t1.indexname as index1,
          t2.indexname as index2,
          t1.indexdef,
          t2.indexdef
        FROM pg_indexes t1
        JOIN pg_indexes t2 ON t1.tablename = t2.tablename 
        WHERE t1.indexname < t2.indexname
        AND t1.indexdef = t2.indexdef
        AND t1.schemaname = 'public'
      `)

      // Add recommendations for duplicate index removal
      for (const dup of duplicateIndexes) {
        recommendations.push({
          table: dup.tablename,
          columns: [],
          type: 'btree',
          reason: `Duplicate index detected: ${dup.index1} and ${dup.index2} are identical`,
          estimatedImprovement: 'Reduced storage and maintenance overhead'
        })
      }

      return recommendations
      
    } finally {
      await queryRunner.release()
    }
  }

  /**
   * Get database performance metrics
   */
  async getDatabaseMetrics(): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner()
    
    try {
      await queryRunner.connect()
      
      // Database size and connection stats
      const [dbStats] = await queryRunner.query(`
        SELECT 
          pg_database_size(current_database()) as database_size,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections
      `)

      // Table sizes and statistics
      const tableStats = await queryRunner.query(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
          pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `)

      // Index usage statistics
      const indexStats = await queryRunner.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan as index_scans,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched,
          pg_size_pretty(pg_relation_size(indexrelid)) as index_size
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC
      `)

      // Query performance stats
      const queryPerformance = await queryRunner.query(`
        SELECT 
          query,
          calls,
          total_time,
          rows,
          100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
        FROM pg_stat_statements 
        WHERE query NOT LIKE '%pg_stat_statements%'
        ORDER BY total_time DESC
        LIMIT 20
      `)

      return {
        database: dbStats,
        tables: tableStats,
        indexes: indexStats,
        topQueries: queryPerformance,
        metrics: {
          totalQueries: this.queryStats.size,
          avgQueryTime: this.getAverageQueryTime(),
          slowQueries: await this.getSlowQueryRecommendations(1000)
        }
      }
      
    } catch (error) {
      console.error('Error getting database metrics:', error)
      return {
        error: 'Unable to retrieve database metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    } finally {
      await queryRunner.release()
    }
  }

  /**
   * Optimize database for better performance
   */
  async optimizeDatabase(): Promise<string[]> {
    const queryRunner = this.dataSource.createQueryRunner()
    const optimizations: string[] = []
    
    try {
      await queryRunner.connect()
      
      // Update table statistics
      await queryRunner.query('ANALYZE')
      optimizations.push('Updated table statistics with ANALYZE')
      
      // Vacuum tables with high dead tuple ratio
      const vacuumCandidates = await queryRunner.query(`
        SELECT tablename 
        FROM pg_stat_user_tables 
        WHERE n_dead_tup > n_live_tup * 0.1 
        AND n_dead_tup > 1000
        AND schemaname = 'public'
      `)
      
      for (const table of vacuumCandidates) {
        await queryRunner.query(`VACUUM ANALYZE ${table.tablename}`)
        optimizations.push(`Vacuumed table: ${table.tablename}`)
      }
      
      // Check for missing primary key constraints
      const tablesWithoutPK = await queryRunner.query(`
        SELECT t.table_name
        FROM information_schema.tables t
        LEFT JOIN information_schema.table_constraints tc 
          ON t.table_name = tc.table_name 
          AND tc.constraint_type = 'PRIMARY KEY'
        WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
        AND tc.constraint_name IS NULL
      `)
      
      for (const table of tablesWithoutPK) {
        optimizations.push(`WARNING: Table ${table.table_name} lacks a primary key`)
      }
      
      return optimizations
      
    } finally {
      await queryRunner.release()
    }
  }

  /**
   * Monitor database connection pool
   */
  getConnectionPoolMetrics() {
    const options = this.dataSource.options as any
    
    return {
      maxConnections: options.extra?.max || 10,
      activeConnections: this.dataSource.isInitialized ? 1 : 0, // Simplified
      idleConnections: 0, // Would need connection pool implementation details
      waitingConnections: 0,
      poolSize: options.extra?.connectionLimit || 10
    }
  }

  private extractIndexesFromPlan(plan: any): string[] {
    const indexes: string[] = []
    
    const extractFromNode = (node: any) => {
      if (node['Index Name']) {
        indexes.push(node['Index Name'])
      }
      if (node['Plans']) {
        node['Plans'].forEach(extractFromNode)
      }
    }
    
    extractFromNode(plan['Plan'])
    return indexes
  }

  private generateRecommendations(plan: any, query: string): string[] {
    const recommendations: string[] = []
    const planNode = plan['Plan']
    
    // Check for sequential scans on large tables
    if (planNode['Node Type'] === 'Seq Scan' && planNode['Actual Rows'] > 1000) {
      recommendations.push('Consider adding an index for this sequential scan')
    }
    
    // Check for nested loops with high cost
    if (planNode['Node Type'] === 'Nested Loop' && planNode['Total Cost'] > 1000) {
      recommendations.push('Nested loop join is expensive, consider index optimization')
    }
    
    // Check for hash joins on large datasets
    if (planNode['Node Type'] === 'Hash Join' && planNode['Actual Rows'] > 10000) {
      recommendations.push('Large hash join detected, ensure proper indexes exist')
    }
    
    // Check execution time
    if (planNode['Actual Total Time'] > 1000) {
      recommendations.push('Query execution time is high, consider optimization')
    }
    
    // Check for sorts without limits
    if (query.toLowerCase().includes('order by') && !query.toLowerCase().includes('limit')) {
      recommendations.push('ORDER BY without LIMIT can be expensive on large datasets')
    }
    
    return recommendations
  }

  private async findMissingIndexes(tableName: string, queryRunner: QueryRunner): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = []
    
    try {
      // Get foreign key columns (common candidates for indexes)
      const foreignKeys = await queryRunner.query(`
        SELECT 
          kcu.column_name
        FROM information_schema.key_column_usage kcu
        JOIN information_schema.referential_constraints rc 
          ON kcu.constraint_name = rc.constraint_name
        WHERE kcu.table_name = $1
        AND kcu.table_schema = 'public'
      `, [tableName])
      
      for (const fk of foreignKeys) {
        // Check if index exists for this FK
        const existingIndex = await queryRunner.query(`
          SELECT indexname 
          FROM pg_indexes 
          WHERE tablename = $1 
          AND indexdef ILIKE '%' || $2 || '%'
        `, [tableName, fk.column_name])
        
        if (existingIndex.length === 0) {
          recommendations.push({
            table: tableName,
            columns: [fk.column_name],
            type: 'btree',
            reason: `Foreign key column ${fk.column_name} lacks an index`,
            estimatedImprovement: 'Faster JOIN operations and foreign key lookups'
          })
        }
      }
      
      // Check for commonly filtered columns (created_at, updated_at, status, etc.)
      const commonColumns = ['created_at', 'updated_at', 'status', 'active', 'deleted_at']
      for (const column of commonColumns) {
        const columnExists = await queryRunner.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = $2
          AND table_schema = 'public'
        `, [tableName, column])
        
        if (columnExists.length > 0) {
          const existingIndex = await queryRunner.query(`
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = $1 
            AND indexdef ILIKE '%' || $2 || '%'
          `, [tableName, column])
          
          if (existingIndex.length === 0) {
            recommendations.push({
              table: tableName,
              columns: [column],
              type: 'btree',
              reason: `Commonly filtered column ${column} might benefit from an index`,
              estimatedImprovement: 'Faster filtering and sorting operations'
            })
          }
        }
      }
      
    } catch (error) {
      console.error(`Error analyzing missing indexes for ${tableName}:`, error)
    }
    
    return recommendations
  }

  private hashQuery(query: string): string {
    // Simple hash function for query normalization
    return query
      .replace(/\s+/g, ' ')
      .replace(/\$\d+/g, '?')
      .trim()
      .toLowerCase()
  }

  private getAverageQueryTime(): number {
    let totalTime = 0
    let totalQueries = 0
    
    for (const analyses of this.queryStats.values()) {
      for (const analysis of analyses) {
        totalTime += analysis.executionTime
        totalQueries++
      }
    }
    
    return totalQueries > 0 ? totalTime / totalQueries : 0
  }
}

// Export singleton instance
export const databaseOptimizer = new DatabaseOptimizer()

// Database health check utilities
export const databaseHealthCheck = {
  async checkConnection(): Promise<boolean> {
    try {
      await AppDataSource.query('SELECT 1')
      return true
    } catch (error) {
      console.error('Database connection failed:', error)
      return false
    }
  },

  async checkDiskSpace(): Promise<{ available: string; used: string; percentage: number }> {
    try {
      const [result] = await AppDataSource.query(`
        SELECT 
          pg_size_pretty(pg_database_size(current_database())) as used,
          pg_size_pretty(pg_tablespace_size('pg_default')) as available
      `)
      
      return {
        used: result.used,
        available: result.available,
        percentage: 0 // Would need additional calculation
      }
    } catch (error) {
      console.error('Disk space check failed:', error)
      return { available: 'unknown', used: 'unknown', percentage: 0 }
    }
  },

  async checkReplicationLag(): Promise<number> {
    try {
      // Only applicable if using replication
      const [result] = await AppDataSource.query(`
        SELECT 
          CASE 
            WHEN pg_is_in_recovery() THEN 
              EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))
            ELSE 0 
          END as lag_seconds
      `)
      
      return result.lag_seconds || 0
    } catch (error) {
      console.error('Replication lag check failed:', error)
      return 0
    }
  }
}
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log('🚀 [Migration] Connecting to MySQL server...');
  
  const host = process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '3306', 10);
  const user = process.env.DATABASE_USER || process.env.DB_USER || 'cf_user';
  const password = process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'cf_password';
  const database = process.env.DATABASE_NAME || process.env.DB_NAME || 'campaignflow';

  let connection;
  try {
    // Connect without database first to ensure database exists
    connection = await mysql.createConnection({ host, port, user, password });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.changeUser({ database });
    console.log(`✅ [Migration] Using database "${database}"`);

    // Ensure migration tracking table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const [rows] = await connection.query('SELECT id FROM schema_migrations WHERE migration_name = ?', [file]);
      if (rows.length > 0) {
        console.log(`⏩ [Migration] Skipping already applied: ${file}`);
        continue;
      }

      console.log(`▶️ [Migration] Applying: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');

      // Split queries while respecting comments
      const statements = sqlContent
        .replace(/--.*$/gm, '') // Remove single-line comments
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        try {
          await connection.query(statement);
        } catch (stmtErr) {
          if (stmtErr.errno === 1060 || stmtErr.errno === 1061) {
            // Safe to ignore duplicate column or duplicate key error
            continue;
          }
          throw stmtErr;
        }
      }

      await connection.query('INSERT INTO schema_migrations (migration_name) VALUES (?)', [file]);
      console.log(`✅ [Migration] Successfully applied: ${file}`);
    }

    console.log('🎉 [Migration] All migrations completed successfully.');
  } catch (error) {
    console.error('❌ [Migration] Failed to execute migrations:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

runMigrations();

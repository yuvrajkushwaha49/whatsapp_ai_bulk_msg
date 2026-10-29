import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const poolConfig = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '3306', 10),
  user: process.env.DATABASE_USER || 'cf_user',
  password: process.env.DATABASE_PASSWORD || 'cf_password',
  database: process.env.DATABASE_NAME || 'campaignflow',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DATABASE_CONNECTION_LIMIT || '10', 10),
  queueLimit: 0,
  charset: 'utf8mb4'
};

let pool = null;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool(poolConfig);
  }
  return pool;
}

/**
 * Execute parameterized query with automatic pool resolution
 */
export async function query(sql, params = []) {
  const p = getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

/**
 * Execute callback within a database transaction
 */
export async function withTransaction(callback) {
  const p = getPool();
  const connection = await p.getConnection();
  await connection.beginTransaction();
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export default {
  getPool,
  query,
  withTransaction
};

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const redis = require('redis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Redis Client Setup
const redisClient = redis.createClient({
  url: process.env.REDIS_URL
});
redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().catch(console.error);

// API Rate Limiting Setup
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { success: false, error: 'Too many requests, please try again later.' }
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
app.use('/api/', apiLimiter); // Protect all /api routes

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Product Browser API is running'
  });
});

// Products route with Redis Caching, Category Filter, FTS, and Cursor Pagination
app.get('/api/products', async (req, res) => {
  try {
    const { category, limit = 20, cursor, search } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 20, 100);

    // 1. Generate unique Redis cache key
    const cacheKey = `products:${category || 'all'}:${limit}:${cursor || 'first'}:${search || 'none'}`;

    // 2. Check if response is already cached in Redis
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log('⚡ Serving fast from Redis Cache');
      return res.json(JSON.parse(cachedData));
    }

    console.log('🐘 Serving from PostgreSQL');
    let cursorTimestamp = null, cursorId = null, snapshotTime = null;

    if (cursor) {
      const parts = cursor.split('_');
      if (parts.length === 3) {
        cursorTimestamp = parts[0];
        cursorId = parseInt(parts[1]);
        snapshotTime = parts[2];
      }
    }
    if (!snapshotTime) snapshotTime = new Date().toISOString();

    let query = `
      SELECT id, name, category, price, created_at, updated_at
      FROM products
      WHERE updated_at <= $1
    `;
    const queryParams = [snapshotTime];

    // Category Filter
    if (category && category.trim() !== '') {
      queryParams.push(category);
      query += ` AND category = $${queryParams.length}`;
    }

    // Full-Text Search (FTS) Logic
    if (search && search.trim() !== '') {
      queryParams.push(search);
      query += ` AND to_tsvector('english', name) @@ plainto_tsquery('english', $${queryParams.length})`;
    }

    // Cursor Pagination Logic
    if (cursorTimestamp && cursorId) {
      queryParams.push(cursorTimestamp, cursorId);
      const timestampIndex = queryParams.length - 1;
      const idIndex = queryParams.length;
      query += ` AND (updated_at < $${timestampIndex} OR (updated_at = $${timestampIndex} AND id < $${idIndex}))`;
    }

    query += ` ORDER BY updated_at DESC, id DESC LIMIT $${queryParams.length + 1}`;
    
    // Add limit parameter
    queryParams.push(parsedLimit + 1);

    const { rows } = await pool.query(query, queryParams);
    const hasNextPage = rows.length > parsedLimit;
    const products = hasNextPage ? rows.slice(0, parsedLimit) : rows;

    let nextCursor = null;
    if (hasNextPage && products.length > 0) {
      const lastProduct = products[products.length - 1];
      const lastUpdatedAt = new Date(lastProduct.updated_at).toISOString();
      nextCursor = `${lastUpdatedAt}_${lastProduct.id}_${snapshotTime}`;
    }

    const responseData = { success: true, count: products.length, nextCursor, products };

    // 3. Save the result in Redis Cache for 1 hour (3600 seconds)
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(responseData));

    res.json(responseData);

  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API route not found'
  });
});
// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
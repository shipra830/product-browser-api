const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// This serves index.html and other static files from project root
app.use(express.static('.'));

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

// Products route with category filter and cursor pagination
app.get('/api/products', async (req, res) => {
  try {
    const { category, limit = 20, cursor } = req.query;

    // Limit is capped at 100 for safety
    const parsedLimit = Math.min(parseInt(limit) || 20, 100);

    let cursorTimestamp = null;
    let cursorId = null;
    let snapshotTime = null;

    // Cursor format:
    // lastProductUpdatedAt_lastProductId_snapshotTime
    if (cursor) {
      const parts = cursor.split('_');

      if (parts.length === 3) {
        cursorTimestamp = parts[0];
        cursorId = parseInt(parts[1]);
        snapshotTime = parts[2];
      }
    }

    // On the first request, create a stable snapshot time.
    // All next pages use the same snapshot time.
    if (!snapshotTime) {
      snapshotTime = new Date().toISOString();
    }

    let query = `
      SELECT id, name, category, price, created_at, updated_at
      FROM products
      WHERE updated_at <= $1
    `;

    const queryParams = [snapshotTime];

    // Category filter
    if (category && category.trim() !== '') {
      queryParams.push(category);
      query += ` AND category = $${queryParams.length}`;
    }

    // Cursor condition for next pages
    if (cursorTimestamp && cursorId) {
      queryParams.push(cursorTimestamp, cursorId);

      const timestampIndex = queryParams.length - 1;
      const idIndex = queryParams.length;

      query += `
        AND (
          updated_at < $${timestampIndex}
          OR (updated_at = $${timestampIndex} AND id < $${idIndex})
        )
      `;
    }

    query += `
      ORDER BY updated_at DESC, id DESC
      LIMIT $${queryParams.length + 1}
    `;

    // Fetch one extra record to check if next page exists
    queryParams.push(parsedLimit + 1);

    const { rows } = await pool.query(query, queryParams);

    const hasNextPage = rows.length > parsedLimit;
    const products = hasNextPage ? rows.slice(0, parsedLimit) : rows;

    let nextCursor = null;

    if (hasNextPage && products.length > 0) {
      const lastProduct = products[products.length - 1];
      const lastUpdatedAt = new Date(lastProduct.updated_at).toISOString();

      // Keep same snapshot time in next cursor
      nextCursor = `${lastUpdatedAt}_${lastProduct.id}_${snapshotTime}`;
    }

    res.json({
      success: true,
      count: products.length,
      nextCursor,
      products
    });

  } catch (err) {
    console.error('Database query error:', err);

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
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
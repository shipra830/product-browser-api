const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.')); 

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get('/api/products', async (req, res) => {
  try {
    const { category, limit = 20, cursor } = req.query;
    const parsedLimit = parseInt(limit);
    
    let query = `SELECT id, name, category, price, created_at FROM products WHERE 1=1`;
    let queryParams = [];

    if (category && category.trim() !== "") {
      queryParams.push(category);
      query += ` AND category = $${queryParams.length}`;
    }

    if (cursor) {
      const parts = cursor.split('_');
      if (parts.length === 2) {
        const cursorTimestamp = parts[0];
        const cursorId = parseInt(parts[1]);
        
        queryParams.push(cursorTimestamp, cursorId);
        const tsIndex = queryParams.length - 1;
        const idIndex = queryParams.length;
        
        query += ` AND (created_at < $${tsIndex} OR (created_at = $${tsIndex} AND id < $${idIndex}))`;
      }
    }

    query += ` ORDER BY created_at DESC, id DESC LIMIT $${queryParams.length + 1}`;
    queryParams.push(parsedLimit + 1);

    const { rows } = await pool.query(query, queryParams);
    
    const hasNextPage = rows.length > parsedLimit;
    const data = hasNextPage ? rows.slice(0, parsedLimit) : rows;
    
    let nextCursor = null;
    if (hasNextPage && data.length > 0) {
      const lastItem = data[data.length - 1];
      const ts = new Date(lastItem.created_at).toISOString();
      nextCursor = `${ts}_${lastItem.id}`;
    }

    res.json({
      success: true,
      count: data.length,
      nextCursor,
      products: data
    });

  } catch (err) {
    console.error("Database query error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
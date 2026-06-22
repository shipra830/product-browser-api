const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seedDatabase() {
  const categories = ['Electronics', 'Clothing', 'Books', 'Home & Kitchen', 'Sports & Outdoors'];
  const totalRecords = 200000;
  const batchSize = 10000;

  console.log("🚀 Database seeding started...");
  console.time("SeedingTime");

  console.log("🧹 Clearing old products...");
  await pool.query("TRUNCATE TABLE products RESTART IDENTITY;");

  for (let i = 0; i < totalRecords; i += batchSize) {
    let valueRows = [];
    
    for (let j = 0; j < batchSize; j++) {
      const globalId = i + j + 1;
      const name = `Premium Product ${globalId}`;
      const category = categories[Math.floor(Math.random() * categories.length)];
      const price = (Math.random() * 990 + 10).toFixed(2);
      const createdDate = new Date(
  Date.now() - (globalId * 60000)
);

let updatedDate = createdDate;

// 20% products ko updated dikhao
if (Math.random() < 0.2) {
  updatedDate = new Date(
    createdDate.getTime() +
    Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
  );
}

const createdAt = createdDate.toISOString();
const updatedAt = updatedDate.toISOString();
      const escapedName = name.replace(/'/g, "''");
      const escapedCategory = category.replace(/'/g, "''");
      
     valueRows.push(
  `('${escapedName}', '${escapedCategory}', ${price}, '${createdAt}', '${updatedAt}')`
);
    }

    const query = `INSERT INTO products (name, category, price, created_at, updated_at) VALUES ${valueRows.join(',')}`;
    await pool.query(query);
    console.log(`📦 Inserted batch: ${i + batchSize} / ${totalRecords}`);
  }

  console.timeEnd("SeedingTime");
  console.log("✅ Seeding completed successfully!");
  await pool.end();
}

seedDatabase().catch(async (err) => {
  console.error("❌ Seeding failed:", err);
  await pool.end();
  process.exit(1);
});
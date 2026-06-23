CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_updated_id
ON products (updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_products_category_updated_id
ON products (category, updated_at DESC, id DESC);
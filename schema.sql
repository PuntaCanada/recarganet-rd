-- RecargaNet RD · isolated, synthetic test orders only.
-- Apply manually in the Cloudflare D1 Console after creating a database.
CREATE TABLE IF NOT EXISTS demo_orders (
  id TEXT PRIMARY KEY,
  operator TEXT NOT NULL CHECK (operator IN ('Claro','Altice','Viva')),
  service_id INTEGER NOT NULL CHECK (service_id IN (1,2,3)),
  amount_dop INTEGER NOT NULL CHECK (amount_dop BETWEEN 25 AND 2000),
  test_phone TEXT NOT NULL CHECK (test_phone IN ('8095550005','8095550001','8095550002','8095550000')),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','success','rejected','pending','unknown')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT 'Demo record only; no payment or mobile credit'
);
CREATE INDEX IF NOT EXISTS idx_demo_orders_created ON demo_orders(created_at DESC);

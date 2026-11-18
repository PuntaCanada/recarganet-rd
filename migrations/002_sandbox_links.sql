-- RecargaNet RD D1 migration 002: sandbox transaction association.
-- RUN ONCE in Cloudflare D1 Console. Does not alter existing demo_orders rows.
CREATE TABLE IF NOT EXISTS sandbox_order_links (
  order_id TEXT PRIMARY KEY REFERENCES demo_orders(id),
  transaction_id INTEGER NOT NULL UNIQUE CHECK (transaction_id > 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_status TEXT NOT NULL CHECK (provider_status IN ('SUCCESS','FAILED','PENDING','PROCESSING','REVERSED')),
  last_checked_at TEXT NOT NULL,
  linked_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sandbox_links_status ON sandbox_order_links(provider_status,last_checked_at);

-- Migration 003: durable single-attempt sandbox dispatch per synthetic D1 order.
-- Run in existing Cloudflare D1 recarganet-rd-demo Console.
-- No existing orders or links are modified.
CREATE TABLE IF NOT EXISTS sandbox_order_dispatches (
  order_id TEXT PRIMARY KEY REFERENCES demo_orders(id),
  idempotency_key TEXT NOT NULL UNIQUE,
  phase TEXT NOT NULL CHECK(phase IN ('prepared','sending','linked','uncertain')),
  transaction_id INTEGER UNIQUE,
  response_http_status INTEGER,
  request_id TEXT,
  prepared_at TEXT NOT NULL,
  sent_at TEXT,
  updated_at TEXT NOT NULL,
  CHECK (transaction_id IS NULL OR transaction_id > 0)
);
CREATE INDEX IF NOT EXISTS idx_sandbox_dispatch_phase
 ON sandbox_order_dispatches(phase,updated_at);

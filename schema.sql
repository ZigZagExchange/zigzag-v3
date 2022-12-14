CREATE TABLE IF NOT EXISTS orders (
    hash               TEXT           NOT NULL PRIMARY KEY,
    user_address       TEXT           NOT NULL,
    buy_token          TEXT           NOT NULL,
    sell_token         TEXT           NOT NULL,
    buy_amount         NUMERIC(50,0)  NOT NULL CHECK (buy_amount > 0),
    sell_amount        NUMERIC(50,0)  NOT NULL CHECK (sell_amount > 0),
    expires            INTEGER        NOT NULL,
    filled             NUMERIC(50,0)  DEFAULT 0 CHECK (filled <= sell_amount),
    sig                TEXT           NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_by_buy_sell_token ON orders(buy_token, sell_token);
CREATE INDEX IF NOT EXISTS orders_by_buy_sell_token_by_expires ON orders(buy_token, sell_token, expires);

CREATE TABLE IF NOT EXISTS token_info (
    token_address      TEXT PRIMARY KEY,
    token_symbol       TEXT,
    token_name         TEXT,
    token_decimals     INTEGER
);

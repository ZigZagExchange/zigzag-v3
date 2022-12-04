CREATE TABLE IF NOT EXISTS orders (
    id                 SERIAL         PRIMARY KEY,
    user_address       TEXT,
    buy_token          TEXT,
    sell_token         TEXT,
    buy_amount         NUMERIC        CHECK (buy_amount > 0),
    sell_amount        NUMERIC        CHECK (sell_amount > 0),
    buy_amount_parsed  TEXT,
    sell_amount_parsed TEXT,
    price              NUMERIC        NOT NULL CHECK (price > 0),
    expires            BIGINT,
    unfilled           NUMERIC        NOT NULL CHECK (unfilled <= sell_amount),
    sig                TEXT
);
CREATE INDEX IF NOT EXISTS orders_by_buy_sell_token ON orders(buy_token, sell_token);
CREATE INDEX IF NOT EXISTS orders_by_buy_sell_token_by_price ON orders(buy_token, sell_token, price);
CREATE INDEX IF NOT EXISTS orders_by_buy_sell_token_by_unfilled ON orders(buy_token, sell_token, unfilled, sell_amount);

CREATE TABLE IF NOT EXISTS token_info (
    id                 SERIAL         PRIMARY KEY,
    token_address      TEXT,
    token_symbol       TEXT,
    token_name         TEXT,
    token_decimals     INTEGER
);


-------------------------------------------------------------------
--
-- Returns table of orders to fill request
-------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_sell_quote(_buy_token TEXT, _sell_token TEXT, _sell_amount NUMERIC)
  RETURNS RECORD
  LANGUAGE plpgsql
AS $$
DECLARE
  match RECORD;
  amount_remaining NUMERIC;
  results INTEGER[];
BEGIN
  amount_remaining := _sell_amount;

  FOR match IN SELECT * FROM orders WHERE buy_token = _buy_token AND sell_token = _sell_token ORDER BY price ASC LOOP
    IF amount_remaining > 0 THEN
        IF amount_remaining < match.unfilled THEN
          RETURN match;
        ELSE
          amount_remaining := amount_remaining - match.buy_amount;
        END IF;    
    END IF; -- if amount_remaining > 0
  END LOOP;
END;
$$;


-------------------------------------------------------------------
--
-- Returns table of orders to fill request
-------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_buy_quote(_buy_token TEXT, _sell_token TEXT, _buy_amount NUMERIC)
  RETURNS RECORD
  LANGUAGE plpgsql
AS $$
DECLARE
  match RECORD;
  amount_remaining NUMERIC;
  results INTEGER[];
BEGIN
  amount_remaining := _buy_amount;

  FOR match IN SELECT id,user_address,buy_token,sell_token,buy_amount,sell_amount,buy_amount_parsed,sell_amount_parsed,price,expires,unfilled,sig FROM orders WHERE buy_token = _buy_token AND sell_token = _sell_token ORDER BY price ASC LOOP
    IF amount_remaining > 0 THEN
        IF amount_remaining < match.unfilled THEN
          RETURN match;
        ELSE
          amount_remaining := amount_remaining - match.sell_amount;
        END IF;    
    END IF; -- if amount_remaining > 0
  END LOOP;
END;
$$;

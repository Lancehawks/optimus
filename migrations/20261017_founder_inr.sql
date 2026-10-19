-- Founder commercial amounts are entered in INR. This changes the unit label,
-- not the numerical values; it does not perform an exchange-rate conversion.
ALTER TABLE founder_lobby_settings ALTER COLUMN sales_currency SET DEFAULT 'INR';
UPDATE founder_lobby_settings SET sales_currency = 'INR' WHERE sales_currency <> 'INR';

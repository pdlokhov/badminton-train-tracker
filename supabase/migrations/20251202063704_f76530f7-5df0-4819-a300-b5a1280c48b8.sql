-- Add retention rate columns to analytics_daily
ALTER TABLE analytics_daily 
ADD COLUMN IF NOT EXISTS retention_d1 numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS retention_d7 numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS retention_d30 numeric DEFAULT 0;
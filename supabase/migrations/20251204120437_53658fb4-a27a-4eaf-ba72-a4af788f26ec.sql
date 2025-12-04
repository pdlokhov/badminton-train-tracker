-- Add topic_id column to channels for supergroups with topics
ALTER TABLE channels ADD COLUMN topic_id integer;
COMMENT ON COLUMN channels.topic_id IS 'ID топика для супергрупп Telegram с разделами (topics/threads)';
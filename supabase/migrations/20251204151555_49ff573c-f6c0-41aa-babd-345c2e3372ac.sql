-- Drop existing and recreate
DROP INDEX IF EXISTS trainings_unique_slot;
CREATE UNIQUE INDEX trainings_unique_slot ON trainings (channel_id, date, time_start, message_id);
-- Drop existing constraint on (channel_id, message_id)
ALTER TABLE trainings DROP CONSTRAINT IF EXISTS trainings_channel_id_message_id_key;

-- Delete duplicates (keep records with price and coach, or most recent)
DELETE FROM trainings t1
WHERE EXISTS (
  SELECT 1 FROM trainings t2
  WHERE t1.channel_id = t2.channel_id
    AND t1.date = t2.date
    AND t1.time_start = t2.time_start
    AND COALESCE(t1.time_end::text, '') = COALESCE(t2.time_end::text, '')
    AND COALESCE(t1.location, '') = COALESCE(t2.location, '')
    AND t1.id != t2.id
    AND (
      (t1.price IS NULL AND t2.price IS NOT NULL) OR
      (t1.price IS NULL AND t2.price IS NULL AND t1.created_at < t2.created_at) OR
      (t1.price IS NOT NULL AND t2.price IS NOT NULL AND t1.created_at < t2.created_at)
    )
);

-- Create unique index on actual training characteristics
CREATE UNIQUE INDEX trainings_unique_slot 
ON trainings (channel_id, date, time_start, COALESCE(time_end::text, ''), COALESCE(location, ''));
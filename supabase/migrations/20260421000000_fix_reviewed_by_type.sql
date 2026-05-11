-- Fix type mismatch: reviewed_by was uuid but profiles.id is text (Clerk userId)
ALTER TABLE attendance_correction_requests
  DROP CONSTRAINT IF EXISTS attendance_correction_requests_reviewed_by_fkey;

ALTER TABLE attendance_correction_requests
  ALTER COLUMN reviewed_by TYPE text USING reviewed_by::text;

ALTER TABLE attendance_correction_requests
  ADD CONSTRAINT attendance_correction_requests_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;

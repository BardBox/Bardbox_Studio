-- Add Cloudinary-hosted image URLs to profiles and clients
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE clients  ADD COLUMN IF NOT EXISTS logo_url   TEXT;

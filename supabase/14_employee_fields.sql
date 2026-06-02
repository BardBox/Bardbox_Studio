-- 14_employee_fields.sql
-- Add HR / employee fields to profiles table
-- Run in Supabase SQL editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_id       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS designation       TEXT,
  ADD COLUMN IF NOT EXISTS date_of_joining   DATE,
  ADD COLUMN IF NOT EXISTS employment_type   TEXT CHECK (employment_type IN ('full-time','part-time','freelance','intern')),
  ADD COLUMN IF NOT EXISTS date_of_birth     DATE,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT;

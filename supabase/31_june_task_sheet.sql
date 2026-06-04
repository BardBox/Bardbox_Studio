-- =============================================================
-- 31_june_task_sheet.sql
-- Content rows for Bizcivitas, K10, Easebiz — June 3–5, 2026
-- All posting dates ≤ June 5 (tight deadlines).
-- Run in Supabase SQL Editor, then select these rows in Content
-- and click "Create Tasks" to generate design + post tasks.
-- =============================================================

INSERT INTO public.content_rows
  (client_name, platform, content_type, brief, caption, hashtags,
   reference_urls, posting_date, posting_time, status, source)
VALUES

  -- ── BIZCIVITAS ───────────────────────────────────────────────

  ('Bizcivitas', 'Instagram', 'reel',
   'Short brand-intro reel: who we are, what we do, why it matters — hook within 3 seconds.',
   'Building brands that convert. 🚀 #Bizcivitas',
   '#digitalmarketing #brandgrowth #bizcivitas',
   '{}', '2026-06-04', '10:00:00', 'pending', 'in_app'),

  ('Bizcivitas', 'Instagram', 'carousel',
   '5-slide carousel: "5 signs your marketing is working" — data points + CTA on last slide.',
   'Are these showing up in YOUR analytics? 👇',
   '#marketingtips #growthhacking #contentmarketing',
   '{}', '2026-06-04', '17:00:00', 'pending', 'in_app'),

  ('Bizcivitas', 'LinkedIn', 'static',
   'Professional post: client success stat (e.g. 3× ROAS in 60 days) with clean branded graphic.',
   'Results speak louder than promises.',
   '#performancemarketing #ROI #casestudy',
   '{}', '2026-06-05', '09:00:00', 'pending', 'in_app'),

  ('Bizcivitas', 'Instagram', 'reel',
   'Behind-the-scenes: team working on a campaign — humanise the brand.',
   'This is what 100% effort looks like. 🎯',
   '#behindthescenes #agencylife #marketingteam',
   '{}', '2026-06-05', '16:00:00', 'pending', 'in_app'),

  -- ── K10 ─────────────────────────────────────────────────────

  ('K10', 'Instagram', 'reel',
   'Walkthrough reel of signature property — showcase lobby, amenities, view. Cinematic cuts.',
   'This is what luxury living looks like. ✨',
   '#luxuryliving #K10 #realestate #dreamhome',
   '{}', '2026-06-03', '11:00:00', 'pending', 'in_app'),

  ('K10', 'Instagram', 'carousel',
   '4-slide carousel: top 4 amenities at K10 — pool, gym, rooftop, concierge. One slide each.',
   'Every detail, designed for you.',
   '#K10residences #amenities #luxuryapartments',
   '{}', '2026-06-04', '12:00:00', 'pending', 'in_app'),

  ('K10', 'Instagram', 'static',
   'Testimonial graphic: real resident quote over an aerial shot of the property.',
   '"Best decision we ever made." — Happy resident 🏡',
   '#testimonial #K10 #happyresidents #luxuryhomes',
   '{}', '2026-06-05', '10:00:00', 'pending', 'in_app'),

  ('K10', 'LinkedIn', 'carousel',
   'Investor-angle carousel: location advantages, appreciation stats, ROI potential — 5 slides.',
   'Smart investors are looking at K10. Here is why.',
   '#realestateinvestment #K10 #propertyinvesting',
   '{}', '2026-06-05', '14:00:00', 'pending', 'in_app'),

  -- ── EASEBIZ ──────────────────────────────────────────────────

  ('Easebiz', 'Instagram', 'reel',
   'Problem–solution reel: "Still managing HR on spreadsheets?" → show Easebiz dashboard. 30 sec.',
   'There is a smarter way. 💡 #Easebiz',
   '#hrtech #startuptools #saas #productivity',
   '{}', '2026-06-03', '10:00:00', 'pending', 'in_app'),

  ('Easebiz', 'Instagram', 'carousel',
   '"Top 5 features businesses love about Easebiz" — one feature per slide, icon + one-liner.',
   'Why 500+ businesses chose Easebiz 👇',
   '#businesssoftware #easebiz #smb #automation',
   '{}', '2026-06-04', '09:00:00', 'pending', 'in_app'),

  ('Easebiz', 'LinkedIn', 'static',
   'Stat post: "Businesses using Easebiz save 8+ hrs/week on admin" — clean infographic style.',
   'Time saved = money earned. How much time are you losing?',
   '#productivity #businessgrowth #hrmanagement #easebiz',
   '{}', '2026-06-05', '09:30:00', 'pending', 'in_app'),

  ('Easebiz', 'Instagram', 'reel',
   'Customer story reel: quick before/after — manual chaos vs Easebiz dashboard. 20–30 sec.',
   'From chaos to clarity in one click. ✅',
   '#customerstory #easebiz #softwaresolutions',
   '{}', '2026-06-05', '15:00:00', 'pending', 'in_app');


-- ── How to use ───────────────────────────────────────────────
-- 1. Run this file in Supabase SQL Editor
-- 2. Go to Content → Table view → filter by client
-- 3. Select all rows for these clients → click "Create Tasks"
-- 4. Tasks get auto-assigned based on content_type:
--      reel  → video_editor (Jignesh)
--      carousel / static → graphic_designer (Neha / Dhairya)
-- 5. Internal deadlines will be tight (June 3–4) since posting
--    dates are June 3–5 and today is June 3.

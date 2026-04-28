-- =============================================================
-- 09_demo_seed.sql
-- Real clients + demo content rows + tasks
-- Team accounts must be created first via /admin/team or Supabase Auth.
-- Safe to re-run. To clear: DELETE FROM content_rows WHERE source = 'import';
-- =============================================================

DO $$
DECLARE
  v_designer1 uuid;  -- Dhairya (graphic designer)
  v_designer2 uuid;  -- Abhishek or Jignesh (motion)
  v_smo1      uuid;  -- Kavita
  v_manager   uuid;  -- Sameer or Yogina
  r           bigint;

BEGIN
  -- Pick real team by role (whoever exists in profiles)
  SELECT id INTO v_designer1 FROM public.profiles WHERE role='designer' AND is_active=true ORDER BY full_name LIMIT 1;
  SELECT id INTO v_designer2 FROM public.profiles WHERE role='designer' AND is_active=true ORDER BY full_name OFFSET 1 LIMIT 1;
  SELECT id INTO v_smo1      FROM public.profiles WHERE role='smo'      AND is_active=true LIMIT 1;
  SELECT id INTO v_manager   FROM public.profiles WHERE role IN ('manager','admin','ceo') AND is_active=true LIMIT 1;

  v_designer2 := COALESCE(v_designer2, v_designer1);

  -- ── Real Clients ─────────────────────────────────────────────
  INSERT INTO public.clients (name) VALUES
    ('Bizcivitas'), ('Easebiz'), ('Bardbox'), ('BrandWhisperer'), ('K10')
  ON CONFLICT DO NOTHING;

  -- ================================================================
  -- POSTED — April 2026
  -- ================================================================

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Bizcivitas','linkedin','post',
    'Thought leadership: 3 common mistakes businesses make when scaling their online presence',
    '3 mistakes that cost businesses lakhs online — and how to avoid them. 🧵 #Bizcivitas #DigitalGrowth',
    '2026-04-05','posted','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status,completed_at,design_url)
  VALUES (r,'design',v_designer1,'2026-04-02 10:00+05:30','done','2026-04-01 16:00+05:30','https://canva.com/design/biz1'),
         (r,'post',v_smo1,'2026-04-05 10:00+05:30','done','2026-04-05 10:05+05:30',null);

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Easebiz','instagram','carousel',
    'Step-by-step guide: registering your business online in under 10 minutes',
    'Start your business in 10 minutes flat 🚀 Swipe to see how Easebiz makes it possible. #Easebiz #Startup',
    '2026-04-08','posted','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status,completed_at,design_url)
  VALUES (r,'design',v_designer2,'2026-04-04 10:00+05:30','done','2026-04-03 14:00+05:30','https://canva.com/design/ease1'),
         (r,'post',v_smo1,'2026-04-08 10:00+05:30','done','2026-04-08 10:00+05:30',null);

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Bardbox','instagram','reel',
    'Agency culture reel — team at work, creative process, behind the scenes vibes',
    'This is what creativity looks like at 9am on a Monday ☕ #Bardbox #AgencyLife #CreativeTeam',
    '2026-04-11','posted','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status,completed_at,design_url)
  VALUES (r,'design',v_designer1,'2026-04-07 10:00+05:30','done','2026-04-06 18:00+05:30','https://canva.com/design/bb1'),
         (r,'post',v_smo1,'2026-04-11 10:00+05:30','done','2026-04-11 10:00+05:30',null);

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('BrandWhisperer','linkedin','post',
    'Why most brands talk AT their audience instead of WITH them — thought piece',
    'Your brand is not the hero. Your customer is. Here is what that actually means for your content. #BrandWhisperer #Branding',
    '2026-04-15','posted','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status,completed_at,design_url)
  VALUES (r,'design',v_designer2,'2026-04-11 10:00+05:30','done','2026-04-10 12:00+05:30','https://canva.com/design/bw1'),
         (r,'post',v_smo1,'2026-04-15 10:00+05:30','done','2026-04-15 10:00+05:30',null);

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('K10','instagram','post',
    'New property listing announcement — premium residential project launch',
    '🏙️ Introducing K10 Heights. Premium living, prime location. DM for details. #K10 #RealEstate',
    '2026-04-18','posted','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status,completed_at,design_url)
  VALUES (r,'design',v_designer1,'2026-04-14 10:00+05:30','done','2026-04-13 17:00+05:30','https://canva.com/design/k10a'),
         (r,'post',v_smo1,'2026-04-18 10:00+05:30','done','2026-04-18 10:00+05:30',null);

  -- ================================================================
  -- OVERDUE — design in_progress, deadline already passed
  -- ================================================================

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Bizcivitas','facebook','post',
    'Case study: how a client 5x-ed their leads in 60 days using Bizcivitas platform',
    null,'2026-04-22','in_design','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer2,'2026-04-19 10:00+05:30','in_progress'),
         (r,'post',v_smo1,'2026-04-22 10:00+05:30','todo');

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('K10','instagram','reel',
    'Walkthrough video of the model apartment — luxury interiors, ambient music',
    null,'2026-04-24','in_design','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer1,'2026-04-21 10:00+05:30','in_progress'),
         (r,'post',v_smo1,'2026-04-24 10:00+05:30','todo');

  -- ================================================================
  -- PENDING APPROVAL — submitted by designer, awaiting review
  -- ================================================================

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Easebiz','instagram','reel',
    'Animated explainer: what is a GST number and why your business needs one',
    'No more GST confusion 📋 We explain it in 30 seconds. #Easebiz #GSTIndia #BusinessTips',
    '2026-04-27','in_review','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status,design_url)
  VALUES (r,'design',v_designer2,'2026-04-23 10:00+05:30','submitted','https://canva.com/design/ease2'),
         (r,'post',v_smo1,'2026-04-27 10:00+05:30','todo',null);

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Bardbox','linkedin','post',
    'Client results showcase: 3 brands, 3 transformations — before/after metrics',
    'We helped 3 brands completely transform their digital presence in Q1 2026. Here are the numbers 👇 #Bardbox #Results',
    '2026-04-28','in_review','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status,design_url)
  VALUES (r,'design',v_designer1,'2026-04-24 10:00+05:30','submitted','https://canva.com/design/bb2'),
         (r,'post',v_smo1,'2026-04-28 10:00+05:30','todo',null);

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('BrandWhisperer','instagram','carousel',
    'Brand audit checklist — 5 things every brand should review quarterly',
    'Is your brand saying the right things? 🔍 Swipe for a 5-point brand health check. #BrandWhisperer #BrandStrategy',
    '2026-04-30','in_review','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status,design_url)
  VALUES (r,'design',v_designer2,'2026-04-26 10:00+05:30','submitted','https://canva.com/design/bw2'),
         (r,'post',v_smo1,'2026-04-30 10:00+05:30','todo',null);

  -- ================================================================
  -- MAY 2026 — approved + in_progress + todo
  -- ================================================================

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('K10','instagram','carousel',
    'Amenities tour — rooftop, gym, pool, co-working space at K10 Heights',
    'Life at K10 is not just a home — it is a lifestyle. 🏊 Swipe to see every amenity. #K10 #LuxuryLiving',
    '2026-05-03','approved','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status,design_url)
  VALUES (r,'design',v_designer1,'2026-04-29 10:00+05:30','approved','https://canva.com/design/k10b'),
         (r,'post',v_smo1,'2026-05-03 10:00+05:30','approved',null);

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Bizcivitas','instagram','reel',
    'Founder story — why Bizcivitas was started and the problem it solves for SMBs',
    'We built Bizcivitas because we saw too many good businesses fail for the wrong reasons. Here is why 👇',
    '2026-05-06','in_design','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer2,'2026-05-02 10:00+05:30','in_progress'),
         (r,'post',v_smo1,'2026-05-06 10:00+05:30','todo');

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Bardbox','instagram','reel',
    'Time-lapse of a full brand identity project from brief to delivery',
    'From blank canvas to full identity in 3 weeks ⚡ Watch the entire process sped up. #Bardbox #BrandDesign',
    '2026-05-09','in_design','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer1,'2026-05-05 10:00+05:30','in_progress'),
         (r,'post',v_smo1,'2026-05-09 10:00+05:30','todo');

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Easebiz','linkedin','post',
    'New feature announcement: one-click GST filing now available on Easebiz dashboard',
    '🎉 Big update: GST filing just got a lot easier. One click. Done. #Easebiz #ProductUpdate',
    '2026-05-12','draft','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer2,'2026-05-08 10:00+05:30','todo'),
         (r,'post',v_smo1,'2026-05-12 10:00+05:30','todo');

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('BrandWhisperer','instagram','post',
    'Quote card: "Your logo is not your brand. Your reputation is." — with commentary',
    '"Your logo is not your brand. Your reputation is." 🔑 Save this. #BrandWhisperer #BrandQuote',
    '2026-05-15','draft','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer1,'2026-05-13 10:00+05:30','todo'),
         (r,'post',v_smo1,'2026-05-15 10:00+05:30','todo');

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('K10','facebook','post',
    'Limited early-bird pricing announcement — deadline May 31',
    '⏳ Early-bird pricing ends May 31. Book your K10 unit before rates increase. DM now. #K10 #RealEstate',
    '2026-05-20','draft','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer2,'2026-05-16 10:00+05:30','todo'),
         (r,'post',v_smo1,'2026-05-20 10:00+05:30','todo');

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Bardbox','instagram','carousel',
    'Services breakdown: what we do at Bardbox — branding, content, digital, web',
    'One studio. Every creative need covered. 🎨 Swipe to see what Bardbox does. #Bardbox #CreativeAgency',
    '2026-05-23','draft','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer1,'2026-05-19 10:00+05:30','todo'),
         (r,'post',v_smo1,'2026-05-23 10:00+05:30','todo');

  -- ================================================================
  -- JUNE 2026 — all draft / todo (comfortable pipeline)
  -- ================================================================

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Bizcivitas','linkedin','post',
    'Mid-year growth report: Bizcivitas platform milestones and what is coming next',
    'Halfway through 2026 and here is where we stand 📊 Our biggest milestones and what comes next. #Bizcivitas',
    '2026-06-05','draft','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer2,'2026-06-02 10:00+05:30','todo'),
         (r,'post',v_smo1,'2026-06-05 10:00+05:30','todo');

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Easebiz','instagram','reel',
    'Motion graphic: the journey of a startup from idea to registered company using Easebiz',
    'From idea to official company in 72 hours ⚡ Watch the full journey. #Easebiz #StartupIndia',
    '2026-06-10','draft','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer1,'2026-06-07 10:00+05:30','todo'),
         (r,'post',v_smo1,'2026-06-10 10:00+05:30','todo');

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('BrandWhisperer','linkedin','post',
    'Case study: rebranding a 15-year-old business — the process and results',
    'We helped a 15-year-old business rediscover its identity. Here is the full story. #BrandWhisperer #CaseStudy',
    '2026-06-16','draft','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer2,'2026-06-12 10:00+05:30','todo'),
         (r,'post',v_smo1,'2026-06-16 10:00+05:30','todo');

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('K10','instagram','reel',
    'Possession ceremony highlights — emotional handover moments, happy residents',
    'This is the moment we work for. 🔑 Possession day at K10. Congratulations to our homeowners! #K10',
    '2026-06-21','draft','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer1,'2026-06-17 10:00+05:30','todo'),
         (r,'post',v_smo1,'2026-06-21 10:00+05:30','todo');

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Bardbox','instagram','reel',
    'Team introduction series: meet the Bardbox creative team — faces behind the work',
    'Meet the people behind the magic ✨ This is the Bardbox team. #Bardbox #TeamBardbox #MeetTheTeam',
    '2026-06-25','draft','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer2,'2026-06-21 10:00+05:30','todo'),
         (r,'post',v_smo1,'2026-06-25 10:00+05:30','todo');

  RAISE NOTICE 'Demo seed complete — 5 clients, 28 content rows, 56 tasks inserted.';
END;
$$;

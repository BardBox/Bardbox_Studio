// scripts/create-users.js
// Creates Supabase Auth users + profiles directly (no invite email needed).
// Run with:  node --env-file=.env.local scripts/create-users.js

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─── Edit this list ────────────────────────────────────────────────────────────
const USERS = [
  {
    full_name:   'Sameer Admin',
    email:       'sameer@yourdomain.com',
    password:    'Sameer@123',
    role:        'admin',
    employee_id: 'BB-001',
    designation: 'Agency Admin',
    employment_type: 'full-time',
  },
  {
    full_name:   'Aadil Developer',
    email:       'aadil@yourdomain.com',
    password:    'Aadil@123',
    role:        'developer',
    employee_id: 'BB-002',
    designation: 'Lead Developer',
    employment_type: 'full-time',
  },
  {
    full_name:       'Jignesh',
    email:           'jignesh@yourdomain.com',
    password:        'Jignesh@123',
    role:            'designer',
    employee_id:     'BB-003',
    designation:     'Video Editor',
    employment_type: 'full-time',
  },
  {
    full_name:       'Yogina',
    email:           'yogina@yourdomain.com',
    password:        'Yogina@123',
    role:            'smo',
    employee_id:     'BB-004',
    designation:     'SMO',
    employment_type: 'full-time',
  },
  {
    full_name:       'Kavita',
    email:           'kavita@yourdomain.com',
    password:        'Kavita@123',
    role:            'smo',
    employee_id:     'BB-005',
    designation:     'Social Media Ops',
    employment_type: 'full-time',
  },
  {
    full_name:       'Dhairya',
    email:           'dhairya@yourdomain.com',
    password:        'Dhairya@123',
    role:            'designer',
    employee_id:     'BB-006',
    designation:     'Graphic Designer',
    employment_type: 'full-time',
  },
];
// ───────────────────────────────────────────────────────────────────────────────

async function createUser(u) {
  // 1. Create auth user (email_confirm: true skips verification — can login immediately)
  const { data, error: authError } = await supabase.auth.admin.createUser({
    email:         u.email,
    password:      u.password,
    email_confirm: true,
    user_metadata: { full_name: u.full_name },
  });

  if (authError) {
    // If user already exists in auth, try to find and update profile only
    if (authError.message?.includes('already been registered')) {
      console.warn(`⚠️  ${u.email} already exists in Auth — skipping`);
    } else {
      console.error(`❌ Auth error for ${u.email}:`, authError.message);
    }
    return;
  }

  // 2. Upsert profile
  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id:                  data.user.id,
      full_name:           u.full_name,
      role:                u.role,
      email:               u.email,
      employee_id:         u.employee_id         ?? null,
      designation:         u.designation         ?? null,
      employment_type:     u.employment_type     ?? null,
      date_of_joining:     u.date_of_joining     ?? null,
      date_of_birth:       u.date_of_birth       ?? null,
      emergency_contact:   u.emergency_contact   ?? null,
      max_concurrent_tasks: u.max_concurrent_tasks ?? 10,
      is_active:           true,
    },
    { onConflict: 'id' }
  );

  if (profileError) {
    console.error(`❌ Profile error for ${u.email}:`, profileError.message);
  } else {
    console.log(`✅ Created  ${u.full_name.padEnd(20)} | ${u.role.padEnd(10)} | ${u.email}`);
  }
}

(async () => {
  console.log(`\nCreating ${USERS.length} user(s)...\n`);
  for (const user of USERS) {
    await createUser(user);
  }
  console.log('\nDone.');
})();

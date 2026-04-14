const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createUsers() {
  console.log("Creating test users...");

  const usersToCreate = [
    {
      email: 'admin@example.com',
      password: 'password123',
      role: 'admin',
      fullName: '管理者 太郎',
      employeeCode: 'ADM-001'
    },
    {
      email: 'employee@example.com',
      password: 'password123',
      role: 'employee',
      fullName: '一般 社員',
      employeeCode: 'EMP-001'
    }
  ];

  for (const u of usersToCreate) {
    console.log(`\nProcessing ${u.email}...`);
    
    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true
    });

    let userId = null;
    if (authError) {
      if (authError.message.includes('already exists')) {
        console.log(`User ${u.email} already exists in auth.users, trying to fetch...`);
        // Find existing user
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const existing = users.find(user => user.email === u.email);
        if (existing) {
          userId = existing.id;
        } else {
          console.error("Could not find existing user id for:", u.email);
          continue;
        }
      } else {
        console.error("Error creating user:", authError);
        continue;
      }
    } else {
      userId = authData.user.id;
      console.log(`Created auth user with ID: ${userId}`);
    }

    if (!userId) continue;

    // 2. Insert into profiles (upsert to avoid conflict)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: u.email,
        role: u.role
      });

    if (profileError) {
      console.error("Error inserting profile:", profileError);
    } else {
      console.log(`Upserted profile for ${u.email}`);
    }

    // 3. Insert into employees if role is employee
    if (u.role === 'employee') {
      const { data: existingEmp } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', userId)
        .single();
      
      if (!existingEmp) {
        const { error: empError } = await supabase
          .from('employees')
          .insert({
            user_id: userId,
            employee_code: u.employeeCode,
            full_name: u.fullName,
            department: 'テスト部門'
          });

        if (empError) {
          console.error("Error inserting employee:", empError);
        } else {
          console.log(`Inserted employee record for ${u.email}`);
        }
      } else {
        console.log(`Employee record already exists for ${u.email}`);
      }
    }
  }
  console.log("\nDone!");
}

createUsers().catch(console.error);

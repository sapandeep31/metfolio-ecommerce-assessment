import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log('--- Seeding Supabase Auth Accounts & Profiles ---');

  // 1. Seed Admin User (admin@shop.local / password123)
  const adminEmail = 'admin@shop.local';
  const adminPassword = 'password123';

  const { data: userList, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Failed to list users:', listError.message);
    process.exit(1);
  }

  let adminUser = userList.users.find((u) => u.email === adminEmail);

  if (!adminUser) {
    const { data: newAdmin, error: createError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      app_metadata: { role: 'admin' },
      user_metadata: { name: 'Shop Admin', display_name: 'Shop Admin' },
    });
    if (createError) {
      console.error('Failed to create admin user:', createError.message);
      process.exit(1);
    }
    adminUser = newAdmin.user;
    console.log(`Created admin user in auth.users: ${adminUser.id} (${adminEmail})`);
  } else {
    const { data: updatedAdmin, error: updateError } = await supabase.auth.admin.updateUserById(
      adminUser.id,
      {
        password: adminPassword,
        email_confirm: true,
        app_metadata: { ...adminUser.app_metadata, role: 'admin' },
      },
    );
    if (updateError) {
      console.error('Failed to update admin user:', updateError.message);
      process.exit(1);
    }
    adminUser = updatedAdmin.user;
    console.log(`Updated admin user in auth.users: ${adminUser.id} (${adminEmail})`);
  }

  // Ensure profiles table has role = 'admin'
  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: adminUser.id,
      email: adminEmail,
      role: 'admin',
      display_name: 'Shop Admin',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (profileError) {
    console.error('Failed to upsert admin profile:', profileError.message);
  } else {
    console.log(`Admin profile set to role='admin' in public.profiles for ${adminEmail}`);
  }

  // 2. Seed Customer User (customer@shop.local / password123)
  const customerEmail = 'customer@shop.local';
  const customerPassword = 'password123';

  let customerUser = userList.users.find((u) => u.email === customerEmail);

  if (!customerUser) {
    const { data: newCustomer, error: createCustError } = await supabase.auth.admin.createUser({
      email: customerEmail,
      password: customerPassword,
      email_confirm: true,
      app_metadata: { role: 'customer' },
      user_metadata: { name: 'Demo Customer', display_name: 'Demo Customer' },
    });
    if (createCustError) {
      console.error('Failed to create customer user:', createCustError.message);
      process.exit(1);
    }
    customerUser = newCustomer.user;
    console.log(`Created customer user in auth.users: ${customerUser.id} (${customerEmail})`);
  } else {
    const { data: updatedCust, error: updateCustError } = await supabase.auth.admin.updateUserById(
      customerUser.id,
      {
        password: customerPassword,
        email_confirm: true,
        app_metadata: { ...customerUser.app_metadata, role: 'customer' },
      },
    );
    if (updateCustError) {
      console.error('Failed to update customer user:', updateCustError.message);
      process.exit(1);
    }
    customerUser = updatedCust.user;
    console.log(`Updated customer user in auth.users: ${customerUser.id} (${customerEmail})`);
  }

  // Ensure profiles table has role = 'customer'
  const { error: custProfileError } = await supabase.from('profiles').upsert(
    {
      id: customerUser.id,
      email: customerEmail,
      role: 'customer',
      display_name: 'Demo Customer',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (custProfileError) {
    console.error('Failed to upsert customer profile:', custProfileError.message);
  } else {
    console.log(`Customer profile set to role='customer' in public.profiles for ${customerEmail}`);
  }

  console.log('--- Finished seeding auth accounts successfully ---');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

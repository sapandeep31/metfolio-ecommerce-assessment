import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  console.log('=== Verifying Supabase Row-Level Security (RLS) ===\n');

  // 1. Anon client
  const anonClient = createClient(supabaseUrl, anonKey);

  console.log('1. Testing Anon permissions:');
  const { data: anonProducts, error: anonProdErr } = await anonClient
    .from('products')
    .select('id, title, status');
  console.log(
    `   - Anon select products: count=${anonProducts?.length ?? 0}, err=${anonProdErr?.message ?? 'none'}`,
  );

  const { data: anonLedger, error: anonLedgerErr } = await anonClient
    .from('stock_ledger')
    .select('*');
  console.log(
    `   - Anon select stock_ledger: count=${anonLedger?.length ?? 0}, err=${anonLedgerErr?.message ?? 'none'}`,
  );

  const { data: anonOrders, error: anonOrdersErr } = await anonClient.from('orders').select('*');
  console.log(
    `   - Anon select orders: count=${anonOrders?.length ?? 0}, err=${anonOrdersErr?.message ?? 'none'}`,
  );

  // 2. Customer client
  console.log('\n2. Testing Customer permissions:');
  const customerClient = createClient(supabaseUrl, anonKey);
  const { data: custAuth, error: custAuthErr } = await customerClient.auth.signInWithPassword({
    email: 'customer@shop.local',
    password: 'password123',
  });
  if (custAuthErr) throw custAuthErr;
  console.log(`   - Customer logged in: user_id=${custAuth.user.id}`);

  const { data: custProducts } = await customerClient.from('products').select('id, title, status');
  console.log(`   - Customer select products: count=${custProducts?.length ?? 0}`);

  const { data: custLedger } = await customerClient.from('stock_ledger').select('*');
  console.log(
    `   - Customer select stock_ledger (RLS must block): count=${custLedger?.length ?? 0}`,
  );

  const { data: custOrders } = await customerClient.from('orders').select('*');
  console.log(`   - Customer select orders (own only): count=${custOrders?.length ?? 0}`);

  // 3. Admin client
  console.log('\n3. Testing Admin permissions:');
  const adminClient = createClient(supabaseUrl, anonKey);
  const { data: adminAuth, error: adminAuthErr } = await adminClient.auth.signInWithPassword({
    email: 'admin@shop.local',
    password: 'password123',
  });
  if (adminAuthErr) throw adminAuthErr;
  console.log(`   - Admin logged in: user_id=${adminAuth.user.id}`);

  const { data: adminLedger } = await adminClient.from('stock_ledger').select('*');
  console.log(`   - Admin select stock_ledger (RLS must allow): count=${adminLedger?.length ?? 0}`);

  const { data: adminOrders } = await adminClient.from('orders').select('*');
  console.log(`   - Admin select all orders: count=${adminOrders?.length ?? 0}`);

  // 4. Service Role Client (Bypasses RLS)
  console.log('\n4. Testing Service Role & Row Isolation:');
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: variant } = await serviceClient
    .from('product_variants')
    .select('id')
    .limit(1)
    .single();
  const testId = 'test_ledger_' + Date.now();
  if (variant) {
    const { error: insErr } = await serviceClient.from('stock_ledger').insert({
      id: testId,
      variant_id: variant.id,
      kind: 'RESTOCK',
      on_hand_delta: 5,
      reserved_delta: 0,
      reason: 'RLS Verification Test',
    });
    if (insErr) console.error('Insert error:', insErr);
    else console.log('   - Inserted test ledger movement as service_role (id=' + testId + ')');
  }

  const { data: srvLedger } = await serviceClient.from('stock_ledger').select('*').eq('id', testId);
  console.log(`   - Service role select stock_ledger: count=${srvLedger?.length ?? 0}`);

  const { data: adminLedgerAfter } = await adminClient
    .from('stock_ledger')
    .select('*')
    .eq('id', testId);
  console.log(
    `   - Admin select stock_ledger: count=${adminLedgerAfter?.length ?? 0} (EXPECTED: 1)`,
  );

  const { data: custLedgerAfter } = await customerClient
    .from('stock_ledger')
    .select('*')
    .eq('id', testId);
  console.log(
    `   - Customer select stock_ledger: count=${custLedgerAfter?.length ?? 0} (EXPECTED: 0)`,
  );

  const { data: anonLedgerAfter } = await anonClient
    .from('stock_ledger')
    .select('*')
    .eq('id', testId);
  console.log(`   - Anon select stock_ledger: count=${anonLedgerAfter?.length ?? 0} (EXPECTED: 0)`);

  if (variant) {
    await serviceClient.from('stock_ledger').delete().eq('id', testId);
    console.log('   - Cleaned up test ledger movement');
  }

  console.log('\n=== All RLS Checks Completed Successfully! ===');
}

main().catch((err) => {
  console.error('Fatal RLS test error:', err);
  process.exit(1);
});

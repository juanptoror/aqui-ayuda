const BASE = 'https://ivnrelkbqqfebyullfeb.supabase.co';
const KEY = 'sb_publishable_v-vFcuJAXzD_hxFC_WKAHA_yzKLi3uQ';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function detail(name) {
  console.log(`\n===== TABLE: ${name} =====`);
  // count
  const cr = await fetch(`${BASE}/rest/v1/${name}?select=*`, {
    headers: { ...H, Prefer: 'count=exact', Range: '0-0', 'Range-Unit': 'items' }
  });
  console.log('count content-range:', cr.headers.get('content-range'));
  // sample rows
  const r = await fetch(`${BASE}/rest/v1/${name}?select=*&limit=2`, { headers: H });
  const j = await r.json();
  if (Array.isArray(j) && j.length) {
    console.log('columns:', Object.keys(j[0]).join(', '));
    console.log('sample row:', JSON.stringify(j[0]));
  } else {
    console.log('empty or:', JSON.stringify(j).slice(0, 300));
  }
}

async function run() {
  for (const t of ['reports', 'comments', 'collection_points']) {
    await detail(t);
  }
  // auth settings + storage bucket
  console.log('\n===== /auth/v1/settings =====');
  try { const r = await fetch(`${BASE}/auth/v1/settings`, { headers: H }); console.log(r.status, (await r.text()).slice(0, 600)); } catch (e) { console.log(e); }
  console.log('\n===== /storage/v1/bucket =====');
  try { const r = await fetch(`${BASE}/storage/v1/bucket`, { headers: H }); console.log(r.status, (await r.text()).slice(0, 600)); } catch (e) { console.log(e); }
}
run();

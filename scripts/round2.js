const BASE = 'https://ivnrelkbqqfebyullfeb.supabase.co';
const KEY = 'sb_publishable_v-vFcuJAXzD_hxFC_WKAHA_yzKLi3uQ';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

// second-round table candidates (English convention observed)
const tables = `
report_updates report_comments report_photos report_confirmations report_categories report_status report_history report_logs report_tags report_media report_contacts report_matches report_offers report_needs report_items report_responses updates confirmations verifications matches
categories category municipalities municipality departments department locations location sites site points point
users user_profiles profiles_public app_users members member accounts
notifications notification subscriptions subscription push_tokens device_tokens
donations donation help_offers offers_help aid_offers aid aids assistance
volunteers_list volunteer_signups signups
collection_point drop_off drop_off_points dropoff_points distribution_points distribution_point aid_points aid_point help_points relief_points supply_points
tags tag statuses feed activity_log audit_log
messages message threads thread chats chat
photos images media attachments files uploads
contacts contact phones
faqs faq about info settings config app_config
regions region zones zone neighborhoods neighborhood comunas
`.split(/\s+/).filter(Boolean);

// candidate columns for collection_points (empty table)
const cols = `id name title description address location_name lat lng latitude longitude municipality department city contact_phone phone contact contact_name hours schedule opening_hours category type status active is_active accepts needs items created_at updated_at photo_urls image_url notes capacity manager responsible email`.split(/\s+/);

async function probeTable(name) {
  const r = await fetch(`${BASE}/rest/v1/${encodeURIComponent(name)}?select=*&limit=1`, { headers: H });
  const body = await r.text();
  let code = null; try { code = JSON.parse(body).code; } catch {}
  if (r.status !== 404 || (code && code !== 'PGRST205')) return { name, status: r.status, code, body: body.slice(0, 200) };
  return null;
}

async function probeCol(table, col) {
  const r = await fetch(`${BASE}/rest/v1/${table}?select=${col}&limit=1`, { headers: H });
  const body = await r.text();
  let code = null; try { code = JSON.parse(body).code; } catch {}
  if (r.status === 200) return { col, ok: true };
  if (code === '42501') return { col, denied: true };
  if (code === '42703') return null; // column doesn't exist
  return { col, status: r.status, code, body: body.slice(0, 120) };
}

async function run() {
  console.log('== round2 tables ==');
  const found = [];
  const uniq = [...new Set(tables)];
  for (let i = 0; i < uniq.length; i += 20) {
    const res = await Promise.all(uniq.slice(i, i + 20).map(probeTable));
    for (const r of res) if (r) { found.push(r); console.log('HIT', JSON.stringify(r)); }
  }
  console.log('round2 hits:', found.length);

  console.log('\n== collection_points columns ==');
  const okCols = [], deniedCols = [];
  for (const c of cols) {
    const r = await probeCol('collection_points', c);
    if (r && r.ok) okCols.push(c);
    else if (r && r.denied) deniedCols.push(c);
    else if (r) console.log('other', c, JSON.stringify(r));
  }
  console.log('collection_points existing cols:', okCols.join(', '));
  console.log('collection_points denied cols (42501):', deniedCols.join(', ') || '(none)');
}
run();

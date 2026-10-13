import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
let db;
const admin='00000000-0000-4000-8000-000000000001',u1='00000000-0000-4000-8000-000000000002',u2='00000000-0000-4000-8000-000000000003',unknown='00000000-0000-4000-8000-000000000004';
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 insert into auth.users values ('${admin}','admin@example.test',now()),('${u1}','siswa001@example.test',now()),('${u2}','siswa002@example.test',now()),('${unknown}','unknown@example.test',now());`);
 await db.exec(await readFile(new URL('../database/01_schema.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../database/02_seed.sql',import.meta.url),'utf8'));
 await db.exec(`insert into pkl_private.admins values ('${admin}');`);
});
after(async()=>{await db?.close();});
beforeEach(async()=>{
 await db.exec(`reset role; truncate pkl_private.requests,pkl_private.registrations,pkl_private.permissions,pkl_private.audit restart identity;
 update pkl_private.periods set registration_open=true,change_mode='admin_approval',max_changes=1,deadline=null;
 update pkl_private.quotas set import_confirmed=(kuota is not null and terisi_import is not null),registration_open=(kuota is not null and terisi_import is not null and kuota>=terisi_import);`);
});
async function as(uid){await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`);}
async function act(uid,action,payload){await as(uid);return (await db.query('select public.pkl_action($1,$2::jsonb) result',[action,JSON.stringify(payload)])).rows[0].result;}
async function snap(uid){await as(uid);return (await db.query('select public.pkl_snapshot() result')).rows[0].result;}
async function q(name,w=1){await db.exec('reset role');return (await db.query('select q.id from pkl_private.quotas q join pkl_private.places p on p.id=q.tempat_id where p.nama=$1 and q.period_id=$2',[name,w])).rows[0].id;}

test('PostgreSQL schema/seed execution and least-privilege snapshots',async()=>{
 const a=await snap(admin),s=await snap(u1),x=await snap(unknown);assert.equal(a.students.length,210);assert.equal(a.tempat_pkl.length,121);assert.equal(a.quota_allocations.length,242);assert.equal(s.students.length,1);assert.equal(s.tempat_pkl.length,40);assert.equal(x.role,'unregistered');assert.equal(x.students.length,0);
 await assert.rejects(()=>db.query('select * from pkl_private.students'),/permission denied/);
 await as(u1);await assert.rejects(()=>db.query("select public.pkl_action('admin_period','{}')"),/admin/);
 await db.exec('reset role; set role anon;');await assert.rejects(()=>db.query('select public.pkl_snapshot()'),/permission denied/);
});
test('database: final seat, duplicate submit, and quota release on reset',async()=>{
 const id=await q('CV. Risky Sakti Trans Mandiri');await act(u1,'choose',{quota_id:id});await act(u1,'choose',{quota_id:id});await assert.rejects(()=>act(u2,'choose',{quota_id:id}),/penuh/);
 let a=await snap(admin);assert.equal(a.registrations.length,1);assert.equal(a.registrations[0].student_id,1);
 await act(admin,'admin_reset',{student_id:1,period_id:1,reason:'Memilih ulang dari sekolah'});await act(u2,'choose',{quota_id:id});a=await snap(admin);assert.equal(a.students.length,210);assert.equal(a.registrations.find(r=>r.student_id===1).status,'reset');
});
test('database: filled target approval rolls back and retains original registration',async()=>{
 const old=await q('Muslim Diesel'),target=await q('CV. Risky Sakti Trans Mandiri');await act(u1,'choose',{quota_id:old});await act(u1,'request_change',{quota_id:target,reason:'Lokasi lebih dekat rumah'});
 let a=await snap(admin);const rid=a.requests[0].id;assert.equal(a.registrations.length,1);
 await act(u2,'choose',{quota_id:target});await assert.rejects(()=>act(admin,'admin_decide',{request_id:rid,approve:true,reason:'Diterima pembimbing sekolah'}),/penuh/);
 a=await snap(admin);assert.equal(a.registrations.find(r=>r.student_id===1).quota_id,old);assert.equal(a.requests[0].status,'pending');
});
test('database: approval once, change limit, individual override and deadline',async()=>{
 const old=await q('Muslim Diesel'),target=await q('Pandawa Motor Sumpiuh');await act(u1,'choose',{quota_id:old});await act(u1,'request_change',{quota_id:target,reason:'Lokasi lebih dekat rumah'});
 const rid=(await snap(admin)).requests[0].id;await act(admin,'admin_decide',{request_id:rid,approve:true,reason:'Disetujui oleh pembimbing'});
 await assert.rejects(()=>act(admin,'admin_decide',{request_id:rid,approve:true,reason:'Percobaan persetujuan ulang'}),/diproses/);
 await assert.rejects(()=>act(u1,'request_change',{quota_id:old,reason:'Kembali ke lokasi semula'}),/Batas/);
 await act(admin,'admin_permission',{student_id:1,period_id:1,change_override:'self_service',extra_changes:1,reason:'Pengecualian dari sekolah'});
 await act(u1,'choose',{quota_id:old,reason:'Kembali ke tempat semula'});assert.equal((await snap(u1)).registrations[0].change_count,2);
 await act(admin,'admin_period',{period_id:1,registration_open:true,change_mode:'admin_approval',max_changes:1,deadline:'2020-01-01T00:00:00Z',reason:'Menutup setelah tenggat'});
 await assert.rejects(()=>act(u2,'choose',{quota_id:target}),/tenggat/);
});
test('database: cross-department selection, tampered student ID, quota reduction, unknown aggregate',async()=>{
 const wrong=await q('Ayun Barokah'),old=await q('Muslim Diesel');await assert.rejects(()=>act(u1,'choose',{quota_id:wrong}),/jurusan/);
 await act(u1,'choose',{quota_id:old,student_id:2});assert.equal((await snap(u1)).registrations[0].student_id,1);
 await assert.rejects(()=>act(admin,'admin_quota',{quota_id:old,kuota:0,terisi_import:0,import_confirmed:true,registration_open:true,reason:'Percobaan mengurangi kapasitas'}),/kuota/);
 const unknownQ=await q('PT. United Tractors Tbk. Cakung');await assert.rejects(()=>act(u2,'choose',{quota_id:unknownQ}),/dikonfirmasi/);
 const a=await snap(admin),broken=a.tempat_pkl.find(p=>p.nama==='PT. Jalur Lintas Maritim Tambak');assert.ok(a.quota_allocations.filter(q=>q.tempat_id===broken.id).every(q=>q.terisi_import===null));
});

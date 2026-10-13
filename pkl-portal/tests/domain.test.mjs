import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeDemo,demoAction,quotaInfo} from '../public/domain.js';
const seed=JSON.parse(await readFile(new URL('../public/demo-data.json',import.meta.url),'utf8'));
const qid=(d,name,wave=1)=>d.quota_allocations.find(q=>q.period_id===wave&&d.tempat_pkl.find(p=>p.id===q.tempat_id)?.nama===name).id;
test('master lengkap dan NIS unik',()=>{assert.equal(seed.students.length,210);assert.equal(new Set(seed.students.map(s=>s.nis)).size,210);assert.equal(seed.tempat_pkl.length,121);assert.equal(seed.quota_allocations.length,242);});
test('kursi terakhir hanya dapat dipilih satu siswa; retry idempotent',()=>{
 let d=makeDemo(seed),id=qid(d,'CV. Risky Sakti Trans Mandiri');
 d=demoAction(d,'student',1,'choose',{quota_id:id}).db;
 d=demoAction(d,'student',1,'choose',{quota_id:id}).db;
 assert.equal(d.registrations.length,1);assert.equal(quotaInfo(d,d.quota_allocations.find(q=>q.id===id)).left,0);
 assert.throws(()=>demoAction(d,'student',2,'choose',{quota_id:id}),/penuh/);
});
test('reset melepaskan kursi dan tidak menghapus siswa/riwayat',()=>{
 let d=makeDemo(seed),id=qid(d,'CV. Risky Sakti Trans Mandiri');d=demoAction(d,'student',1,'choose',{quota_id:id}).db;
 d=demoAction(d,'admin',null,'admin_reset',{student_id:1,period_id:1,reason:'Siswa ingin memilih ulang'}).db;
 assert.equal(d.registrations[0].status,'reset');assert.equal(d.students.length,210);assert.equal(quotaInfo(d,d.quota_allocations.find(q=>q.id===id)).left,1);assert.equal(d.audit.length,2);
});
test('permintaan tidak memesan tujuan; persetujuan penuh tidak merusak pilihan lama',()=>{
 let d=makeDemo(seed),old=qid(d,'Muslim Diesel'),target=qid(d,'CV. Risky Sakti Trans Mandiri');
 d=demoAction(d,'student',1,'choose',{quota_id:old}).db;
 d=demoAction(d,'student',1,'request_change',{quota_id:target,reason:'Lokasi lebih dekat rumah'}).db;
 assert.equal(quotaInfo(d,d.quota_allocations.find(q=>q.id===target)).left,1);
 d=demoAction(d,'student',2,'choose',{quota_id:target}).db;
 assert.throws(()=>demoAction(d,'admin',null,'admin_decide',{request_id:d.requests[0].id,approve:true,reason:'Disetujui pembimbing'}),/penuh/);
 assert.equal(d.registrations.find(r=>r.student_id===1).quota_id,old);assert.equal(d.requests[0].status,'pending');
});
test('batas perubahan, override individual, mode locked, tenggat',()=>{
 let d=makeDemo(seed),old=qid(d,'Muslim Diesel'),target=qid(d,'Pandawa Motor Sumpiuh');
 d=demoAction(d,'student',1,'choose',{quota_id:old}).db;d.periods[0].change_mode='self_service';
 d=demoAction(d,'student',1,'choose',{quota_id:target,reason:'Lokasi lebih dekat'}).db;
 assert.throws(()=>demoAction(d,'student',1,'choose',{quota_id:old,reason:'Kembali ke tempat lama'}),/Batas/);
 d=demoAction(d,'admin',null,'admin_permission',{student_id:1,period_id:1,extra_changes:1,change_override:'self_service',reason:'Izin tambahan pembimbing'}).db;
 d=demoAction(d,'student',1,'choose',{quota_id:old,reason:'Kembali ke tempat lama'}).db;assert.equal(d.registrations[0].change_count,2);
 d.permissions[0].change_override='locked';assert.throws(()=>demoAction(d,'student',1,'choose',{quota_id:target,reason:'Pindah lagi lokasi'}),/dikunci/);
 d.periods[0].deadline='2020-01-01T00:00:00Z';assert.throws(()=>demoAction(d,'student',3,'choose',{quota_id:target}),/tenggat/);
});
test('siswa tidak bisa mengakses aksi admin, memilih jurusan lain, atau kuota kosong',()=>{
 const d=makeDemo(seed);
 assert.throws(()=>demoAction(d,'student',1,'admin_reset',{student_id:2,period_id:1,reason:'Tidak punya akses'}),/admin/);
 assert.throws(()=>demoAction(d,'student',1,'choose',{quota_id:qid(d,'Ayun Barokah')}),/jurusan/);
 assert.throws(()=>demoAction(d,'student',1,'choose',{quota_id:qid(d,'PT. United Tractors Tbk. Cakung')}),/dikonfirmasi/);
});

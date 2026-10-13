export const modes={locked:'Pilihan dikunci',self_service:'Boleh mengganti langsung',admin_approval:'Persetujuan admin'};
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function quotaInfo(db,q) {
 const registered=db.registrations.filter(r=>r.quota_id===q.id&&r.status==='active').length;
 const fresh=q.new_count??registered;
 const known=q.kuota!=null&&q.terisi_import!=null;
 const raw=known?q.kuota-q.terisi_import-fresh:null;
 const period=db.periods.find(p=>p.id===q.period_id);
 const place=db.tempat_pkl.find(p=>p.id===q.tempat_id);
 const over=raw!=null&&raw<0;
 const opened=period?.registration_open&&(!period.deadline||new Date(period.deadline)>new Date());
 const available=known&&q.import_confirmed&&q.registration_open&&opened&&place?.active&&raw>0;
 const label=!known?'Perlu konfirmasi':over?'Melebihi kuota':!q.import_confirmed?'Belum dikonfirmasi':raw===0?'Penuh':!q.registration_open||!opened?'Ditutup':raw<=2?'Hampir penuh':'Tersedia';
 return {fresh,total:known?q.terisi_import+fresh:null,raw,left:known?Math.max(0,raw):null,over,available,label,tone:over||raw===0?'red':available?(raw<=2?'amber':'green'):'gray'};
}
export function currentRegistration(db,sid,pid){return db.registrations.find(r=>r.student_id===sid&&r.period_id===pid);}
export function effectivePermission(db,sid,pid){
 const p=db.periods.find(p=>p.id===pid),x=db.permissions.find(p=>p.student_id===sid&&p.period_id===pid);
 return {mode:x&&x.change_override!=='inherit'?x.change_override:p?.change_mode,limit:(p?.max_changes??0)+(x?.extra_changes??0)};
}
export function makeDemo(seed){
 const d=structuredClone(seed);d.requests=[];d.permissions=[];d.audit=[];d.registrations=[];
 d.periods.forEach(p=>{p.registration_open=true;p.change_mode='admin_approval';p.max_changes=1;p.deadline=null;});
 d.quota_allocations.forEach(q=>{q.import_confirmed=q.kuota!=null&&q.terisi_import!=null;q.registration_open=q.import_confirmed&&q.kuota>=q.terisi_import;delete q.new_count;});
 return d;
}
export function demoAction(db,role,actorStudent,action,payload){
 // Work on a copy: a rejected move never removes the original place.
 const d=structuredClone(db),admin=role==='admin';
 if(action.startsWith('admin_')&&!admin) throw Error('Akses admin diperlukan.');
 const sid=admin&&action.startsWith('admin_')?Number(payload.student_id)||null:actorStudent;
 let pid=Number(payload.period_id),qid=Number(payload.quota_id),why=String(payload.reason||'').trim();
 const reason=()=>{if(why.length<5)throw Error('Isi alasan minimal 5 karakter.');};
 const requireStudent=()=>{if(!d.students.find(s=>s.id===sid&&s.active))throw Error('Siswa tidak aktif atau tidak ditemukan.');};
 const target=(student,quota,requireOpen=true)=>{
   const s=d.students.find(s=>s.id===student&&s.active),q=d.quota_allocations.find(q=>q.id===quota),p=d.tempat_pkl.find(p=>p.id===q?.tempat_id);
   if(!s||!q||!p||s.jurusan!==p.jurusan||!p.active)throw Error('Tempat tidak sesuai jurusan atau siswa tidak aktif.');
   const pe=d.periods.find(p=>p.id===q.period_id),info=quotaInfo(d,q);
   if(requireOpen&&(!pe.registration_open||(pe.deadline&&new Date(pe.deadline)<=new Date())))throw Error('Pendaftaran ditutup atau melewati tenggat.');
   if(!q.import_confirmed||!q.registration_open||info.raw==null)throw Error('Kuota belum dibuka/dikonfirmasi.');
   if(info.raw<=0)throw Error('Kuota tujuan sudah penuh. Pilihan lama tetap tersimpan.');
   return q;
 };
 const change=(student,period,count)=>{
   const pe=d.periods.find(p=>p.id===period),perm=effectivePermission(d,student,period);
   if(!pe.registration_open||(pe.deadline&&new Date(pe.deadline)<=new Date()))throw Error('Periode ditutup atau melewati tenggat.');
   if(perm.mode==='locked')throw Error('Pilihan dikunci. Hubungi admin.');
   if(count>=perm.limit)throw Error('Batas perubahan telah tercapai.');
   return perm.mode;
 };
 const log=(act,student,period,oldq,newq,detail={})=>d.audit.unshift({id:Date.now()+d.audit.length,student_id:student,period_id:period,action:act,old_quota_id:oldq,new_quota_id:newq,reason:why||'Pendaftaran siswa',actor_id:admin?'Admin demo':`Siswa ${actorStudent}`,created_at:new Date().toISOString(),detail});
 const nextId=rows=>Math.max(0,...rows.map(r=>r.id))+1;
 const withdraw=r=>d.requests.filter(x=>x.registration_id===r.id&&x.status==='pending').forEach(x=>{x.status='withdrawn';x.decided_at=new Date().toISOString();});
 let message='Perubahan berhasil disimpan.';
 if(action==='choose'||action==='request_change'){
   requireStudent();const q=d.quota_allocations.find(q=>q.id===qid);if(!q)throw Error('Tempat tidak ditemukan.');pid=q.period_id;
   const r=currentRegistration(d,sid,pid);
   if(r?.status==='active'&&r.quota_id===qid)return {db:d,message:'Pilihan ini sudah tersimpan.'};
   target(sid,qid);
   if(r?.status==='active'){
     const mode=change(sid,pid,r.change_count);reason();
     if(d.requests.some(x=>x.registration_id===r.id&&x.status==='pending'))throw Error('Masih ada pengajuan perubahan yang menunggu.');
     if(mode==='admin_approval'){
       if(action!=='request_change')throw Error('Ajukan perubahan untuk persetujuan admin.');
       d.requests.unshift({id:nextId(d.requests),registration_id:r.id,student_id:sid,period_id:pid,from_quota_id:r.quota_id,target_quota_id:qid,reason:why,status:'pending',created_at:new Date().toISOString()});
       log('request_change',sid,pid,r.quota_id,qid);return {db:d,message:'Pengajuan dikirim. Pilihan lama tetap aktif.'};
     }
     if(action==='request_change')throw Error('Gunakan perubahan langsung.');
   }
   const old=r?.quota_id;
   if(r){r.change_count+=r.status==='active'?1:0;r.quota_id=qid;r.status='active';r.updated_at=new Date().toISOString();}
   else d.registrations.push({id:nextId(d.registrations),student_id:sid,period_id:pid,quota_id:qid,status:'active',change_count:0,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
   log(old?'change':'choose',sid,pid,old,qid);
 } else if(action==='withdraw_request'){
   const req=d.requests.find(r=>r.id===Number(payload.request_id)&&r.student_id===sid&&r.status==='pending');if(!req)throw Error('Pengajuan tidak ditemukan.');req.status='withdrawn';log(action,sid,req.period_id,req.from_quota_id,req.target_quota_id);
 } else if(action==='admin_reset'||action==='admin_move'){
   reason();const r=currentRegistration(d,sid,pid);if(r?.status!=='active')throw Error('Pilihan aktif tidak ditemukan.');const old=r.quota_id;
   if(action==='admin_move'){const q=target(sid,qid,false);if(q.period_id!==pid)throw Error('Gelombang tujuan berbeda.');if(old===qid)throw Error('Tempat tujuan sama.');r.quota_id=qid;r.change_count++;}
   else r.status='reset';
   r.updated_at=new Date().toISOString();withdraw(r);log(action,sid,pid,old,action==='admin_move'?qid:null);
 } else if(action==='admin_decide'){
   reason();const req=d.requests.find(r=>r.id===Number(payload.request_id)&&r.status==='pending');if(!req)throw Error('Pengajuan sudah diproses.');
   if(payload.approve){const r=d.registrations.find(r=>r.id===req.registration_id);if(r.status!=='active'||r.quota_id!==req.from_quota_id)throw Error('Pilihan sudah berubah.');if(change(req.student_id,req.period_id,r.change_count)!=='admin_approval')throw Error('Mode perubahan telah berubah.');target(req.student_id,req.target_quota_id);r.quota_id=req.target_quota_id;r.change_count++;r.updated_at=new Date().toISOString();}
   req.status=payload.approve?'approved':'rejected';req.decided_at=new Date().toISOString();log(req.status,req.student_id,req.period_id,req.from_quota_id,req.target_quota_id);
 } else if(action==='admin_quota'){
   reason();const q=d.quota_allocations.find(q=>q.id===qid);if(!q)throw Error('Kuota tidak ditemukan.');
   const cap=payload.kuota==null||payload.kuota===''?null:Number(payload.kuota),base=payload.terisi_import==null||payload.terisi_import===''?null:Number(payload.terisi_import);
   if([cap,base].some(n=>n!=null&&(!Number.isInteger(n)||n<0)))throw Error('Kuota/terisi harus bilangan bulat nonnegatif.');
   if(payload.import_confirmed&&(cap==null||base==null))throw Error('Isi kuota dan terisi sebelum konfirmasi.');
   const count=quotaInfo(d,q).fresh;
   if(cap!=null&&base!=null&&cap<base+count&&(payload.registration_open||count>0))throw Error('Kuota lebih kecil daripada total terisi.');
   const old=structuredClone(q);Object.assign(q,{kuota:cap,terisi_import:base,import_confirmed:Boolean(payload.import_confirmed),registration_open:Boolean(payload.registration_open)});log(action,null,q.period_id,q.id,q.id,{before:old,after:payload});
 } else if(action==='admin_period'){
   reason();const p=d.periods.find(p=>p.id===pid);if(!p)throw Error('Periode tidak ditemukan.');if(!Object.keys(modes).includes(payload.change_mode)||!Number.isInteger(Number(payload.max_changes))||Number(payload.max_changes)<0)throw Error('Pengaturan tidak valid.');
   const old=structuredClone(p);Object.assign(p,{registration_open:payload.registration_open,change_mode:payload.change_mode,max_changes:Number(payload.max_changes),deadline:payload.deadline||null});log(action,null,pid,null,null,{before:old,after:payload});
 } else if(action==='admin_permission'){
   reason();if(!d.students.some(s=>s.id===sid)||!d.periods.some(p=>p.id===pid))throw Error('Siswa/periode tidak ditemukan.');if(!['inherit',...Object.keys(modes)].includes(payload.change_override)||!Number.isInteger(Number(payload.extra_changes))||Number(payload.extra_changes)<0)throw Error('Izin tidak valid.');
   let p=d.permissions.find(p=>p.student_id===sid&&p.period_id===pid);if(!p){p={student_id:sid,period_id:pid};d.permissions.push(p);}Object.assign(p,{change_override:payload.change_override,extra_changes:Number(payload.extra_changes)});log(action,sid,pid,null,null);
 } else if(action==='admin_student'){
   reason();const email=String(payload.email||'').trim().toLowerCase(),nis=String(payload.nis||'').trim();if(!email.includes('@')||!nis||String(payload.nama_lengkap||'').trim().length<2||!['TAB','TAV','TKJ','TKR'].includes(payload.jurusan))throw Error('Data siswa tidak valid.');
   if(d.students.some(s=>s.id!==sid&&(s.nis===nis||s.email.toLowerCase()===email)))throw Error('NIS/email sudah terdaftar.');
   let s=d.students.find(s=>s.id===sid);if(s&&s.jurusan!==payload.jurusan&&d.registrations.some(r=>r.student_id===sid&&r.status==='active'))throw Error('Reset pilihan sebelum mengubah jurusan.');
   if(!s){s={id:nextId(d.students),is_dummy:true};d.students.push(s);}Object.assign(s,{nis,nama_lengkap:payload.nama_lengkap.trim(),kelas:payload.kelas.trim(),jurusan:payload.jurusan,email,active:payload.active!==false});log(action,s.id,null,null,null);
 } else throw Error('Aksi tidak dikenal.');
 return {db:d,message};
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM,VirtualConsole} from 'jsdom';
const tick=()=>new Promise(r=>setTimeout(r,25));
test('standalone DOM: student choice, admin reset, and inline settings errors',async()=>{
 const html=await readFile(new URL('../demo-preview.html',import.meta.url),'utf8');
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(html,{url:'https://demo.example.test/',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){
  w.structuredClone=structuredClone;
  w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 }});
 const w=dom.window,d=w.document;
 const click=async selector=>{const e=d.querySelector(selector);assert.ok(e,`Missing ${selector}`);assert.equal(e.disabled,false);e.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));await tick();};
 const submit=async selector=>{const f=d.querySelector(selector);assert.ok(f);f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();};
 try{
 await tick();assert.ok(d.body.textContent.includes('Mulai perjalanan PKL.'));
 await submit('[data-form="demo-login"]');assert.ok(d.body.textContent.includes('Halo, Aditya'));
 const seed=w.__PKL_DEMO_SEED__,p=seed.tempat_pkl.find(p=>p.nama==='CV. Risky Sakti Trans Mandiri');
 const id=seed.quota_allocations.find(q=>q.tempat_id===p.id&&q.period_id===1).id;
 await click(`[data-action="choose"][data-id="${id}"]`);
 assert.equal(d.querySelector('#modal').open,true);d.querySelector('#modal input[type="checkbox"]').checked=true;
 await submit('[data-form="choose"]');assert.equal(d.querySelector('#modal').open,false);
 await click('[data-action="nav"][data-tab="selection"]');assert.ok(d.body.textContent.includes('Pilihan tersimpan'));
 await click('[data-action="logout"]');await click('[data-action="login-role"][data-role="admin"]');
 await submit('[data-form="demo-login"]');assert.ok(d.body.textContent.includes('Pemetaan yang lebih terarah.'));
 await click('[data-action="nav"][data-tab="registrations"]');await click('[data-action="admin-reset"][data-id="1"]');
 d.querySelector('#reason').value='Siswa memilih ulang dari sekolah';d.querySelector('#modal input[type="checkbox"]').checked=true;
 await submit('[data-form="reset"]');assert.equal(JSON.parse(w.localStorage.getItem('pkl-connect-demo-v1')).registrations[0].status,'reset');
 await click('[data-action="nav"][data-tab="settings"]');d.querySelector('#reason').value='Pengaturan tidak valid untuk pengujian';d.querySelector('#max_changes').value='-1';
 await submit('[data-form="period"]');const error=d.querySelector('.main .error');assert.equal(error.hidden,false);assert.ok(error.textContent.includes('tidak valid'));
 assert.equal(errors.length,0,errors.map(e=>e.message).join('\n'));
 }finally{w.close();}
});

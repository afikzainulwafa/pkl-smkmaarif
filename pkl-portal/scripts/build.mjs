import {build} from 'esbuild';
import {rm,mkdir,cp,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const url=process.env.SUPABASE_URL || '';
const key=process.env.SUPABASE_PUBLISHABLE_KEY || '';
if(Boolean(url)!==Boolean(key)) throw new Error('Isi SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY sekaligus.');
if(url && !/^https:\/\/[\w-]+\.supabase\.co\/?$/.test(url)) throw new Error('Gunakan URL proyek https://PROJECT.supabase.co');
if(key.startsWith('sb_secret_')) throw new Error('Secret key dilarang pada frontend.');
if(key.startsWith('eyJ')) {
 let role; try {role=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role;} catch {throw new Error('Anon key tidak valid.');}
 if(role!=='anon') throw new Error('Hanya anon key, bukan service_role.');
}
if(key && !key.startsWith('sb_publishable_') && !key.startsWith('eyJ')) throw new Error('Gunakan publishable key atau legacy anon key.');
await rm('dist',{recursive:true,force:true}); await mkdir('dist');
await cp('public','dist',{recursive:true});
await writeFile('dist/config.js','export default '+JSON.stringify({mode:url?'live':'demo',url,key})+';\n');
await build({entryPoints:['public/app.js'],bundle:true,external:['./config.js'],format:'esm',target:'es2022',minify:true,outfile:resolve('dist/app.js')});
// Demo mandiri: bisa dibuka langsung tanpa server, selalu memakai data fiktif.
const preview=await build({entryPoints:['public/app.js'],bundle:true,format:'iife',target:'es2022',minify:true,write:false});
const css=await readFile('public/styles.css','utf8');
const data=(await readFile('public/demo-data.json','utf8')).replaceAll('<','\\u003c');
const html=(await readFile('public/index.html','utf8')).replace('<link rel="stylesheet" href="styles.css">',`<style>${css}</style>`).replace('<script type="module" src="app.js"></script>',`<script>globalThis.__PKL_DEMO_SEED__=${data};</script><script>${preview.outputFiles[0].text.replaceAll('</script','<\\/script')}</script>`);
await writeFile('demo-preview.html',html);
console.log(`Build selesai: ${url?'LIVE — Supabase':'DEMO — data browser saja'}`);

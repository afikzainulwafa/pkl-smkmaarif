import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist'); const port=Number(process.env.PORT || 3000);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
http.createServer(async(req,res)=>{
 try {
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!path.startsWith(root+sep)) {res.writeHead(403);res.end();return;}
 const bytes=await readFile(path);res.setHeader('Content-Type',types[extname(path)] || 'application/octet-stream'); res.end(bytes);
 } catch {res.writeHead(404);res.end('Not found');}
}).listen(port,()=>console.log(`http://localhost:${port} — jalankan npm run build terlebih dahulu`));

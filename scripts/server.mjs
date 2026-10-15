import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, relative, extname, sep} from 'node:path';
const port=Number(process.env.GAME_PORT||4175);
const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.md':'text/plain; charset=utf-8'};
const server=createServer(async(req,res)=>{
  try{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const path=resolve(root,'.'+(name==='/'?'/index.html':name));
    const rel=relative(root,path);
    if(rel==='..'||rel.startsWith('..'+sep)) {res.writeHead(403).end();return;}
    const data=await readFile(path);
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);
  }catch{res.writeHead(404).end('Файл не найден');}
});
server.listen(port,'127.0.0.1',()=>console.log('Мопс: После полуночи — http://127.0.0.1:'+port+'/'));
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Порт 4175 занят. Закройте прежний сервер игры.':e.message);process.exitCode=1;});


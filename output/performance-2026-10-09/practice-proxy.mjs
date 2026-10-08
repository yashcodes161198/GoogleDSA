import http from 'node:http';
import { readFileSync, appendFileSync } from 'node:fs';
import { parse } from 'dotenv';

// Loopback-only synthetic sign-in for browser benchmarking. Never deploy.
const env = parse(readFileSync('.env'));
const fixture = JSON.parse(readFileSync(new URL('./dashboard-fixture.json',import.meta.url)));
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const expires = Math.floor(Date.now()/1000)+7200;
const project = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const session = { access_token:encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:fixture.user.id,aud:'authenticated',role:'authenticated',exp:expires})+'.fixture',
  refresh_token:'fixture-only',token_type:'bearer',expires_in:7200,expires_at:expires,user:fixture.user };
const cookie = 'sb-'+project+'-auth-token=base64-'+encode(session);
const logPath = process.env.PERF_PROXY_LOG;
if (!logPath) throw new Error('PERF_PROXY_LOG required');
http.createServer((request,response)=>{
  const start = performance.now();
  let bytes=0;
  const upstream=http.request({hostname:'127.0.0.1',port:3100,path:request.url,method:request.method,
    headers:{...request.headers,cookie}}, result=>{
      const headersMs=performance.now()-start;
      response.writeHead(result.statusCode,result.headers);
      result.on('data',chunk=>{bytes+=chunk.length;});
      result.pipe(response);
      result.on('end',()=>appendFileSync(logPath,JSON.stringify({at:Date.now(),method:request.method,path:request.url,
        rsc:request.headers.rsc==='1',prefetch:request.headers['next-router-prefetch']==='1',
        status:result.statusCode,bytes,headersMs,totalMs:performance.now()-start})+'\n'));
    });
  upstream.on('error',()=>{response.writeHead(502);response.end('Fixture server unavailable');});
  request.pipe(upstream);
}).listen(3101,'127.0.0.1',()=>console.log('Loopback fixture proxy ready on 3101'));

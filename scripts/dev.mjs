import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const children=[];
function run(args,env={}){const child=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,...env}});children.push(child);child.on('exit',code=>{if(code)console.error(`Processo encerrado com código ${code}`);});return child;}
const migration=run([require.resolve('tsx/cli'),'lib/db/src/migrate.ts']);
await new Promise((resolve,reject)=>migration.on('exit',code=>code===0?resolve():reject(new Error('Falha na migração'))));
run([require.resolve('tsx/cli'),'watch','artifacts/api-server/src/index.ts']);
const vite=createRequire(new URL('../artifacts/nativos-precificacao/package.json',import.meta.url)).resolve('vite/package.json').replace(/package\.json$/, 'bin/vite.js');
run([vite,'--config','artifacts/nativos-precificacao/vite.config.ts'],{PORT:process.env.WEB_PORT||'5173'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{for(const child of children)child.kill();process.exit();});

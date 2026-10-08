import path from 'node:path';
import { existsSync } from 'node:fs';
import express,{type Express,type ErrorRequestHandler} from 'express';
import { clerkMiddleware } from '@clerk/express';
import { ZodError } from 'zod';
import router from './routes';
import { HttpError } from './lib/validation';
const app:Express=express();
app.disable('x-powered-by');
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin){const allowed=new Set((process.env.APP_ORIGINS||'http://localhost:5173,http://127.0.0.1:5173').split(','));if(!allowed.has(req.headers.origin)){res.status(403).json({error:'Origem não autorizada.'});return;}}
  next();
});
app.use(express.json({limit:'8mb'}));
app.get('/api/runtime',(_req,res)=>res.json({authenticationConfigured:!!process.env.CLERK_SECRET_KEY,databaseMode:process.env.DATABASE_MODE==='local'?'local':'postgresql'}));
if(process.env.CLERK_SECRET_KEY)app.use(clerkMiddleware({publishableKey:process.env.CLERK_PUBLISHABLE_KEY,secretKey:process.env.CLERK_SECRET_KEY}));
else app.use('/api',(_req,res,next)=>{if(_req.path==='/healthz')return next();res.status(503).json({error:'Configure CLERK_SECRET_KEY e CLERK_PUBLISHABLE_KEY no .env para habilitar o login.'});});
app.use('/api',router);
export const errorHandler:ErrorRequestHandler=(error,_req,res,_next)=>{
  if(error instanceof ZodError){res.status(400).json({error:'Revise os campos informados.',fields:error.issues.map(x=>({field:x.path.join('.'),message:x.message}))});return;}
  if(error instanceof HttpError){res.status(error.status).json({error:error.message});return;}
  if(error?.type==='entity.too.large'){res.status(413).json({error:'Arquivo ou pedido grande demais.'});return;}
  console.error('Falha interna:',error instanceof Error?error.message:'erro desconhecido');res.status(500).json({error:'Não foi possível concluir a operação. Tente novamente.'});
};
app.use('/api',(_req,res)=>res.status(404).json({error:'Endpoint não encontrado.'}));
const publicDir=path.resolve(process.env.PUBLIC_DIR || 'artifacts/nativos-precificacao/dist/public');
if (existsSync(publicDir)) { app.use(express.static(publicDir)); app.get('/{*path}',(_req,res)=>res.sendFile(path.join(publicDir,'index.html'))); }
app.use(errorHandler);
export default app;

import app from './app';
const port=Number(process.env.API_PORT||process.env.PORT||5000);
if(!Number.isInteger(port)||port<=0)throw new Error('Porta inválida.');
app.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`API: http://localhost:${port}`));

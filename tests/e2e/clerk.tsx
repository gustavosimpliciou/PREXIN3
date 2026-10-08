import React from 'react';
// Only used by Vite's explicit e2e mode. Never imported by a production build.
export const ClerkProvider=({children}:any)=><>{children}</>;
export const Show=({when,children}:any)=>when==='signed-in'?<>{children}</>:null;
export const SignIn=()=> <div>Autenticação simulada exclusivamente no teste.</div>;
export const SignUp=SignIn;
const listener=()=>()=>{};
export const useClerk=()=>({addListener:listener,signOut:()=>{}});
export const useUser=()=>({user:{firstName:'Teste',fullName:'Conta de teste',primaryEmailAddress:{emailAddress:'teste@example.test'}}});

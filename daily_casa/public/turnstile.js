// 3.24 · Cloudflare Turnstile no login e na recuperação de palavra-passe (só nos acessos pelo túnel).
// O servidor indica no arranque se a verificação é precisa (`window.dcTurnstile` = chave do site); em casa e dentro do
// Home Assistant fica vazio e nada disto corre. O widget só aparece se a Cloudflare precisar de interação.
(function(){
 'use strict';
 const SRC='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
 const ROUTES={'/api/login':'login','/api/password/forgot':'recover','/api/password/reset':'recover'};
 let loading=null;const widgets=new Map(); // form -> {id, action, token, waiters}
 const key=()=>window.dcTurnstile||'';
 const dark=()=>document.documentElement.classList.contains('theme-dark')||document.documentElement.dataset.theme==='dark'||(!document.documentElement.dataset.theme&&matchMedia('(prefers-color-scheme: dark)').matches);

 function load(){
  if(window.turnstile)return Promise.resolve(window.turnstile);
  if(loading)return loading;
  loading=new Promise((ok,ko)=>{const s=document.createElement('script');s.src=SRC;s.async=true;s.defer=true;
   s.onload=()=>{const t0=Date.now();(function wait(){if(window.turnstile)return ok(window.turnstile);if(Date.now()-t0>8000)return ko(new Error('timeout'));setTimeout(wait,50);})();};
   s.onerror=()=>{loading=null;ko(new Error('load'));};document.head.appendChild(s);});
  return loading;
 }
 const formFor=action=>action==='login'?document.getElementById('auth-form'):document.getElementById('forgot-form');

 async function ensure(form,action){
  let w=widgets.get(form);if(w&&w.box.isConnected)return w;
  const ts=await load();
  const box=document.createElement('div');box.className='ts-box';
  const submit=form.querySelector('.auth-submit');(submit||form.lastElementChild).before(box);
  w={box,action,token:'',waiters:[]};widgets.set(form,w);
  const settle=(tok,err)=>{w.token=tok||'';const ws=w.waiters.splice(0);ws.forEach(f=>f(tok,err));};
  w.id=ts.render(box,{sitekey:key(),action,appearance:'interaction-only',size:'flexible',theme:dark()?'dark':'light',
   callback:t=>settle(t),'expired-callback':()=>{w.token='';},'error-callback':()=>{settle('',new Error('Não foi possível completar a verificação de segurança. Tenta outra vez.'));return true;}});
  return w;
 }
 async function token(action){
  const form=formFor(action);if(!form)throw new Error('Formulário não encontrado.');
  let w;try{w=await ensure(form,action);}catch{throw new Error('Não foi possível carregar a verificação de segurança. Verifica a ligação e tenta outra vez.');}
  if(w.token)return w.token;
  return new Promise((ok,ko)=>{const timer=setTimeout(()=>ko(new Error('Confirma a verificação de segurança por cima do botão e tenta outra vez.')),45000);
   w.waiters.push((tok,err)=>{clearTimeout(timer);tok?ok(tok):ko(err||new Error('Verificação de segurança falhou.'));});});
 }
 function reset(action){const form=formFor(action);const w=form&&widgets.get(form);if(w&&window.turnstile){w.token='';try{window.turnstile.reset(w.id);}catch{}}}

 // Acrescenta o token aos três pedidos protegidos. Cada token só serve uma vez: depois de cada pedido pede-se um novo.
 if(typeof api==='function'){const orig=api;api=async function(endpoint,method,data,extra){
  const action=ROUTES[String(endpoint).split('?')[0]];
  if(!action||!key()||String(method).toUpperCase()!=='POST')return orig.apply(this,arguments);
  const t=await token(action);
  try{return await orig.call(this,endpoint,method,{...(data||{}),turnstileToken:t},extra);}finally{reset(action);}
 };}

 // Prepara o widget assim que o formulário aparece, para o token estar pronto quando se carrega no botão.
 let queued=false;const tick=()=>{queued=false;if(!key())return;
  const a=document.getElementById('auth-form');if(a&&!a.querySelector('[name=name]'))ensure(a,'login').catch(()=>{});
  const f=document.getElementById('forgot-form');if(f)ensure(f,'recover').catch(()=>{});};
 const mo=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(tick);});
 const start=()=>{mo.observe(document.body,{childList:true,subtree:true});tick();};
 if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
})();

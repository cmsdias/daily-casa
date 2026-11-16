// 3.23 · Passkeys: entrar com Face ID / Touch ID (iPhone) ou impressão digital / rosto (Android).
// A cara e o dedo nunca saem do telemóvel: o servidor só guarda uma chave pública.
// Só aparece quando o servidor diz que está disponível (endereço público em HTTPS) e o browser suporta.
(function(){
 'use strict';
 const B=s=>Uint8Array.from(atob(String(s).replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(String(s).length/4)*4,'=')),c=>c.charCodeAt(0));
 const S=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const supported=()=>!!(window.dcPasskeys&&window.PublicKeyCredential&&window.isSecureContext&&navigator.credentials);
 const IS_APPLE=/iPhone|iPad|Macintosh/.test(navigator.userAgent),IS_ANDROID=/Android/.test(navigator.userAgent);
 const METHOD=IS_APPLE?'Face ID ou Touch ID':IS_ANDROID?'impressão digital ou rosto':'Face ID ou impressão digital';
 const deviceName=()=>{const u=navigator.userAgent;return /iPhone/.test(u)?'iPhone':/iPad/.test(u)?'iPad':/Android/.test(u)?'Android':/Macintosh/.test(u)?'Mac':/Windows/.test(u)?'Windows':'Este dispositivo';};
 const cancelled=e=>e&&(e.name==='NotAllowedError'||e.name==='AbortError');
 const safe=f=>{try{return f();}catch{return null;}};

 async function createPasskey(currentPassword){
  const o=await api('/api/passkeys/register/options','POST',currentPassword?{currentPassword}:{});
  const cred=await navigator.credentials.create({publicKey:{...o,challenge:B(o.challenge),user:{...o.user,id:B(o.user.id)},excludeCredentials:(o.excludeCredentials||[]).map(c=>({...c,id:B(c.id)}))}});
  const r=cred.response;
  const body={id:cred.id,rawId:S(cred.rawId),type:cred.type,response:{clientDataJSON:S(r.clientDataJSON),attestationObject:S(r.attestationObject),transports:typeof r.getTransports==='function'?r.getTransports():[]}};
  return api('/api/passkeys/register','POST',{credential:body,name:deviceName()});
 }

 // ---- Entrar ----
 async function loginWithPasskey(btn){
  const msg=document.getElementById('auth-error');if(msg)msg.textContent='';btn.disabled=true;
  try{
   const o=await api('/api/passkeys/login/options','POST',{});
   const a=await navigator.credentials.get({publicKey:{challenge:B(o.challenge),rpId:o.rpId,timeout:o.timeout,userVerification:'required'}});
   const r=a.response;
   const res=await api('/api/passkeys/login','POST',{credential:{id:a.id,rawId:S(a.rawId),type:a.type,response:{clientDataJSON:S(r.clientDataJSON),authenticatorData:S(r.authenticatorData),signature:S(r.signature),userHandle:r.userHandle?S(r.userHandle):''}}});
   if(res.user?.mustChangePassword){store.user=res.user;renderForcePassword();return;}
   location.replace(location.pathname+location.search);
  }catch(e){if(msg)msg.textContent=cancelled(e)?'':(e.message||'Não foi possível entrar com a passkey.');}
  finally{btn.disabled=false;}
 }
 function addLoginButton(){
  const f=document.getElementById('auth-form');if(!f||!supported()||f.querySelector('.pk-login')||f.querySelector('[name=name]'))return;
  const submit=f.querySelector('.auth-submit');if(!submit)return;
  const wrap=document.createElement('div');wrap.className='pk-login';
  wrap.innerHTML=`<div class="pk-or" aria-hidden="true"><span>ou</span></div><button type="button" class="button pk-login-btn">${typeof ico==='function'?ico('lock'):''}<span>Entrar com ${METHOD}</span></button>`;
  submit.after(wrap);wrap.querySelector('button').addEventListener('click',e=>loginWithPasskey(e.currentTarget));
  // Depois de entrar com a palavra-passe, a app oferece ativar a passkey (uma vez por dispositivo).
  f.addEventListener('submit',()=>{safe(()=>sessionStorage.setItem('dc-pk-offer','1'));},true);
 }
 if(typeof renderAuth==='function'){const orig=renderAuth;renderAuth=function(){const r=orig.apply(this,arguments);addLoginButton();return r;};}
 addLoginButton();

 // ---- Oferta depois de entrar ----
 async function maybeOffer(){
  if(!safe(()=>sessionStorage.getItem('dc-pk-offer')))return;safe(()=>sessionStorage.removeItem('dc-pk-offer'));
  if(!supported()||safe(()=>localStorage.getItem('dc-pk-asked'))||typeof store==='undefined'||!store.user)return;
  try{const l=await api('/api/passkeys');if(!l.available||l.passkeys.length)return;}catch{return;}
  safe(()=>localStorage.setItem('dc-pk-asked',new Date().toISOString().slice(0,10)));
  const yes=await confirmDialog({title:`Entrar com ${METHOD}?`,message:'Da próxima vez entras sem escrever a palavra-passe. A tua cara ou o teu dedo nunca saem do telemóvel. Podes desativar no perfil.',confirmLabel:'Ativar',cancelLabel:'Agora não'});
  if(!yes)return;
  try{await createPasskey();toast(`Pronto. Da próxima vez podes entrar com ${METHOD}.`);}catch(e){if(!cancelled(e))toast(e.message||'Não foi possível ativar.');}
 }

 // ---- Perfil ----
 const fmt=d=>d?new Date(d).toLocaleDateString('pt-PT',{day:'numeric',month:'short',year:'numeric'}):'';
 async function fillSection(el){
  el.dataset.ready='1';
  if(!window.PublicKeyCredential){el.hidden=true;return;}
  let l;try{l=await api('/api/passkeys');}catch{el.hidden=true;return;}
  if(!el.isConnected)return;el.hidden=false;
  const rows=l.passkeys.map(k=>`<li><div><b></b><small>Ativada a ${esc(fmt(k.createdAt))}${k.lastUsedAt?' · última entrada a '+esc(fmt(k.lastUsedAt)):''}</small></div><button type="button" class="button small danger-soft" data-pk-remove="${esc(k.id)}">Remover</button></li>`).join('');
  el.innerHTML=`<h3>Face ID e impressão digital</h3>
   <p class="field-help">Entra sem escrever a palavra-passe. A tua cara ou o teu dedo nunca saem do dispositivo; a app só guarda uma chave pública.</p>
   ${l.passkeys.length?`<ul class="pk-list">${rows}</ul>`:''}
   ${l.available&&supported()?`<div class="pk-confirm" hidden><div class="field"><label for="pk-password">Confirma a tua palavra-passe</label><input id="pk-password" type="password" autocomplete="current-password"/></div></div><button type="button" class="button" data-pk-add>${typeof ico==='function'?ico('lock'):''}<span>Ativar neste ${esc(deviceName()==='Este dispositivo'?'dispositivo':deviceName())}</span></button>`
     :`<p class="field-help">Para ativar, abre a app pelo endereço público da casa (com HTTPS). Dentro do Home Assistant usa-se a palavra-passe.</p>`}`;
  [...el.querySelectorAll('.pk-list b')].forEach((b,i)=>{b.textContent=l.passkeys[i].name;});
  el.querySelector('[data-pk-add]')?.addEventListener('click',async e=>{const btn=e.currentTarget;btn.disabled=true;const pw=el.querySelector('#pk-password');
   try{await createPasskey(pw&&pw.value||'');toast(`Pronto. Já podes entrar com ${METHOD}.`);fillSection(el);}
   catch(err){if(cancelled(err)){}else if(err&&err.name==='InvalidStateError')toast('Este dispositivo já tem uma passkey ativa.');else if(/Confirma a tua palavra-passe/.test(err.message||'')){el.querySelector('.pk-confirm').hidden=false;if(pw&&pw.value&&window.fieldError)fieldError(pw,'Palavra-passe errada.');pw&&pw.focus();}else toast(err.message||'Não foi possível ativar.');}
   finally{btn.disabled=false;}});
  el.querySelectorAll('[data-pk-remove]').forEach(b=>b.addEventListener('click',async()=>{
   if(!await confirmDialog({title:'Remover esta passkey?',message:'Deixas de poder entrar com ela. Podes voltar a ativar quando quiseres.',confirmLabel:'Remover',danger:true}))return;
   try{await api('/api/passkeys/'+encodeURIComponent(b.dataset.pkRemove),'DELETE');toast('Passkey removida.');fillSection(el);}catch(e){toast(e.message);}}));
 }

 // ---- Administrador: remover as passkeys de alguém ----
 if(typeof actionHandlers!=='undefined')actionHandlers.push(async(name,el)=>{if(name!=='person-passkeys-clear')return false;
  const p=people().find(x=>x.id===el.dataset.id);if(!p)return true;
  if(!await confirmDialog({title:`Remover as passkeys de ${p.name.split(' ')[0]}?`,message:'Deixa de poder entrar com Face ID ou impressão digital até voltar a ativar no perfil. A palavra-passe continua a funcionar.',confirmLabel:'Remover',danger:true}))return true;
  try{const r=await api('/api/people/'+encodeURIComponent(p.id)+'/passkeys','DELETE');toast(r.removed===1?'1 passkey removida.':r.removed+' passkeys removidas.');await reload();}catch(e){toast(e.message);}return true;});

 let queued=false;
 const tick=()=>{queued=false;const el=document.getElementById('pk-section');if(el&&!el.dataset.ready&&typeof demo!=='undefined'&&!demo)fillSection(el);if(typeof store!=='undefined'&&store.user&&document.querySelector('#content, main.main'))maybeOffer();};
 const mo=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(tick);});
 const start=()=>{mo.observe(document.body,{childList:true,subtree:true});tick();};
 if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
})();

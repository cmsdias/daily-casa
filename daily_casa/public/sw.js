const VERSION='daily-casa-v2-3-0';
const SHELL=['./','./index.html','./style.css?v=3.19.1','./theme-dark.css?v=3.19.1','./theme-init.js?v=3.19.1','./app.js?v=3.19.1','./features.js?v=3.19.1','./finance-core.js?v=3.19.1','./shopping-units.js?v=3.19.1','./finance-ui.js?v=3.19.1','./house-core.js?v=3.19.1','./shell.js?v=3.19.1','./today.js?v=3.19.1','./weather.js?v=3.19.1','./tasks-view.js?v=3.19.1','./equipment-ui.js?v=3.19.1','./shopping-store.js?v=3.19.1','./onboarding.js?v=3.19.1','./approvals.js?v=3.19.1','./incidents-ui.js?v=3.19.1','./offline.js?v=3.19.1','./datepicker.js?v=3.19.1','./search.js?v=3.19.1','./motion.js?v=3.19.1','./manifest.webmanifest','./fonts/instrument-sans-latin-wght-normal.woff2','./fonts/instrument-sans-latin-ext-wght-normal.woff2','./logo-mark.svg','./logo-mark-light.svg','./logo-primary-light.svg','./logo-primary-dark.svg','./icon.svg','./icon-maskable-512.png','./apple-touch-icon.png','./icon-192.png','./icon-512.png','./assets/casa-detail.svg','./assets/botanical-editorial.svg','./assets/electric-editorial.svg','./assets/plumbing-editorial.svg','./assets/storage-editorial.svg','./assets/coffee-editorial.svg','./assets/laundry-editorial.svg','./assets/office-editorial.svg','./assets/outdoor-editorial.svg','./assets/cleaning-editorial.svg','./assets/bath-editorial.svg','./assets/general-editorial.svg','./assets/sala-editorial.svg','./assets/alpendre-editorial.svg','./assets/hall-editorial.svg','./assets/corredor-editorial.svg','./assets/quarto-nascente-editorial.svg','./assets/quarto-poente-editorial.svg','./assets/quarto-principal-editorial.svg','./assets/wc-duche-editorial.svg','./assets/terraco-editorial.svg','./assets/garagem-editorial.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);if(e.request.method!=='GET'||u.pathname.includes('/api/'))return;
 // 3.19: a página abre da cópia guardada se a rede demorar mais de 1,2 s (a cópia nova fica guardada para a próxima).
 if(e.request.mode==='navigate'){e.respondWith((async()=>{const cache=await caches.open(VERSION);const net=fetch(e.request).then(r=>{if(r.ok&&r.type==='basic')cache.put('./index.html',r.clone());return r;});
  const cached=await cache.match('./index.html');if(!cached)return net.catch(()=>Response.error());
  const timer=new Promise(ok=>setTimeout(()=>ok(null),1200));try{const r=await Promise.race([net,timer]);if(r)return r;}catch{}return cached;})());return;}
 // Ficheiros com versão (?v=): nunca mudam, por isso saem da cópia guardada (abre logo, mesmo com rede fraca).
 if(u.searchParams.has('v')&&(e.request.destination==='script'||e.request.destination==='style')){e.respondWith(caches.match(e.request).then(v=>v||fetch(e.request).then(async r=>{if(r.ok){const c=await caches.open(VERSION);await c.put(e.request,r.clone());}return r;})));return;}
 // Restantes scripts e CSS: rede primeiro para apresentar imediatamente atualizações.
 if(e.request.destination==='script'||e.request.destination==='style'||/\\.(?:js|css)$/.test(u.pathname)){
  e.respondWith((async()=>{try{const fresh=await fetch(e.request,{cache:'no-store'});if(fresh.ok){const cache=await caches.open(VERSION);await cache.put(e.request,fresh.clone());}return fresh;}catch{return (await caches.match(e.request))||Response.error();}})());return;
 }
 e.respondWith(caches.match(e.request).then(v=>v||fetch(e.request)));
});
// 3.3 · Notificações push: mostrar e, ao tocar, abrir (ou focar) a app na notificação certa.
self.addEventListener('push',e=>{
 let d={};try{d=e.data?e.data.json():{};}catch{d={title:'Daily Casa',body:e.data?e.data.text():''};}
 e.waitUntil(self.registration.showNotification(d.title||'Daily Casa',{body:d.body||'',tag:d.tag||undefined,icon:'./icon-192.png',badge:'./favicon-32.png',data:{url:d.url||'./'},lang:'pt-PT'}));
});
self.addEventListener('notificationclick',e=>{
 e.notification.close();const url=new URL(e.notification.data?.url||'./',self.registration.scope).href;
 e.waitUntil((async()=>{const all=await clients.matchAll({type:'window',includeUncontrolled:true});
  const c=all.find(w=>w.url.startsWith(self.registration.scope));
  if(c){try{await c.focus();}catch{}c.postMessage({type:'open-notification',url});return;}
  await clients.openWindow(url);})());
});

// 3.19 · Envio em segundo plano (Android): as alterações feitas sem rede seguem quando a ligação voltar, mesmo com a app fechada.
// Cada uma leva o seu identificador (X-Op-Id); se a app também a enviar depois, o servidor reconhece-a e não a repete.
function outboxAll(){return new Promise(ok=>{try{const r=indexedDB.open('daily-casa',1);r.onupgradeneeded=()=>r.result.createObjectStore('outbox',{keyPath:'opId'});r.onerror=()=>ok({db:null,items:[]});
 r.onsuccess=()=>{const db=r.result;const tx=db.transaction('outbox','readonly');const q=tx.objectStore('outbox').getAll();q.onsuccess=()=>ok({db,items:(q.result||[]).sort((a,b)=>String(a.at).localeCompare(String(b.at)))});q.onerror=()=>ok({db,items:[]});};}catch{ok({db:null,items:[]});}});}
async function flushOutbox(){const {db,items}=await outboxAll();if(!db||!items.length)return;const sent=[];
 for(const q of items){if(String(q.endpoint).includes('/tmp-'))break;let r;try{r=await fetch(new URL(q.endpoint.replace(/^\//,''),self.registration.scope).href,{method:q.method,credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json','X-Casa-Request':'1','X-Op-Id':q.opId},body:JSON.stringify(q.data||{})});}catch{throw Error('sem rede');}
  if(r.status===401||r.status>=500)break;sent.push(q.opId);await new Promise(ok=>{const tx=db.transaction('outbox','readwrite');tx.objectStore('outbox').delete(q.opId);tx.oncomplete=ok;tx.onerror=ok;});}
 if(sent.length){const all=await clients.matchAll({type:'window',includeUncontrolled:true});for(const c of all)c.postMessage({type:'outbox-sent',ids:sent});}}
self.addEventListener('sync',e=>{if(e.tag==='dc-outbox')e.waitUntil(flushOutbox());});

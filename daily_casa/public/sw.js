const VERSION='daily-casa-v2-3-0';
const SHELL=['./','./index.html','./style.css?v=3.9.5','./theme-dark.css?v=3.9.5','./theme-init.js?v=3.9.5','./app.js?v=3.9.5','./features.js?v=3.9.5','./finance-core.js?v=3.9.5','./shopping-units.js?v=3.9.5','./finance-ui.js?v=3.9.5','./house-core.js?v=3.9.5','./shell.js?v=3.9.5','./today.js?v=3.9.5','./tasks-view.js?v=3.9.5','./equipment-ui.js?v=3.9.5','./shopping-store.js?v=3.9.5','./onboarding.js?v=3.9.5','./approvals.js?v=3.9.5','./incidents-ui.js?v=3.9.5','./offline.js?v=3.9.5','./manifest.webmanifest','./fonts/instrument-sans-latin-wght-normal.woff2','./fonts/instrument-sans-latin-ext-wght-normal.woff2','./logo-mark.svg','./logo-mark-light.svg','./logo-primary-light.svg','./logo-primary-dark.svg','./icon.svg','./icon-maskable-512.png','./apple-touch-icon.png','./icon-192.png','./icon-512.png','./assets/casa-detail.svg','./assets/botanical-editorial.svg','./assets/electric-editorial.svg','./assets/plumbing-editorial.svg','./assets/storage-editorial.svg','./assets/coffee-editorial.svg','./assets/laundry-editorial.svg','./assets/office-editorial.svg','./assets/outdoor-editorial.svg','./assets/cleaning-editorial.svg','./assets/bath-editorial.svg','./assets/general-editorial.svg','./assets/sala-editorial.svg','./assets/alpendre-editorial.svg','./assets/hall-editorial.svg','./assets/corredor-editorial.svg','./assets/quarto-nascente-editorial.svg','./assets/quarto-poente-editorial.svg','./assets/quarto-principal-editorial.svg','./assets/wc-duche-editorial.svg','./assets/terraco-editorial.svg','./assets/garagem-editorial.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);if(e.request.method!=='GET'||u.pathname.includes('/api/'))return;
 if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('./index.html')));return;}
 // HTML, scripts e CSS: rede primeiro para apresentar imediatamente atualizações.
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

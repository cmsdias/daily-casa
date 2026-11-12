/* Daily Casa — abrir já, responder já, funcionar sem rede (2.0, revisto na 3.19)
 * - Dados guardados no dispositivo depois de cada atualização (sem finanças nem auditoria). Ao abrir, a app
 *   mostra-os logo e vai buscar os novos em segundo plano (barra no topo enquanto atualiza).
 * - Atualizações otimistas: concluir tarefas, marcar subtarefas, mexer nas compras e registar horas aparecem
 *   feitos no instante. O pedido segue numa fila; sem rede, fica guardado e é enviado quando a ligação voltar.
 * - Cada ação leva um identificador único (X-Op-Id): se chegar duas vezes ao servidor, conta só uma.
 * - No Android, a fila também é enviada em segundo plano com a app fechada (Background Sync). No iPhone,
 *   é enviada quando a app volta a abrir.
 * - Os dados guardados são apagados ao terminar sessão, ao mudar de pessoa ou quando a sessão expira.
 * Na demonstração nada disto é necessário (os dados já estão no dispositivo).
 */
'use strict';
const CACHE_KEY='casa-cache-v2',QUEUE_KEY='casa-fila';
const readJSON=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d;}catch{return d;}};
const writeJSON=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}};
let queue=readJSON(QUEUE_KEY,[]);if(!Array.isArray(queue))queue=[];
const newOpId=()=>{try{return crypto.randomUUID().replace(/-/g,'');}catch{return Date.now().toString(36)+Math.random().toString(36).slice(2,12);}};
for(const q of queue)if(!q.opId)q.opId=newOpId(); // filas antigas (antes da 3.19)
const pendingCount=()=>queue.length;

/* Cópia da fila na base de dados do navegador, para o envio em segundo plano (o service worker não lê localStorage). */
const IDB={db:null,open(){if(this.db)return this.db;this.db=new Promise((ok,no)=>{try{const r=indexedDB.open('daily-casa',1);r.onupgradeneeded=()=>{r.result.createObjectStore('outbox',{keyPath:'opId'});};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);}catch(e){no(e);}});return this.db;},
 async run(mode,fn){try{const db=await this.open();return await new Promise((ok,no)=>{const tx=db.transaction('outbox',mode);const st=tx.objectStore('outbox');const r=fn(st);tx.oncomplete=()=>ok(r?.result);tx.onerror=()=>no(tx.error);});}catch{return null;}},
 put(item){return this.run('readwrite',st=>st.put(item));},del(id){return this.run('readwrite',st=>st.delete(id));},clear(){return this.run('readwrite',st=>st.clear());}};
function saveQueue(){writeJSON(QUEUE_KEY,queue);}
function requestBgSync(){try{navigator.serviceWorker?.ready.then(r=>r.sync?.register('dc-outbox')).catch(()=>{});}catch{}}
function offlineClear(){try{localStorage.removeItem(CACHE_KEY);localStorage.removeItem(QUEUE_KEY);localStorage.removeItem('casa-cache');}catch{}queue=[];IDB.clear();}

function offlineBanner(){
 const n=queue.length;
 if(!offline)return n>1||(n&&queueStuck())?`<div class="offline-banner sending">${ico('refresh')} A enviar ${plural(n,'alteração','alterações')}…</div>`:'';
 const at=readJSON(CACHE_KEY,null)?.at;const when=at?new Date(at):null;const hhmm=when?when.toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}):'';const day=when?(when.toDateString()===new Date().toDateString()?'hoje':when.toLocaleDateString('pt-PT',{day:'numeric',month:'short'}).replace('.','')):'';
 return `<div class="offline-banner">${ico('wifi-off')}<span><b>Sem ligação${when?` · dados de ${day} às ${hhmm}`:''}.</b> Podes consultar, concluir tarefas, mexer nas compras e registar horas${n?` (${plural(n,'alteração','alterações')} por enviar)`:''}; o resto fica disponível quando a ligação voltar.</span></div>`;
}
let queueSince=0;const queueStuck=()=>queue.length&&queueSince&&Date.now()-queueSince>2500;

/* Abrir já: mostra os dados guardados enquanto vai buscar os novos. */
function instantBoot(){if(demo)return false;const c=readJSON(CACHE_KEY,null);if(!c?.state?.user?.id)return false;store=c.state;replayQueue();render();loadStart();return true;}
function offlineBoot(){if(demo)return false;const c=readJSON(CACHE_KEY,null);if(!c?.state?.user)return false;store=c.state;replayQueue();offline=true;render();return true;}
// Depois de cada leitura bem-sucedida, guarda os dados e volta a aplicar o que ainda está na fila.
const loadOnline=load;
load=async function(){
 // Com alterações por enviar e rede: o ecrã já as mostra; envia-as e só depois lê do servidor (sem esperar aqui).
 if(queue.length&&!demo&&!offline&&store.user?.id){flushQueue();return;}
 await loadOnline();
 if(!demo&&store.user){const {audit,...rest}=store;writeJSON(CACHE_KEY,{at:new Date().toISOString(),state:rest});}
 if(queue.length){replayQueue();queueMicrotask(()=>flushQueue());}
};

const offIsCollab=()=>store.user?.role==='collaborator';
const QUEUEABLE=[
 [/^\/api\/tasks\/[^/]+\/complete$/,'POST',()=>!offIsCollab()],
 [/^\/api\/shopping\/[^/]+$/,'PATCH'],
 [/^\/api\/shopping$/,'POST'],
 [/^\/api\/tasks\/[^/]+$/,'PATCH',b=>Object.keys(b||{}).every(k=>['status','subtasks','thisWeek'].includes(k))&&!(offIsCollab()&&b.status==='done')],
 [/^\/api\/worklogs$/,'POST'],
];
const canQueue=(ep,m,b)=>!demo&&QUEUEABLE.some(([re,mm,ok])=>re.test(ep)&&mm===m&&(!ok||ok(b)));
// Aplica a alteração aos dados no ecrã, como o servidor faria.
function applyLocally(ep,method,b,q){
 let m;const tmp=q?.tempId||('tmp-'+(q?.opId||newOpId()).slice(0,12));
 if((m=ep.match(/^\/api\/tasks\/([^/]+)\/complete$/))){const t=tasks().find(x=>x.id===m[1]);if(!t)return {};store.history=[...(store.history||[]),{id:'tmp-h-'+(q?.opId||''),taskId:t.id,title:t.title,kind:t.kind,assignedTo:t.assignedTo,by:store.user.id,at:q?.at||new Date().toISOString()}];
  if(t.kind==='routine'&&t.repeat!=='none'){t.dueDate=nextDemoDate(t.dueDate,t.repeat);t.status='todo';if(Array.isArray(t.rotation)&&t.rotation.length>1){const i=t.rotation.indexOf(t.assignedTo);t.assignedTo=t.rotation[(i+1)%t.rotation.length];}}else{t.status='done';t.completedBy=store.user.id;}return {task:t};}
 if((m=ep.match(/^\/api\/tasks\/([^/]+)$/))){const t=tasks().find(x=>x.id===m[1]);if(t){Object.assign(t,b);if(t.status!=='done')delete t.completedBy;}return {task:t};}
 if(ep==='/api/shopping'){if(shopping().some(x=>x.id===tmp))return {item:shopping().find(x=>x.id===tmp),tempId:tmp};const item={...b,id:tmp,purchased:false,createdBy:store.user.id,quantity:b.quantity||'1',unit:b.unit||'',category:b.category||guessShopCategory(b.title)||'Outros',pending:true};store.shopping=[...shopping(),item];return {item,tempId:item.id};}
 if((m=ep.match(/^\/api\/shopping\/([^/]+)$/))){const it=shopping().find(x=>x.id===m[1]);if(it)Object.assign(it,b);return {item:it};}
 if(ep==='/api/worklogs'){const ids=Array.isArray(b.userIds)&&b.userIds.length?b.userIds:[b.userId||store.user.id];const gid=ids.length>1?'tmp-g-'+tmp:null;const at=q?.at||new Date().toISOString();
  const entries=ids.map((uid,i)=>({id:`${tmp}-${i}`,taskId:b.taskId||null,userId:uid,actor:store.user.id,date:b.date,minutes:Number(b.minutes)||0,note:b.note||'',createdAt:at,pending:true,...(gid?{groupId:gid}:{})}));
  store.workLogs=[...workLogs().filter(x=>!String(x.id).startsWith(tmp)),...entries];return {entry:entries[0],entries};}
 return {};
}
function replayQueue(){for(const q of queue){try{applyLocally(q.endpoint,q.method,q.data,q);}catch{}}}
function enqueue(ep,method,b){
 const opId=newOpId();const at=new Date().toISOString();const q={opId,endpoint:ep,method,data:b,at,by:store.user?.id};
 const res=applyLocally(ep,method,b,q);
 // Um produto criado há instantes e alterado logo a seguir: junta a alteração ao próprio pedido de criação.
 const tm=ep.match(/^\/api\/shopping\/(tmp-[^/]+)$/);if(tm){const create=queue.find(x=>x.tempId===tm[1]);if(create){Object.assign(create.data,b);saveQueue();IDB.put(create);return res;}}
 if(res.tempId)q.tempId=res.tempId;
 if(!queue.length)queueSince=Date.now();queue.push(q);saveQueue();IDB.put(q);requestBgSync();
 return res;
}
const apiOnline=api;
api=async function(endpoint,method='GET',data,extra){
 if(method==='GET'||!canQueue(endpoint,method,data))return apiOnline(endpoint,method,data,extra);
 // Otimista: aparece feito já; o pedido segue pela fila (pela ordem certa, sem duplicados).
 const r=enqueue(endpoint,method,data);
 if(!modal)render();
 if(offline||navigator.onLine===false){if(!endpoint.includes('/tmp-'))toast('Sem rede: fica guardado e é enviado quando a ligação voltar.');}
 else setTimeout(()=>flushQueue(),0);
 return r;
};
let flushing=null;
function flushQueue(opts={}){
 if(flushing)return flushing;if(!queue.length||demo)return Promise.resolve();
 flushing=(async()=>{let sent=0;const failed=[];
  try{while(queue.length){const q=queue[0];
    if(q.by&&store.user?.id&&q.by!==store.user.id){queue.shift();saveQueue();IDB.del(q.opId);continue;} // fila de outra pessoa neste dispositivo
    try{const r=await apiCore(q.endpoint,q.method,q.data,{opId:q.opId});sent++;
     // Produto criado na fila: as alterações seguintes passam a usar o id verdadeiro.
     if(q.tempId&&r?.item?.id){for(const n of queue.slice(1))n.endpoint=n.endpoint.replace(q.tempId,r.item.id);}
    }catch(e){if(offline)break;failed.push(e.message);}
    queue.shift();saveQueue();IDB.del(q.opId);}
  }finally{flushing=null;if(!queue.length)queueSince=0;}
  if(offline&&queue.length&&!modal){queueWasOffline=true;render();}
  if(failed.length){if(typeof haptic==='function')haptic('error');toast(failed.length===1?`Não foi possível guardar: ${failed[0]}`:`${failed.length} alterações não puderam ser guardadas: ${failed[0]}`);}
  if(!opts.quiet&&(sent||failed.length)){await loadOnline().catch(()=>{});if(!demo&&store.user){const {audit,...rest}=store;writeJSON(CACHE_KEY,{at:new Date().toISOString(),state:rest});}if(queue.length)replayQueue();if(!modal&&!formDirty)render();
   if(sent&&!failed.length&&(opts.announce||queueWasOffline)){toast(`${plural(sent,'alteração feita sem rede enviada','alterações feitas sem rede enviadas')}.`);}
   queueWasOffline=false;}
 })();
 return flushing;
}
let queueWasOffline=false;
const tryFlush=()=>{if(!queue.length||!store.user||demo||navigator.onLine===false)return;queueWasOffline=queueWasOffline||offline;apiOnline('/api/rev').then(()=>{offline=false;flushQueue();}).catch(()=>{});};
window.addEventListener('online',()=>{if(store.user&&!demo){queueWasOffline=true;reload();}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')tryFlush();});
setInterval(tryFlush,15_000);
navigator.serviceWorker?.addEventListener?.('message',e=>{if(e.data?.type==='outbox-sent'&&store.user&&!demo){const ids=new Set(e.data.ids||[]);const before=queue.length;queue=queue.filter(q=>!ids.has(q.opId));if(queue.length!==before){saveQueue();reload();}}});

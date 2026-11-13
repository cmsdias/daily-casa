'use strict';
/* 3.19 — Toque e movimento com significado.
 * Haptics: só Android (navigator.vibrate), com padrões. No iPhone as apps web não podem vibrar (a via do interruptor
 * nativo foi fechada pela Apple no iOS 26.5). Interruptor «Vibração» em Definições › Aparência (por dispositivo, só Android). Nada vibra ao percorrer listas nem quando chegam notificações.
 * Movimento: deslizar nas linhas, janelas que fecham a arrastar, listas que se reorganizam a deslizar,
 * entrada de páginas pela direção certa, valores a contar, dia completo, sino e menu «+».
 * Tudo desligado com «reduzir movimento» (os haptics continuam, se estiverem ligados). */
const IS_IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
// 3.19.1: no iPhone não há vibração em apps web (a Apple fechou a única via no iOS 26.5); só Android.
const HAPTIC_OK=!IS_IOS&&!!navigator.vibrate;
const hapticsOn=()=>{try{return localStorage.getItem('dc-haptics')!=='0';}catch{return true;}};
const H_PATTERNS={tick:10,select:6,success:[12,70,22],warn:[24,50,24],error:[14,45,14,45,14]};
let hIos=null;
function haptic(kind='tick'){if(!HAPTIC_OK||!hapticsOn())return;
try{navigator.vibrate(H_PATTERNS[kind]||10);}catch{}}
function hapticsField(){if(!HAPTIC_OK)return '';return `<label class="check-line haptics-field"><input type="checkbox" data-haptics-toggle ${hapticsOn()?'checked':''}/> <span><b>Vibração ao tocar</b><small>Um toque leve ao concluir, marcar compras e mudar de vista. Só neste dispositivo.</small></span></label>`;}
document.addEventListener('change',e=>{const t=e.target.closest?.('[data-haptics-toggle]');if(!t)return;try{localStorage.setItem('dc-haptics',t.checked?'1':'0');}catch{}if(t.checked)haptic('tick');});
const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Haptics nos toques (sempre dentro do próprio toque, para funcionar no iPhone). */
const SELECT_ACTIONS=new Set(['tab','task-view','fin-tab','list-kind','quick-filter','search-area','weather-toggle','filter-toggle','advanced-task','shopping-view','worklog-period']);
function todayPendingMine(){const t=today();return tasks().filter(x=>x.status!=='done'&&x.dueDate&&x.dueDate<=t&&(x.assignedTo===store.user?.id||(x.coAssignees||[]).includes(store.user?.id))).length;}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-action]');if(!b||b.disabled)return;const a=b.dataset.action;
 if(a==='complete'){const t=tasks().find(x=>x.id===b.dataset.id);if(t&&t.status!=='done'){const mine=t.assignedTo===store.user?.id||(t.coAssignees||[]).includes(store.user?.id);const lastToday=mine&&t.dueDate&&t.dueDate<=today()&&todayPendingMine()===1;haptic(lastToday?'success':'tick');if(lastToday)celebrateNext=true;}else haptic('tick');}
 else if(SELECT_ACTIONS.has(a)||(a==='nav'&&b.closest('.tab-nav,.sidebar,.swipe-nav')))haptic('select');
 else if(a==='undo-complete'||a==='search-go')haptic('tick');},true);
// Confirmações: aviso nas que apagam ou anulam, toque nas restantes.
document.addEventListener('click',e=>{const b=e.target.closest?.('#confirm-holder button');if(!b)return;if(b.classList.contains('danger'))haptic('warn');else if(b.classList.contains('primary'))haptic('tick');},true);
document.addEventListener('change',e=>{if(e.target.matches?.('.shop-check'))haptic('tick');},true);

/* Deslizar nas linhas (só ao toque): tarefas → direita conclui, esquerda adia para amanhã; compras → direita marca, esquerda edita. */
(function swipeRows(){let s=null;const TH=0.32;
 const kindOf=row=>row.classList.contains('task-row')?'task':row.classList.contains('shopping-line')?'shop':null;
 const can=(row,dir)=>{const k=kindOf(row);if(k==='task'){const t=tasks().find(x=>x.id===row.dataset.task);if(!t||t.status==='done')return false;return dir>0?canCompleteVisible(t):canEditVisible(t)&&!offline;}
  if(k==='shop'){const box=row.querySelector('.shop-check');return dir>0?!!box&&!box.checked:true;}return false;};
 document.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'||s)return;const row=e.target.closest?.('.task-row,.shopping-line');if(!row||e.target.closest('input,select,textarea,.task-actions'))return;s={row,x:e.clientX,y:e.clientY,id:e.pointerId,dx:0,lock:null,w:row.offsetWidth,passed:false};},{passive:true});
 document.addEventListener('pointermove',e=>{if(!s||e.pointerId!==s.id)return;const dx=e.clientX-s.x,dy=e.clientY-s.y;
  if(!s.lock){if(Math.abs(dx)<12&&Math.abs(dy)<12)return;s.lock=Math.abs(dx)>Math.abs(dy)*1.6?'x':'y';if(s.lock==='x'){const par=s.row.parentElement;if(getComputedStyle(par).position==='static'){par.style.position='relative';s.par=par;}const u=document.createElement('div');u.className='swipe-under '+(kindOf(s.row)==='shop'?'is-shop':'is-task');u.setAttribute('aria-hidden','true');Object.assign(u.style,{top:s.row.offsetTop+'px',left:s.row.offsetLeft+'px',width:s.row.offsetWidth+'px',height:s.row.offsetHeight+'px'});par.insertBefore(u,s.row);s.u=u;s.row.classList.add('swiping');}}
  if(s.lock!=='x')return;const dir=Math.sign(dx);if(!can(s.row,dir)){s.dx=dx*0.15;}else s.dx=dx;
  s.row.style.transform=`translateX(${s.dx}px)`;s.u.classList.toggle('sw-right',s.dx>0);s.u.classList.toggle('sw-left',s.dx<0);
  const passed=Math.abs(s.dx)>s.w*TH&&can(s.row,dir);if(passed!==s.passed){s.passed=passed;s.u.classList.toggle('sw-ready',passed);if(passed)haptic('select');}},{passive:true});
 const end=e=>{if(!s||(e&&e.pointerId!==s.id))return;const {row,dx,passed,lock,u,par}=s;s=null;if(lock!=='x')return;
  // um deslize não conta como toque na linha
  const stop=ev=>{if(row._swAct)return;ev.stopPropagation();ev.preventDefault();row.removeEventListener('click',stop,{capture:true});};row.addEventListener('click',stop,{capture:true});setTimeout(()=>row.removeEventListener('click',stop,{capture:true}),350);
  const act=el=>{if(!el)return;row._swAct=true;try{el.click();}finally{row._swAct=false;}};
  row.classList.add('sw-release');row.style.transform='';setTimeout(()=>{row.classList.remove('swiping','sw-release');u?.remove();if(par)par.style.position='';},260);
  if(!passed)return;const k=kindOf(row);
  if(k==='task'&&dx>0)act(row.querySelector('.task-check'));
  else if(k==='task'&&dx<0){const t=tasks().find(x=>x.id===row.dataset.task);if(t){const d=CasaCore.addDays(today(),1);api('/api/tasks/'+t.id,'PATCH',{dueDate:d}).then(()=>{reload();toast(`«${t.title}» adiada para amanhã.`);}).catch(err=>toast(err.message));}}
  else if(k==='shop'&&dx>0)act(row.querySelector('.shop-check'));
  else if(k==='shop'&&dx<0)act(row.querySelector('.shop-name'));};
 document.addEventListener('pointerup',end,{passive:true});document.addEventListener('pointercancel',e=>{if(s){s.passed=false;end(e);}},{passive:true});
})();

/* Janelas: fecham a arrastar para baixo pelo topo (só ao toque). */
(function dragModals(){let d=null;
 document.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;const head=e.target.closest?.('.modal-head');const m=head?.closest('.modal');if(!m||e.target.closest('button,input,select,textarea,a'))return;d={m,y:e.clientY,id:e.pointerId,dy:0};},{passive:true});
 document.addEventListener('pointermove',e=>{if(!d||e.pointerId!==d.id)return;d.dy=Math.max(0,e.clientY-d.y);if(d.dy>4){d.m.style.transition='none';d.m.style.transform=`translateY(${d.dy}px)`;d.m.style.opacity=String(Math.max(.4,1-d.dy/500));}},{passive:true});
 const end=e=>{if(!d||e.pointerId!==d.id)return;const {m,dy}=d;d=null;m.style.transition='transform .22s ease,opacity .22s ease';
  if(dy>110){m.style.transform='translateY(110%)';m.style.opacity='0';setTimeout(()=>{const c=m.querySelector('[data-action="close"]');if(c)c.click();else{m.closest('.overlay')?.querySelector('[data-action="close"]')?.click();}},180);}
  else{m.style.transform='';m.style.opacity='';setTimeout(()=>{m.style.transition='';},240);}};
 document.addEventListener('pointerup',end,{passive:true});document.addEventListener('pointercancel',end,{passive:true});
})();

/* Listas que se reorganizam a deslizar (FLIP), entrada de páginas pela direção certa, valores a contar,
 * dia completo e sino. Envolve render() sem mudar o que ele faz. */
const NAV_ORDER=['today','tasks','shopping','house'];let lastPageKey=null,celebrateNext=false,lastUnread=null,lastRingFull=null;
function flipSnap(){if(calm())return null;const m=new Map();document.querySelectorAll('#content .task-row[data-task], #content .shopping-line').forEach(el=>{const k=el.dataset.task||el.querySelector('[data-id]')?.dataset.id;if(k)m.set(k,el.getBoundingClientRect().top);});return m;}
function flipPlay(snap){if(!snap||!snap.size)return;document.querySelectorAll('#content .task-row[data-task], #content .shopping-line').forEach(el=>{const k=el.dataset.task||el.querySelector('[data-id]')?.dataset.id;if(!k)return;const old=snap.get(k);const now=el.getBoundingClientRect().top;
  if(old==null){el.animate([{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'none'}],{duration:220,easing:'ease-out'});return;}
  const dy=old-now;if(Math.abs(dy)>2&&Math.abs(dy)<window.innerHeight)el.animate([{transform:`translateY(${dy}px)`},{transform:'none'}],{duration:260,easing:'cubic-bezier(.3,.8,.3,1)'});});}
function countUp(){if(calm())return;document.querySelectorAll('#content [data-count]').forEach(el=>{const to=Number(el.dataset.count);if(!Number.isFinite(to)||el.dataset.counted)return;el.dataset.counted='1';const fmt=el.dataset.fmt;const final=el.textContent;const t0=performance.now(),D=650;
  const f=v=>fmt==='eur'?eurFull(Math.round(v)):fmt==='min'?(typeof fmtDur==='function'?fmtDur(Math.round(v)):Math.round(v)+' min'):fmt==='pct'?Math.round(v)+'%':String(Math.round(v));
  const step=now=>{const p=Math.min(1,(now-t0)/D);const e=1-Math.pow(1-p,3);el.textContent=p<1?f(to*e):final;if(p<1)requestAnimationFrame(step);};requestAnimationFrame(step);});}
function afterRender(pageKey,prevKey){const content=document.getElementById('content');
 if(prevKey&&pageKey!==prevKey&&content&&!calm()){const a=NAV_ORDER.indexOf(prevKey.split('|')[0]),b=NAV_ORDER.indexOf(pageKey.split('|')[0]);if(a>=0&&b>=0&&a!==b){content.classList.remove('page-enter');content.classList.add(b>a?'enter-right':'enter-left');}}
 if(pageKey!==prevKey)countUp();
 // Dia completo: o anel enche e brilha uma vez.
 const ring=document.querySelector('.today-ring');const full=ring?ringFull(ring):null;
 if(ring&&full&&lastRingFull===false&&(celebrateNext||pageKey===prevKey)){ring.closest('.today-hero')?.classList.add('celebrate');if(!celebrateNext)haptic('success');}
 if(ring)lastRingFull=full;celebrateNext=false;
 // Sino: abana uma vez quando chega uma notificação nova com a app aberta.
 const unread=(typeof notifications==='function'?notifications():store.notifications||[]).filter(n=>!n.read&&!n.cleared).length;if(lastUnread!=null&&unread>lastUnread&&!calm())document.querySelectorAll('.bell-btn').forEach(b=>{b.classList.remove('bell-shake');void b.offsetWidth;b.classList.add('bell-shake');});lastUnread=unread;}
function ringFull(ring){const p=parseFloat(getComputedStyle(ring).getPropertyValue('--p')||ring.style.getPropertyValue('--p'));return Number.isFinite(p)?p>=100:false;}
{const base=render;render=function(...a){const prev=lastPageKey;const key=page+'|'+(typeof taskView!=='undefined'?taskView:'');const snap=prev===key?flipSnap():null;const r=base.apply(this,a);lastPageKey=key;try{flipPlay(snap);afterRender(key,prev);}catch{}return r;};}

'use strict';
/* ───────────── Esperas: abertura, barra de carregamento e botões ocupados ───────────── */
// Abertura: o símbolo desenha-se num só traço. Só fica visível se o arranque passar 0,3 s;
// uma vez visível, fica até o traço terminar, para não ser cortado a meio.
(function splashControl(){
 const el=document.getElementById('splash');if(!el)return;
 if(window.__CASA_DEMO__){try{if(!sessionStorage.getItem('casa-splash')){sessionStorage.setItem('casa-splash','1');el.classList.add('instant');}else{el.remove();return;}}catch{el.remove();return;}}
 // Se a app abrir em menos de 0,3 s, a animação nem aparece. Se aparecer, corre até ao fim (o nome «Daily Casa»
 // termina por volta de 1,9 s) e só depois desvanece: nunca é cortada a meio.
 const shownAt=el.classList.contains('instant')?0:300;let drawn=matchMedia('(prefers-reduced-motion: reduce)').matches,waiting=false;
 const word=el.querySelector('.splash-word');
 const fadeOut=()=>{if(!el.isConnected||el.classList.contains('out'))return;el.classList.add('out');setTimeout(()=>el.remove(),320);};
 word?.addEventListener('animationend',()=>{drawn=true;if(waiting)setTimeout(fadeOut,250);});
 setTimeout(()=>{drawn=true;if(waiting)fadeOut();},2600); // segurança, se o evento não chegar
 const hide=()=>{if(!el.isConnected||el.classList.contains('out')||waiting)return;if(performance.now()<shownAt&&!el.classList.contains('instant')){el.remove();return;}waiting=true;if(drawn)setTimeout(fadeOut,250);};
 const app=document.getElementById('app');new MutationObserver((m,obs)=>{if(app.childElementCount){obs.disconnect();hide();}}).observe(app,{childList:true});
 setTimeout(hide,8000);
})();
// Barra dourada no topo enquanto a app vai buscar dados (só se demorar mais de 0,2 s).
const topLoad=document.createElement('div');topLoad.className='topbar-load';topLoad.setAttribute('aria-hidden','true');document.body.appendChild(topLoad);
let loadCount=0,loadTimer=null;
function loadStart(){if(++loadCount===1){clearTimeout(loadTimer);loadTimer=setTimeout(()=>topLoad.classList.add('on'),200);}}
function loadEnd(){loadCount=Math.max(0,loadCount-1);if(!loadCount){clearTimeout(loadTimer);topLoad.classList.remove('on');}}
// Botões a guardar: o botão tocado mostra três pontos dourados e fica bloqueado até a gravação terminar.
let lastTrigger=null,lastTriggerAt=0;
const markTrigger=b=>{if(b&&b.matches?.('button')){lastTrigger=b;lastTriggerAt=performance.now();}};
document.addEventListener('click',e=>markTrigger(e.target.closest?.('button')),true);
document.addEventListener('submit',e=>markTrigger(e.submitter||e.target.querySelector('[type=submit]')),true);
function busyStart(){const b=lastTrigger;if(!b||!b.isConnected||performance.now()-lastTriggerAt>2000||b.offsetWidth<64)return null;
 b._busy=(b._busy||0)+1;if(b._busy>1)return b;
 b._busyTimer=setTimeout(()=>{if(!b.isConnected||!b._busy)return;b._busyState={html:b.innerHTML,w:b.style.width,dis:b.disabled};b.style.width=b.offsetWidth+'px';b.classList.add('is-busy');b.setAttribute('aria-busy','true');b.disabled=true;b.innerHTML='<span class="busy-dots" role="status" aria-label="A guardar"><i></i><i></i><i></i></span>';},150);
 return b;}
function busyEnd(b){if(!b)return;b._busy=Math.max(0,(b._busy||1)-1);if(b._busy)return;clearTimeout(b._busyTimer);const st=b._busyState;if(!st)return;b._busyState=null;b.classList.remove('is-busy');b.removeAttribute('aria-busy');b.disabled=st.dis;b.innerHTML=st.html;b.style.width=st.w;}
const apiCore=api;
// eslint-disable-next-line no-global-assign
api=async function(endpoint,method='GET',data){const write=method!=='GET';const b=write?busyStart():null;if(!write)loadStart();
 try{if(demo&&write)await new Promise(r=>setTimeout(r,450));return await apiCore(endpoint,method,data);}finally{if(write)busyEnd(b);else loadEnd();}};
const skeletonLines=(n=3)=>`<div class="sk-group" aria-hidden="true">${Array.from({length:n},(_,i)=>`<div class="sk sk-line" style="width:${[92,74,83,66][i%4]}%"></div>`).join('')}</div>`;

// Daily Casa 1.7 — funcionalidades acrescentadas ao núcleo (app.js):
// atualização automática, cópias de segurança, calendário sazonal, compras rápidas,
// rotação de rotinas, fotografias nas tarefas e Home Assistant.
// Partilha o estado global de app.js (store, page, modal, render, api…), carregado antes deste ficheiro.

/* ───────────── Atualização automática entre pessoas ───────────── */
let syncRev=null,syncPending=false,formDirty=false;
const SYNC_MS=10_000;
function syncBusy(){const a=document.activeElement;return !!(modal||quickCreateOpen||moreOpen||formDirty||document.getElementById('confirm-holder')||document.getElementById('crop-holder')||document.getElementById('photo-viewer')||(a&&a.matches?.('input,textarea,select')&&a.closest('#content')));}
function syncBanner(show){let el=document.getElementById('sync-banner');if(!show){el?.remove();return;}if(el)return;el=document.createElement('div');el.id='sync-banner';el.className='sync-banner';el.setAttribute('role','status');el.innerHTML=`<span>${ico('refresh')} Há alterações de outras pessoas.</span><button type="button" data-action="sync-apply">Atualizar</button>`;document.body.appendChild(el);}
async function syncApply(){const y=window.scrollY;syncPending=false;syncBanner(false);await load();render();window.scrollTo(0,y);}
async function syncCheck(){
 if(demo||!store.user||document.hidden)return;
 let j;try{const r=await fetch('api/rev',{credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store'});if(r.status===401){store.user=null;renderAuth('login','A sessão terminou. Volta a entrar.');return;}if(!r.ok)return;j=await r.json();if(offline){offline=false;render();}}catch{return;}
 if(j.version)versionCheck(j.version);
 if(!syncRev){syncRev=j.rev;return;}
 if(j.rev===syncRev){if(syncPending&&!syncBusy())syncApply().catch(()=>{});return;}
 if(syncBusy()){syncPending=true;syncBanner(true);return;}
 await syncApply().catch(()=>{});
}
setInterval(()=>syncCheck(),SYNC_MS);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncCheck();});
document.addEventListener('input',e=>{if(e.target.closest?.('#content form'))formDirty=true;},true);

/* ───────────── Utilitários ───────────── */
const REPEAT_EXTRA={quarterly:'Trimestral',yearly:'Anual'};Object.assign(repeatLabels,REPEAT_EXTRA);
const fmtBytes=n=>n>=1048576?(n/1048576).toLocaleString('pt-PT',{maximumFractionDigits:1})+' MB':Math.max(1,Math.round(n/1024))+' KB';
const fmtDateTime=iso=>{const d=new Date(iso);return d.toLocaleDateString('pt-PT',{day:'numeric',month:'short',year:'numeric'})+' · '+d.toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'});};
// Copiar: API moderna só em contexto seguro (HTTPS); por IP (http) ou no iframe do HA usa execCommand; em último caso seleciona o texto.
function copyFallback(text){const ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:0;left:-9999px;opacity:0;font-size:16px';document.body.appendChild(ta);ta.focus();ta.select();ta.setSelectionRange(0,text.length);let ok=false;try{ok=document.execCommand('copy');}catch{}ta.remove();return ok;}
function selectForCopy(node){if(!node)return;const r=document.createRange();r.selectNodeContents(node);const s=getSelection();s.removeAllRanges();s.addRange(r);}
async function copyText(text,msg='Copiado.',node){if(!text){toast('Não há nada para copiar.');return;}
 if(window.isSecureContext&&navigator.clipboard){try{await navigator.clipboard.writeText(text);toast(msg);return;}catch{}}
 if(copyFallback(text)){toast(msg);return;}
 selectForCopy(node);toast(node?'O código ficou selecionado: toque longo › Copiar.':'Não foi possível copiar automaticamente.');}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);}

/* ───────────── Cópias de segurança (Definições, administrador) ───────────── */
const BACKUP_REASONS={auto:'Automática',manual:'Manual','pre-restore':'Antes de restaurar',upload:'Carregada',upgrade:'Antes da atualização','pre-import':'Antes de importar'};
let backupsData=null;
function backupsCard(){
 if(!isAdmin())return '';
 if(!backupsData){queueMicrotask(loadBackups);return `<div class="settings-card" id="backups-card" aria-busy="true"><h3>Cópias de segurança</h3>${skeletonLines(4)}</div>`;}
 const list=backupsData.backups||[];const auto=list.find(b=>b.reason==='auto');
 return `<div class="settings-card" id="backups-card"><h3>Cópias de segurança</h3><p>É feita uma cópia automática por dia (ficam as últimas 14). Antes de restaurar uma cópia, o estado atual é sempre guardado.${demo?' <b>Na demonstração, as cópias são apenas ilustrativas.</b>':''}</p>
 <div class="backup-status">${ico('check-square')}<span>${auto?`Última cópia automática: <b>${esc(fmtDateTime(auto.createdAt))}</b>`:'Ainda não há cópias automáticas.'}</span></div>
 <div class="backup-actions"><button class="button primary" type="button" data-action="backup-create">${ico('download')} Criar cópia agora</button><button class="button" type="button" data-action="backup-upload">${ico('plus-square')} Carregar ficheiro</button><input type="file" id="backup-file" accept=".json,application/json" hidden/></div>
 <div class="backup-list">${list.slice(0,10).map(b=>`<div class="backup-row"><div><strong>${esc(fmtDateTime(b.createdAt))}</strong><small>${esc(BACKUP_REASONS[b.reason]||b.reason)} · ${esc(fmtBytes(b.size))}</small></div><div class="backup-row-actions"><button class="button small" type="button" data-action="backup-download" data-name="${esc(b.name)}" aria-label="Descarregar cópia de ${esc(fmtDateTime(b.createdAt))}">${ico('download')}</button><button class="button small" type="button" data-action="backup-restore" data-name="${esc(b.name)}">Restaurar</button></div></div>`).join('')||'<p class="muted">Sem cópias guardadas.</p>'}</div>
 <p class="field-help">As fotografias das tarefas não entram nestes ficheiros; ficam incluídas nas cópias de segurança do Home Assistant.</p></div>`;
}
async function loadBackups(){try{backupsData=await api('/api/backups');}catch(e){backupsData={backups:[]};}const el=document.getElementById('backups-card');if(el&&page==='settings')el.outerHTML=backupsCard();}

/* ───────────── Home Assistant (Definições, administrador) ───────────── */
let haData=null;
function haCard(){
 if(!isAdmin())return '';
 if(!haData){queueMicrotask(loadHa);return `<div class="settings-card" id="ha-card" aria-busy="true"><h3>Home Assistant</h3>${skeletonLines(3)}</div>`;}
 const h=haData;
 if(!h.available)return `<div class="settings-card" id="ha-card"><h3>Home Assistant</h3><p>As notificações e os sensores funcionam apenas na app instalada no Home Assistant. Nesta instalação, a ligação não está disponível.</p></div>`;
 const act=people().filter(p=>p.active!==false);
 const base=h.hostname?`http://${h.hostname}:3000`:'http://<endereço-do-add-on>:3000';
 const yaml=`rest_command:\n  daily_casa_tarefa:\n    url: "${base}/api/integracao/tarefas"\n    method: POST\n    headers:\n      Authorization: "Bearer ${h.token}"\n    content_type: "application/json"\n    payload: '{"title": "{{ titulo }}", "room": "{{ divisao }}", "assignedTo": "{{ pessoa }}"}'`;
 return `<div class="settings-card ha-card" id="ha-card"><h3>Home Assistant</h3><p>${h.demo?'<b>Demonstração:</b> na app instalada, esta secção liga-se ao teu Home Assistant.':'Ligado ao Home Assistant desta casa.'}</p>
 <form id="ha-form" class="ha-form">
 <fieldset class="ha-section"><legend>Notificações no telemóvel</legend><p class="field-help">Escolhe o telemóvel de cada pessoa (a app Home Assistant tem de estar instalada nele).${h.servicesError?' Não foi possível obter a lista de telemóveis: '+esc(h.servicesError):''}</p>
 ${act.map(p=>`<div class="ha-person">${avatarHtml(p,'mini')}<span class="ha-person-name">${esc(p.name)}</span><select class="select-control" name="notify:${esc(p.id)}" aria-label="Telemóvel de ${esc(p.name)}">${option('','Sem notificações',h.notify[p.id]||'')}${[...new Set([...(h.services||[]),...(h.notify[p.id]?[h.notify[p.id]]:[])])].map(s=>option(s,s.replace(/^mobile_app_/,'').replace(/_/g,' '),h.notify[p.id]||'')).join('')}</select><button type="button" class="button small" data-action="ha-test" data-id="${esc(p.id)}" ${h.notify[p.id]?'':'disabled'}>Testar</button></div>`).join('')}
 <label class="check-line"><input type="checkbox" name="assigned" ${h.events.assigned?'checked':''}/> Avisar quando alguém recebe uma tarefa</label>
 <label class="check-line"><input type="checkbox" name="daily" ${h.events.daily?'checked':''}/> Resumo diário das tarefas para hoje e atrasadas</label><label class="check-line ha-time">Enviar às <input type="time" name="dailyTime" value="${esc(h.dailyTime)}" class="inline-time" aria-label="Hora do resumo diário"/></label></fieldset>
 <fieldset class="ha-section"><legend>Sensores</legend><label class="check-line"><input type="checkbox" name="sensors" ${h.sensors?'checked':''}/> Publicar o estado da casa como sensores</label><p class="field-help">Ficam disponíveis para cartões e automações (as tarefas privadas nunca são incluídas):</p><ul class="ha-entities">${(h.sensorEntities||[]).map(e=>`<li><code>${esc(e)}</code></li>`).join('')}</ul></fieldset>
 <div class="manager-actions"><span>As alterações só são aplicadas quando guardares.</span><button class="button primary" type="submit">Guardar</button></div></form>
 <details class="ha-section ha-auto"><summary><span class="disc-ico" aria-hidden="true"></span>Criar tarefas a partir de automações</summary><p class="field-help">Por exemplo: quando a máquina de lavar termina, criar «Estender a roupa». Acrescenta isto a <code>configuration.yaml</code> e chama <code>rest_command.daily_casa_tarefa</code> nas automações.</p><pre class="code-block">${esc(yaml)}</pre><div class="backup-actions"><button class="button small" type="button" data-action="ha-copy-yaml">${ico('copy')} Copiar configuração</button><button class="button small" type="button" data-action="ha-token">Gerar novo token</button></div><p class="field-help">O token dá acesso à criação de tarefas e de produtos de compras. Se o partilhares por engano, gera um novo.</p></details></div>`;
}
async function loadHa(){try{haData=await api('/api/ha');}catch(e){haData={available:false};}const el=document.getElementById('ha-card');if(el&&page==='settings'){if(!modal&&!formDirty)render();else el.outerHTML=haCard();}}
document.addEventListener('submit',async e=>{
 if(e.target.id==='ha-form'){e.preventDefault();const f=e.target;const notify={};f.querySelectorAll('select[name^="notify:"]').forEach(s=>{notify[s.name.slice(7)]=s.value;});
  const body={notify,events:{assigned:f.elements.assigned.checked,daily:f.elements.daily.checked},dailyTime:f.elements.dailyTime.value||'08:30',sensors:f.elements.sensors.checked};
  try{await api('/api/ha','PATCH',body);haData=null;formDirty=false;await loadHa();toast('Definições do Home Assistant guardadas.');}catch(err){toast(err.message);}}
});

/* ───────────── Calendário sazonal ───────────── */
let calMonth=new Date().getMonth()+1,calEditing=false;
const seasonal=()=>Array.isArray(store.seasonal)?store.seasonal:[];
const calMonthName=m=>MONTHS_FULL[m-1];
function calYearFor(m){const now=new Date();return m>=now.getMonth()+1?now.getFullYear():now.getFullYear()+1;}
function seasonalTaskFor(item,m,y=calYearFor(m)){const key=`${item.id}:${y}-${String(m).padStart(2,'0')}`;return tasks().find(t=>t.seasonalKey===key);}
function seasonalCard(item,m,compact=false,y=calYearFor(m)){const t=seasonalTaskFor(item,m,y);
 return `<article class="season-item ${t?'is-created':''}"><div class="season-art room-art art-${esc(roomArt(item.room))}" aria-hidden="true"></div><div class="season-body"><strong>${esc(item.title)}</strong><small>${esc(roomShort(item.room))}${item.minutes?` · ${esc(fmtMinutes(item.minutes))}`:''}${item.months.length>1?` · também em ${esc(item.months.filter(x=>x!==m).map(x=>MONTHS_FULL[x-1]).join(', '))}`:''}</small>${!compact&&item.notes?`<p>${esc(item.notes)}</p>`:''}</div><div class="season-actions">${t?`<button type="button" class="button small" data-action="edit" data-id="${esc(t.id)}">${t.status==='done'?ico('check')+' Feito':ico('check-square')+' Ver tarefa'}</button>`:`<button type="button" class="button small primary" data-action="season-task" data-id="${esc(item.id)}" data-month="${m}" data-year="${y}" ${store.user?.role==='collaborator'?'disabled':''}>${ico('plus-square')} Criar tarefa</button>`}${calEditing&&(canManage()||demo)&&!compact?`<button type="button" class="button small" data-action="season-edit" data-id="${esc(item.id)}" aria-label="Editar ${esc(item.title)}">${ico('edit')}</button>`:''}</div></article>`;}
// Feriados em Portugal: nacionais (fixos e móveis, a partir da Páscoa), São João (feriado municipal do Porto)
// e dias habituais de tolerância (Carnaval e vésperas de Natal e de Ano Novo).
function easterDate(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;return new Date(Date.UTC(y,month-1,day));}
const isoUTC=d=>d.toISOString().slice(0,10);
const holidayCache={};
function holidays(y){if(holidayCache[y])return holidayCache[y];const e=easterDate(y);const rel=n=>isoUTC(new Date(e.getTime()+n*864e5));const f=md=>`${y}-${md}`;
 const list=[[f('01-01'),'Ano Novo','nacional'],[rel(-47),'Carnaval','tolerancia'],[rel(-2),'Sexta-feira Santa','nacional'],[rel(0),'Páscoa','nacional'],[f('04-25'),'Dia da Liberdade','nacional'],[f('05-01'),'Dia do Trabalhador','nacional'],[rel(60),'Corpo de Deus','nacional'],[f('06-10'),'Dia de Portugal','nacional'],[f('06-24'),'São João (Porto)','municipal'],[f('08-15'),'Assunção de Nossa Senhora','nacional'],[f('10-05'),'Implantação da República','nacional'],[f('11-01'),'Dia de Todos os Santos','nacional'],[f('12-01'),'Restauração da Independência','nacional'],[f('12-08'),'Imaculada Conceição','nacional'],[f('12-24'),'Véspera de Natal','tolerancia'],[f('12-25'),'Natal','nacional'],[f('12-31'),'Véspera de Ano Novo','tolerancia']];
 return holidayCache[y]=Object.fromEntries(list.map(([d,name,kind])=>[d,{name,kind}]));}
const HOLIDAY_KIND={nacional:'Feriado nacional',municipal:'Feriado municipal',tolerancia:'Tolerância habitual'};
// Estado do calendário (mês visível, dia escolhido, filtros).
const calNow=new Date();let calView={y:calNow.getFullYear(),m:calNow.getMonth()+1},calSel=today(),calFilter='all',calTypes={task:true,routine:true,birthday:true,holiday:true};
const pad2=n=>String(n).padStart(2,'0');
function addStep(d,rep){const x=new Date(d.getTime());if(rep==='daily')x.setUTCDate(x.getUTCDate()+1);else if(rep==='weekly')x.setUTCDate(x.getUTCDate()+7);else if(rep==='biweekly')x.setUTCDate(x.getUTCDate()+14);else if(rep==='monthly')x.setUTCMonth(x.getUTCMonth()+1);else if(rep==='quarterly')x.setUTCMonth(x.getUTCMonth()+3);else if(rep==='yearly')x.setUTCFullYear(x.getUTCFullYear()+1);else return null;return x;}
// Eventos de um intervalo de datas (inclusive), já filtrados.
function calEvents(from,to){const ev=[];const who=t=>calFilter==='all'||(calFilter==='me'?t.assignedTo===store.user.id:t.assignedTo===calFilter);const tdy=today();
 if(calTypes.task)for(const t of tasks())if(t.kind==='project'&&t.dueDate&&t.dueDate>=from&&t.dueDate<=to&&who(t))ev.push({date:t.dueDate,type:t.status==='done'?'task-done':t.dueDate<tdy?'task-late':'task',title:t.title,taskId:t.id,who:t.assignedTo});
 if(calTypes.routine)for(const t of tasks()){if(t.kind!=='routine'||!t.dueDate||!who(t)||t.status==='done')continue;let d=new Date(t.dueDate+'T12:00:00Z');let n=0;
  while(d&&isoUTC(d)<=to&&n++<400){const iso=isoUTC(d);if(iso>=from)ev.push({date:iso,type:'routine',title:t.title,taskId:t.id,who:t.assignedTo,daily:t.repeat==='daily',future:iso!==t.dueDate});if(t.repeat==='none')break;d=addStep(d,t.repeat);}}
 if(calTypes.birthday)for(const p of people()){const md=p.birthDate?p.birthDate.slice(5):p.birthday;if(!md||p.active===false)continue;for(let y=Number(from.slice(0,4));y<=Number(to.slice(0,4));y++){const iso=`${y}-${md}`;if(iso>=from&&iso<=to)ev.push({date:iso,type:'birthday',title:`Aniversário de ${p.name.split(' ')[0]}`});}}
 return ev;}
function holidayOn(iso){return calTypes.holiday?holidays(Number(iso.slice(0,4)))[iso]:null;}
const EVENT_LABEL={task:'Tarefa','task-late':'Atrasada','task-done':'Concluída',routine:'Rotina',birthday:'Aniversário'};
function calendarPage(){
 const {y,m}=calView;const first=new Date(Date.UTC(y,m-1,1));const startDow=(first.getUTCDay()+6)%7;const gridStart=new Date(first.getTime()-startDow*864e5);
 const cells=[];for(let i=0;i<42;i++){const d=new Date(gridStart.getTime()+i*864e5);cells.push(isoUTC(d));}
 const weeks=cells.slice(35).every(c=>c.slice(5,7)!==pad2(m))?5:6;const shown=cells.slice(0,weeks*7);
 const ev=calEvents(shown[0],shown[shown.length-1]);const byDay={};ev.forEach(e=>(byDay[e.date]??=[]).push(e));
 const order={birthday:0,'task-late':1,task:2,routine:3,'task-done':4};Object.values(byDay).forEach(a=>a.sort((x,z)=>order[x.type]-order[z.type]));
 const tdy=today();const collab=store.user?.role==='collaborator';
 const chip=(v,l)=>`<button type="button" class="cal-chip ${calFilter===v?'active':''}" data-action="cal-filter" data-value="${esc(v)}" aria-pressed="${calFilter===v}">${l}</button>`;
 const tchip=(k,l)=>`<button type="button" class="cal-type t-${k} ${calTypes[k]?'on':''}" data-action="cal-type" data-value="${k}" aria-pressed="${calTypes[k]}"><i aria-hidden="true"></i>${l}</button>`;
 const dayCell=iso=>{const inMonth=iso.slice(5,7)===pad2(m);const h=holidayOn(iso);const list=(byDay[iso]||[]).filter(e=>!e.daily);const dow=(new Date(iso+'T12:00:00Z').getUTCDay()+6)%7;
  return `<button type="button" class="cal-day ${inMonth?'':'out'} ${iso===tdy?'is-today':''} ${iso===calSel?'is-sel':''} ${h?'is-holiday':''} ${dow>=5?'is-weekend':''}" data-action="cal-day" data-date="${iso}" aria-label="${esc(new Date(iso+'T12:00:00Z').toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}))}${h?', '+esc(h.name):''}${list.length?`, ${list.length} ${list.length===1?'evento':'eventos'}`:''}" aria-pressed="${iso===calSel}"><span class="cal-num">${Number(iso.slice(8))}</span>${h?`<span class="cal-hol">${esc(h.name)}</span>`:''}<span class="cal-evs">${list.slice(0,3).map(e=>`<span class="cal-ev t-${e.type}">${esc(e.title)}</span>`).join('')}${list.length>3?`<span class="cal-more">+${list.length-3}</span>`:''}</span><span class="cal-dots" aria-hidden="true">${list.slice(0,4).map(e=>`<i class="t-${e.type}"></i>`).join('')}</span></button>`;};
 const sel=calSel;const selH=holidayOn(sel);const selEv=(byDay[sel]||calEvents(sel,sel));
 const label=new Date(sel+'T12:00:00Z').toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'});
 const all=seasonal(),active=all.filter(x=>x.active!==false),inactive=all.filter(x=>x.active===false);const sugg=active.filter(x=>x.months.includes(m));
 const monthName=MONTHS_FULL[m-1][0].toUpperCase()+MONTHS_FULL[m-1].slice(1);
 return `
 <div class="cal-toolbar"><div class="cal-nav"><button type="button" class="icon-btn" data-action="cal-step" data-step="-1" aria-label="Mês anterior">‹</button><h2 class="cal-title">${monthName} <span>${y}</span></h2><button type="button" class="icon-btn" data-action="cal-step" data-step="1" aria-label="Mês seguinte">›</button><button type="button" class="button small" data-action="cal-today">Hoje</button></div>
 <div class="cal-filters" role="group" aria-label="Mostrar tarefas de">${chip('all','Tudo')}${chip('me','Só eu')}${collab?'':people().filter(p=>p.active!==false&&p.id!==store.user.id).map(p=>chip(p.id,esc(shortName(p)))).join('')}</div>
 <div class="cal-types" role="group" aria-label="Tipos de evento">${tchip('task','Tarefas')}${tchip('routine','Rotinas')}${collab?'':tchip('birthday','Aniversários')}${tchip('holiday','Feriados')}</div></div>
 <div class="cal-grid" role="grid" aria-label="${monthName} ${y}"><div class="cal-dows" role="row">${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d=>`<span role="columnheader">${d}</span>`).join('')}</div><div class="cal-cells">${shown.map(dayCell).join('')}</div></div>
 <section class="cal-daylist" aria-live="polite"><div class="cal-daylist-head"><div><h3>${esc(label[0].toUpperCase()+label.slice(1))}</h3>${selH?`<span class="cal-hol-tag">${esc(selH.name)} · ${esc(HOLIDAY_KIND[selH.kind])}</span>`:''}</div>${collab?'':`<button type="button" class="button small primary" data-action="cal-new" data-date="${sel}">${ico('plus')} Tarefa neste dia</button>`}</div>
 ${selEv.length?`<div class="cal-list">${selEv.map(e=>`<${e.taskId?'button type="button" data-action="edit" data-id="'+esc(e.taskId)+'"':'div'} class="cal-item t-${e.type}"><i aria-hidden="true"></i><span><b>${esc(e.title)}</b><small>${EVENT_LABEL[e.type]}${e.future?' (próxima ocorrência)':''}${e.who?' · '+esc(owner(e.who)):''}</small></span></${e.taskId?'button':'div'}>`).join('')}</div>`:`<p class="muted">${selH?'Dia de descanso: nada marcado.':'Nada marcado para este dia.'}</p>`}</section>
 ${collab?'':`<section class="cal-sugg"><div class="season-head"><div><span class="eyebrow">SUGESTÕES PARA ${esc(MONTHS_FULL[m-1].toUpperCase())}</span><h2 class="section-title">Manutenção da casa e do jardim</h2><p class="section-sub">${sugg.length} ${sugg.length===1?'trabalho sugerido':'trabalhos sugeridos'}. «Criar tarefa» acrescenta-o às Tarefas com prazo até ao fim do mês.</p></div>${canManage()||demo?`<div class="season-tools"><button type="button" class="button" data-action="season-new">${ico('plus-square')} Novo trabalho</button><button type="button" class="button ${calEditing?'primary':''}" data-action="season-editing" aria-pressed="${calEditing}">${ico('edit')} ${calEditing?'Concluir edição':'Editar'}</button></div>`:''}</div>
 <div class="season-list">${sugg.map(x=>seasonalCard(x,m,false,y)).join('')||'<p class="muted">Sem sugestões para este mês.</p>'}</div>
 ${inactive.length&&(canManage()||demo)?`<details class="season-inactive"><summary><span class="disc-ico" aria-hidden="true"></span>${inactive.length} ${inactive.length===1?'trabalho desativado':'trabalhos desativados'}</summary>${inactive.map(x=>`<div class="shopping-line"><span>${esc(x.title)} <small class="muted">· ${esc(x.months.map(mm=>MONTHS_PT[mm-1]).join(', '))}</small></span><button type="button" class="button small" data-action="season-toggle" data-id="${esc(x.id)}">Reativar</button></div>`).join('')}</details>`:''}</section>`}`;
}
function seasonalDashboard(){if(store.user?.role==='collaborator')return '';const m=new Date().getMonth()+1;const items=seasonal().filter(x=>x.active!==false&&x.months.includes(m));const pending=items.filter(x=>!seasonalTaskFor(x,m));if(!items.length)return '';
 return `<section class="season-dash"><div class="season-dash-head"><div><span class="eyebrow">CALENDÁRIO DA CASA</span><h2 class="editorial-title">${esc(MONTHS_FULL[m-1][0].toUpperCase()+MONTHS_FULL[m-1].slice(1))}, <em>na casa e no jardim.</em></h2></div><button type="button" class="rooms-hint rooms-explore" data-action="nav" data-page="calendar">Ver o ano <span aria-hidden="true">↗</span></button></div><div class="season-list compact">${(pending.length?pending:items).slice(0,3).map(x=>seasonalCard(x,m,true)).join('')}</div>${pending.length>3?`<p class="muted season-more">E mais ${pending.length-3} por planear este mês.</p>`:''}</section>`;}
function seasonModal(item){const it=item||{title:'',months:[calMonth],room:'Geral',category:'Manutenção',minutes:60,notes:'',active:true};const editing=!!item;
 const h=$('#modal-holder');h.innerHTML=`<div class="overlay" data-action="overlay"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="season-title"><div class="modal-head"><div><h2 id="season-title">${editing?'Editar trabalho sazonal':'Novo trabalho sazonal'}</h2><p class="modal-sub">Aparece no calendário nos meses escolhidos.</p></div><button type="button" class="close" data-action="close" aria-label="Fechar">×</button></div><div class="modal-body"><form id="season-form"><div class="field"><label>Trabalho</label><input name="title" required maxlength="140" value="${esc(it.title)}" placeholder="Ex.: Limpar caleiras"/></div><fieldset class="access-days"><legend>Meses</legend><div class="month-picks">${MONTHS_PT.map((l,i)=>`<label class="day-chip-check"><input type="checkbox" name="months" value="${i+1}" ${it.months.includes(i+1)?'checked':''}/><span>${l}</span></label>`).join('')}</div></fieldset><div class="form-row"><div class="field"><label>Divisão / Área</label><select name="room">${option('Geral','Geral',it.room)}${roomOptions(config().rooms,it.room)}</select></div><div class="field"><label>Duração (min)</label><input name="minutes" type="number" min="0" max="10080" step="5" value="${esc(it.minutes??'')}"/></div></div><div class="field"><label>Categoria</label><select name="category">${[...new Set([...config().categories,it.category])].map(c=>option(c,c,it.category)).join('')}</select></div><div class="field"><label>Notas</label><textarea name="notes" maxlength="500" rows="3" placeholder="Como fazer, materiais, contactos…">${esc(it.notes||'')}</textarea></div><div class="modal-actions">${editing?`<button type="button" class="button danger" data-action="season-toggle" data-id="${esc(it.id)}">${it.active===false?'Reativar':'Desativar'}</button><button type="button" class="button danger" data-action="season-delete" data-id="${esc(it.id)}">${ico('trash')} Eliminar</button>`:''}<span class="spacer"></span><button type="button" class="button" data-action="close">Cancelar</button><button type="submit" class="button primary">${ico('check')} Guardar</button></div></form></div></div></div>`;
 modal={type:'season',item:it};associateLabels(h);
 $('#season-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.target);const body={title:fd.get('title'),months:fd.getAll('months').map(Number),room:fd.get('room'),category:fd.get('category'),minutes:fd.get('minutes')===''?null:Number(fd.get('minutes')),notes:fd.get('notes')};if(!body.months.length)return toast('Escolhe pelo menos um mês.');
  try{if(editing)await api('/api/seasonal/'+it.id,'PATCH',body);else await api('/api/seasonal','POST',body);modal=null;await reload();toast(editing?'Trabalho atualizado.':'Trabalho acrescentado ao calendário.');}catch(err){toast(err.message);}});
 setTimeout(()=>h.querySelector('[name=title]')?.focus(),30);}

/* ───────────── Compras rápidas ───────────── */
const SHOP_CATEGORIES=['Alimentação','Limpeza','Higiene','Casa','Jardim','Outros'];
const SHOP_RULES=[[/leite|pão|ovos|queijo|fiambre|iogurte|manteiga|fruta|banana|maçã|laranja|tomate|alface|batata|cebola|alho|arroz|massa|azeite|óleo|açúcar|sal\b|farinha|café|chá|cereais|bolachas|carne|frango|peixe|atum|feijão|grão|legumes|vinho|cerveja|água|sumo|chocolate|bacalhau|natas|congelad/,'Alimentação'],[/detergente|lixívia|esfregão|esponja|desengordurante|lava.?loiça|amaciador|limpa|sacos do lixo|papel de cozinha|pastilhas|vinagre de limpeza|sal para a máquina/,'Limpeza'],[/champô|gel de banho|sabonete|pasta de dentes|escova de dentes|desodorizante|papel higiénico|lenços|creme|algodão|pensos|lâminas/,'Higiene'],[/lâmpada|pilhas|fita|parafuso|cola|vela|filtro|tomada|extensão/,'Casa'],[/adubo|substrato|terra|semente|vaso|planta|inseticida|herbicida|mangueira/,'Jardim']];
function guessShopCategory(title){const t=String(title).toLocaleLowerCase('pt-PT');const known=(store.shoppingFrequent||[]).find(x=>x.title.toLocaleLowerCase('pt-PT')===t);if(known?.category)return known.category;return SHOP_RULES.find(([re])=>re.test(t))?.[1]||'Outros';}
// «2 leite», «leite x2», «3 kg batatas», «1 pacote de café», «0,5kg queijo» → quantidade + unidade + produto.
function parseShopInput(raw){let s=String(raw||'').trim().replace(/\s+/g,' ');let quantity='1',unit='';
 let m=/^(\d+(?:[.,]\d+)?)\s*([A-Za-zÀ-ÿ.]+)?\s+(.+)$/.exec(s);
 if(m){const u=m[2]?CasaUnits.unitFromWord(m[2]):'';if(m[2]&&!u){quantity=m[1];s=`${m[2]} ${m[3]}`;}else{quantity=m[1];unit=u==='un'&&/^x$/i.test(m[2]||'')?'':u;s=m[3];}s=s.replace(/^de\s+/i,'');}
 else if((m=/^(\d+(?:[.,]\d+)?)\s*([A-Za-zÀ-ÿ.]+)$/.exec(s))&&!CasaUnits.unitFromWord(m[2])){quantity=m[1];s=m[2];}
 else if((m=/^(.+?)\s*(?:x\s*(\d+)|(\d+)\s*x)$/i.exec(s))){s=m[1];quantity=m[2]||m[3];}
 return {title:s.charAt(0).toUpperCase()+s.slice(1),quantity:quantity.replace('.',','),unit};}
const unitOptions=sel=>option('','Sem unidade',sel||'')+CasaUnits.UNITS.map(([k,one])=>option(k,one,sel||'')).join('');
// Campos de quantidade, unidade e categoria (janela «+» e edição de um produto).
function shopQtyFields(it,withCategory=true,lockOthers=false){const cats=[...new Set([...SHOP_CATEGORIES,...(it.category?[it.category]:[])])];
 return `<div class="form-row shop-qty-row"><div class="field"><label>Quantidade</label><div class="qty-stepper"><button type="button" class="icon-btn" data-action="qty-step" data-step="-1" aria-label="Menos">−</button><input name="quantity" inputmode="decimal" maxlength="20" value="${esc(it.quantity||'1')}"/><button type="button" class="icon-btn" data-action="qty-step" data-step="1" aria-label="Mais">+</button></div></div><div class="field"><label>Unidade</label><select name="unit">${unitOptions(it.unit)}</select></div></div>${withCategory?`<div class="field"><label>Categoria</label><select name="category" ${lockOthers?'disabled':''}>${option('','Automática',it.category||'')}${cats.map(c=>option(c,c,it.category||'')).join('')}</select></div>`:''}`;}
function stepQty(el){const input=el.closest('.qty-stepper')?.querySelector('input');if(!input)return;const n=Number(String(input.value).replace(',','.'));const step=Number(el.dataset.step);const unit=input.form?.elements.unit?.value;const inc=['kg','L'].includes(unit)&&n<2?0.5:['g','ml'].includes(unit)?100:1;let v=(Number.isFinite(n)?n:0)+step*inc;if(v<=0)v=inc;input.value=String(Math.round(v*1000)/1000).replace('.',',');}
function editShopItem(id){const it=shopping().find(x=>x.id===id);if(!it)return;const mine=canManage()||it.createdBy===store.user?.id||demo;
 const h=$('#modal-holder');modal={type:'shop-edit'};
 h.innerHTML=`<div class="overlay" data-action="overlay"><div class="modal quick-modal" role="dialog" aria-modal="true" aria-labelledby="shop-edit-title"><div class="modal-head"><div><h2 id="shop-edit-title">Editar produto</h2>${mine?'':'<p class="modal-sub">Podes acertar a quantidade e a unidade. O resto só quem o acrescentou.</p>'}</div><button type="button" class="close" data-action="close" aria-label="Fechar">×</button></div><div class="modal-body"><form id="shop-edit-form"><div class="field"><label>Produto</label><input name="title" required maxlength="180" value="${esc(it.title)}" ${mine?'':'disabled'}/></div>${shopQtyFields(it,true,!mine)}<div class="field"><label>Notas</label><input name="notes" maxlength="500" value="${esc(it.notes||'')}" placeholder="Ex.: marca, tamanho, sem lactose" ${mine?'':'disabled'}/></div><div class="modal-actions">${mine?`<button type="button" class="button danger" data-action="shopping-delete" data-id="${esc(it.id)}">${ico('trash')} Eliminar</button>`:''}<span class="spacer"></span><button type="button" class="button" data-action="close">Cancelar</button><button type="submit" class="button primary">${ico('check')} Guardar</button></div></form></div></div></div>`;
 associateLabels(h);const form=$('#shop-edit-form');
 form.addEventListener('submit',async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(form));const q=String(v.quantity||'').trim();if(q&&!/^\d{1,5}([.,]\d{1,3})?$/.test(q))return toast('Quantidade inválida: usa um número, por exemplo 2 ou 0,5.');
  const body={quantity:q||'1',unit:v.unit||''};if(mine){body.title=v.title;body.notes=v.notes;body.category=v.category||guessShopCategory(v.title);}
  try{await api('/api/shopping/'+it.id,'PATCH',body);modal=null;h.innerHTML='';await reload();toast('Produto atualizado.');}catch(err){toast(err.message);}});
 setTimeout(()=>form.querySelector('[name=quantity]')?.select(),30);}
let shopUsualEdit=false;
function shoppingQuickHtml(){const open=new Set(shopping().filter(x=>!x.purchased).map(x=>x.title.toLocaleLowerCase('pt-PT')));const usual=(store.shoppingFrequent||[]).filter(x=>!open.has(x.title.toLocaleLowerCase('pt-PT'))).slice(0,12);const bought=shopping().filter(x=>x.purchased).length;
 return `<form class="shop-quick" id="shopping-quick" autocomplete="off"><label class="search">${ico('cart')}<input name="product" required maxlength="200" placeholder="Ex.: 2 leite, detergente, 1 kg batatas" aria-label="Produto a acrescentar" enterkeyhint="send" list="shop-suggest"/></label><datalist id="shop-suggest">${(store.shoppingFrequent||[]).map(x=>`<option value="${esc(x.title)}"></option>`).join('')}</datalist><button class="button primary" type="submit">${ico('plus')} Adicionar</button><div class="shop-quick-opts"><input name="quantity" class="select-control" inputmode="decimal" maxlength="20" placeholder="Qtd." aria-label="Quantidade (opcional)"/><select name="unit" class="select-control" aria-label="Unidade">${option('','Unidade','')}${CasaUnits.UNITS.map(([k,one])=>option(k,one,'')).join('')}</select><select name="category" class="select-control" aria-label="Categoria">${option('','Categoria automática','')}${SHOP_CATEGORIES.map(c=>option(c,c,'')).join('')}</select></div></form>
 ${usual.length?`<div class="shop-usual"><div class="shop-usual-head"><span class="eyebrow">COMPRAS HABITUAIS · ${shopUsualEdit?'TOCA PARA ESQUECER':'TOCA PARA ACRESCENTAR'}</span><button type="button" class="link-btn" data-action="shop-usual-edit">${shopUsualEdit?'Concluído':'Editar'}</button></div><div class="shop-chips ${shopUsualEdit?'editing':''}">${usual.map(x=>shopUsualEdit?`<button type="button" class="shop-chip forget" data-action="shop-forget" data-title="${esc(x.title)}" aria-label="Esquecer ${esc(x.title)}">${esc(x.title)}<span aria-hidden="true">×</span></button>`:`<button type="button" class="shop-chip" data-action="shop-usual" data-title="${esc(x.title)}" data-category="${esc(x.category||'')}" data-quantity="${esc(x.quantity||'1')}" data-unit="${esc(x.unit||'')}">${ico('plus')}${esc(x.title)}</button>`).join('')}</div></div>`:''}
 ${bought?`<div class="shop-clear"><span>${bought} ${bought===1?'produto comprado':'produtos comprados'}</span><button type="button" class="button small" data-action="shop-clear">${ico('trash')} Limpar comprados</button></div>`:''}`;}
document.addEventListener('submit',async e=>{if(e.target.id!=='shopping-quick')return;e.preventDefault();const f=e.target;const raw=f.elements.product.value;if(!raw.trim())return;
 // Vários produtos de uma vez, separados por vírgulas ou mudanças de linha.
 const parts=raw.split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean).slice(0,20);
 const qOver=f.elements.quantity.value.trim(),uOver=f.elements.unit.value;if(qOver&&!/^\d{1,5}([.,]\d{1,3})?$/.test(qOver))return toast('Quantidade inválida: usa um número, por exemplo 2 ou 0,5.');
 try{for(const part of parts){const it=parseShopInput(part);await api('/api/shopping','POST',{title:it.title,quantity:(parts.length===1&&qOver)||it.quantity,unit:uOver||it.unit||(store.shoppingFrequent||[]).find(x=>x.title.toLocaleLowerCase('pt-PT')===it.title.toLocaleLowerCase('pt-PT'))?.unit||'',category:f.elements.category.value||guessShopCategory(it.title)});}formDirty=false;await reload();toast(parts.length>1?`${parts.length} produtos adicionados.`:'Produto adicionado.');setTimeout(()=>$('#shopping-quick [name=product]')?.focus(),20);}catch(err){toast(err.message);}});

/* ───────────── Rotação de rotinas ───────────── */
// Rotação ordenada: o 1.º da lista fica responsável agora; ao marcar como feita passa ao seguinte.
// Ao abrir uma rotina já em curso, a lista começa em quem a tem atualmente.
const shortName=p=>{const first=(p?.name||'?').split(' ')[0];return people().filter(x=>x.active!==false&&x.name.split(' ')[0]===first).length>1?p.name:first;};
// 3.9: tarefa partilhada — outras pessoas também responsáveis; basta uma concluir.
function shareField(t){if(!(canManage()||demo))return '';const co=Array.isArray(t.coAssignees)?t.coAssignees:[];const list=people().filter(p=>p.active!==false);if(list.length<2)return '';
 const hide=(t.kind||'project')==='routine'||t.visibility==='private';
 return `<fieldset class="access-days share-field" data-share-field ${hide?'hidden':''}><legend>Partilhar com <small>(opcional)</small></legend><div class="rotation-picks">${list.map(p=>`<label class="day-chip-check" ${p.id===t.assignedTo?'hidden':''}><input type="checkbox" name="coAssignees" value="${esc(p.id)}" ${co.includes(p.id)?'checked':''}/><span>${esc(shortName(p))}</span></label>`).join('')}</div><p class="field-help">Aparece em «As minhas» de cada pessoa. Basta uma concluir, e fica registado quem a fez.</p></fieldset>`;}
function shareSync(form){const f=form.querySelector('[data-share-field]');if(!f)return;const kind=form.elements.kind?.value;const vis=form.elements.visibility?.value;f.hidden=kind==='routine'||vis==='private';const main=form.elements.assignedTo?.value;f.querySelectorAll('label').forEach(l=>{const i=l.querySelector('input');const me=i.value===main;l.hidden=me;if(me)i.checked=false;});}
document.addEventListener('change',e=>{const form=e.target.closest?.('#task-form');if(form&&['kind','visibility','assignedTo'].includes(e.target.name))shareSync(form);});
function rotationField(t){if(!(canManage()||demo))return '';let rot=(Array.isArray(t.rotation)?t.rotation:[]).filter(id=>people().some(p=>p.id===id&&p.active!==false));const i=rot.indexOf(t.assignedTo);if(i>0)rot=[...rot.slice(i),...rot.slice(0,i)];
 return `<fieldset class="access-days rotation-field" data-rotation-field ${(t.kind||'project')==='routine'?'':'hidden'}><legend>Rotação <small>(rotinas)</small></legend><p class="field-help">Toca nas pessoas pela ordem em que fazem a rotina. A 1.ª fica responsável agora; ao marcar como feita, passa à seguinte. Usa as setas (ou arrasta) para mudar a ordem.</p><ol class="rotation-order">${rotationItems(rot)}</ol><div class="rotation-pool">${rotationPool(rot)}</div></fieldset>`;}
function rotationItems(rot){return rot.map((id,i)=>{const p=who(id);return `<li class="rotation-item" draggable="true" data-id="${esc(id)}"><input type="hidden" name="rotation" value="${esc(id)}"/><span class="rotation-pos">${i+1}</span><span class="rotation-name">${esc(shortName(p))}${i===0?' <small>agora</small>':''}</span><span class="rotation-tools"><button type="button" class="icon-btn" data-action="rot-move" data-dir="-1" aria-label="Passar ${esc(p?.name)} para antes" ${i===0?'disabled':''}>↑</button><button type="button" class="icon-btn" data-action="rot-move" data-dir="1" aria-label="Passar ${esc(p?.name)} para depois" ${i===rot.length-1?'disabled':''}>↓</button><button type="button" class="icon-btn" data-action="rot-remove" aria-label="Retirar ${esc(p?.name)} da rotação">×</button></span></li>`;}).join('');}
function rotationPool(rot){const rest=people().filter(p=>p.active!==false&&!rot.includes(p.id));return rest.map(p=>`<button type="button" class="shop-chip" data-action="rot-add" data-id="${esc(p.id)}">${ico('plus')}${esc(shortName(p))}</button>`).join('')||'<small class="field-help">Todas as pessoas estão na rotação.</small>';}
function rotationRefresh(field,rot){field.querySelector('.rotation-order').innerHTML=rotationItems(rot);field.querySelector('.rotation-pool').innerHTML=rotationPool(rot);const sel=field.closest('form')?.elements.assignedTo;if(sel&&rot.length)sel.value=rot[0];}
const rotationOf=field=>[...field.querySelectorAll('.rotation-item')].map(li=>li.dataset.id);
function rotationAction(name,el){const field=el.closest('[data-rotation-field]');if(!field)return;let rot=rotationOf(field);const id=el.closest('.rotation-item')?.dataset.id||el.dataset.id;
 if(name==='rot-add')rot.push(id);if(name==='rot-remove')rot=rot.filter(x=>x!==id);
 if(name==='rot-move'){const i=rot.indexOf(id),j=i+Number(el.dataset.dir);if(j<0||j>=rot.length)return;[rot[i],rot[j]]=[rot[j],rot[i]];}
 rotationRefresh(field,rot);const focus=name==='rot-move'?field.querySelector(`.rotation-item[data-id="${CSS.escape(id)}"] [data-dir="${el.dataset.dir}"]:not([disabled])`)||field.querySelector(`.rotation-item[data-id="${CSS.escape(id)}"] .rotation-name`):null;focus?.focus?.();}
// Arrastar para reordenar (computador).
let rotDrag=null;
document.addEventListener('dragstart',e=>{const li=e.target.closest?.('.rotation-item');if(!li)return;rotDrag=li.dataset.id;e.dataTransfer.effectAllowed='move';li.classList.add('dragging');});
document.addEventListener('dragover',e=>{const li=e.target.closest?.('.rotation-item');if(!li||!rotDrag)return;e.preventDefault();});
document.addEventListener('drop',e=>{const li=e.target.closest?.('.rotation-item');if(!li||!rotDrag)return;e.preventDefault();const field=li.closest('[data-rotation-field]');let rot=rotationOf(field).filter(x=>x!==rotDrag);const at=rot.indexOf(li.dataset.id);const r=li.getBoundingClientRect();rot.splice(at+(e.clientY>r.top+r.height/2?1:0),0,rotDrag);rotDrag=null;rotationRefresh(field,rot);});
document.addEventListener('dragend',()=>{rotDrag=null;document.querySelectorAll('.rotation-item.dragging').forEach(x=>x.classList.remove('dragging'));});
function rotationLine(t){if(!Array.isArray(t.rotation)||t.rotation.length<2)return '';return `<div class="rotation-line" title="Rotação">${ico('repeat')}${t.rotation.map(id=>`<span class="${id===t.assignedTo?'is-current':''}">${esc(shortName(who(id)))}</span>`).join('<i aria-hidden="true">→</i>')}</div>`;}

/* ───────────── Fotografias nas tarefas ───────────── */
const photoSrc=ph=>demo?(store.photoData?.[ph.id]||''):'api/photos/'+encodeURIComponent(ph.id);
function taskPhotosHtml(t){if(!t?.id)return '';
 const list=t.photos||[];const can=canCompleteVisible(t);
 return `<div class="task-photos" id="task-photos"><div class="task-photos-head"><strong>Fotografias</strong><small>${list.length}/8 · antes, depois ou do problema</small></div><div class="photo-grid">${list.map(ph=>`<button type="button" class="photo-thumb" data-action="photo-view" data-task="${esc(t.id)}" data-id="${esc(ph.id)}" aria-label="Ver fotografia${ph.caption?': '+esc(ph.caption):''}"><img src="${esc(photoSrc(ph))}" alt="" loading="lazy"/>${ph.caption?`<span>${esc(ph.caption)}</span>`:''}</button>`).join('')}${can&&list.length<8?`<button type="button" class="photo-add" data-action="photo-add" data-task="${esc(t.id)}">${ico('camera')}<span>Acrescentar</span></button>`:''}</div><input type="file" id="task-photo-input" accept="image/*" hidden/></div>`;}
// Redimensiona no browser (máx. 1600 px; 800 px na demonstração) e converte para JPEG.
function resizePhoto(file,max=demo?800:1600,q=demo?0.7:0.82){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{const s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);const ctx=c.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',q));};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Não foi possível ler esta imagem.'));};img.src=url;});}
let photoTarget=null;
document.addEventListener('change',async e=>{if(e.target.id!=='task-photo-input'||!e.target.files?.[0]||!photoTarget)return;const file=e.target.files[0];e.target.value='';const taskId=photoTarget;
 const grid=document.querySelector('#task-photos .photo-grid');grid?.insertAdjacentHTML('beforeend','<span class="photo-thumb is-loading sk" role="status" aria-label="A enviar a fotografia"></span>');
 try{const data=await resizePhoto(file);const caption=(tasks().find(t=>t.id===taskId)?.photos||[]).length?'':'Antes';const r=await api(`/api/tasks/${taskId}/photos`,'POST',{data,caption});const t=tasks().find(x=>x.id===taskId);if(t&&r.task)t.photos=r.task.photos;const box=document.getElementById('task-photos');if(box&&t)box.outerHTML=taskPhotosHtml(t);toast('Fotografia acrescentada.');}catch(err){document.querySelector('#task-photos .is-loading')?.remove();toast(err.message);}});
function viewPhoto(taskId,photoId){const t=tasks().find(x=>x.id===taskId);const ph=t?.photos?.find(x=>x.id===photoId);if(!ph)return;const canDel=ph.by===store.user?.id||canEditVisible(t);
 const v=document.createElement('div');v.id='photo-viewer';v.innerHTML=`<div class="confirm-overlay photo-overlay" data-photo-close><figure class="photo-figure" role="dialog" aria-modal="true" aria-label="Fotografia da tarefa"><img src="${esc(photoSrc(ph))}" alt="${esc(ph.caption||'Fotografia da tarefa')}"/><figcaption><span><b>${esc(ph.caption||t.title)}</b><small>${esc(owner(ph.by))} · ${esc(fmtDateTime(ph.at))}</small></span><span class="photo-figure-actions">${canDel?`<button type="button" class="button small danger" data-photo-delete>${ico('trash')} Remover</button>`:''}<button type="button" class="button small" data-photo-close>Fechar</button></span></figcaption></figure></div>`;
 document.body.appendChild(v);const close=()=>{v.remove();document.removeEventListener('keydown',onKey,true);};const onKey=ev=>{if(ev.key==='Escape'){ev.stopPropagation();close();}};document.addEventListener('keydown',onKey,true);
 v.addEventListener('click',async ev=>{if(ev.target.closest('[data-photo-delete]')){ev.stopPropagation();if(!await confirmDialog({title:'Remover esta fotografia?',confirmLabel:'Remover',danger:true}))return;try{const r=await api(`/api/tasks/${t.id}/photos/${ph.id}`,'DELETE',{});t.photos=r.task.photos;close();const box=document.getElementById('task-photos');if(box)box.outerHTML=taskPhotosHtml(t);toast('Fotografia removida.');}catch(err){toast(err.message);}return;}if(ev.target.hasAttribute('data-photo-close')||ev.target.closest('button[data-photo-close]'))close();});
 v.querySelector('button[data-photo-close]').focus();}

/* ───────────── Ações ───────────── */
async function featureAction(name,el){
 if(name.startsWith('notif-'))return notifAction(name,el);
 switch(name){
  // Tocar fora da janela fecha-a; se já houver alterações escritas, pergunta antes de as perder.
  case 'overlay':{if(el.dataset.dirty==='1'&&!await confirmDialog({title:'Fechar sem guardar?',message:'As alterações que fizeste nesta janela perdem-se.',confirmLabel:'Fechar',danger:true}))return true;closeModal();return true;}
  case 'person-edit':personEditModal(el.dataset.id);return true;
  case 'pe-photo-pick':document.getElementById('pe-photo-input')?.click();return true;
  case 'pe-photo-remove':peDraft.photo=null;pePhotoRefresh();return true;
  case 'theme-set':{window.casaSetTheme?.(el.dataset.themeValue);const g=el.parentElement;g.querySelectorAll('[role=radio]').forEach(b=>b.setAttribute('aria-checked',String(b===el)));const i=THEME_OPTS.findIndex(o=>o[0]===el.dataset.themeValue);g.style.setProperty('--i',i);const st=g.closest('.appearance-field')?.querySelector('.appearance-state');if(st)st.textContent=THEME_OPTS[i][3];return true;}
  case 'sync-apply':await syncApply();return true;
  case 'backup-create':{if(demo){toast('Na demonstração não há cópias de segurança.');return true;}const r=await api('/api/backups','POST',{});backupsData={...backupsData,backups:r.backups};loadBackups();toast('Cópia de segurança criada.');return true;}
  case 'backup-download':{if(demo){toast('Indisponível na demonstração.');return true;}const res=await fetch('api/backups/'+encodeURIComponent(el.dataset.name),{credentials:'same-origin'});if(!res.ok)throw Error('Não foi possível descarregar a cópia.');downloadBlob(await res.blob(),el.dataset.name);toast('Transferência iniciada.');return true;}
  case 'backup-upload':{if(demo){toast('Indisponível na demonstração.');return true;}const input=$('#backup-file');input.value='';input.onchange=async()=>{const f=input.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());const r=await api('/api/backups/upload','POST',{data});backupsData={...backupsData,backups:r.backups};loadBackups();toast(`Cópia carregada (${r.summary.tasks} tarefas, ${r.summary.people} pessoas). Usa «Restaurar» para a aplicar.`);}catch(err){toast(err instanceof SyntaxError?'O ficheiro não é JSON válido.':err.message);}};input.click();return true;}
  case 'backup-restore':{if(demo){toast('Indisponível na demonstração.');return true;}const b=(backupsData?.backups||[]).find(x=>x.name===el.dataset.name);if(!await confirmDialog({title:'Restaurar esta cópia?',message:`Os dados atuais são substituídos pelos da cópia de ${b?fmtDateTime(b.createdAt):'segurança'}. O estado atual fica guardado numa cópia «Antes de restaurar».`,confirmLabel:'Restaurar',danger:true}))return true;
   await api('/api/backups/'+encodeURIComponent(el.dataset.name)+'/restore','POST',{});backupsData=null;try{await load();render();toast('Cópia restaurada.');}catch{store.user=null;renderAuth('login','Cópia restaurada. Volta a entrar.');}return true;}
  case 'ha-test':{await api('/api/ha/test','POST',{personId:el.dataset.id});toast('Notificação de teste enviada.');return true;}
  case 'ha-copy-yaml':{await copyText(document.querySelector('#ha-card pre')?.textContent||'','Configuração copiada.',document.querySelector('#ha-card pre'));return true;}
  case 'ha-token':{if(!await confirmDialog({title:'Gerar um novo token?',message:'As automações que usam o token atual deixam de funcionar até atualizares a configuração.',confirmLabel:'Gerar novo',danger:true}))return true;await api('/api/ha/token','POST',{});haData=null;await loadHa();toast('Novo token gerado.');return true;}
  case 'cal-month':calMonth=Number(el.dataset.month);render();return true;
  case 'cal-step':{let {y,m}=calView;m+=Number(el.dataset.step);if(m<1){m=12;y--;}if(m>12){m=1;y++;}calView={y,m};calSel=`${y}-${pad2(m)}-01`;if(calSel.slice(0,7)===today().slice(0,7))calSel=today();render();return true;}
  case 'cal-today':{const t=today();calView={y:Number(t.slice(0,4)),m:Number(t.slice(5,7))};calSel=t;render();return true;}
  case 'cal-day':{calSel=el.dataset.date;const y=Number(calSel.slice(0,4)),m=Number(calSel.slice(5,7));if(y!==calView.y||m!==calView.m)calView={y,m};render();document.querySelector('.cal-daylist')?.scrollIntoView({block:'nearest',behavior:'smooth'});return true;}
  case 'cal-filter':calFilter=el.dataset.value;render();return true;
  case 'cal-type':calTypes[el.dataset.value]=!calTypes[el.dataset.value];render();return true;
  case 'cal-new':{openTask(null,'project');const f=document.getElementById('task-form');if(f){f.elements.dueDate.value=el.dataset.date;}return true;}
  case 'season-editing':calEditing=!calEditing;render();return true;
  case 'season-new':seasonModal(null);return true;
  case 'season-edit':seasonModal(seasonal().find(x=>x.id===el.dataset.id));return true;
  case 'season-task':{const it=seasonal().find(x=>x.id===el.dataset.id);const m=Number(el.dataset.month);const r=await api('/api/seasonal/'+it.id+'/task','POST',{year:Number(el.dataset.year)||calYearFor(m),month:m});await reload();toast('Tarefa criada até '+shortDate(r.task.dueDate)+'.');return true;}
  case 'season-toggle':{const it=seasonal().find(x=>x.id===el.dataset.id);await api('/api/seasonal/'+it.id,'PATCH',{active:it.active===false});modal=null;await reload();toast(it.active===false?'Trabalho reativado.':'Trabalho desativado.');return true;}
  case 'season-delete':{const it=seasonal().find(x=>x.id===el.dataset.id);if(!await confirmDialog({title:'Eliminar este trabalho?',message:`«${it.title}» sai do calendário. As tarefas já criadas mantêm-se.`,confirmLabel:'Eliminar',danger:true}))return true;await api('/api/seasonal/'+it.id,'DELETE',{});modal=null;await reload();toast('Trabalho eliminado.');return true;}
  case 'shop-usual':{await api('/api/shopping','POST',{title:el.dataset.title,quantity:el.dataset.quantity||'1',unit:el.dataset.unit||'',category:el.dataset.category||guessShopCategory(el.dataset.title)});await reload();toast(el.dataset.title+' adicionado.');return true;}
  case 'shop-clear':{const n=shopping().filter(x=>x.purchased).length;if(!await confirmDialog({title:`Limpar ${n} ${n===1?'produto comprado':'produtos comprados'}?`,message:'Saem da lista. Continuam nas compras habituais para os voltares a acrescentar com um toque.',confirmLabel:'Limpar'}))return true;await api('/api/shopping/clear-purchased','POST',{});await reload();toast('Lista limpa.');return true;}
  case 'rot-add':case 'rot-remove':case 'rot-move':rotationAction(name,el);return true;
  case 'shop-edit':editShopItem(el.dataset.id);return true;
  case 'shop-usual-edit':shopUsualEdit=!shopUsualEdit;render();return true;
  case 'shop-forget':{try{const r=await api('/api/shopping/frequent','DELETE',{title:el.dataset.title});store.shoppingFrequent=r.shoppingFrequent;if(!r.shoppingFrequent.length)shopUsualEdit=false;render();toast(`«${el.dataset.title}» deixou de ser sugerido.`);}catch(e){toast(e.message);}return true;}
  case 'qty-step':stepQty(el);return true;
  case 'photo-add':photoTarget=el.dataset.task;$('#task-photo-input')?.click();return true;
  case 'photo-view':viewPhoto(el.dataset.task,el.dataset.id);return true;
 }
 return false;
}

/* ───────────── Demonstração (sem servidor) ───────────── */
function demoFeatureApi(p,method,b){
 if(p==='/api/notifications/read'){store.notifications=notifications().map(n=>b.ids==='all'||b.ids.includes(n.id)?{...n,read:true}:n);persistDemo();return {notifications:store.notifications};}
 if(p==='/api/notifications/clear'){store.notifications=notifications().map(n=>({...n,cleared:true,read:true}));persistDemo();return {notifications:store.notifications};}
 const SEED=window.__CASA_SEASONAL__||[];
 if(!Array.isArray(store.seasonal))store.seasonal=SEED.map(x=>({...x}));
 if(p==='/api/rev')return {rev:'demo'};
 if(p==='/api/backups'&&method==='GET'){const d=new Date();const mk=(h,r,s)=>({name:'demo-'+h,reason:r,createdAt:new Date(d-h*3600e3).toISOString(),size:s});return {backups:[mk(2,'auto',84211),mk(26,'auto',83102),mk(50,'manual',82877),mk(74,'auto',80544)]};}
 if(p==='/api/ha'&&method==='GET'){store.demoHa=store.demoHa||{notify:{'demo-1':'mobile_app_iphone_de_tu'},events:{assigned:true,daily:true},dailyTime:'08:30',sensors:true};return {available:true,demo:true,hostname:'local-daily-casa',token:'exemplo-token-da-demonstracao',services:['mobile_app_iphone_de_tu','mobile_app_pixel_da_pessoa_2'],sensorEntities:['sensor.daily_casa_tarefas_por_fazer','sensor.daily_casa_tarefas_atrasadas','sensor.daily_casa_para_hoje','sensor.daily_casa_compras','sensor.daily_casa_ultima_conclusao'],...store.demoHa};}
 if(p==='/api/ha'&&method==='PATCH'){store.demoHa={...(store.demoHa||{}),...b};persistDemo();return {ok:true};}
 if(p==='/api/ha/test'||p==='/api/ha/token')return {ok:true};
 if(p==='/api/seasonal'&&method==='POST'){const item={id:'s-d'+Date.now(),active:true,...b};store.seasonal.push(item);persistDemo();return {item};}
 let m=p.match(/^\/api\/seasonal\/([^/]+?)(\/task)?$/);
 if(m){const it=store.seasonal.find(x=>x.id===m[1]);if(!it)throw Error('Trabalho não encontrado.');
  if(m[2]){const key=`${it.id}:${b.year}-${String(b.month).padStart(2,'0')}`;if(tasks().some(t=>t.seasonalKey===key))throw Error('Este trabalho já foi criado como tarefa para este mês.');const due=new Date(Date.UTC(b.year,b.month,0)).toISOString().slice(0,10);const t={id:'d'+Date.now(),title:it.title,room:it.room,category:it.category,notes:it.notes||'',estimatedMinutes:it.minutes,kind:'project',priority:'P3',status:'todo',repeat:'none',dueDate:due,assignedTo:null,createdBy:store.user.id,visibility:'shared',subtasks:[],seasonalKey:key};store.tasks.push(t);persistDemo();return {task:t};}
  if(method==='PATCH'){Object.assign(it,b);persistDemo();return {item:it};}
  if(method==='DELETE'){store.seasonal=store.seasonal.filter(x=>x.id!==it.id);persistDemo();return {ok:true};}}
 if(p==='/api/shopping'&&method==='POST'){store.shoppingFreqDemo=store.shoppingFreqDemo||{};const k=String(b.title).toLocaleLowerCase('pt-PT');const prev=store.shoppingFreqDemo[k]||{count:0};store.shoppingFreqDemo[k]={title:b.title,category:b.category,quantity:b.quantity,unit:b.unit||'',count:prev.count+1};store.shoppingFrequent=Object.values(store.shoppingFreqDemo).sort((a,b)=>b.count-a.count).slice(0,16);return undefined;}
 if(p==='/api/shopping/frequent'&&method==='DELETE'){const k=String(b.title).toLocaleLowerCase('pt-PT');store.shoppingFrequent=(store.shoppingFrequent||[]).filter(x=>x.title.toLocaleLowerCase('pt-PT')!==k);if(store.shoppingFreqDemo)delete store.shoppingFreqDemo[k];persistDemo();return {shoppingFrequent:store.shoppingFrequent};}
 if(p==='/api/shopping/clear-purchased'){const n=shopping().filter(x=>x.purchased).length;store.shopping=shopping().filter(x=>!x.purchased);persistDemo();return {removed:n};}
 m=p.match(/^\/api\/tasks\/([^/]+)\/photos(?:\/([^/]+))?$/);
 if(m){const t=tasks().find(x=>x.id===m[1]);if(!t)throw Error('Tarefa não encontrada.');store.photoData=store.photoData||{};
  if(method==='POST'){if((t.photos||[]).length>=8)throw Error('Cada tarefa pode ter no máximo 8 fotografias.');const pid='ph'+Date.now();store.photoData[pid]=b.data;t.photos=[...(t.photos||[]),{id:pid,by:store.user.id,at:new Date().toISOString(),caption:b.caption||''}];try{persistDemo();localStorage.setItem('casa-demo-1-7',JSON.stringify(store));}catch{t.photos.pop();delete store.photoData[pid];throw Error('Sem espaço na demonstração para mais fotografias.');}return {task:t};}
  if(method==='DELETE'){t.photos=(t.photos||[]).filter(x=>x.id!==m[2]);delete store.photoData[m[2]];persistDemo();return {task:t};}}
 return undefined;
}

// A rotação só faz sentido em rotinas: mostra/esconde ao mudar o tipo da tarefa.
document.addEventListener('change',e=>{if(e.target.name!=='kind'||!e.target.closest('#task-form'))return;const f=e.target.closest('#task-form').querySelector('[data-rotation-field]');if(f)f.hidden=e.target.value!=='routine';});
document.addEventListener('input',e=>{const o=e.target.closest?.('.overlay[data-action="overlay"]');if(o)o.dataset.dirty='1';},true);

/* ───────────── Aparência (claro / escuro), por dispositivo ───────────── */
// Aparência: três símbolos (automático · claro · escuro) num interruptor compacto; o nome do modo escolhido aparece ao lado.
const THEME_OPTS=[['auto','Automático','theme-auto','Automático · segue o dispositivo'],['light','Claro','sun','Claro'],['dark','Escuro','moon','Escuro']];
function appearanceField(){const cur=window.casaThemePref?.()||'auto';const sel=THEME_OPTS.find(o=>o[0]===cur)||THEME_OPTS[0];
 return `<div class="field appearance-field"><div class="appearance-row"><div><span class="field-label" id="appearance-label">Aparência</span><small class="appearance-state" aria-live="polite">${sel[3]}</small></div><div class="theme-toggle" role="radiogroup" aria-labelledby="appearance-label" style="--i:${THEME_OPTS.indexOf(sel)}">${THEME_OPTS.map(([v,l,ic])=>`<button type="button" role="radio" aria-checked="${cur===v}" aria-label="${l}" title="${l}" data-action="theme-set" data-theme-value="${v}">${ico(ic)}</button>`).join('')}</div></div></div>`;}

/* ───────────── Pessoas: contactos e edição pelo administrador ───────────── */
const MONTHS_LONG_PT=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const fmtBirthday=mmdd=>{const m=/^(\d{2})-(\d{2})$/.exec(mmdd||'');return m?`${Number(m[2])} de ${MONTHS_LONG_PT[Number(m[1])-1]}`:'';};
function personContacts(p){const bd=p.birthDate?p.birthDate.slice(5):p.birthday;const items=[];
 if(bd)items.push(`<span>${ico('cake')}${esc(fmtBirthday(bd))}</span>`);
 if(p.phone)items.push(`<a href="tel:${esc(p.phone.replace(/[^\d+]/g,''))}">${ico('phone')}${esc(p.phone)}</a>`);
 if(p.email)items.push(`<a href="mailto:${esc(p.email)}">${ico('mail')}${esc(p.email)}</a>`);
 return items.length?`<div class="person-contacts">${items.join('')}</div>`:'';}
let peDraft={};
function pePhotoBlock(p){const ph='photo'in peDraft?peDraft.photo:p.photo;return `${avatarHtml({...p,photo:ph||''},'profile-avatar')}<div class="profile-photo-actions"><input type="file" id="pe-photo-input" accept="image/*" hidden/><button class="button" type="button" data-action="pe-photo-pick">${ico('camera')} ${ph?'Mudar fotografia':'Adicionar fotografia'}</button>${ph?`<button class="button" type="button" data-action="pe-photo-remove">${ico('trash')} Remover</button>`:''}</div>${'photo'in peDraft?'<p class="profile-pending">Fotografia por guardar.</p>':''}`;}
function pePhotoRefresh(){const p=people().find(x=>x.id===peDraft.__id);const b=document.getElementById('pe-photo');if(p&&b){b.innerHTML=pePhotoBlock(p);const o=b.closest('.overlay');if(o)o.dataset.dirty='1';}}
document.addEventListener('change',async e=>{if(e.target.id!=='pe-photo-input'||!e.target.files?.[0])return;const f=e.target.files[0];e.target.value='';try{const data=await cropPhoto(f);if(data){peDraft.photo=data;pePhotoRefresh();}}catch(err){toast(err.message);}});
modalRenderers['person-edit']=h=>{const p=people().find(x=>x.id===peDraft.__id);if(!p){modal=null;h.innerHTML='';return;}const z=h.querySelector('#pe-admin');if(z)z.innerHTML=personAdminBlock(p);else personEditModal(p.id);};
function personEditModal(id){const p=people().find(x=>x.id===id);if(!p)return;peDraft={__id:p.id};const h=$('#modal-holder');modal={type:'person-edit'};
 h.innerHTML=`<div class="overlay" data-action="overlay"><div class="modal quick-modal" role="dialog" aria-modal="true" aria-labelledby="pe-title"><div class="modal-head"><div><h2 id="pe-title">Editar ${esc(p.name.split(' ')[0])}</h2><p class="modal-sub">Fotografia, nome, email de entrada e contactos.</p></div><button type="button" class="close" data-action="close" aria-label="Fechar">×</button></div><div class="modal-body"><form id="person-edit-form" novalidate><div class="pe-photo" id="pe-photo">${pePhotoBlock(p)}</div><div class="field"><label>Nome</label><input name="name" required minlength="2" maxlength="80" value="${esc(p.name)}"/></div><div class="field"><label>Data de nascimento</label><input type="date" name="birthDate" max="${today()}" value="${esc(p.birthDate||'')}"/></div><div class="field"><label for="pe-phone">Telefone</label>${phoneField('pe-phone','phone',p.phone)}</div><div class="field"><label>Email</label><input type="email" name="email" maxlength="120" autocapitalize="none" spellcheck="false" value="${esc(p.email||'')}"/><small class="field-help">É com este email que ${esc(p.name.split(' ')[0])} entra na app. Se o mudares, avisa a pessoa; a palavra-passe mantém-se.</small></div><div class="modal-actions"><span class="spacer"></span><button type="button" class="button" data-action="close">Cancelar</button><button type="submit" class="button primary">${ico('check')} Guardar</button></div></form><div id="pe-admin">${personAdminBlock(p)}</div></div></div></div>`;
 associateLabels(h);$('#person-edit-form').addEventListener('submit',async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));const body={};for(const k of ['name','birthDate','email','phone']){const val=String(v[k]??'').trim();if(val!==String(p[k]||''))body[k]=val;}if('photo'in peDraft)body.photo=peDraft.photo||null;
  if(!Object.keys(body).length){closeModal();return;}
  try{const r=await api('/api/people/'+p.id,'PATCH',body);if(r.people)store.people=r.people;modal=null;h.innerHTML='';await reload();toast(body.email?`Dados guardados. ${p.name.split(' ')[0]} passa a entrar com ${body.email}.`:'Dados guardados.');}catch(err){toast(err.message);}});}

/* ───────────── Notificações (sino) ───────────── */
let notifOpen=false;
const notifications=()=>Array.isArray(store.notifications)?store.notifications:[];
const NOTIF_ICON={assigned:'list',rotation:'repeat',done:'check-square',birthday:'cake',due:'clock',season:'calendar',equipment:'tool',subscription:'wallet'};
function relTime(iso){const d=(Date.now()-Date.parse(iso))/1000;if(d<60)return 'agora';if(d<3600)return `há ${Math.floor(d/60)} min`;if(d<86400)return `há ${Math.floor(d/3600)} h`;if(d<172800)return 'ontem';if(d<7*86400)return `há ${Math.floor(d/86400)} dias`;return new Date(iso).toLocaleDateString('pt-PT',{day:'numeric',month:'short'});}
function bellButton(){const n=notifications().filter(x=>!x.read&&!x.cleared).length;return `<button type="button" class="icon-btn bell-btn ${notifOpen?'is-open':''}" data-action="notif-toggle" aria-haspopup="dialog" aria-expanded="${notifOpen}" aria-label="Notificações${n?`: ${n} por ler`:''}">${ico('bell')}${n?`<span class="bell-badge" aria-hidden="true">${n>9?'9+':n}</span>`:''}</button>`;}
function notifItem(n){return `<button type="button" class="notif-item ${n.read?'':'unread'}" data-action="notif-open" data-id="${esc(n.id)}"><span class="notif-ico t-${esc(n.type)}" aria-hidden="true">${ico(NOTIF_ICON[n.type]||'info')}</span><span class="notif-text"><b>${esc(n.title)}</b>${n.body?`<small>${esc(n.body)}</small>`:''}<em>${esc(relTime(n.at))}</em></span>${n.read?'':'<i class="notif-dot" aria-label="Por ler"></i>'}</button>`;}
function notifPanel(){if(!notifOpen)return '';const all=notifications();const list=all.filter(x=>!x.cleared);const unread=list.filter(x=>!x.read).length;
 return `<button class="notif-dismiss" type="button" data-action="notif-close" tabindex="-1" aria-label="Fechar notificações"></button><section class="notif-panel" role="dialog" aria-label="Notificações" tabindex="-1"><header class="notif-head"><strong>Notificações</strong><span>${unread?`<button type="button" class="link-btn" data-action="notif-read-all">Marcar todas como lidas</button>`:''}${list.length?`<button type="button" class="link-btn" data-action="notif-clear">Limpar</button>`:''}</span></header><div class="notif-list">${list.map(notifItem).join('')||`<div class="notif-empty">${ico('bell')}<p>Sem notificações novas.</p><small>Aqui aparecem tarefas atribuídas, conclusões, rotações, aniversários e lembretes.</small></div>`}</div><footer class="notif-foot"><button type="button" class="link-btn" data-action="notif-all">Ver todas${all.length?` (${all.length})`:''}</button><small>Últimos 30 dias</small></footer></section>`;}
// Página «Notificações»: as dos últimos 30 dias, incluindo as limpas do sino, agrupadas por dia.
function notificationsPage(){const all=notifications();const groups={};const dayKey=iso=>{const d=new Date(iso);const t=new Date();const k=d.toDateString();if(k===t.toDateString())return 'Hoje';const y=new Date(t.getTime()-864e5);if(k===y.toDateString())return 'Ontem';const s=d.toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'});return s[0].toUpperCase()+s.slice(1);};
 all.forEach(n=>(groups[dayKey(n.at)]??=[]).push(n));const unread=all.filter(x=>!x.read).length;
 return `${head('Notificações','Os avisos dos últimos 30 dias, incluindo os que limpaste do sino.',false)}<div class="notif-page-tools">${unread?`<button type="button" class="button small" data-action="notif-read-all">${ico('check')} Marcar todas como lidas</button>`:''}<span class="muted">${all.length} ${all.length===1?'notificação':'notificações'}</span></div>
 ${Object.entries(groups).map(([d,list])=>`<section class="notif-day"><h3>${esc(d)}</h3><div class="notif-list page">${list.map(notifItem).join('')}</div></section>`).join('')||`<div class="panel">${empty('bell','Sem notificações','Nos últimos 30 dias não houve avisos para ti.')}</div>`}`;}
async function notifRead(ids){try{const r=await api('/api/notifications/read','POST',{ids});if(r.notifications)store.notifications=r.notifications;}catch(e){toast(e.message);}}
async function notifAction(name,el){
 if(name==='notif-toggle'){notifOpen=!notifOpen;moreOpen=false;quickCreateOpen=false;render();if(notifOpen)(document.querySelector('.notif-panel .notif-item')||document.querySelector('.notif-panel'))?.focus();return true;}
 if(name==='notif-close'){notifOpen=false;render();return true;}
 if(name==='notif-read-all'){await notifRead('all');render();return true;}
 if(name==='notif-clear'){try{const r=await api('/api/notifications/clear','POST',{});store.notifications=r.notifications||[];}catch(e){toast(e.message);}render();toast('Sino limpo. Continuam em «Ver todas» durante 30 dias.');return true;}
 if(name==='notif-all'){notifOpen=false;page='notifications';render();window.scrollTo(0,0);return true;}
 if(name==='notif-open'){const n=notifications().find(x=>x.id===el.dataset.id);if(!n)return true;if(!n.read)await notifRead([n.id]);notifOpen=false;const l=n.link||{};
  if(l.finTab&&typeof finTab!=='undefined')finTab=l.finTab;if(l.page){page=l.page;taskView='list';normalizePage();query='';roomFilter='all';statusFilter='all';priorityFilter='all';personFilter=l.filter==='mine'?store.user.id:'all';tab='active';}
  render();window.scrollTo(0,0);if(l.taskId&&tasks().some(t=>t.id===l.taskId))openTask(l.taskId);if(l.equipmentId)openEquipmentView(l.equipmentId);if(l.incidentId)openIncidentView(l.incidentId);return true;}
 return false;}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&notifOpen){notifOpen=false;render();document.querySelector('.bell-btn')?.focus();}});

/* ───────────── Telefone com indicativo (bandeiras) ───────────── */
const DIAL=[['Portugal','+351','🇵🇹'],['Espanha','+34','🇪🇸'],['França','+33','🇫🇷'],['Reino Unido','+44','🇬🇧'],['Alemanha','+49','🇩🇪'],['Itália','+39','🇮🇹'],['Suíça','+41','🇨🇭'],['Bélgica','+32','🇧🇪'],['Países Baixos','+31','🇳🇱'],['Luxemburgo','+352','🇱🇺'],['Irlanda','+353','🇮🇪'],['Áustria','+43','🇦🇹'],['Andorra','+376','🇦🇩'],['Brasil','+55','🇧🇷'],['EUA / Canadá','+1','🇺🇸'],['Angola','+244','🇦🇴'],['Moçambique','+258','🇲🇿'],['Cabo Verde','+238','🇨🇻'],['Guiné-Bissau','+245','🇬🇼'],['São Tomé e Príncipe','+239','🇸🇹'],['Timor-Leste','+670','🇹🇱'],['Macau','+853','🇲🇴'],['África do Sul','+27','🇿🇦'],['Venezuela','+58','🇻🇪'],['Austrália','+61','🇦🇺']];
// «+351 912 345 678» → {code:'+351', number:'912 345 678'}; sem indicativo assume Portugal.
function splitPhone(v){const t=String(v||'').trim();if(!t)return {code:'+351',number:''};if(t.startsWith('+')){const digits=t.replace(/[^\d+]/g,'');const hit=DIAL.map(d=>d[1]).filter(c=>digits.startsWith(c)).sort((a,b)=>b.length-a.length)[0];if(hit){let rest=t.slice(1);for(const ch of hit.slice(1)){rest=rest.replace(new RegExp('^[^\\d]*'+ch),'');}return {code:hit,number:rest.trim()};}return {code:'',number:t};}if(t.startsWith('00'))return splitPhone('+'+t.slice(2));return {code:'+351',number:t};}
function phoneField(id,name,value){const {code,number}=splitPhone(value);const codes=DIAL.some(d=>d[1]===code)?DIAL:[[code||'Outro',code,'🌐'],...DIAL];
 return `<div class="phone-field"><select class="phone-code" aria-label="Indicativo do país" data-phone-for="${esc(name)}">${codes.map(([n,c,f])=>`<option value="${esc(c)}" ${c===code?'selected':''} title="${esc(n)}">${f} ${esc(c)}</option>`).join('')}</select><input id="${esc(id)}" type="tel" inputmode="tel" autocomplete="tel-national" maxlength="20" placeholder="912 345 678" data-phone-for="${esc(name)}" value="${esc(number)}"/><input type="hidden" name="${esc(name)}" value="${esc(value||'')}"/></div>`;}
// Junta indicativo e número no campo escondido que o formulário envia.
document.addEventListener('input',e=>{const w=e.target.closest?.('.phone-field');if(!w)return;const code=w.querySelector('.phone-code').value,num=w.querySelector('input[type=tel]').value.trim();w.querySelector('input[type=hidden]').value=num?(code?code+' ':'')+num.replace(/^\+\d+\s*/,''):'';},true);
document.addEventListener('change',e=>{if(e.target.classList?.contains('phone-code'))e.target.closest('.phone-field').querySelector('input[type=tel]').dispatchEvent(new Event('input',{bubbles:true}));},true);

/* 3.1.1 · Aviso de nova versão: quando o add-on é atualizado no Home Assistant, a app aberta (ou reaberta) pede para atualizar. */
let versionShown='';
function versionDismissed(v){try{return sessionStorage.getItem('dc-version-later')===v;}catch{return versionShown===v;}}
async function versionCheck(v){
 if(!APP_VER||v===APP_VER||versionShown===v||versionDismissed(v)||document.getElementById('version-holder'))return;
 versionShown=v;let notes={title:'',items:[]};try{notes=await api('/api/version');}catch{}
 const holder=document.createElement('div');holder.id='version-holder';
 holder.innerHTML=`<div class="confirm-overlay"><div class="confirm-box version-box" role="alertdialog" aria-modal="true" aria-labelledby="version-title" aria-describedby="version-msg"><span class="version-badge">${ico('sparkle')} Versão ${esc(v)}</span><h2 id="version-title">Há uma nova versão da Daily Casa</h2><p id="version-msg">${notes.title?`<b>${esc(notes.title)}.</b> `:''}Atualiza para usares as novidades. Demora só uns segundos.</p>${notes.items?.length?`<ul class="version-notes">${notes.items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<div class="confirm-actions"><button type="button" class="button" data-version="later">Mais tarde</button><button type="button" class="button primary" data-version="now">${ico('refresh')} Atualizar agora</button></div></div></div>`;
 document.body.appendChild(holder);holder.querySelector('[data-version="now"]').focus();
 holder.addEventListener('click',async e=>{const b=e.target.closest('[data-version]');if(!b)return;
  if(b.dataset.version==='later'){try{sessionStorage.setItem('dc-version-later',v);}catch{}holder.remove();return;}
  b.disabled=true;b.innerHTML=`${ico('refresh')} A atualizar…`;await versionReload();});
}
async function versionReload(){
 try{if('caches'in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)));}}catch{}
 try{const reg=await navigator.serviceWorker?.getRegistration();if(reg)await reg.update();}catch{}
 location.reload();
}

/* 3.11.3 · Tocar numa fotografia de perfil (Pessoas, perfil, edição de pessoa) mostra-a em grande. */
function viewAvatar(src,name,sub){if(!src)return;document.getElementById('photo-viewer')?.remove();
 const v=document.createElement('div');v.id='photo-viewer';v.innerHTML=`<div class="confirm-overlay photo-overlay" data-photo-close><figure class="photo-figure avatar-figure" role="dialog" aria-modal="true" aria-label="Fotografia de ${esc(name||'perfil')}"><img src="${esc(src)}" alt="Fotografia de ${esc(name||'perfil')}"/><figcaption><span><b>${esc(name||'')}</b>${sub?`<small>${esc(sub)}</small>`:''}</span><span class="photo-figure-actions"><button type="button" class="button" data-photo-close>${ico('check')} Fechar</button></span></figcaption></figure></div>`;
 document.body.appendChild(v);const prev=document.activeElement;const close=()=>{v.remove();document.removeEventListener('keydown',onKey,true);prev?.focus?.();};const onKey=ev=>{if(ev.key==='Escape'){ev.stopPropagation();close();}};document.addEventListener('keydown',onKey,true);
 v.addEventListener('click',ev=>{if(ev.target.closest('[data-photo-close]')&&(ev.target.closest('button')||ev.target.classList.contains('photo-overlay')))close();});v.querySelector('button[data-photo-close]').focus();}
document.addEventListener('click',e=>{const a=e.target.closest?.('.person-card .person-head .avatar.has-photo,.profile-photo .avatar.has-photo,.person-modal .avatar.has-photo');if(!a)return;const img=a.querySelector('img');if(!img)return;
 const card=a.closest('.person-card');const name=card?.querySelector('.person-id strong')?.textContent||a.closest('.modal')?.querySelector('h2')?.textContent||'';const sub=card?.querySelector('.person-id .sub')?.textContent||'';e.preventDefault();viewAvatar(img.getAttribute('src'),name,sub);});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('.person-card .avatar.has-photo,.profile-photo .avatar.has-photo')){e.preventDefault();e.target.click();}});

/* 3.11.4 · Editar ou apagar um registo de trabalho (Registo de horas). */
modalRenderers['worklog-edit']=holder=>{const e=workLogs().find(x=>x.id===modal.id);if(!e){modal=null;return;}const group=e.groupId?workLogs().filter(x=>x.groupId===e.groupId):[e];
 const body=`<form id="worklog-edit-form"><div class="form-row"><div class="field"><label for="we-date">Data</label><input id="we-date" type="date" name="date" required value="${esc(e.date)}" max="${esc(today())}"/></div><div class="field"><label for="we-min">Duração (min)</label><input id="we-min" type="number" inputmode="numeric" name="minutes" min="1" max="1440" required value="${esc(String(e.minutes))}"/></div></div>
 <div class="field"><label for="we-task">Tarefa relacionada</label><select id="we-task" name="taskId">${option('','Sem tarefa associada',e.taskId||'')}${tasks().map(t=>option(t.id,t.title,e.taskId||'')).join('')}</select></div>
 ${wlWhoField(group.map(x=>x.userId),'we')}
 <div class="field"><label for="we-note">Trabalho realizado</label><textarea id="we-note" name="note" rows="3" maxlength="1000" required>${esc(e.note||'')}</textarea></div>
 <div class="modal-actions"><button type="button" class="button danger" data-action="worklog-delete" data-id="${esc(e.id)}">${ico('trash')} Eliminar</button><span class="spacer"></span><button type="button" class="button" data-action="close">Cancelar</button><button type="submit" class="button primary">${ico('check')} Guardar</button></div></form>`;
 holder.innerHTML=modalShell({title:'Editar registo',sub:`${esc(wlNames(group.map(x=>x.userId)))} · registado a ${esc(shortDate(String(e.createdAt||e.date).slice(0,10)))}`,body});
 const f=holder.querySelector('#worklog-edit-form');f.addEventListener('submit',async ev=>{ev.preventDefault();const v=Object.fromEntries(new FormData(f));delete v.userIds;v.minutes=Number(v.minutes);if(f.querySelector('[data-wl-who]')){v.userIds=wlPicked(f);if(!v.userIds.length){toast('Escolhe quem fez o trabalho.');return;}}const b=f.querySelector('[type=submit]');b.disabled=true;
  try{await api('/api/worklogs/'+encodeURIComponent(e.id),'PATCH',v);modal=null;await reload();toast('Registo atualizado.');}catch(err){toast(err.message);b.disabled=false;}});};
actionHandlers.push(async(name,el)=>{
 if(name==='worklog-edit'){modal={type:'worklog-edit',id:el.dataset.id};renderModal();return true;}
 if(name!=='worklog-delete')return false;
 const de=workLogs().find(x=>x.id===el.dataset.id);const gn=de?.groupId?workLogs().filter(x=>x.groupId===de.groupId).length:1;
 if(!await confirmDialog({title:'Eliminar este registo?',message:gn>1?`O registo é de ${gn} pessoas e é eliminado para todas. O tempo deixa de contar no resumo do mês e no equilíbrio.`:'O tempo deixa de contar no resumo do mês e no equilíbrio.',confirmLabel:'Eliminar',danger:true}))return true;
 try{await api('/api/worklogs/'+encodeURIComponent(el.dataset.id)+(gn>1?'?grupo=1':''),'DELETE',{});modal=null;await reload();toast('Registo eliminado.');}catch(e){toast(e.message);}return true;});

/* 3.12 — Modal da tarefa: o essencial à vista; «Mais opções» resume o que está preenchido lá dentro. */
function taskMoreSummary(t){const bits=[];
 if((t.kind||'project')==='routine')bits.push('Rotina');
 if(t.priority==='P1'||t.priority==='P2')bits.push(PRIORITIES[t.priority]);
 if(t.repeat&&t.repeat!=='none')bits.push(repeatLabels[t.repeat]||'Repete');
 const co=(Array.isArray(t.coAssignees)?t.coAssignees:[]).length;if(co)bits.push(co===1?'partilhada com 1':'partilhada com '+co);
 if(t.estimatedMinutes)bits.push(t.estimatedMinutes+' min');
 const st=(t.subtasks||[]).length;if(st)bits.push(st+(st===1?' passo':' passos'));
 if(t.visibility==='private')bits.push('privada');
 if(t.status&&t.status!=='todo'&&t.status!=='done'&&typeof labels!=='undefined')bits.push(String(labels[t.status]||'').toLowerCase());
 if(t.notes)bits.push('com notas');
 return bits.length?bits.slice(0,4).join(' · '):'Prioridade, repetição, partilha, notas…';}
function taskMoreRefresh(form){const sum=form?.querySelector('.task-more-sum');if(!sum)return;const v=Object.fromEntries(new FormData(form));
 const co=form.querySelectorAll('[data-share-field] [aria-pressed="true"],[data-share-field] input:checked').length;
 sum.textContent=taskMoreSummary({kind:v.kind,priority:v.priority,repeat:v.repeat,estimatedMinutes:Number(v.estimatedMinutes)||0,subtasks:String(v.subtasksText||'').split('\n').filter(x=>x.trim()),visibility:v.visibility,status:v.status,notes:String(v.notes||'').trim(),coAssignees:Array(co).fill(0)});}
['change','input'].forEach(ev=>document.addEventListener(ev,e=>{const f=e.target.closest?.('#task-form');if(f&&e.target.closest('#task-advanced'))taskMoreRefresh(f);}));

/* 3.13 — Registo de horas: primeiro o que foi feito, agrupado por dia; registar numa janela. */
let worklogPeriod='month';
const WL_PERIODS=[['month','Este mês'],['prev','Mês anterior'],['all','Tudo']];
function worklogFilter(){const m=today().slice(0,7);if(worklogPeriod==='all')return()=>true;
 let k=m;if(worklogPeriod==='prev'){const [y,mm]=m.split('-').map(Number);const d=new Date(Date.UTC(y,mm-2,15));k=d.toISOString().slice(0,7);}
 return x=>(x.date||'').startsWith(k);}
const fmtDur=m=>{m=Number(m)||0;const h=Math.floor(m/60),r=m%60;return h?`${h} h${r?' '+String(r).padStart(2,'0'):''}`:`${r} min`;};
function worklogDayLabel(d){const t=today();const y=CasaCore.addDays(t,-1);const dt=new Date(d+'T12:00:00Z');
 const long=dt.toLocaleDateString('pt-PT',{day:'numeric',month:'short',timeZone:'UTC'}).replace('.','');
 const wd=dt.toLocaleDateString('pt-PT',{weekday:'long',timeZone:'UTC'});
 return d===t?`Hoje · ${long}`:d===y?`Ontem · ${long}`:`${wd[0].toUpperCase()+wd.slice(1)} · ${long}`;}
// 3.16: registos feitos em conjunto (mesmo groupId) aparecem numa só linha, com as pessoas todas.
function wlMerge(logs){const out=[];const seen=new Map();for(const x of logs){if(x.groupId){const g=seen.get(x.groupId);if(g){g.members.push(x);continue;}const it={...x,members:[x]};seen.set(x.groupId,it);out.push(it);}else out.push({...x,members:[x]});}return out;}
const wlNames=ids=>{const n=ids.map(i=>{const p=people().find(x=>x.id===i);return p?shortName(p):owner(i);});return n.length<=1?n.join(''):n.slice(0,-1).join(', ')+' e '+n[n.length-1];};
function worklogRow(x){const members=x.members||[x];const ids=members.map(m=>m.userId);
 const mine=canManage()||demo||members.some(m=>m.userId===store.user?.id||m.actor===store.user?.id);
 const task=x.taskId?tasks().find(t=>t.id===x.taskId):null;
 const meta=[wlNames(ids),task?task.title:'',task?.room&&task.room!=='Geral'?roomShort(task.room):''].filter(Boolean).map(esc).join(' · ');
 const same=members.every(m=>m.minutes===members[0].minutes);
 const dur=members.length>1?(same?`${fmtDur(members[0].minutes)} cada`:fmtDur(members.reduce((n,m)=>n+Number(m.minutes||0),0))):fmtDur(x.minutes);
 const av=members.length>1?`<span class="wl-avs">${members.slice(0,3).map(m=>avatarHtml(people().find(p=>p.id===m.userId)||{name:owner(m.userId)},'mini')).join('')}</span>`:avatarHtml(people().find(p=>p.id===x.userId)||{name:owner(x.userId)},'mini');
 const inner=`${av}<span class="wl-text"><strong>${esc(x.note||'Trabalho')}</strong><small>${meta}</small></span><em>${esc(dur)}</em>`;
 return mine?`<button type="button" class="wl-row" data-action="worklog-edit" data-id="${esc(x.id)}" aria-label="Editar o registo «${esc(x.note||'')}»">${inner}</button>`:`<div class="wl-row">${inner}</div>`;}
// Quem fez: várias pessoas. Quem não é administrador/gestor fica sempre incluído (só regista trabalho em que participou).
function wlWhoField(selected,prefix){const me=store.user?.id;const isCol=store.user?.role==='collaborator';if(isCol)return '';
 const list=people().filter(p=>p.active!==false||selected.includes(p.id));const lock=!canManage();
 return `<fieldset class="access-days wl-who" data-wl-who><legend>Quem fez <small>(escolhe todas as pessoas que participaram)</small></legend><div class="rotation-picks">${list.map(p=>{const on=selected.includes(p.id);const locked=lock&&p.id===me;
  return `<label class="day-chip-check ${locked?'locked':''}"><input type="checkbox" name="userIds" value="${esc(p.id)}" ${on||locked?'checked':''} ${locked?'disabled':''}/><span>${esc(p.id===me?'Eu':shortName(p))}</span></label>${locked?`<input type="hidden" name="userIds" value="${esc(p.id)}"/>`:''}`;}).join('')}</div></fieldset>`;}
const wlPicked=f=>[...new Set([...f.querySelectorAll('input[name="userIds"]')].filter(i=>i.type==='hidden'||i.checked).map(i=>i.value))];
function worklogsPage(){
 const logs=workLogs().filter(worklogFilter()).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
 const total=logs.reduce((n,x)=>n+Number(x.minutes||0),0);const ppl=new Set(logs.map(x=>x.userId)).size;
 const merged=wlMerge(logs);const days=[];for(const x of merged){const last=days[days.length-1];if(last&&last.date===x.date)last.items.push(x);else days.push({date:x.date,items:[x]});}
 const seg=`<div class="seg-control seg-small wl-period" role="radiogroup" aria-label="Período">${WL_PERIODS.map(([k,l])=>`<button type="button" role="radio" aria-checked="${worklogPeriod===k}" data-action="worklog-period" data-period="${k}">${l}</button>`).join('')}</div>`;
 const stats=`<div class="wl-stats"><div><strong>${esc(fmtDur(total))}</strong><span>registadas</span></div><div><strong>${merged.length}</strong><span>${merged.length===1?'registo':'registos'}</span></div><div><strong>${ppl}</strong><span>${ppl===1?'pessoa':'pessoas'}</span></div></div>`;
 const list=days.length?days.map(d=>`<section class="wl-day"><h2 class="wl-day-head"><span>${esc(worklogDayLabel(d.date))}</span><span>${esc(fmtDur(d.items.reduce((n,x)=>n+x.members.reduce((m,y)=>m+Number(y.minutes||0),0),0)))}</span></h2><div class="panel wl-list">${d.items.map(worklogRow).join('')}</div></section>`).join(''):`<div class="panel">${empty('clock','Sem registos neste período','Toca em «Registar trabalho» para anotar o que foi feito e quanto tempo levou.')}</div>`;
 return `${head('Registo de horas','Trabalhos feitos, datas e tempo de cada pessoa.',false)}${seg}${stats}${list}${hoursSummary()}<div class="wl-cta"><button type="button" class="button primary" data-action="worklog-new">${ico('plus-square')} Registar trabalho</button></div>`;}
modalRenderers['worklog-new']=holder=>{const preset=modal.taskId||'';
 const body=`<form id="worklog-form-new"><div class="field"><label for="wn-note">O que foi feito</label><textarea id="wn-note" name="note" rows="3" maxlength="1000" required placeholder="Ex.: Limpeza geral do 1.º piso">${esc(preset?(tasks().find(t=>t.id===preset)?.title||''):'')}</textarea></div>
 <div class="form-row"><div class="field"><label for="wn-date">Data</label><input id="wn-date" type="date" name="date" required value="${esc(today())}" max="${esc(today())}"/></div><div class="field"><label for="wn-min">Duração (min)</label><input id="wn-min" type="number" inputmode="numeric" name="minutes" min="1" max="1440" required value="30"/></div></div>
 ${wlWhoField([store.user.id],'wn')}
 <div class="field"><label for="wn-task">Tarefa relacionada</label><select id="wn-task" name="taskId">${option('','Sem tarefa associada',preset)}${tasks().map(t=>option(t.id,t.title,preset)).join('')}</select></div>
 <div class="modal-actions"><span class="spacer"></span><button type="button" class="button" data-action="close">Cancelar</button><button type="submit" class="button primary">${ico('check')} Guardar</button></div></form>`;
 const dupe=preset?workLogs().filter(l=>l.taskId===preset&&l.date===today()&&(l.userId===store.user.id||l.actor===store.user.id)):[];
 holder.innerHTML=modalShell({title:'Registar trabalho',sub:'O que foi feito e quanto tempo levou.',body:(dupe.length?`<p class="wl-dupe">${ico('alert')} Já registaste ${esc(fmtDur(dupe.reduce((n,l)=>n+Number(l.minutes||0),0)))} nesta tarefa hoje. Só regista outra vez se for trabalho a mais.</p>`:'')+body});
 const f=holder.querySelector('#worklog-form-new');setTimeout(()=>{const n=f.querySelector('#wn-note');n.focus();n.setSelectionRange(n.value.length,n.value.length);},60);
 f.addEventListener('submit',async ev=>{ev.preventDefault();const v=Object.fromEntries(new FormData(f));delete v.userIds;v.minutes=Number(v.minutes);if(f.querySelector('[data-wl-who]')){v.userIds=wlPicked(f);if(!v.userIds.length){toast('Escolhe quem fez o trabalho.');return;}}const b=f.querySelector('[type=submit]');b.disabled=true;
  try{await api('/api/worklogs','POST',v);modal=null;await reload();toast(v.userIds?.length>1?`Trabalho registado para ${v.userIds.length} pessoas.`:'Trabalho registado.');}catch(err){toast(err.message);b.disabled=false;}});};
actionHandlers.push(async(name,el)=>{
 if(name==='worklog-period'){worklogPeriod=el.dataset.period;render();return true;}
 if(name==='worklog-new'){modal={type:'worklog-new'};renderModal();return true;}
 return false;});

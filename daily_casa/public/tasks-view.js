/* Daily Casa — Tarefas (2.0)
 * Uma só página com quatro vistas: Lista (agrupada por quando), Rotinas, Calendário e Divisões (estado de cada uma).
 * Criação rápida por escrita natural (CasaCore.parseTask), com etiquetas que se podem corrigir.
 */
'use strict';
const QUICK_FILTERS=[['mine','As minhas'],['all','Todas'],['unassigned','Sem responsável'],['urgent','Urgentes'],['short','Até 30 min']];
function taskMatches(t){
 if(quickFilter==='mine'&&!isAssignee(t,store.user.id))return false;
 if(quickFilter==='unassigned'&&t.assignedTo)return false;
 if(quickFilter==='urgent'&&!['P1','P2'].includes(t.priority))return false;
 if((quickFilter==='short'||timeMode)&&!(t.estimatedMinutes!=null&&t.estimatedMinutes<=(timeMode?durationLimit:30)&&t.status!=='waiting'))return false;
 if(personFilter!=='all'&&(personFilter==='none'?t.assignedTo:!isAssignee(t,personFilter)))return false;
 if(roomFilter!=='all'&&t.room!==roomFilter)return false;
 if(priorityFilter!=='all'&&t.priority!==priorityFilter)return false;
 if(query&&!(t.title+' '+(t.notes||'')+' '+(t.room||'')).toLocaleLowerCase('pt-PT').includes(query.toLocaleLowerCase('pt-PT')))return false;
 return true;
}
// 3.8: a lista separa Pontuais e Rotinas (seletor no topo) e lembra-se dos grupos abertos.
const lsGet=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch{return d;}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}};
let listKind=lsGet('dc-list-kind','project')==='routine'?'routine':'project';
const groupOpen=Object.assign({late:true,today:true,week:true,later:false,none:false},lsGet('dc-task-groups',{}));
// Agrupa por quando. As rotinas só entram na lista quando se aproximam (até 7 dias); todas estão em «Rotinas».
function whenGroups(list){
 const t0=today(),week=CasaCore.addDays(t0,7);
 const g={late:[],today:[],week:[],later:[],none:[]};
 for(const t of list){
  if(!t.dueDate)(t.thisWeek?g.week:g.none).push(t);else if(t.dueDate<t0)g.late.push(t);else if(t.dueDate===t0)g.today.push(t);else if(t.dueDate<=week)g.week.push(t);else g.later.push(t);}
 const by=(a,b)=>CasaCore.urgency(b,t0)-CasaCore.urgency(a,t0)||(a.dueDate||'9').localeCompare(b.dueDate||'9')||a.title.localeCompare(b.title,'pt-PT');
 Object.values(g).forEach(a=>a.sort(by));return g;
}
function viewTabs(){return `<div class="view-tabs" role="tablist" aria-label="Vistas das tarefas">${TASK_VIEWS.filter(([id])=>id!=='routines'||taskView==='routines').map(([id,l])=>`<button type="button" role="tab" aria-selected="${taskView===id}" class="${taskView===id?'active':''}" data-action="task-view" data-view="${id}">${l}</button>`).join('')}</div>`;}
function tasksPage(){
 const sub={list:'O que há para fazer, por ordem de quando.',routines:'Os cuidados que se repetem, com frequência e rotação.',calendar:'Tarefas, rotinas, aniversários e feriados, mês a mês.',rooms:'Como está cada divisão, a partir das rotinas e das atrasadas.'}[taskView];
 const body=taskView==='routines'?routinesPage():taskView==='calendar'?calendarPage():taskView==='rooms'?roomsView():taskListView();
 return `${head('Tarefas',sub,taskView!=='rooms')}${viewTabs()}${body}`;
}
function taskListView(){
 const projects=tasks().filter(t=>t.kind==='project');const doneCount=projects.filter(t=>t.status==='done').length;
 const showDone=tab==='done';
 const base=showDone?projects.filter(t=>t.status==='done'):tasks().filter(t=>t.status!=='done');
 const pending=base.filter(taskMatches);const list=showDone?pending:pending.filter(t=>(t.kind==='routine')===(listKind==='routine'));
 const kindSeg=showDone?'':`<div class="seg-control kind-seg" role="radiogroup" aria-label="Tipo de tarefa"><button type="button" role="radio" aria-checked="${listKind==='project'}" data-action="list-kind" data-kind="project">Pontuais · ${pending.filter(t=>t.kind!=='routine').length}</button><button type="button" role="radio" aria-checked="${listKind==='routine'}" data-action="list-kind" data-kind="routine">Rotinas · ${pending.filter(t=>t.kind==='routine').length}</button></div>`;
 const advanced=personFilter!=='all'||roomFilter!=='all'||priorityFilter!=='all';
 const custom=quickFilter!=='mine'||advanced||!!query||showDone||timeMode;
 const chips=`<div class="filter-chips" role="group" aria-label="Filtros rápidos">${QUICK_FILTERS.map(([id,l])=>`<button type="button" class="chip ${!showDone&&quickFilter===id?'on':''}" data-action="quick-filter" data-value="${id}" aria-pressed="${!showDone&&quickFilter===id}">${l}</button>`).join('')}<button type="button" class="chip ${showDone?'on':''}" data-action="tab" data-tab="${showDone?'active':'done'}" aria-pressed="${showDone}">Concluídas · ${doneCount}</button></div>`;
 const filterBtn=`<button type="button" class="button filter-btn ${custom?'has-filter':''}" data-action="filter-toggle" aria-expanded="${taskFiltersOpen}" aria-controls="task-filter-panel">${ico('filter')} Filtros${custom?'<i class="filter-dot" aria-hidden="true"></i><span class="sr-only"> (ativos)</span>':''}</button>`;
 const doneBar=`<div class="done-bar"><strong>Concluídas · ${doneCount}</strong><button type="button" class="button small" data-action="tab" data-tab="active">Ver por fazer</button></div>`;
 const tools=`<div class="task-tools">${showDone?doneBar:kindSeg}${filterBtn}</div><div id="task-filter-panel" class="task-filter-panel ${taskFiltersOpen?'':'filters-collapsed'}"><label class="search">${ico('search')}<input name="search" type="search" placeholder="Pesquisar tarefa ou divisão…" value="${esc(query)}" aria-label="Pesquisar tarefas" /></label>${chips}${filtersHtml('project')}${custom?'<button class="button small" data-action="clear-filters">Limpar filtros</button>':''}</div>`;
 if(showDone){const sorted=list.slice().sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  return `${tools}<div class="panel task-group">${sorted.length?sorted.map(t=>taskRow(t,true)).join(''):`<p class="group-empty">Ainda não há tarefas concluídas${quickFilter!=='all'||advanced?' com estes filtros':''}.</p>`}</div>${isAdmin()&&doneCount?`<button type="button" class="button small" data-action="tasks-clear-done">${ico('trash')} Limpar concluídas</button>`:''}`;}
 const g=whenGroups(list);
 const GROUPS=[['late','Atrasadas','is-late'],['today','Hoje',''],['week','Esta semana',''],['later','Mais tarde',''],['none','Sem data','']];
 const shown=GROUPS.filter(([k])=>g[k].length);
 const grp=([k,l,cls])=>`<details class="task-when" data-group="${k}" ${groupOpen[k]||query?'open':''}><summary class="group-title ${cls}"><span class="car" aria-hidden="true"></span>${l} <span>${g[k].length}</span></summary><div class="panel task-group">${g[k].map(t=>taskRow(t,true)).join('')}</div></details>`;
 // 3.13: no computador largo, duas colunas — agora (atrasadas e hoje) à esquerda, depois (semana, mais tarde, sem data) à direita.
 const colA=shown.filter(([k])=>k==='late'||k==='today'),colB=shown.filter(([k])=>!(k==='late'||k==='today'));
 const cols=colA.length&&colB.length?`<div class="task-cols"><div class="task-col">${colA.map(grp).join('')}</div><div class="task-col">${colB.map(grp).join('')}</div></div>`:shown.map(grp).join('');
 return `${tools}${shown.length?cols:`<div class="panel">${empty('search',listKind==='routine'?'Não há rotinas aqui':'Não há tarefas aqui',quickFilter!=='all'||advanced||query?(quickFilter==='mine'?'Não tens nada atribuído. Vê «Todas» ou altera os filtros.':'Altera os filtros ou a pesquisa.'):'Está tudo feito. Acrescenta uma tarefa com o «+».')}</div>`}<p class="field-help list-foot">Toca no título de um grupo para o abrir ou fechar.</p>${listKind==='routine'?`<button type="button" class="button small" data-action="task-view" data-view="routines">${ico('repeat')} Gerir frequência e rotação</button>`:''}`;
}

/* ───────────── Divisões com estado ───────────── */
function roomsView(){
 const st=roomsStatus();const score=CasaCore.houseScore(st);const groups=roomsByFloor(Object.keys(st).filter(r=>config().rooms.includes(r)||st[r].open));
 const card=r=>{const s=st[r];const pct=s.score;return `<button type="button" class="room-status" data-action="open-room" data-room="${esc(r)}"><span class="room-art art-${esc(roomArt(r))}" aria-hidden="true"></span><span class="room-status-text"><strong>${esc(roomShort(r))}</strong><span class="meter ${s.level}" role="img" aria-label="${pct==null?'Sem rotinas':pct+'% em dia'}"><i style="width:${pct==null?0:pct}%"></i></span><small class="lvl-${s.level}">${esc(CasaCore.statusLabel(s))}</small></span><b class="room-pct">${pct==null?'—':pct+'%'}</b></button>`;};
 return `${score!=null?`<div class="house-summary"><span class="house-score-ring" style="--p:${score}"><b>${score}%</b></span><div><strong>Casa em ordem</strong><p>Média das divisões com rotinas. Cada rotina perde frescura à medida que se aproxima da data e mais ainda quando fica atrasada; tarefas atrasadas descontam.</p></div></div>`:`<div class="info-note">Ainda não há rotinas com data. Cria rotinas por divisão (por exemplo «Limpar a cozinha todas as semanas #Cozinha») para ver o estado de cada uma.</div>`}
 ${groups.map(gr=>`${gr.floor?`<h2 class="group-title">${esc(gr.floor)}</h2>`:''}<div class="room-status-grid">${gr.rooms.map(card).join('')}</div>`).join('')}
 <div class="legend-row"><span class="lvl-ok">● Em dia (80% ou mais)</span><span class="lvl-warn">● Precisa de atenção</span><span class="lvl-bad">● Atrasada</span></div>`;
}

/* ───────────── Criação rápida por escrita natural ───────────── */
const QT_PICKERS={date:'Quando',person:'Quem',room:'Onde',priority:'Prioridade',repeat:'Repetir',duration:'Duração'};
function qtParse(){const q=modal.qt;return CasaCore.parseTask(q.text,{today:today(),userId:store.user.id,people:people(),rooms:[...new Set([...config().rooms,...tasks().map(t=>t.room).filter(Boolean)])],ignore:q.ignore});}
function qtChips(r){
 const chip=(key,label,val)=>val?`<span class="qt-chip on">${label}<button type="button" data-action="qt-ignore" data-key="${key}" aria-label="Não usar: ${esc(label)}">×</button></span>`:`<button type="button" class="qt-chip add ${modal.qt.picker===key?'open':''}" data-action="qt-picker" data-key="${key}" aria-expanded="${modal.qt.picker===key}">+ ${QT_PICKERS[key]}</button>`;
 const out=[chip('date',r.dueDate?`${ico('calendar')}${r.dueDate===today()?'Hoje':r.dueDate===CasaCore.addDays(today(),1)?'Amanhã':esc(new Date(r.dueDate+'T12:00:00Z').toLocaleDateString('pt-PT',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}))}`:'',r.dueDate),
  chip('person',r.assignedTo?`${ico('user')}${esc(owner(r.assignedTo))}`:'',r.assignedTo),
  chip('room',r.room?`${ico('home')}${esc(r.room)}`:'',r.room),
  chip('priority',r.priority?`${ico('alert')}${esc(PRIORITIES[r.priority])}`:'',r.priority),
  chip('repeat',r.repeat?`${ico('repeat')}${esc(repeatLabels[r.repeat])}`:'',r.repeat),
  chip('duration',r.estimatedMinutes?`${ico('clock')}${fmtMin(r.estimatedMinutes)}`:'',r.estimatedMinutes)];
 const warn=(r.unknown||[]).map(u=>`<span class="qt-chip warn">${u.type==='person'?'Não conheço a pessoa':'Não conheço a divisão'} «${esc(u.value)}»</span>`).join('');
 return out.join('')+warn;
}
function qtPicker(){
 const k=modal.qt.picker;if(!k)return '';const opt=(text,ins)=>`<button type="button" class="chip" data-action="qt-insert" data-text="${esc(ins)}">${esc(text)}</button>`;
 let items='';
 if(k==='date')items=[['Hoje','hoje'],['Amanhã','amanhã'],['Sexta','sexta'],['Fim de semana','fim de semana'],['Próxima semana','próxima semana'],['Fim do mês','fim do mês']].map(([a,b])=>opt(a,b)).join('')+`<input type="date" class="qt-date" aria-label="Escolher a data" />`;
 if(k==='person')items=people().filter(p=>p.active!==false).map(p=>opt(p.name,'@'+(people().filter(x=>x.active!==false&&x.name.split(' ')[0]===p.name.split(' ')[0]).length>1?p.name.replace(/\s+/g,''):p.name.split(' ')[0]))).join('');
 if(k==='room')items=config().rooms.map(r=>opt(roomShort(r),'#'+r)).join('');
 if(k==='priority')items=[['Urgente','!urgente'],['Importante','!importante'],['Sem pressa','!baixa']].map(([a,b])=>opt(a,b)).join('');
 if(k==='repeat')items=[['Todos os dias','todos os dias'],['Todas as semanas','todas as semanas'],['De 15 em 15 dias','quinzenal'],['Todos os meses','todos os meses'],['Trimestral','trimestral'],['Anual','anual']].map(([a,b])=>opt(a,b)).join('');
 if(k==='duration')items=[['15 min','15 min'],['30 min','30 min'],['1 hora','1h'],['2 horas','2h']].map(([a,b])=>opt(a,b)).join('');
 return `<div class="qt-picker" role="group" aria-label="${QT_PICKERS[k]}">${items}</div>`;
}
function qtRefresh(){const r=qtParse();const box=document.getElementById('qt-chips');if(box)box.innerHTML=qtChips(r)+'';const pk=document.getElementById('qt-picker');if(pk)pk.innerHTML=qtPicker();const pv=document.getElementById('qt-title');if(pv)pv.textContent=r.title?`«${r.title}»`:'';const ov=document.querySelector('#qt-form')?.closest('.overlay');if(ov)ov.dataset.dirty=modal.qt.text.trim()?'1':'';}
function openQuickTask(kind='project',text=''){quickCreateOpen=false;modal={type:'quick-task',qt:{kind,text,ignore:[],picker:''}};renderModal();setTimeout(()=>{const i=document.getElementById('qt-text');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}},30);}
modalRenderers['quick-task']=holder=>{
 const q=modal.qt;const r=qtParse();const routine=q.kind==='routine'||!!r.repeat;
 const body=`<form id="qt-form" autocomplete="off"><label class="sr-only" for="qt-text">O que é preciso fazer?</label><textarea id="qt-text" class="qt-input" rows="2" maxlength="300" placeholder="${routine?'Ex.: Lixo e reciclagem todas as semanas @Rui #Cozinha':'Ex.: Trocar lâmpada amanhã @Ana #Hall !urgente'}">${esc(q.text)}</textarea>
 <p class="qt-title" id="qt-title" aria-live="polite">${r.title?`«${esc(r.title)}»`:''}</p>
 <div class="qt-chips" id="qt-chips" aria-live="polite">${qtChips(r)}</div><div id="qt-picker">${qtPicker()}</div>
 <p class="field-help">Escreve como dirias: «amanhã», «sexta», «dia 12», «@pessoa», «#divisão», «!urgente», «todas as semanas», «30 min». Toca numa etiqueta para a acrescentar ou no × para a tirar.</p>
 <div class="modal-actions"><button type="button" class="button" data-action="qt-details">Mais detalhes</button><span class="spacer"></span><button type="submit" class="button primary">${ico('check')} Criar</button></div></form>`;
 holder.innerHTML=modalShell({title:routine?'Nova rotina':'Nova tarefa',sub:'Uma linha chega. A app percebe a data, a pessoa e a divisão.',body,cls:'quick-task-modal'});
 const f=holder.querySelector('#qt-form');const input=f.querySelector('#qt-text');
 input.addEventListener('input',()=>{q.text=input.value;qtRefresh();});
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();f.requestSubmit();}});
 f.addEventListener('change',e=>{if(e.target.classList.contains('qt-date')&&e.target.value){const [y,m,d]=e.target.value.split('-');qtInsert(`${Number(d)}/${Number(m)}/${y}`);}});
 f.addEventListener('submit',async e=>{e.preventDefault();const r=qtParse();if(!r.title)return toast('Escreve o que é preciso fazer.');
  const kind=r.kind||q.kind;const body={title:r.title,kind,room:r.room||'Geral',priority:r.priority||'P3',dueDate:r.dueDate||'',assignedTo:r.assignedTo||null,repeat:r.repeat||(kind==='routine'?'weekly':'none'),estimatedMinutes:r.estimatedMinutes??null,status:'todo',suggested:false,thisWeek:false,subtasks:[]};
  const btn=f.querySelector('[type=submit]');btn.disabled=true;
  try{await api('/api/tasks','POST',body);modal=null;await reload();toast(kind==='routine'?'Rotina criada.':`Tarefa criada${r.dueDate?' para '+(r.dueDate===today()?'hoje':dateShortPT(r.dueDate)):''}.`);}catch(err){toast(err.message);btn.disabled=false;}});
};
function qtInsert(text){const q=modal.qt;q.text=(q.text.trim()+' '+text).trim()+' ';q.picker='';const i=document.getElementById('qt-text');if(i){i.value=q.text;i.focus();}qtRefresh();}

actionHandlers.push(async(name,el)=>{
 switch(name){
  case 'task-view':taskView=el.dataset.view;timeMode=false;render();return true;
  case 'list-kind':listKind=el.dataset.kind==='routine'?'routine':'project';lsSet('dc-list-kind',listKind);render();return true;
  case 'quick-filter':{const v=el.dataset.value;quickFilter=quickFilter===v&&v!=='all'&&tab!=='done'?'all':v;tab='active';timeMode=false;render();return true;}
  case 'qt-picker':modal.qt.picker=modal.qt.picker===el.dataset.key?'':el.dataset.key;qtRefresh();return true;
  case 'qt-insert':qtInsert(el.dataset.text);return true;
  case 'qt-ignore':modal.qt.ignore=[...new Set([...modal.qt.ignore,el.dataset.key])];qtRefresh();return true;
  case 'qt-details':{const r=qtParse();const kind=r.kind||modal.qt.kind;modal={type:'task',task:{kind,status:'todo',priority:r.priority||'P3',repeat:r.repeat||(kind==='routine'?'weekly':'none'),room:r.room||'Geral',title:r.title,dueDate:r.dueDate||'',assignedTo:r.assignedTo||null,estimatedMinutes:r.estimatedMinutes??null}};renderModal();const adv=document.getElementById('task-advanced');if(adv){adv.hidden=false;document.querySelector('[aria-controls=task-advanced]')?.setAttribute('aria-expanded','true');}return true;}
 }
 return false;
});

// Guarda que grupos da lista estão abertos.
document.addEventListener('toggle',e=>{const d=e.target;if(!d.classList?.contains('task-when'))return;groupOpen[d.dataset.group]=d.open;lsSet('dc-task-groups',groupOpen);},true);

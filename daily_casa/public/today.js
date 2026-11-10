/* Daily Casa — «Hoje», plano do dia e equilíbrio da casa (2.0)
 * «Hoje» responde a «o que faço agora?»: progresso do dia, a semana, atrasadas e para hoje, compras.
 * O plano do dia escolhe as tarefas que cabem no tempo disponível (CasaCore.planDay).
 */
'use strict';
let todayScope='me'; // 'me' = minhas e por atribuir · 'all' = toda a casa
const WEEK_LETTERS=['D','S','T','Q','Q','S','S'];
function relevantToMe(t){return todayScope==='all'||t.assignedTo===store.user.id||!t.assignedTo;}
function todayPage(){
 const t0=today();const u=store.user;const first=(u.name||'').split(' ')[0];
 const hour=new Date().getHours();const hello=hour<6?'Boa noite':hour<12?'Bom dia':hour<20?'Boa tarde':'Boa noite';
 const open=tasks().filter(t=>t.status!=='done'&&relevantToMe(t));
 const late=open.filter(t=>t.dueDate&&t.dueDate<t0).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
 const now=open.filter(t=>t.dueDate===t0).sort((a,b)=>CasaCore.urgency(b,t0)-CasaCore.urgency(a,t0));
 const doneToday=(store.history||[]).filter(h=>h.by===u.id&&new Date(h.at).toDateString()===new Date().toDateString()).length;
 const total=doneToday+late.length+now.length;const pct=total?Math.round(doneToday/total*100):100;
 const st=roomsStatus();const score=CasaCore.houseScore(st);
 const dateLabel=new Date().toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'});
 const mmdd=t0.slice(5);const bdays=people().filter(p=>p.active!==false&&((p.birthDate||'').slice(5)===mmdd||p.birthday===mmdd));
 const summary=[now.length?`${now.length} para hoje`:'',late.length?plural(late.length,'atrasada','atrasadas'):''].filter(Boolean).join(' · ')||(doneToday?'Tudo feito por hoje. Bom trabalho.':'Nada marcado para hoje.');
 // A semana (segunda a domingo) com um ponto nos dias com tarefas.
 const {start}=CasaCore.weekRange(t0);const week=Array.from({length:7},(_,i)=>CasaCore.addDays(start,i));
 const dueOn=d=>tasks().filter(t=>t.status!=='done'&&t.dueDate===d&&relevantToMe(t)).length;
 const shop=shopping().filter(x=>!x.purchased);
 const seasonalList=(canManage()&&typeof seasonal==='function')?seasonal().filter(x=>x.active!==false&&x.months.includes(new Date().getMonth()+1)&&!seasonalTaskFor(x,new Date().getMonth()+1)):[];const seasonalPending=seasonalList.length,seasonalFirst=seasonalList[0];
 const list=(arr,max=6)=>arr.slice(0,max).map(t=>taskRow(t)).join('')+(arr.length>max?`<button type="button" class="more-link" data-action="nav" data-page="tasks">Ver mais ${arr.length-max} em Tarefas ${ico('chevron')}</button>`:'');
 return `<section class="today-hero">
  <div class="today-hero-text"><span class="eyebrow">${esc(dateLabel.toUpperCase())}</span><h1>${hello}, ${esc(first)}.</h1><p>${esc(summary)}</p>
   <div class="today-pills">${score!=null?`<button type="button" class="hero-pill" data-action="nav" data-page="tasks" data-view="rooms">${ico('home')} Casa em ordem ${score}%</button>`:''}${bdays.map(p=>`<span class="hero-pill">${ico('cake')} ${p.id===u.id?'Parabéns!':'Aniversário de '+esc(p.name.split(' ')[0])}</span>`).join('')}</div></div>
  <div class="today-ring" style="--p:${pct}" role="img" aria-label="${doneToday} de ${total} tarefas de hoje concluídas"><b>${doneToday}/${total}</b><small>hoje</small></div>
 </section>
 ${typeof weatherCard==='function'?weatherCard():''}
 <div class="week-strip" role="group" aria-label="Esta semana">${week.map(d=>{const n=dueOn(d);const wd=new Date(d+'T12:00:00Z').getUTCDay();return `<button type="button" class="week-day ${d===t0?'is-today':''} ${d<t0?'is-past':''}" data-action="today-day" data-date="${d}" aria-label="${esc(new Date(d+'T12:00:00Z').toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',timeZone:'UTC'}))}${n?', '+plural(n,'tarefa','tarefas'):''}"><span>${WEEK_LETTERS[wd]}</span><b>${Number(d.slice(8))}</b>${n?'<i aria-hidden="true"></i>':'<i class="nodot" aria-hidden="true"></i>'}</button>`;}).join('')}</div>
 <div class="today-tools"><div class="seg-control seg-small" role="radiogroup" aria-label="Mostrar"><button type="button" role="radio" aria-checked="${todayScope==='me'}" data-action="today-scope" data-scope="me">Para mim</button><button type="button" role="radio" aria-checked="${todayScope==='all'}" data-action="today-scope" data-scope="all">Toda a casa</button></div>
  <div class="time-chips"><span>Tenho</span>${[15,30,60].map(m=>`<button type="button" class="chip" data-action="plan-open" data-min="${m}">${m===60?'1 hora':m+' min'}</button>`).join('')}</div></div>
 ${approvalsCard()}
 ${late.length?`<h2 class="group-title is-late">Atrasadas <span>${late.length}</span></h2><div class="panel task-group">${list(late,5)}</div>`:''}
 <h2 class="group-title">Hoje <span>${now.length}</span></h2><div class="panel task-group">${now.length?list(now,8):`<p class="group-empty">${late.length?'Nada novo para hoje. Começa pelas atrasadas.':'Nada marcado para hoje. Se tiveres tempo, usa «Tenho 15 min» para escolher algo.'}</p>`}</div>
 <div class="today-cards">
  <button type="button" class="today-card" data-action="nav" data-page="shopping"><span class="today-card-head">${ico('cart')}<strong>Compras</strong><span class="count-pill">${shop.length} por comprar</span></span><small>${shop.length?esc(shop.slice(0,5).map(x=>x.title+(x.quantity&&x.quantity!=='1'||x.unit?' '+CasaUnits.format(x.quantity,x.unit):'')).join(' · ')):'A lista está vazia.'}</small></button>
  ${canManage()&&(store.incidents||[]).some(x=>x.status!=='resolved')?(()=>{const o=store.incidents.filter(x=>x.status!=='resolved');return `<button type="button" class="today-card" data-action="nav" data-page="incidents"><span class="today-card-head">${ico('alert')}<strong>Ocorrências</strong><span class="count-pill">${o.length}</span></span><small>${esc(o.slice(0,3).map(x=>x.title).join(' · '))}</small></button>`;})():''}
 </div>
 ${seasonalFirst?`<section class="season-today"><h2 class="group-title">Este mês na casa <span>${seasonalPending}</span></h2>${seasonalCard(seasonalFirst,new Date().getMonth()+1,true)}${seasonalPending>1?`<button type="button" class="more-link" data-action="nav" data-page="tasks" data-view="calendar">Ver as ${seasonalPending} sugestões do mês ${ico('chevron')}</button>`:''}</section>`:''}`;
}

/* ───────────── Plano do dia ───────────── */
modalRenderers.plan=holder=>{
 const m=modal.minutes;const plan=CasaCore.planDay(tasks(),{userId:store.user.id,minutes:m,today:today()});
 const opts=[15,30,60,120].map(x=>`<button type="button" role="radio" aria-checked="${x===m}" data-action="plan-open" data-min="${x}">${x>=60?(x/60)+' h':x+' min'}</button>`).join('');
 const body=`<div class="seg-control" role="radiogroup" aria-label="Tempo disponível">${opts}</div>
 ${plan.tasks.length?`<div class="plan-list">${plan.tasks.map(t=>`<div class="plan-item"><button class="task-check" data-action="complete" data-id="${esc(t.id)}" aria-label="Concluir ${esc(t.title)}" ${canCompleteVisible(t)?'':'disabled'}></button><button type="button" class="plan-detail" data-action="edit" data-id="${esc(t.id)}"><b>${esc(t.title)}</b><small>${esc([t.room,t.dueDate?(t.dueDate<today()?'atrasada':t.dueDate===today()?'hoje':dateShortPT(t.dueDate)):'',t.assignedTo?'':'por atribuir'].filter(Boolean).join(' · '))}</small></button><span class="plan-min">${fmtMin(plan.estimate(t))}</span></div>`).join('')}</div><p class="plan-total">${plural(plan.tasks.length,'tarefa','tarefas')} · ${fmtMin(plan.minutes)} de ${fmtMin(m)}${plan.left>=5?` · sobram ${fmtMin(plan.left)}`:''}</p>`:`<p class="group-empty">Não há tarefas tuas ou por atribuir que caibam em ${fmtMin(m)}. Experimenta mais tempo.</p>`}
 <p class="field-help">Escolhidas por urgência (atrasadas, para hoje, prioridade) entre as tuas e as que estão por atribuir. Sem tempo estimado, conta 15 min.</p>`;
 holder.innerHTML=modalShell({title:`Plano para ${fmtMin(m)}`,sub:'O mais urgente que cabe no tempo que tens.',body,cls:'plan-modal'});
};

/* ───────────── Equilíbrio da casa ───────────── */
function balancePage(){
 const b=CasaCore.balance(tasks(),store.history,people(),{today:today()});const max=Math.max(60,...b.rows.map(r=>r.total));
 const sug=b.suggestion&&canManage()?b.suggestion:null;
 const range=`${dateShortPT(b.start)} a ${dateShortPT(b.end)}`;
 return `${head('Equilíbrio da casa',`Semana de ${esc(range)}: tempo estimado das tarefas de cada pessoa.`,false)}
 <div class="panel balance-panel"><div class="balance-legend"><span><i class="done"></i>Feito</span><span><i class="planned"></i>Por fazer esta semana</span></div>
 ${b.rows.length?b.rows.map(r=>`<div class="balance-row"><span class="balance-name">${avatarHtml(who(r.id)||{name:r.name},'mini')}${esc(shortName(who(r.id)||{name:r.name}))}</span><span class="balance-bar" role="img" aria-label="${esc(r.name)}: ${fmtMin(r.done)} feito, ${fmtMin(r.planned)} por fazer"><i class="done" style="width:${r.done/max*100}%"></i><i class="planned" style="width:${r.planned/max*100}%"></i></span><span class="balance-total"><b>${fmtMin(r.total)}</b><small>${r.doneCount} feitas · ${r.plannedCount} por fazer</small></span></div>`).join(''):'<p class="group-empty">Ainda não há pessoas com tarefas esta semana.</p>'}</div>
 ${sug?`<div class="suggest-card">${ico('scale')}<div><strong>Sugestão</strong><p>${esc(firstNameOf(sug.to))} tem menos trabalho esta semana. Passar «${esc(sug.title)}» (${fmtMin(sug.minutes)}) de ${esc(firstNameOf(sug.from))} para ${esc(firstNameOf(sug.to))}?</p></div><button type="button" class="button primary" data-action="balance-apply" data-id="${esc(sug.taskId)}" data-to="${esc(sug.to)}">Atribuir a ${esc(firstNameOf(sug.to))}</button></div>`:''}
 <div class="info-note">Conta o tempo estimado de cada tarefa concluída esta semana e das que estão atribuídas com data até domingo (15 min quando não há estimativa). Não há pontos nem classificação: serve para repartir melhor. Os colaboradores não entram aqui; o tempo deles está no Registo de horas.</div>`;
}

actionHandlers.push(async(name,el)=>{
 switch(name){
  case 'today-scope':todayScope=el.dataset.scope;render();return true;
  case 'today-day':{calSel=el.dataset.date;calView={y:Number(calSel.slice(0,4)),m:Number(calSel.slice(5,7))};go('tasks',{view:'calendar'});return true;}
  case 'plan-open':modal={type:'plan',minutes:Number(el.dataset.min)||30};quickCreateOpen=false;renderModal();return true;
  case 'balance-apply':{await api('/api/tasks/'+el.dataset.id,'PATCH',{assignedTo:el.dataset.to});await reload();toast(`Tarefa atribuída a ${firstNameOf(el.dataset.to)}.`);return true;}
 }
 return false;
});

/* ───────────── Demonstração: datas relativas a hoje ───────────── */
const initDemoBeforeToday=initDemo;
initDemo=function(){initDemoBeforeToday();if(store.demoDated)return;const t=today(),d=n=>n==null?'':CasaCore.addDays(t,n);
 const plan={'Rever iluminação do alpendre':[-2,'demo-1',30],'Instalar suportes no WC':[0,'demo-2',45],'Organizar o armário da cozinha':[0,'demo-1',40],'Arrumar o roupeiro':[3,'demo-3',60],'Afinar o duche':[5,null,20],'Podar a sebe':[12,'demo-2',90],'Limpar a lareira':[null,'demo-1',45],'Limpar bancadas':[0,'demo-1',15],'Limpar o corredor':[-3,'demo-3',20],'Regar os vasos do terraço':[2,'demo-2',15],'Pôr o lixo e a reciclagem':[1,undefined,10]};
 for(const x of store.tasks){const p=plan[x.title];if(!p)continue;x.dueDate=d(p[0]);if(p[1]!==undefined)x.assignedTo=p[1];x.estimatedMinutes=p[2];}
 const ago=h=>new Date(Date.now()-h*3600e3).toISOString();
 store.history=[...(store.history||[]),{id:'hd1',taskId:'example-6',title:'Regar os vasos do terraço',by:'demo-2',at:ago(26)},{id:'hd2',taskId:'example-4',title:'Limpar bancadas',by:'demo-1',at:ago(20)},{id:'hd3',taskId:'example-5',title:'Limpar o corredor',by:'demo-3',at:ago(50)}].filter(h=>h.at>=new Date(CasaCore.weekRange(t).start+'T00:00:00').toISOString());
 store.demoDated=true;persistDemo();};

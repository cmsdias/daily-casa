/* Daily Casa — lógica partilhada pela app e pelo servidor (sem dependências).
 * - parseTask: lê uma frase em português («Trocar lâmpada amanhã @Ana #Hall !urgente») e devolve os campos da tarefa.
 * - roomStatus: estado «em dia» de cada divisão, calculado a partir das rotinas e das tarefas atrasadas.
 * - planDay: escolhe as tarefas que cabem no tempo disponível, das mais urgentes para as menos.
 * - balance: esforço da semana por pessoa (minutos estimados), com uma sugestão de reatribuição.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CasaCore=api;})(typeof self!=='undefined'?self:this,function(){
'use strict';
const DAY=864e5;
const toDate=iso=>new Date(iso+'T12:00:00Z');
const iso=d=>d.toISOString().slice(0,10);
const addDays=(s,n)=>iso(new Date(toDate(s).getTime()+n*DAY));
const daysBetween=(a,b)=>Math.round((toDate(b)-toDate(a))/DAY);
const dow=s=>toDate(s).getUTCDay(); // 0 = domingo
const lastDayOfMonth=s=>{const d=toDate(s);return iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0,12)));};
// Minúsculas sem acentos, mantendo o comprimento (para cortar o texto original nas mesmas posições).
function fold(s){return [...s].map(c=>{const b=c.normalize('NFD').replace(/[̀-ͯ]/g,'');return (b.length===1?b:c).toLowerCase();}).join('');}
const capFirst=s=>s?s[0].toLocaleUpperCase('pt-PT')+s.slice(1):s;
const WEEKDAYS={domingo:0,segunda:1,terca:2,quarta:3,quinta:4,sexta:5,sabado:6};
const MONTHS={janeiro:1,jan:1,fevereiro:2,fev:2,marco:3,mar:3,abril:4,abr:4,maio:5,mai:5,junho:6,jun:6,julho:7,jul:7,agosto:8,ago:8,setembro:9,set:9,outubro:10,out:10,novembro:11,nov:11,dezembro:12,dez:12};
const REPEAT_DAYS={daily:1,weekly:7,biweekly:14,monthly:30,quarterly:91,yearly:365};
const PRIORITY_WORDS={urgente:'P1',importante:'P2',normal:'P3',baixa:'P4','sem-pressa':'P4',1:'P1',2:'P2',3:'P3',4:'P4'};
const LEAD='(?:(?:ate|para|no|na|em|a|ja|e)\\s+)*';
function nextWeekday(today,wd,allowToday=false){let n=(wd-dow(today)+7)%7;if(n===0&&!allowToday)n=7;return addDays(today,n);}
function dateFromDM(today,d,m,y){const ty=Number(today.slice(0,4));let year=y?(y<100?2000+y:y):ty;const make=yy=>{const s=`${yy}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;return iso(toDate(s))===s?s:null;};let s=make(year);if(!s)return null;if(!y&&s<today)s=make(year+1);return s;}

/* ───────────── Escrita natural ───────────── */
function parseTask(text,ctx={}){
 const today=ctx.today||iso(new Date());const skip=new Set(ctx.ignore||[]);const on=k=>!skip.has(k);
 let orig=String(text||'').normalize('NFC');let low=fold(orig);
 const out={};const chips=[];const unknown=[];
 // Retira o trecho [i,j) das duas versões (mantém posições alinhadas).
 const cut=(i,j)=>{orig=orig.slice(0,i)+' '.repeat(j-i)+orig.slice(j);low=low.slice(0,i)+' '.repeat(j-i)+low.slice(j);};
 const take=(re,fn)=>{const r=new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g');let m,hit=false;while((m=r.exec(low))){const res=fn(m,orig.slice(m.index,m.index+m[0].length));if(res!==false){cut(m.index,m.index+m[0].length);hit=true;if(res==='once')break;}}return hit;};
 // Repetição (antes das datas: «todas as sextas» também define a próxima data).
 const REP=[[/\b(?:todos\s+os\s+dias|diariamente|cada\s+dia)\b/,'daily'],[/\b(?:de\s+15\s+em\s+15\s+dias|quinzenal(?:mente)?|de\s+duas\s+em\s+duas\s+semanas)\b/,'biweekly'],[/\b(?:todas\s+as\s+semanas|semanal(?:mente)?|cada\s+semana|uma\s+vez\s+por\s+semana)\b/,'weekly'],[/\b(?:todos\s+os\s+meses|mensal(?:mente)?|cada\s+mes|uma\s+vez\s+por\s+mes)\b/,'monthly'],[/\b(?:trimestral(?:mente)?|de\s+3\s+em\s+3\s+meses|de\s+tres\s+em\s+tres\s+meses)\b/,'quarterly'],[/\b(?:anual(?:mente)?|todos\s+os\s+anos|uma\s+vez\s+por\s+ano)\b/,'yearly']];
if(on('repeat')){ for(const [re,rep] of REP){if(!out.repeat&&take(re,()=> 'once'))out.repeat=rep;}
 if(!out.repeat)take(/\b(?:tod[ao]s\s+(?:as|os)\s+|as\s+)(segunda|terca|quarta|quinta|sexta|sabado|domingo)s(?:[\s-]feiras)?\b/,m=>{out.repeat='weekly';out.dueDate=nextWeekday(today,WEEKDAYS[m[1]],true);return 'once';});}
 // Datas
 const setDate=(d)=>{if(!d||out.dueDate)return false;out.dueDate=d;return 'once';};
 const R=s=>new RegExp('\\b'+LEAD+s+'\\b');
 if(on('date')){
 take(R('depois\\s+de\\s+amanha'),()=>setDate(addDays(today,2)));
 take(R('amanha'),()=>setDate(addDays(today,1)));
 take(R('hoje'),()=>setDate(today));
 take(R('(?:este\\s+|o\\s+)?fim\\s+de\\s+semana'),()=>{const w=dow(today);return setDate(w===6||w===0?today:nextWeekday(today,6));});
 take(R('(?:a\\s+)?proxima\\s+semana|\\bpara\\s+a\\s+semana'),()=>setDate(nextWeekday(today,1)));
 take(R('(?:o\\s+)?fim\\s+do\\s+mes'),()=>setDate(lastDayOfMonth(today)));
 take(R('(?:daqui\\s+a|dentro\\s+de)\\s+(\\d{1,3})\\s+(dias?|semanas?|mes(?:es)?)'),m=>{const n=Number(m[1]);const u=m[2];if(u.startsWith('dia'))return setDate(addDays(today,n));if(u.startsWith('semana'))return setDate(addDays(today,7*n));const d=toDate(today);d.setUTCMonth(d.getUTCMonth()+n);return setDate(iso(d));});
 take(R('(?:(?:a|o|esta|este|proxima|proximo)\\s+)?(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:[\\s-]feira)?'),m=>setDate(nextWeekday(today,WEEKDAYS[m[1]])));
 take(R('(?:(?:o|ao)\\s+)?(?:dia\\s+)?(\\d{1,2})[/.-](\\d{1,2})(?:[/.-](\\d{2,4}))?'),m=>setDate(dateFromDM(today,Number(m[1]),Number(m[2]),m[3]?Number(m[3]):0)));
 take(R('(?:(?:o|ao)\\s+)?(?:dia\\s+)?(\\d{1,2})\\s+(?:de\\s+)?(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(?:\\s+(?:de\\s+)?(\\d{4}))?'),m=>setDate(dateFromDM(today,Number(m[1]),MONTHS[m[2]],m[3]?Number(m[3]):0)));
 take(R('(?:o\\s+|ao\\s+)?dia\\s+(\\d{1,2})(?!\\s*[/.-]\\d)'),m=>{const d=Number(m[1]);if(d<1||d>31)return false;const y=Number(today.slice(0,4)),mo=Number(today.slice(5,7));let s=dateFromDM(today,d,mo,y);if(!s||s<today){const nm=mo===12?1:mo+1,ny=mo===12?y+1:y;s=dateFromDM(today,d,nm,ny);}return setDate(s);});
 }
 // Duração
 if(on('duration'))
 take(/(?:\(|\b(?:durante|demora|leva)\s+)?\b(\d{1,2})\s*h\s*(\d{2})\b\)?/,m=>{out.estimatedMinutes=Number(m[1])*60+Number(m[2]);return 'once';})||
 take(/(?:\(|\b(?:durante|demora|leva)\s+)?\bmeia\s+hora\b\)?/,()=>{out.estimatedMinutes=30;return 'once';})||
 take(/(?:\(|\b(?:durante|demora|leva)\s+)?\b(\d{1,2}(?:[.,]5)?)\s*(?:h|horas?)\b\)?/,m=>{out.estimatedMinutes=Math.round(Number(m[1].replace(',','.'))*60);return 'once';})||
 take(/(?:\(|\b(?:durante|demora|leva)\s+)?\b(\d{1,4})\s*(?:min|minutos?)\b\)?/,m=>{out.estimatedMinutes=Number(m[1]);return 'once';});
 // Prioridade
 if(on('priority'))
 take(/(?:^|\s)!(urgente|importante|normal|baixa|sem-pressa|[1-4])\b/,m=>{out.priority=PRIORITY_WORDS[m[1]];return 'once';})||
 take(/(?:^|\s)(!{1,3})(?=\s|$)/,m=>{out.priority=m[1].length>=2?'P1':'P2';return 'once';})||
 take(/\b(?:e\s+)?(urgente|com\s+urgencia)\b/,()=>{out.priority='P1';return 'once';});
 // Pessoa: @nome (primeiro nome, nome completo sem espaços ou utilizador)
 if(on('person'))take(/@([\p{L}\d._-]+)/u,(m,raw)=>{const key=m[1].replace(/[._-]+$/,'');const people=(ctx.people||[]).filter(p=>p.active!==false);const f=s=>fold(String(s||'')).replace(/\s+/g,'');
  let p=people.find(x=>f(x.username)===key)||people.find(x=>f(x.name)===key)||people.find(x=>f(String(x.name).split(' ')[0])===key)||people.find(x=>f(x.name).startsWith(key));
  if(!p){unknown.push({type:'person',value:raw.slice(1)});return 'once';}out.assignedTo=p.id;return 'once';});
 if(/\b(?:para\s+mim|eu\s+faco)\b/.test(low)&&ctx.userId&&!out.assignedTo)take(/\b(?:para\s+mim|eu\s+faco)\b/,()=>{out.assignedTo=ctx.userId;return 'once';});
 // Divisão: #nome (o nome mais comprido que coincide; «#wc-completo» = «WC Completo»; «#hall» = primeira divisão começada por «hall»)
 if(on('room')){const i=low.indexOf('#');if(i>=0){const rest=low.slice(i+1).replace(/-/g,' ');const rooms=(ctx.rooms||[]).slice().sort((a,b)=>b.length-a.length);let room=null,len=0;
  for(const r of rooms){const fr=fold(r);if(rest.startsWith(fr)&&(rest.length===fr.length||/[\s,.;!)]/.test(rest[fr.length]))){room=r;len=fr.length;break;}}
  if(!room){const word=(/^[\p{L}\d]+/u.exec(rest)||[''])[0];if(word){const ordered=ctx.rooms||[];room=ordered.find(r=>fold(r).startsWith(word))||ordered.find(r=>fold(r).split(/\s+/).some(w=>w.startsWith(word)))||null;len=word.length;if(!room)unknown.push({type:'room',value:orig.slice(i+1,i+1+len)});}}
  if(room)out.room=room;cut(i,i+1+len);}}
 if(out.repeat)out.kind='routine';
 // Título: o que sobra, sem preposições soltas no fim.
 let title=orig.replace(/\s+/g,' ').trim().replace(/(?:\s+(?:ate|até|para|no|na|em|a|e|de|do|da|com|,|-))+$/i,'').replace(/^[,\-\s]+|[,\-\s]+$/g,'');
 out.title=capFirst(title);
 return {...out,unknown};
}

/* ───────────── Estado das divisões ───────────── */
function routineScore(t,today){
 if(!t.dueDate)return 1;
 const interval=REPEAT_DAYS[t.repeat]||7;const d=daysBetween(today,t.dueDate);
 if(d>=1)return 0.85+0.15*Math.min(1,d/interval);
 if(d===0)return 0.7;
 return Math.max(0,0.6-0.6*(-d)/interval);
}
function roomStatus(tasks,today,rooms){
 const by={};const get=r=>(by[r]??={room:r,routines:[],late:0,dueToday:0,open:0,penalty:0});
 for(const t of tasks||[]){if(t.status==='done')continue;const r=t.room||'Geral';const e=get(r);e.open++;
  if(t.dueDate&&t.dueDate<today)e.late++;else if(t.dueDate===today)e.dueToday++;
  if(t.kind==='routine'&&t.repeat&&t.repeat!=='none')e.routines.push(routineScore(t,today));
  else if(t.dueDate&&t.dueDate<today)e.penalty+=t.priority==='P1'?0.2:0.12;}
 const out={};
 for(const r of new Set([...(rooms||[]),...Object.keys(by)])){const e=by[r]||{room:r,routines:[],late:0,dueToday:0,open:0,penalty:0};
  let score=null;if(e.routines.length||e.penalty)score=Math.round(Math.max(0,Math.min(1,(e.routines.length?e.routines.reduce((a,b)=>a+b,0)/e.routines.length:1)-e.penalty))*100);
  const level=score==null?'none':score>=80?'ok':score>=50?'warn':'bad';
  out[r]={room:r,score,level,late:e.late,dueToday:e.dueToday,open:e.open,routines:e.routines.length};}
 return out;
}
function houseScore(status){const s=Object.values(status).filter(x=>x.score!=null);return s.length?Math.round(s.reduce((a,b)=>a+b.score,0)/s.length):null;}
function statusLabel(s){if(!s||s.score==null)return s&&s.open?`${s.open} ${s.open===1?'tarefa':'tarefas'}`:'Sem rotinas';if(s.late)return `${s.late} ${s.late===1?'atrasada':'atrasadas'}`;if(s.dueToday)return `${s.dueToday} para hoje`;return s.level==='ok'?'Em dia':'Precisa de atenção';}

/* ───────────── Plano do dia ───────────── */
function urgency(t,today){let u=0;if(t.dueDate){const d=daysBetween(today,t.dueDate);if(d<0)u+=20+Math.min(30,-d*2);else if(d===0)u+=16;else if(d<=2)u+=8;else if(d<=7)u+=4;}
 u+=({P1:12,P2:6,P3:2,P4:0}[t.priority]||2);if(t.thisWeek)u+=3;if(t.status==='doing')u+=4;return u;}
function planDay(tasks,{userId,minutes,today}){
 const horizon=addDays(today,7);
 const cand=(tasks||[]).filter(t=>t.status!=='done'&&t.status!=='waiting'&&(t.assignedTo===userId||(t.coAssignees||[]).includes(userId)||!t.assignedTo)&&(t.kind!=='routine'||(t.dueDate&&t.dueDate<=horizon))&&(!t.dueDate||t.dueDate<=horizon||t.thisWeek));
 const est=t=>Number.isFinite(t.estimatedMinutes)&&t.estimatedMinutes>0?t.estimatedMinutes:15;
 const sorted=cand.map(t=>({t,u:urgency(t,today)+(t.assignedTo===userId?3:0),m:est(t)})).sort((a,b)=>b.u-a.u||a.m-b.m);
 const pick=[];let used=0;for(const x of sorted){if(used+x.m<=minutes){pick.push(x.t);used+=x.m;}if(used>=minutes)break;}
 return {tasks:pick,minutes:used,left:Math.max(0,minutes-used),estimate:est};
}

/* ───────────── Equilíbrio da casa ───────────── */
function weekRange(today){const w=(dow(today)+6)%7;const start=addDays(today,-w);return {start,end:addDays(start,6)};}
function balance(tasks,history,people,{today,minutesDefault=15}={}){
 const {start,end}=weekRange(today);const byId=new Map((tasks||[]).map(t=>[t.id,t]));const est=t=>t&&Number.isFinite(t.estimatedMinutes)&&t.estimatedMinutes>0?t.estimatedMinutes:minutesDefault;
 const rows=(people||[]).filter(p=>p.active!==false&&p.role!=='collaborator').map(p=>({id:p.id,name:p.name,done:0,planned:0,doneCount:0,plannedCount:0}));
 const row=id=>rows.find(r=>r.id===id);
 for(const h of history||[]){const day=String(h.at||'').slice(0,10);if(day<start||day>end)continue;const r=row(h.by);if(!r)continue;r.done+=est(byId.get(h.taskId));r.doneCount++;}
 for(const t of tasks||[]){if(t.status==='done'||!t.assignedTo)continue;const r=row(t.assignedTo);if(!r)continue;if(!(t.dueDate?t.dueDate<=end:t.thisWeek))continue;r.planned+=est(t);r.plannedCount++;}
 rows.forEach(r=>r.total=r.done+r.planned);rows.sort((a,b)=>b.total-a.total);
 let suggestion=null;
 if(rows.length>1){const hi=rows[0],lo=rows[rows.length-1];const gap=hi.total-lo.total;
  if(gap>=60){const movable=(tasks||[]).filter(t=>t.status==='todo'&&t.assignedTo===hi.id&&!(t.coAssignees||[]).length&&t.visibility!=='private'&&!(Array.isArray(t.rotation)&&t.rotation.length>1)&&(t.dueDate?t.dueDate>=today&&t.dueDate<=end:t.thisWeek));
   const best=movable.map(t=>({t,d:Math.abs(est(t)-gap/2)})).sort((a,b)=>a.d-b.d)[0];
   if(best&&est(best.t)<gap)suggestion={taskId:best.t.id,title:best.t.title,from:hi.id,to:lo.id,minutes:est(best.t)};}}
 return {start,end,rows,suggestion};
}

return {fold,addDays,daysBetween,weekRange,lastDayOfMonth,parseTask,REPEAT_DAYS,routineScore,roomStatus,houseScore,statusLabel,urgency,planDay,balance};
});

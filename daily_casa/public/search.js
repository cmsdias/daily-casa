'use strict';
/* 3.18 — Pesquisa geral: uma lupa no topo procura na app toda (tarefas, compras, ocorrências, equipamentos,
 * pessoas, registos de horas, finanças e subscrições para quem as vê, páginas e ações).
 * Procura só no que já está nesta sessão, por isso mostra apenas o que a pessoa pode ver.
 * Ignora acentos e maiúsculas. Abre com a lupa, com «/» ou com Ctrl/⌘+K. */
let searchOpen=false,searchQ='',searchArea='all',searchSel=0,searchReturn=null;
const SEARCH_AREAS=[['all','Tudo'],['tasks','Tarefas'],['shopping','Compras'],['incidents','Ocorrências'],['equipment','Equipamentos'],['finance','Finanças'],['people','Pessoas'],['worklogs','Registo de horas'],['pages','Páginas e ações']];
const sNorm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
function searchButton(){return `<button type="button" class="icon-btn search-btn" data-action="search-open" aria-label="Pesquisar na app" aria-keyshortcuts="/ Control+K">${ico('search')}</button>`;}
const sAct=(action,data={})=>()=>{const b=document.createElement('button');b.type='button';b.dataset.action=action;for(const [k,v] of Object.entries(data))b.dataset[k]=v;b.hidden=true;document.body.appendChild(b);b.click();b.remove();};
const sGo=(p,extra)=>()=>{page=p;modal=null;if(extra)extra();render();window.scrollTo(0,0);};
function searchIndex(){const out=[];const add=(area,icon,title,sub,run,extra='',badge='')=>out.push({area,icon,title:String(title||''),sub:String(sub||''),run,hay:sNorm(`${title} ${sub} ${extra}`),t:sNorm(title),badge});
 const pName=id=>{const p=people().find(x=>x.id===id);return p?shortName(p):'';};
 for(const t of tasks()){const done=t.status==='done';const when=t.dueDate?shortDate(t.dueDate):'';
  add('tasks',t.kind==='routine'?'repeat':'check-square',t.title,[t.kind==='routine'?'Rotina':'',t.room&&t.room!=='Geral'?roomShort(t.room):'',done?'concluída':when,pName(t.assignedTo)].filter(Boolean).join(' · '),()=>{closeSearch();openTask(t.id);},`${t.notes||''} ${t.room||''} ${(t.subtasks||[]).map(x=>x.title||x.text||x).join(' ')}`,t.priority==='P1'&&!done?'Urgente':'');}
 for(const s of shopping())add('shopping','cart',s.name,[s.quantity||s.qty||'',s.purchased?'comprado':'por comprar',s.category||''].filter(Boolean).join(' · '),()=>{closeSearch();page='shopping';render();if(typeof editShopItem==='function')editShopItem(s.id);},s.note||'');
 if(typeof incidents==='function')for(const x of incidents())add('incidents','alert',x.title,[roomShort(x.room||'Geral'),x.status==='resolved'?'resolvida':x.status==='progress'?'em resolução':'por resolver'].join(' · '),()=>{closeSearch();page='incidents';render();openIncidentView(x.id);},x.description||'',x.status!=='resolved'&&x.severity==='alta'?'Urgente':'');
 if(typeof equipment==='function')for(const x of equipment())add('equipment','tool',x.name,[x.brand,x.model,x.room?roomShort(x.room):''].filter(Boolean).join(' · '),()=>{closeSearch();page='equipment';render();openEquipmentView(x.id);},`${x.notes||''} ${x.serial||''} ${x.supplier||''}`);
 for(const p of people().filter(x=>x.active!==false))add('people','users',p.name,ROLE_LABELS[p.role]||'',sGo('people'),p.email||'');
 for(const l of (typeof wlMerge==='function'?wlMerge(workLogs()):workLogs().map(x=>({...x,members:[x]})))){const names=l.members.map(m=>pName(m.userId)).filter(Boolean).join(', ');
  add('worklogs','clock',l.note||'Trabalho',[names,l.date?shortDate(l.date):'',typeof fmtDur==='function'?fmtDur(l.minutes):l.minutes+' min'].filter(Boolean).join(' · '),()=>{closeSearch();page='worklogs';render();modal={type:'worklog-edit',id:l.id};renderModal();});}
 if(typeof canFinance==='function'&&canFinance()&&financeData){const f=financeData;
  for(const r of f.recurring)add('finance',r.sub?'wallet':'repeat',r.name,[r.sub?'Subscrição':'Despesa fixa',eurFull(r.amountCents),r.active===false?(r.sub?'cancelada':'em pausa'):''].filter(Boolean).join(' · '),()=>{closeSearch();finTab=r.sub?'subs':'fixas';page='finance';render();if(r.sub)openSubView(r.id);else openRecurring(r.id);},`${r.category||''} ${r.sub?.plan||''} ${r.sub?.group||''} ${r.sub?.payMethod||''}`);
  for(const x of f.expenses.filter(e=>!e.recurringId).slice(-300))add('finance','wallet',x.description||x.category,[x.category,eurFull(x.amountCents),x.transactionDate?shortDate(x.transactionDate):''].filter(Boolean).join(' · '),()=>{closeSearch();finTab='despesas';page='finance';render();openExpense(x.id);},x.notes||'');
  for(const a of f.assets)add('finance','home',a.name,[a.institution,eurFull(typeof curVal==='function'?curVal(a):a.valueCents)].filter(Boolean).join(' · '),()=>{closeSearch();finTab='patrimonio';page='finance';render();openAsset(a.id);},`${a.type||''} ${a.symbol||''}`);}
 // Páginas e ações
 const P=(t,s,icon,run,extra='')=>add('pages',icon,t,s,()=>{closeSearch();run();},extra);
 P('Nova tarefa','Criar uma tarefa pontual','plus-square',()=>openTask(null,'project'),'criar adicionar');
 if(canManage())P('Nova rotina','Tarefa que se repete','repeat',()=>openTask(null,'routine'),'criar adicionar');
 P('Adicionar compra','Lista de compras','cart',sGo('shopping'),'compras lista');
 P('Reportar ocorrência','Avaria, fuga, estrago','alert',sAct('inc-new'),'avaria problema');
 P('Registar trabalho','Registo de horas','clock',sAct('worklog-new'),'horas tempo');
 if(typeof canFinance==='function'&&canFinance())P('Nova subscrição','Finanças › Subscrições','wallet',()=>{finTab='subs';page='finance';render();openSubEdit(null);},'subscricao servico');
 P('O teu perfil','Foto, palavra-passe, notificações','users',sAct('profile-open'),'conta perfil notificacoes avisos');
 for(const [id,label,icon,,ok] of HOUSE_PAGES)if(id!=='calendar'&&ok())P(label,'Página','chevron',sGo(id));
 P('Hoje','Página','today',sGo('today'));P('Tarefas','Página','list',sGo('tasks'));P('Calendário','Tarefas › Calendário','calendar',sGo('tasks',()=>{taskView='calendar';}));P('Compras','Página','cart',sGo('shopping'));
 if(typeof SETTINGS_SECTIONS!=='undefined')for(const [id,label,icon] of SETTINGS_SECTIONS)if(canManage()||['notify','appearance','about'].includes(id))P(`Definições › ${label}`,'Definições','settings',sGo('settings',()=>{settingsSection=id;}),id==='notify'?'notificacoes avisos home assistant':'');
 return out;}
function searchResults(){const q=sNorm(searchQ.trim());if(!q)return [];const toks=q.split(/\s+/).filter(Boolean);
 return searchIndex().filter(e=>(searchArea==='all'||e.area===searchArea)&&toks.every(t=>e.hay.includes(t))).map(e=>{let sc=0;if(e.t===q)sc+=10;if(e.t.startsWith(q))sc+=5;if(e.t.includes(q))sc+=3;for(const t of toks)if(new RegExp('(^|\\s)'+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).test(e.t))sc+=1;if(e.area==='pages')sc-=.5;return {...e,sc};}).sort((a,b)=>b.sc-a.sc||a.title.localeCompare(b.title,'pt'));}
function sMark(text,q){const t=String(text);const tok=sNorm(q.trim()).split(/\s+/).filter(Boolean)[0];if(!tok)return esc(t);const n=sNorm(t);const i=n.indexOf(tok);if(i<0)return esc(t);return esc(t.slice(0,i))+'<mark>'+esc(t.slice(i,i+tok.length))+'</mark>'+esc(t.slice(i+tok.length));}
function searchRecent(){try{return JSON.parse(localStorage.getItem('dc-search-recent')||'[]').filter(x=>typeof x==='string').slice(0,5);}catch{return [];}}
function searchRemember(q){q=q.trim();if(q.length<2)return;try{const r=[q,...searchRecent().filter(x=>sNorm(x)!==sNorm(q))].slice(0,5);localStorage.setItem('dc-search-recent',JSON.stringify(r));}catch{}}
let searchFlat=[];
function drawSearchResults(){const box=document.getElementById('search-results');if(!box)return;const q=searchQ.trim();
 if(!q){const rec=searchRecent();searchFlat=[];box.innerHTML=rec.length?`<section class="srch-group"><h3 class="srch-head"><span>Pesquisas recentes</span><button type="button" class="link-btn" data-action="search-clear-recent">Limpar</button></h3><div class="srch-list">${rec.map(r=>`<button type="button" class="srch-row" data-action="search-recent" data-q="${esc(r)}"><span class="srch-ico">${ico('clock')}</span><span class="srch-text"><strong>${esc(r)}</strong></span></button>`).join('')}</div></section>`:`<p class="srch-hint">Procura em tarefas, compras, ocorrências, equipamentos, pessoas, registos${typeof canFinance==='function'&&canFinance()?', finanças':''} e páginas da app.</p>`;return;}
 const res=searchResults();searchFlat=[];
 if(!res.length){box.innerHTML=`<p class="srch-empty">Nada encontrado para «${esc(q)}».${searchArea!=='all'?' <button type="button" class="link-btn" data-action="search-area" data-area="all">Procurar em tudo</button>':''}</p>`;return;}
 const per=searchArea==='all'?5:40;const groups=SEARCH_AREAS.filter(([k])=>k!=='all').map(([k,l])=>({k,l,list:res.filter(r=>r.area===k)})).filter(g=>g.list.length).sort((a,b)=>(a.k==='pages')-(b.k==='pages')||b.list[0].sc-a.list[0].sc);
 box.innerHTML=groups.map(g=>`<section class="srch-group"><h3 class="srch-head"><span>${esc(g.l)}</span><span>${g.list.length>per?`<button type="button" class="link-btn" data-action="search-area" data-area="${g.k}">Ver ${g.list.length}</button>`:g.list.length}</span></h3><div class="srch-list">${g.list.slice(0,per).map(r=>{const i=searchFlat.push(r)-1;return `<button type="button" class="srch-row ${i===searchSel?'is-sel':''}" data-action="search-go" data-i="${i}" id="srch-opt-${i}" role="option" aria-selected="${i===searchSel}"><span class="srch-ico">${ico(r.icon)}</span><span class="srch-text"><strong>${sMark(r.title,q)}</strong>${r.sub?`<small>${sMark(r.sub,q)}</small>`:''}</span>${r.badge?`<span class="srch-badge">${esc(r.badge)}</span>`:''}</button>`;}).join('')}</div></section>`).join('');
 document.getElementById('search-input')?.setAttribute('aria-activedescendant',searchFlat.length?`srch-opt-${searchSel}`:'');}
function drawSearchChips(){const c=document.getElementById('search-chips');if(!c)return;const fin=typeof canFinance==='function'&&canFinance();c.innerHTML=SEARCH_AREAS.filter(([k])=>k!=='finance'||fin).map(([k,l])=>`<button type="button" class="chip ${searchArea===k?'on':''}" data-action="search-area" data-area="${k}" aria-pressed="${searchArea===k}">${l}</button>`).join('');}
function openSearch(){if(searchOpen){document.getElementById('search-input')?.focus();return;}searchOpen=true;searchSel=0;searchQ='';searchArea='all';searchReturn=document.activeElement;notifOpen=false;
 let h=document.getElementById('search-holder');if(!h){h=document.createElement('div');h.id='search-holder';document.body.appendChild(h);}
 h.innerHTML=`<div class="srch-overlay" data-action="search-close-bg"><div class="srch-panel" role="dialog" aria-modal="true" aria-label="Pesquisar na app"><div class="srch-field">${ico('search')}<input id="search-input" type="text" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Pesquisar na casa…" aria-label="Pesquisar na casa" role="combobox" aria-expanded="true" aria-controls="search-results" value="${esc(searchQ)}"/><button type="button" class="srch-close" data-action="search-close">Fechar</button></div><div class="srch-chips" id="search-chips" role="group" aria-label="Onde procurar"></div><div class="srch-results" id="search-results" role="listbox" aria-label="Resultados"></div></div></div>`;
 document.documentElement.classList.add('srch-lock');drawSearchChips();drawSearchResults();
 const inp=document.getElementById('search-input');setTimeout(()=>{inp.focus();inp.select();},30);
 inp.addEventListener('input',()=>{searchQ=inp.value;searchSel=0;drawSearchResults();});
 if(typeof canFinance==='function'&&canFinance()&&!financeData)refreshFinance().then(()=>{if(searchOpen)drawSearchResults();}).catch(()=>{});}
function closeSearch(){if(!searchOpen)return;searchRemember(searchQ);searchOpen=false;document.documentElement.classList.remove('srch-lock');const h=document.getElementById('search-holder');if(h)h.innerHTML='';try{searchReturn?.focus?.();}catch{}}
function searchRun(i){const r=searchFlat[i];if(!r)return;searchRemember(searchQ);r.run();}
document.addEventListener('keydown',e=>{
 if(searchOpen){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeSearch();return;}
  if(e.target?.id==='search-input'){if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!searchFlat.length)return;searchSel=(searchSel+(e.key==='ArrowDown'?1:-1)+searchFlat.length)%searchFlat.length;drawSearchResults();document.getElementById('srch-opt-'+searchSel)?.scrollIntoView({block:'nearest'});}
   else if(e.key==='Enter'){e.preventDefault();searchRun(searchSel);}}
  return;}
 if(!store?.user||document.querySelector('.overlay'))return;const tag=(e.target?.tagName||'').toLowerCase();const typing=['input','textarea','select'].includes(tag)||e.target?.isContentEditable;
 if((e.key==='/'&&!typing&&!e.ctrlKey&&!e.metaKey&&!e.altKey)||(e.key.toLowerCase()==='k'&&(e.ctrlKey||e.metaKey))){e.preventDefault();openSearch();}},true);
actionHandlers.push(async(name,el)=>{
 if(name==='search-open'){openSearch();return true;}
 if(name==='search-close'){closeSearch();return true;}
 if(name==='search-close-bg'){closeSearch();return true;}
 if(name==='search-area'){searchArea=el.dataset.area||'all';searchSel=0;drawSearchChips();drawSearchResults();document.getElementById('search-input')?.focus();return true;}
 if(name==='search-recent'){searchQ=el.dataset.q||'';const i=document.getElementById('search-input');if(i){i.value=searchQ;i.focus();}searchSel=0;drawSearchResults();return true;}
 if(name==='search-clear-recent'){try{localStorage.removeItem('dc-search-recent');}catch{}drawSearchResults();return true;}
 if(name==='search-go'){searchRun(Number(el.dataset.i));return true;}
 return false;});

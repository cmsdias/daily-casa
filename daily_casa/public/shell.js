/* Daily Casa — estrutura da app (2.0)
 * Página «Casa» (índice do que se usa menos), Definições em secções, janelas reutilizáveis e ícones novos.
 * Partilha o âmbito global com app.js e features.js (scripts clássicos, carregados por esta ordem).
 */
'use strict';
const APP_VER=((document.currentScript&&document.currentScript.src)||'').match(/[?&]v=([\d.]+)/)?.[1]||'';
Object.assign(paths,{
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
 scale:'<path d="M12 5v15M8 20.5h8M4.5 7.5h15"/><circle cx="12" cy="4" r="1.2"/><path d="M4.5 7.5 1.8 14a2.7 2.7 0 0 0 5.4 0zM19.5 7.5 16.8 14a2.7 2.7 0 0 0 5.4 0z"/>',
 file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
 store:'<path d="M4 9h16l-1.2-4.2A1 1 0 0 0 17.8 4H6.2a1 1 0 0 0-1 .8z"/><path d="M5 9v11h14V9M9 20v-6h6v6"/>',
 sparkle:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
 'wifi-off':'<path d="M2 8.8a16 16 0 0 1 4.2-2.6M10.7 5.1A16 16 0 0 1 22 8.8M5 12.6a10 10 0 0 1 3.2-2M15.7 10.7A10 10 0 0 1 19 12.6M8.5 16.4a5 5 0 0 1 7 0"/><circle cx="12" cy="20" r="1"/><path d="M3 3l18 18"/>',
 back:'<path d="M15 5l-7 7 7 7"/>',
 moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
 'theme-auto':'<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor" stroke="none"/>',
 phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
 upload:'<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
 copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
 cake:'<path d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M5 16c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 5 0M12 12V8M12 5.5c.8-.8.8-1.7 0-2.5-.8.8-.8 1.7 0 2.5z"/>',
 eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
 'eye-off':'<path d="M3 3l18 18M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3 3.6M6.5 7.6A15.5 15.5 0 0 0 2.5 12S6 18 12 18a9.3 9.3 0 0 0 4.2-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'
});
// Janela flutuante com o mesmo aspeto das restantes (cabeçalho fixo, × sempre visível, fecha ao tocar fora).
function modalShell({title,sub='',body='',cls='',label}){return `<div class="overlay" data-action="overlay"><div class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${esc(label||title)}"><div class="modal-head"><div><h2>${title}</h2>${sub?`<p class="modal-sub">${sub}</p>`:''}</div><button type="button" class="close" data-action="close" aria-label="Fechar">×</button></div><div class="modal-body">${body}</div></div></div>`;}
const plural=(n,one,many)=>`${n} ${n===1?one:many}`;
const fmtMin=m=>{m=Math.round(m||0);const h=Math.floor(m/60),r=m%60;return h?`${h}h${r?String(r).padStart(2,'0'):''}`:`${r} min`;};
const dateShortPT=iso=>{if(!iso)return '';const d=new Date(iso+'T12:00:00Z');return `${d.getUTCDate()} ${MONTHS_PT[d.getUTCMonth()]}`;};
const firstNameOf=id=>owner(id).split(' ')[0];
const roomsStatus=()=>CasaCore.roomStatus(tasks(),today(),config().rooms);

/* ───────────── Página «Casa» ───────────── */
function nextHoliday(){const t=today();const y=Number(t.slice(0,4));const all={...holidays(y),...holidays(y+1)};const k=Object.keys(all).sort().find(d=>d>=t);return k?{date:k,...all[k]}:null;}
function houseStatusLine(id){
 switch(id){
  case 'calendar':{const h=nextHoliday();return h?`Próximo feriado: ${dateShortPT(h.date)} · ${h.name}`:'Mês, feriados e aniversários';}
  case 'balance':{const b=CasaCore.balance(tasks(),store.history,people(),{today:today()});const top=b.rows[0];return top&&top.total?`Esta semana: ${b.rows.map(r=>`${shortName(who(r.id)||{name:r.name})} ${fmtMin(r.total)}`).slice(0,3).join(' · ')}`:'Ainda sem tarefas esta semana';}
  case 'equipment':{const eq=store.equipment||[];if(!eq.length)return 'Caldeira, AC, eletrodomésticos: tudo num só sítio';const next=eq.filter(x=>x.nextService).sort((a,b)=>a.nextService.localeCompare(b.nextService))[0];return `${plural(eq.length,'equipamento','equipamentos')}${next?` · próxima revisão ${dateShortPT(next.nextService)}`:''}`;}
  case 'incidents':{const open=(store.incidents||[]).filter(x=>x.status!=='resolved');const hi=open.filter(x=>x.severity==='alta').length;return open.length?`${plural(open.length,'por resolver','por resolver')}${hi?` · ${plural(hi,'urgente','urgentes')}`:''}`:'Nada por resolver · algo partiu, avariou ou falta?';}
  case 'people':{const n=people().filter(p=>p.active!==false).length;return `${plural(n,'pessoa','pessoas')} com conta`;}
  case 'worklogs':{const m=today().slice(0,7);const mins=workLogs().filter(x=>(x.date||'').startsWith(m)).reduce((n,x)=>n+Number(x.minutes||0),0);return mins?`${fmtMin(mins)} registadas este mês`:'Trabalhos e tempo de cada pessoa';}
  default:return (HOUSE_PAGES.find(x=>x[0]===id)||[])[3]||'';
 }
}
function housePage(){
 const st=roomsStatus();const score=CasaCore.houseScore(st);const bad=Object.values(st).filter(x=>x.level==='bad').length;
 const items=HOUSE_PAGES.filter(x=>x[4]());
 return `${head('Casa','Tudo o que não é do dia a dia, num só sítio.',false)}
 ${score!=null?`<button type="button" class="house-score" data-action="nav" data-page="tasks" data-view="rooms"><span class="house-score-ring" style="--p:${score}"><b>${score}%</b></span><span><strong>Casa em ordem</strong><small>${bad?`${plural(bad,'divisão precisa','divisões precisam')} de atenção`:'Todas as divisões com rotinas estão em dia'} · ver divisões</small></span>${ico('chevron')}</button>`:''}
 <nav class="index-list" aria-label="Secções da casa">${items.map(([id,label,icon])=>`<button type="button" class="index-row" data-action="nav" data-page="${id}"><span class="index-ico">${ico(icon)}</span><span class="index-text"><strong>${esc(label)}</strong><small>${esc(houseStatusLine(id))}</small></span>${ico('chevron','index-chev')}</button>`).join('')}</nav>`;
}

/* ───────────── Definições em secções ───────────── */
let settingsSection='';
const SETTINGS_SECTIONS=[
 ['house','A casa','home',()=>`${plural(config().floors.length,'piso','pisos')} · ${plural(config().rooms.length,'divisão','divisões')} · ${plural(config().categories.length,'categoria','categorias')}`],
 ['notify','Notificações e Home Assistant','bell',()=>store.haAvailable?'Home Assistant ligado':demo?'Disponível na app instalada no Home Assistant':'Sino da app (Home Assistant não ligado)'],
 ['data','Dados e cópias','download',()=>{if(!isAdmin())return 'Sincronização entre pessoas';const a=(backupsData?.backups||[]).find(b=>b.reason==='auto');return a?`Última cópia: ${fmtDateTime(a.createdAt)}`:'Cópias automáticas diárias';}],
 ['appearance','Aparência','sun',()=>({auto:'Automático (segue o telemóvel)',light:'Claro',dark:'Escuro'})[window.casaThemePref?.()||'auto']],
 ['security','Acesso e segurança','lock',()=>store.publicUrl?store.publicUrl.replace(/^https:\/\//,''):'Endereço externo, email e bloqueios'],
 ['about','Sobre a app','info',()=>`Versão ${APP_VER}`]];
function settingsPage(){
 const sec=SETTINGS_SECTIONS.find(x=>x[0]===settingsSection);
 if(!sec){
  if(isAdmin()&&!backupsData&&!demo)queueMicrotask(async()=>{try{backupsData=await api('/api/backups');}catch{backupsData={backups:[]};}if(page==='settings'&&!settingsSection&&!modal)render();});
  return `${head('Definições','A tua casa e os teus dados, sempre sob controlo.',false)}<nav class="index-list" aria-label="Secções das definições">${SETTINGS_SECTIONS.filter(([id])=>id!=='security'||(isAdmin()&&!demo)).map(([id,label,icon,status])=>`<button type="button" class="index-row" data-action="settings-open" data-section="${id}"><span class="index-ico">${ico(icon)}</span><span class="index-text"><strong>${esc(label)}</strong><small>${esc(status())}</small></span>${ico('chevron','index-chev')}</button>`).join('')}</nav>
  <button type="button" class="index-row index-row-solo" data-action="profile-open"><span class="index-ico">${avatarHtml(me(),'mini')}</span><span class="index-text"><strong>O teu perfil</strong><small>Fotografia, contactos, palavra-passe e terminar sessão</small></span>${ico('chevron','index-chev')}</button>`;
 }
 const back=`<button type="button" class="back-link" data-action="settings-open" data-section="">${ico('back')} Definições</button>`;
 const title=(t,s)=>`${back}${head(t,s,false)}`;
 switch(sec[0]){
  case 'house':return `${title('A casa','Pisos, divisões, categorias e regras da casa.')}${isAdmin()?`<div class="settings-card"><h3>Assistente de início</h3><p>Escolhe o tipo de casa e recebe divisões e rotinas sugeridas. Não apaga nada do que já existe; só acrescenta o que escolheres.</p><button type="button" class="button" data-action="onboarding-open">${ico('sparkle')} Abrir o assistente</button></div>`:''}${rulesCard()}${settingsHouseCard()}`;
  case 'notify':return `${title('Notificações e Home Assistant','O que te avisa e onde.')}<div class="settings-card"><h3>Sino da app</h3><p>Recebes no sino as tarefas que te atribuem, a tua vez nas rotinas, conclusões das tarefas que criaste, aniversários, revisões de equipamentos e o calendário do mês. «Limpar» só as tira do sino; ficam em «Ver todas» durante 30 dias.</p><button type="button" class="button" data-action="nav" data-page="notifications">${ico('bell')} Ver todas as notificações</button></div>${isAdmin()?haCard()+haDashboardCard():`<div class="settings-card"><h3>Home Assistant</h3><p>As notificações no telemóvel e os sensores da casa são configurados pelo administrador.</p></div>`}`;
  case 'data':return `${title('Dados e cópias','Onde estão os dados e como os guardar.')}<div class="settings-card"><h3>Sincronização</h3><p>${demo?'Estás a utilizar uma demonstração local neste browser. A versão com servidor sincroniza automaticamente as alterações entre todos os membros.':'As alterações das outras pessoas aparecem sozinhas, em poucos segundos. Se estiveres a escrever, a app avisa e espera que termines. Sem rede, as conclusões e as compras ficam guardadas no telemóvel e são enviadas quando a ligação voltar.'}</p><button class="button" data-action="refresh">${ico('refresh')} Atualizar agora</button></div>${backupsCard()}${isAdmin()||demo?`<div class="settings-card"><h3>Importar tarefas</h3><p>Para carregar uma lista inicial num servidor novo, seleciona o ficheiro JSON privado guardado no teu computador. O GitHub guarda apenas o código, nunca a lista de tarefas. Tarefas repetidas são ignoradas.</p><button class="button" data-action="import">${ico('download')} Importar ficheiro JSON</button><input id="casa-import-file" type="file" accept=".json,application/json" hidden /></div><div class="settings-card"><h3>Exportar</h3><p>Guarda um ficheiro JSON com as tarefas, as pessoas e o histórico de conclusões.</p><button class="button" data-action="export">${ico('download')} Exportar dados</button></div>`:''}`;
  case 'appearance':return `${title('Aparência','Claro, escuro ou a seguir o telemóvel.')}<div class="settings-card">${appearanceField()}</div>`;
  case 'security':return `${title('Acesso e segurança','Endereço externo, email de recuperação e tentativas bloqueadas.')}${securityBody()}`;
  case 'about':{const url=store.publicUrl||'';return `${title('Sobre a app','Versão, instalação e licença.')}<div class="settings-card"><h3>Daily Casa ${esc(APP_VER)}</h3><p>Os dados ficam no servidor desta casa (Home Assistant). ${url?'O acesso fora de casa passa por um túnel seguro (HTTPS) e os códigos de recuperação da palavra-passe podem ser enviados por email; nenhum outro serviço recebe os dados da casa.':'Nenhum serviço externo recebe os dados da casa.'} Todos os direitos reservados.</p><button type="button" class="button" data-action="nav" data-page="notifications">${ico('bell')} Notificações</button></div><div class="settings-card"><h3>Instalar no telemóvel</h3>${url?`<p>Abre <a href="${esc(url)}" target="_blank" rel="noopener"><b>${esc(url.replace(/^https:\/\//,''))}</b></a> no Safari (iPhone) ou no Chrome (Android), entra com a tua conta e escolhe <b>Partilhar → Adicionar ao ecrã principal</b> (iPhone) ou <b>menu → Instalar aplicação</b> (Android). Funciona dentro e fora de casa.</p><p class="field-help">Se tinhas a app instalada pelo endereço com o IP (http://…:3000), remove esse ícone e instala de novo por este endereço.</p>`:`<p>Para ter a Daily Casa como app própria, sem o cabeçalho do Home Assistant: o administrador liga o <b>acesso direto</b> no Home Assistant (Definições → Aplicações → Daily Casa → Configuração → Rede, porta 3000). Depois, no telemóvel ligado ao Wi-Fi de casa, abre o endereço IP do Home Assistant com a porta (ex.: <code>http://192.168.1.50:3000</code>), entra com a tua conta e escolhe Partilhar → Adicionar ao ecrã principal (iPhone) ou menu → Instalar aplicação (Android).</p><p class="field-help">Para usar fora de casa, o administrador pode configurar um endereço próprio em Definições → Acesso e segurança.</p>`}</div>`;}
 }
 return '';
}
// Cartão para o painel do Home Assistant (usa os sensores publicados pela app).
function haDashboardCard(){
 if(!haData?.available)return '';const path=haData.panelUrl||'/daily_casa';
 const yaml=`type: vertical-stack\ncards:\n  - type: markdown\n    title: Daily Casa\n    content: >-\n      **Casa em ordem: {{ states('sensor.daily_casa_estado_da_casa') }}%**\n\n      {% set t = state_attr('sensor.daily_casa_hoje', 'tarefas') or [] %}\n      {% if t | count == 0 %}Nada para hoje.{% else %}\n      {% for x in t %}- {{ 'Atrasada: ' if x.atrasada }}{{ x.titulo }}{{ ' · ' ~ x.divisao if x.divisao }}{{ ' · ' ~ x.quem if x.quem }}\n      {% endfor %}{% endif %}\n\n      Compras: {{ states('sensor.daily_casa_compras') }} por comprar\n  - type: button\n    name: Abrir a Daily Casa\n    icon: mdi:home-variant-outline\n    tap_action:\n      action: navigate\n      navigation_path: ${path}`;
 return `<div class="settings-card"><h3>Cartão para o painel</h3><p>Mostra as tarefas de hoje, o estado da casa e as compras num painel do Home Assistant (por exemplo, num tablet na cozinha). Requer «Publicar o estado da casa como sensores» ligado.</p><ol class="steps-mini"><li>No Home Assistant, abre o painel e escolhe <b>Editar painel</b> → <b>Adicionar cartão</b> → <b>Manual</b>.</li><li>Cola o código abaixo e guarda.</li></ol><pre class="code-block">${esc(yaml)}</pre><button type="button" class="button" data-action="copy-ha-card">${ico('copy')} Copiar código</button></div>`;
}

actionHandlers.push(async(name,el)=>{
 if(name==='settings-open'){settingsSection=el.dataset.section||'';if(settingsSection==='security')securityData=null;render();window.scrollTo(0,0);return true;}
 if(name==='copy-ha-card'){const pre=el.parentElement.querySelector('.code-block');await copyText(pre?.textContent||'','Código do cartão copiado.',pre);return true;}
 if(name==='nav'&&el.dataset.page==='settings'){settingsSection=el.dataset.section||'';return false;}
 return false;
});

// Importar: resumo do ficheiro e opção de substituir o que existe (com cópia de segurança automática antes).
modalRenderers.import=holder=>{
 const {payload,file}=modal;const t=payload.tasks||[];const routines=t.filter(x=>x.kind==='routine').length;const rooms=payload.settings?.rooms?.length||0;const now=tasks().length;
 const body=`<p class="import-summary"><b>${esc(file)}</b><br>${plural(t.length-routines,'tarefa pontual','tarefas pontuais')} · ${plural(routines,'rotina','rotinas')}${rooms?` · ${plural(rooms,'divisão','divisões')}`:''}</p>
 ${demo?'':`<label class="check-line"><input type="checkbox" id="imp-replace" ${now?'checked':''}/> Apagar primeiro as ${plural(now,'tarefa e rotina atual','tarefas e rotinas atuais')}</label>
 <label class="check-line"><input type="checkbox" id="imp-other"/> Limpar também a lista de compras, os registos de horas e o histórico de conclusões</label>
 <p class="field-help">Antes de apagar, a app guarda uma cópia de segurança «Antes de importar» (Definições › Dados e cópias), para poder voltar atrás. Pessoas, finanças, equipamentos e definições não são tocados.</p>`}
 <div class="modal-actions"><button type="button" class="button" data-action="close">Cancelar</button><span class="spacer"></span><button type="button" class="button primary" data-action="import-run">${ico('download')} Importar</button></div>`;
 holder.innerHTML=modalShell({title:'Importar tarefas',sub:'As tarefas repetidas (mesmo título, divisão e tipo) são ignoradas.',body,cls:'import-modal'});
 holder.querySelector('#imp-other')?.addEventListener('change',e=>{if(e.target.checked){const r=holder.querySelector('#imp-replace');if(r)r.checked=true;}});
};
actionHandlers.push(async(name)=>{
 if(name!=='import-run')return false;const {payload,file}=modal;const rep=document.getElementById('imp-replace')?.checked,other=document.getElementById('imp-other')?.checked;
 if(rep&&!await confirmDialog({title:'Substituir as tarefas atuais?',message:`As ${tasks().length} tarefas e rotinas atuais são apagadas${other?', bem como as compras, os registos de horas e o histórico':''}, e substituídas pelas de «${file}». Fica uma cópia de segurança para voltar atrás.`,confirmLabel:'Substituir',danger:true}))return true;
 if(demo){let n=0;if(rep)store.tasks=[];const ids=new Set(store.tasks.map(t=>[t.title,t.room,t.kind].join('|')));for(const raw of payload.tasks){const key=[raw.title,raw.room,raw.kind].join('|');if(!raw.title||ids.has(key))continue;ids.add(key);store.tasks.push({status:'todo',priority:'P3',repeat:'none',kind:'project',...raw,id:'import-'+Date.now()+'-'+n++});}persistDemo();modal=null;render();toast(`${n} tarefas importadas para a demonstração.`);return true;}
 const r=await api('/api/import','POST',{tasks:payload.tasks,settings:payload.settings,replace:rep?{tasks:true,other:!!other}:false});
 modal=null;await reload();toast(`${r.imported} importadas${r.skipped?`, ${r.skipped} ignoradas`:''}${r.removed?` · ${r.removed} antigas apagadas (cópia guardada)`:''}.`);return true;
});

/* ───────────── 2.2 · Notificações no telemóvel (perfil) e recuperar a palavra-passe ───────────── */
Object.assign(paths,{login:'<path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/>'});
// Interruptor por pessoa: as notificações chegam pela app Home Assistant do telemóvel (o administrador escolhe o telemóvel de cada um).
function pushField(){
 const u=me();const ready=!!u.pushReady;const on=ready&&!u.pushOff;
 const ha=ready?`<div class="field pref-row"><div><span class="field-label" id="push-label">Notificações pela app Home Assistant</span><small class="appearance-state" id="push-state">${esc(on?(u.webPush?'Só o resumo diário (o resto chega pelas notificações da app)':'Ligadas · tarefas atribuídas e resumo diário'):'Desligadas')}</small></div><button type="button" class="switch" role="switch" aria-checked="${on}" aria-labelledby="push-label" data-action="push-toggle"><span></span></button></div>`:'';
 return webPushField()+ha;
}
/* 3.3 · Notificações push próprias da app, por dispositivo. */
const wpSupported=()=>'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window&&window.isSecureContext;
const wpIOS=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const wpStandalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
function wpBlocker(){
 if(demo)return 'Disponível na app instalada no Home Assistant.';
 if(!window.isSecureContext)return store.publicUrl?`Abre a app pelo endereço seguro (${store.publicUrl.replace(/^https:\/\//,'')}) para ativar.`:'Precisa de um endereço seguro (https://). Ver Definições → Acesso e segurança.';
 if(wpIOS()&&!wpStandalone())return 'No iPhone, instala primeiro a app no ecrã principal (Partilhar → Adicionar ao ecrã principal) e abre-a pelo ícone.';
 if(!wpSupported())return 'Este browser não suporta notificações.';
 if(Notification.permission==='denied')return 'Bloqueadas nas definições do telemóvel para esta app.';
 return '';
}
function webPushField(){
 const block=wpBlocker();
 if(!block)queueMicrotask(wpRefresh);
 return `<div class="field pref-row"><div><span class="field-label" id="wp-label">Notificações neste telemóvel</span><small class="appearance-state" id="wp-state">${esc(block||'A verificar…')}</small></div><button type="button" class="switch" role="switch" id="wp-switch" aria-checked="false" aria-labelledby="wp-label" data-action="wp-toggle" ${block?'disabled':''}><span></span></button></div>`;
}
async function wpSub(){const reg=await navigator.serviceWorker.ready;return {reg,sub:await reg.pushManager.getSubscription()};}
async function wpRefresh(){const sw=document.getElementById('wp-switch'),st=document.getElementById('wp-state');if(!sw)return;
 try{const {sub}=await wpSub();const on=!!sub&&Notification.permission==='granted';sw.setAttribute('aria-checked',String(on));st.textContent=on?'Ligadas · tudo o que chega ao sino aparece também aqui':'Desligadas · liga para receber avisos mesmo com a app fechada';}catch{st.textContent='Não foi possível verificar.';}}
const wpKey=k=>{const s=(k+'='.repeat((4-k.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s),c=>c.charCodeAt(0));};
const wpLabel=()=>{const ua=navigator.userAgent;return /iPhone/.test(ua)?'iPhone':/iPad/.test(ua)?'iPad':/Android/.test(ua)?'Android':/Mac/.test(ua)?'Mac':/Windows/.test(ua)?'Windows':'Browser';};
async function wpEnable(){
 const perm=await Notification.requestPermission();if(perm!=='granted')throw Error('Sem autorização para notificações. Podes ativá-las nas definições do telemóvel.');
 const {reg,sub:old}=await wpSub();const {publicKey}=await api('/api/push');
 if(old)await old.unsubscribe().catch(()=>{});
 const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:wpKey(publicKey)});
 await api('/api/push/subscribe','POST',{subscription:sub.toJSON(),label:wpLabel()});
}
async function wpDisable(){const {sub}=await wpSub();if(sub){await api('/api/push/unsubscribe','POST',{endpoint:sub.endpoint}).catch(()=>{});await sub.unsubscribe().catch(()=>{});}}
// Se este telemóvel já tinha notificações ligadas, volta a registá-lo no servidor (ex.: depois de restaurar uma cópia).
async function wpResync(){if(demo||wpBlocker()||Notification.permission!=='granted'||!store.user)return;try{const {sub}=await wpSub();if(sub)await api('/api/push/subscribe','POST',{subscription:sub.toJSON(),label:wpLabel()});}catch{}}
let wpSynced=false;setInterval(()=>{if(!wpSynced&&store?.user){wpSynced=true;wpResync();}},3000);
// Abrir a notificação certa quando se toca numa notificação push.
function openNotifFromUrl(url){try{const id=new URL(url,location.href).searchParams.get('n');if(!id)return;const tryOpen=(n=0)=>{if(notifications().some(x=>x.id===id)){action('notif-open',{dataset:{id}});}else if(n<20)setTimeout(()=>tryOpen(n+1),300);};tryOpen();history.replaceState(null,'',location.pathname);}catch{}}
navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='open-notification')openNotifFromUrl(e.data.url);});
if(new URLSearchParams(location.search).has('n'))setTimeout(()=>openNotifFromUrl(location.href),1500);
actionHandlers.push(async(name,el)=>{
 if(name==='wp-toggle'){const on=el.getAttribute('aria-checked')!=='true';el.disabled=true;const st=document.getElementById('wp-state');
  try{if(on){st.textContent='A ligar…';await wpEnable();const r=await api('/api/push/test','POST',{}).catch(()=>null);toast(r?.sent?'Notificações ligadas. Enviámos uma de teste.':'Notificações ligadas neste telemóvel.');}else{await wpDisable();toast('Notificações desligadas neste telemóvel.');}}
  catch(e){toast(e.message);}el.disabled=false;await wpRefresh();return true;}
 return false;
});
actionHandlers.push(async(name,el)=>{
 if(name==='push-toggle'){const on=el.getAttribute('aria-checked')!=='true';el.setAttribute('aria-checked',String(on));
  try{if(demo){me().pushOff=!on;}else{const r=await api('/api/me','PATCH',{pushOff:!on});if(r.people)store.people=r.people;}const st=document.getElementById('push-state');if(st)st.textContent=on?'Ligadas · tarefas atribuídas e resumo diário':'Desligadas · continuas a ver tudo no sino';toast(on?'Notificações no telemóvel ligadas.':'Notificações no telemóvel desligadas.');}
  catch(e){el.setAttribute('aria-checked',String(!on));toast(e.message);}return true;}
 if(name==='forgot-open'){renderForgot(1,document.querySelector('#auth-form [name=email]')?.value||'');return true;}
 if(name==='forgot-back'){renderAuth('login');return true;}
 return false;
});
// Recuperar a palavra-passe: 1) pedir o código (chega à app Home Assistant do telemóvel; o administrador é avisado); 2) código + nova palavra-passe.
function renderForgot(step,email='',msg=''){
 const box=document.querySelector('.auth-inner');if(!box)return;
 box.innerHTML=`<img class="auth-mobile-logo" src="logo-primary-dark.svg" alt="Daily Casa" /><div class="eyebrow">DAILY CASA · RECUPERAR ACESSO</div><h2>${step===1?'Esqueceste-te da palavra-passe?':'Escolhe uma nova palavra-passe.'}</h2>
 <p>${step===1?'Indica o teu email. Enviamos-te um código de 6 dígitos por email (e para a app Home Assistant do telemóvel, se estiver ligada). O administrador é avisado e também pode repor-te a palavra-passe.':'Escreve o código de 6 dígitos que recebeste e a nova palavra-passe.'}</p>
 <form id="forgot-form">${step===1?`<div class="field"><label>Email</label><input type="email" name="email" required autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(email)}" placeholder="nome@exemplo.pt"/></div>`:`<input type="email" name="email" autocomplete="username" value="${esc(email)}" hidden/><div class="field"><label>Código</label><input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="\\d{6}" maxlength="6" required placeholder="000000"/></div><div class="field"><label>Nova palavra-passe</label><input type="password" name="password" autocomplete="new-password" minlength="10" required placeholder="Mínimo de 10 caracteres"/></div>`}
 <button class="button primary auth-submit" type="submit">${ico(step===1?'mail':'check')}<span>${step===1?'Enviar código':'Guardar e entrar'}</span></button><div class="auth-message ${msg?'ok':''}" id="auth-error">${esc(msg)}</div>
 <button type="button" class="auth-link" data-action="forgot-back">${ico('back')} Voltar ao login</button>${step===2?`<button type="button" class="auth-link" data-action="forgot-open">Pedir um novo código</button>`:''}</form>`;
 const f=box.querySelector('#forgot-form');f.querySelector('input:not([hidden])')?.focus();
 f.addEventListener('submit',async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(f));const b=f.querySelector('[type=submit]');b.disabled=true;
  try{if(step===1){await api('/api/password/forgot','POST',{email:v.email});renderForgot(2,v.email,'Se o email estiver registado, enviámos um código válido durante 15 minutos. Vê também o spam. Se não chegar, o administrador já foi avisado.');}
   else{await api('/api/password/reset','POST',v);location.replace(location.pathname+location.search);}}
  catch(err){const m=box.querySelector('#auth-error');m.classList.remove('ok');m.textContent=err.message;b.disabled=false;}});
}

/* 2.3.7 · Olho nos campos de palavra-passe (entrada, recuperação, perfil, pessoas): mostra ou esconde o que se escreveu. */
function enhancePasswords(root){
 (root.querySelectorAll?root:document).querySelectorAll('input[type="password"]:not([data-eye])').forEach(inp=>{
  inp.dataset.eye='1';const w=document.createElement('span');w.className='pw-wrap';inp.parentNode.insertBefore(w,inp);w.appendChild(inp);
  const b=document.createElement('button');b.type='button';b.className='pw-eye';b.setAttribute('aria-label','Mostrar palavra-passe');b.setAttribute('aria-pressed','false');b.innerHTML=ico('eye');w.appendChild(b);});
}
document.addEventListener('pointerdown',e=>{if(e.target.closest('.pw-eye'))e.preventDefault();},true);
document.addEventListener('click',e=>{const b=e.target.closest('.pw-eye');if(!b)return;e.preventDefault();e.stopPropagation();
 const inp=b.parentNode.querySelector('input');if(!inp)return;const show=inp.type==='password';const pos=inp.selectionStart;
 inp.type=show?'text':'password';b.setAttribute('aria-pressed',String(show));b.setAttribute('aria-label',show?'Esconder palavra-passe':'Mostrar palavra-passe');b.innerHTML=ico(show?'eye-off':'eye');
 if(document.activeElement===inp&&pos!=null)try{inp.setSelectionRange(pos,pos);}catch{}},true);
// Ao submeter, volta a esconder (para o gestor de palavras-passe do iPhone reconhecer o campo).
document.addEventListener('submit',e=>{e.target.querySelectorAll?.('.pw-wrap input[data-eye]').forEach(i=>{i.type='password';const b=i.parentNode.querySelector('.pw-eye');if(b){b.setAttribute('aria-pressed','false');b.innerHTML=ico('eye');}});},true);
new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1)enhancePasswords(n);}).observe(document.body,{childList:true,subtree:true});
enhancePasswords(document);

/* 3.1 · Acesso e segurança (administrador): endereço externo, diagnóstico do proxy, email de recuperação e bloqueios. */
let securityData=null;
function securityBody(){
 if(!securityData){queueMicrotask(async()=>{try{securityData=await api('/api/security');}catch(e){securityData={error:e.message};}if(page==='settings'&&settingsSection==='security')render();});return `<div class="settings-card"><p>A carregar…</p></div>`;}
 if(securityData.error)return `<div class="settings-card"><p>${esc(securityData.error)}</p></div>`;
 const d=securityData,n=d.net||{},m=d.mail||{};
 const conn=n.viaProxy?`Chegaste pelo túnel seguro (${n.https?'HTTPS':'sem HTTPS'}). O teu endereço na Internet é <b>${esc(n.client)}</b>.`:n.cloudflareHeaders?`O pedido traz cabeçalhos da Cloudflare mas veio de <b>${esc(n.remote)}</b>, que não é reconhecido como proxy. No add-on Cloudflared, usa como serviço <code>http://${esc(d.hostname||'NOME-DO-ADD-ON')}:3000</code> para a app ver o IP real de quem entra.`:`Ligação direta, sem túnel (${esc(n.client||'')}).`;
 const kinds={ip:'Endereço',account:'Conta',reset:'Recuperação'};
 const blocked=(d.blocked||[]).map(b=>`<li><b>${kinds[b.kind]||''}</b> ${esc(b.key.replace(/^(login|int|ip|acct):/,''))} <small>até ${esc(fmtDateTime(b.until))}</small></li>`).join('');
 return `<div class="settings-card"><h3>Endereço externo</h3><p>${d.publicUrl?`A app está disponível em <a href="${esc(d.publicUrl)}" target="_blank" rel="noopener"><b>${esc(d.publicUrl)}</b></a>${d.publicUrlManual?'':' (detetado automaticamente)'}. É este o endereço indicado em «Sobre a app» e nos emails.`:'Ainda não foi detetado nenhum endereço externo. Abre a app uma vez pelo endereço do túnel (https://…) ou indica-o aqui.'}</p>
 <form id="public-url-form" class="inline-form"><div class="field"><label for="public-url">Endereço (opcional)</label><input id="public-url" name="publicUrl" type="url" inputmode="url" autocapitalize="none" spellcheck="false" placeholder="${esc(d.publicUrlAuto||'https://casa.exemplo.pt')}" value="${esc(d.publicUrlManual||'')}"/></div><button class="button" type="submit">Guardar</button></form><p class="field-help">Deixa em branco para usar o endereço detetado.</p></div>
 <div class="settings-card"><h3>Esta ligação</h3><p>${conn}</p></div>
 <div class="settings-card"><h3>Email de recuperação</h3>${m.configured?`<p>Os códigos para recuperar a palavra-passe são enviados por <b>${esc(m.name)}</b> &lt;${esc(m.from)}&gt;.</p><button type="button" class="button" data-action="security-mail-test">${ico('mail')} Enviar email de teste para mim</button>`:`<p>Ainda não está configurado. No Home Assistant: Definições → Aplicações → Daily Casa → Configuração. Preenche o email Gmail de envio e uma <b>palavra-passe de aplicação</b> da conta Google (Segurança → Palavras-passe de aplicações; exige a verificação em dois passos). Guarda e reinicia a app.</p>`}</div>
 <div class="settings-card"><h3>Proteção da entrada</h3><p>10 tentativas falhadas a partir do mesmo endereço bloqueiam-no durante 15 minutos (o dobro a cada reincidência, até 24 horas). 20 falhas numa conta, numa hora, bloqueiam essa conta durante 30 minutos. Recebes um aviso no sino quando isso acontece.</p>${blocked?`<ul class="blocked-list">${blocked}</ul><button type="button" class="button" data-action="security-unblock">Desbloquear tudo</button>`:'<p class="field-help">Neste momento não há nada bloqueado.</p>'}</div>`;
}
actionHandlers.push(async(name,el)=>{
 if(name==='security-mail-test'){el.disabled=true;try{const r=await api('/api/security/mail-test','POST',{});toast(`Email de teste enviado para ${r.to}.`);}catch(e){toast(e.message);}el.disabled=false;return true;}
 if(name==='security-unblock'){try{securityData=await api('/api/security/unblock','POST',{});render();toast('Desbloqueado.');}catch(e){toast(e.message);}return true;}
 return false;
});
document.addEventListener('submit',async e=>{if(e.target.id!=='public-url-form')return;e.preventDefault();const v=new FormData(e.target).get('publicUrl')||'';
 try{securityData=await api('/api/security','PATCH',{publicUrl:String(v).trim()});store.publicUrl=securityData.publicUrl;render();toast(v?'Endereço guardado.':'A usar o endereço detetado.');}catch(err){toast(err.message);}});

/* 3.2 · Convite para instalar a app no ecrã principal.
   Aparece alguns segundos depois de entrar, sempre que a app é aberta no browser, até ser instalada.
   - Android/Chrome/Edge: botão «Instalar» com o pedido nativo do browser (beforeinstallprompt).
   - iPhone/iPad: passos para Partilhar › Adicionar ao ecrã principal (o Safari não permite instalar por botão).
   - Aberta como app instalada (ecrã inteiro), dentro do Home Assistant (iframe) ou em browsers sem instalação: não aparece.
   - «Já instalei» deixa de mostrar neste browser (no iPhone o Safari não consegue saber que a app foi instalada). */
let installEvt=null,installShown=false;
const isStandalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
const installLS={get:k=>{try{return localStorage.getItem(k);}catch{return null;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch{}}};
const installSS={get:k=>{try{return sessionStorage.getItem(k);}catch{return null;}},set:(k,v)=>{try{sessionStorage.setItem(k,v);}catch{}}};
function installPlatform(){const ua=navigator.userAgent||'';const ios=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 if(ios)return 'ios';if(installEvt)return 'prompt';if(/Macintosh/.test(ua)&&/Safari/.test(ua)&&!/Chrome|Chromium|Edg|Firefox/.test(ua))return 'macsafari';return '';}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;});
window.addEventListener('appinstalled',()=>{installLS.set('dc-installed','1');document.getElementById('install-sheet')?.remove();});
if(isStandalone())installLS.set('dc-installed','1');
const SHARE_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1"/></svg>';
function installSheet(){
 if(installShown||isStandalone()||window.top!==window.self||installLS.get('dc-installed')||installSS.get('dc-install-later')||!store?.user||document.getElementById('install-sheet')||document.getElementById('version-holder')||modal)return;
 const pf=installPlatform();if(!pf)return;installShown=true;
 const pub=store.publicUrl||'';const onPub=pub&&location.origin===pub;
 const better=pub&&!onPub?`<p class="install-hint">Para funcionar também fora de casa, instala a partir de <a href="${esc(pub)}">${esc(pub.replace(/^https:\/\//,''))}</a>.</p>`:'';
 const steps=pf==='ios'?`<ol class="install-steps"><li><span class="install-key">${SHARE_SVG}</span><span>Toca em <b>Partilhar</b> na barra do Safari<small>Se não o vires, toca primeiro em <b>⋯</b></small></span></li><li><span class="install-key">${ico('plus-square')}</span><span>Escolhe <b>Adicionar ao ecrã principal</b></span></li><li><span class="install-key install-key-app"><img src="apple-touch-icon.png" alt="" /></span><span>Toca em <b>Adicionar</b>. A Daily Casa fica junto às outras apps</span></li></ol>`
  :pf==='macsafari'?`<ol class="install-steps"><li><span class="install-key">${SHARE_SVG}</span><span>No menu <b>Ficheiro</b>, escolhe <b>Adicionar à Dock</b></span></li></ol>`:'';
 const el=document.createElement('div');el.id='install-sheet';el.className='install-sheet';el.setAttribute('role','dialog');el.setAttribute('aria-labelledby','install-title');
 el.innerHTML=`<div class="install-card"><button type="button" class="install-close" data-install="later" aria-label="Agora não">×</button>
  <div class="install-head"><img class="install-icon" src="apple-touch-icon.png" alt="" /><div><h2 id="install-title">Instala a Daily Casa</h2><p>Abre num toque, em ecrã inteiro, como as outras apps${pub?', dentro e fora de casa':''}.</p></div></div>
  ${steps}${better}
  <div class="install-actions">${pf==='prompt'?`<button type="button" class="button" data-install="later">Agora não</button><button type="button" class="button primary" data-install="go">${ico('download')} Instalar</button>`:`<button type="button" class="button" data-install="done">Já instalei</button><button type="button" class="button primary" data-install="later">Percebi</button>`}</div></div>${pf==='ios'?'<div class="install-pointer" aria-hidden="true"></div>':''}`;
 document.body.appendChild(el);requestAnimationFrame(()=>el.classList.add('open'));
 el.addEventListener('click',async e=>{const b=e.target.closest('[data-install]');if(!b)return;const k=b.dataset.install;
  if(k==='go'&&installEvt){installEvt.prompt();const r=await installEvt.userChoice.catch(()=>({}));installEvt=null;if(r.outcome==='accepted'){installLS.set('dc-installed','1');close();toast('A instalar a Daily Casa…');}return;}
  if(k==='done')installLS.set('dc-installed','1');else installSS.set('dc-install-later','1');close();});
 function close(){el.classList.remove('open');setTimeout(()=>el.remove(),250);}
}
setInterval(()=>{if(!installShown&&store?.user&&!document.hidden)setTimeout(installSheet,3500);},4000);

/* 3.4 · Zoom elástico: com dois dedos amplia-se o conteúdo; ao largar volta suavemente ao tamanho normal.
   Substitui o zoom do browser (que no iPhone ficava preso ampliado). 3.7: também sobre campos e dentro das janelas
   (amplia-se a janela), e o zoom automático do iPhone ao tocar num campo fica desligado (maximum-scale no viewport);
   se mesmo assim o ecrã ficar ampliado, volta à largura normal ao sair do campo. Só as fotografias usam o zoom nativo. */
(function(){
 const native=t=>!!(t&&t.closest&&t.closest('#photo-viewer,#crop-holder'));
 const target=t=>t?.closest?.('.overlay .modal,.store-mode,#install-sheet')||document.querySelector('main.main');
 for(const ev of ['gesturestart','gesturechange'])document.addEventListener(ev,e=>{if(!native(e.target))e.preventDefault();},{passive:false});
 let g=null;
 const dist=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
 const mid=t=>({x:(t[0].clientX+t[1].clientX)/2,y:(t[0].clientY+t[1].clientY)/2});
 document.addEventListener('touchstart',e=>{
  if(e.touches.length!==2||native(e.target))return;const el=target(e.target);if(!el)return;
  const r=el.getBoundingClientRect(),m=mid(e.touches);g={el,d:dist(e.touches),m};
  el.style.transition='none';el.style.transformOrigin=`${m.x-r.left}px ${m.y-r.top}px`;el.style.willChange='transform';
 },{passive:true});
 document.addEventListener('touchmove',e=>{
  if(!g||e.touches.length!==2)return;e.preventDefault();
  let s=dist(e.touches)/g.d;s=s<1?1-(1-s)*.25:Math.min(s,4);const m=mid(e.touches);
  g.el.style.transform=`translate(${(m.x-g.m.x).toFixed(1)}px,${(m.y-g.m.y).toFixed(1)}px) scale(${s.toFixed(3)})`;
 },{passive:false});
 const release=e=>{if(!g||e.touches.length>=2)return;const el=g.el;g=null;
  el.style.transition='transform .5s cubic-bezier(.18,1.35,.4,1)';el.style.transform='';
  setTimeout(()=>{if(!g){el.style.transition='';el.style.transformOrigin='';el.style.willChange='';}},550);};
 document.addEventListener('touchend',release);document.addEventListener('touchcancel',release);
 // Rede de segurança: se o browser ampliou (zoom nativo), repõe a largura do ecrã quando se sai do campo.
 const vp=document.querySelector('meta[name=viewport]');
 const iOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 // No iPhone/iPad, maximum-scale=1 impede o zoom automático ao tocar num campo (o zoom com dois dedos continua possível).
 if(vp&&iOS&&!/maximum-scale/.test(vp.content))vp.setAttribute('content',vp.content+', maximum-scale=1');
 const base=vp?.getAttribute('content')||'';
 const reset=()=>{const vv=window.visualViewport;if(!vp||!vv||vv.scale<=1.01||document.querySelector('#photo-viewer'))return;
  vp.setAttribute('content',base.replace(/,?\s*maximum-scale=[^,]*/,'')+', maximum-scale=1, user-scalable=no');setTimeout(()=>vp.setAttribute('content',base),300);};
 document.addEventListener('focusout',()=>setTimeout(()=>{if(!document.activeElement?.matches?.('input,textarea,select'))reset();},120));
 window.visualViewport?.addEventListener('resize',()=>{if(!document.activeElement?.matches?.('input,textarea,select'))setTimeout(reset,400);});
})();

/* 3.5 · Sobre o que te avisamos: cada pessoa escolhe que tipos de notificação recebe no telemóvel (o sino mostra sempre tudo). */
function notifTypesField(){
 const u=me();if(!u)return '';const role=u.role,mgr=role==='admin'||role==='manager',collab=role==='collaborator',prefs=u.notifPrefs||{};
 const rows=[
  ['assigned','list','Tarefas atribuídas','Quando alguém te atribui uma tarefa',true],
  ['rotation','repeat','A tua vez nas rotinas','Quando uma rotina com rotação passa para ti',true],
  ['due','clock','Tarefas do dia','De manhã, as tuas tarefas para hoje e as atrasadas',true],
  ['done','check-square','Tarefas concluídas','Quando alguém conclui uma tarefa que criaste',!collab],
  ['approval','users','Aprovações',mgr?'Pedidos de atribuição e trabalho por aprovar':'A decisão sobre os teus pedidos e o teu trabalho',true],
  ['incident','alert','Ocorrências',mgr?'Novas ocorrências e as tuas quando são resolvidas':'Quando uma ocorrência que reportaste é resolvida',true],
  ['equipment','tool','Equipamentos','Revisões marcadas e garantias a terminar',mgr],
  ['birthday','cake','Aniversários','No dia e na véspera',!collab],
  ['season','calendar','Calendário da casa','No início do mês, os trabalhos da época',mgr]].filter(r=>r[4]);
 return `<div class="notif-types"><h3 class="notif-types-title">Sobre o que te avisamos</h3>${rows.map(([k,icon,t,d])=>{const on=prefs[k]!==false;return `<div class="pref-row notif-type-row"><span class="notif-type-ico" aria-hidden="true">${ico(icon)}</span><div><span class="field-label" id="np-${k}">${t}</span><small class="appearance-state">${d}</small></div><button type="button" class="switch" role="switch" aria-checked="${on}" aria-labelledby="np-${k}" data-action="notif-pref" data-type="${k}" ${demo?'':''}><span></span></button></div>`;}).join('')}<p class="field-help">Os avisos de segurança e os códigos de recuperação são sempre enviados. No sino continuas a ver tudo.</p></div>`;
}
actionHandlers.push(async(name,el)=>{
 if(name!=='notif-pref')return false;const k=el.dataset.type,on=el.getAttribute('aria-checked')!=='true';el.setAttribute('aria-checked',String(on));
 try{if(demo){const u=me();u.notifPrefs={...(u.notifPrefs||{}),[k]:on};}else{const r=await api('/api/me','PATCH',{notifPrefs:{[k]:on}});if(r.people)store.people=r.people;}}
 catch(e){el.setAttribute('aria-checked',String(!on));toast(e.message);}return true;
});

/* 3.6 · Convites por email (administrador) e aceitação do convite. */
let invitesData=null;
function invitesCard(){
 if(demo)return '';
 if(!invitesData){queueMicrotask(async()=>{try{invitesData=await api('/api/invites');}catch{invitesData={invites:[]};}if(page==='people'&&!modal)render();});return '';}
 const list=invitesData.invites||[];if(!list.length)return '';
 return `<div class="settings-card invites-card"><h3>Convites por aceitar</h3><ul class="invite-list">${list.map(x=>`<li><div><b>${esc(x.name||x.email)}</b><small>${x.name?esc(x.email)+' · ':''}${esc(x.roleLabel)} · enviado ${esc(relTime(x.sentAt))} · válido até ${esc(new Date(x.expiresAt).toLocaleDateString('pt-PT'))}</small></div><span class="invite-actions"><button type="button" class="button small" data-action="invite-resend" data-id="${esc(x.id)}">Reenviar</button><button type="button" class="icon-btn" data-action="invite-cancel" data-id="${esc(x.id)}" aria-label="Cancelar o convite de ${esc(x.email)}">×</button></span></li>`).join('')}</ul></div>`;
}
modalRenderers['invite']=holder=>{
 const done=modal.result;
 if(done){const r=done;holder.innerHTML=modalShell({title:r.mailed?'Convite enviado':'Convite criado',sub:r.mailed?`Enviámos um email para ${r.invite.email} com as instruções.`:(r.mailError?`O email não seguiu: ${r.mailError}`:'O envio de email não está configurado.')+' Partilha a ligação abaixo com a pessoa.',body:`<div class="field"><label>Ligação do convite</label><pre class="code-block invite-link">${esc(r.link)}</pre><small class="field-help">Válida durante 7 dias. Quem a abrir escolhe a palavra-passe e entra como ${esc(r.invite.roleLabel.toLowerCase())}.</small></div><div class="modal-actions"><button type="button" class="button" data-action="invite-copy">${ico('copy')} Copiar ligação</button><button type="button" class="button primary" data-action="close">Concluído</button></div>`});return;}
 holder.innerHTML=modalShell({title:'Convidar por email',sub:'A pessoa recebe um email com uma ligação para criar a conta e escolher a palavra-passe.',body:`<form id="invite-form"><div class="field"><label for="inv-email">Email</label><input id="inv-email" name="email" type="email" required autocapitalize="none" spellcheck="false" placeholder="nome@exemplo.pt"/></div><div class="field"><label for="inv-name">Nome (opcional)</label><input id="inv-name" name="name" maxlength="80" placeholder="Para personalizar o email"/></div><div class="field"><label for="inv-role">Perfil</label><select id="inv-role" name="role">${option('resident','Morador','resident')}${option('manager','Gestor da casa','resident')}${option('collaborator','Colaborador','resident')}</select><small class="field-help">Podes mudar o perfil mais tarde em Pessoas.</small></div><div class="modal-actions"><button class="button" type="button" data-action="close">Cancelar</button><button class="button primary" type="submit">${ico('mail')} Enviar convite</button></div></form>`});
 holder.querySelector('#invite-form').addEventListener('submit',async e=>{e.preventDefault();const b=e.target.querySelector('[type=submit]');b.disabled=true;
  try{const r=await api('/api/invites','POST',Object.fromEntries(new FormData(e.target)));invitesData={...invitesData,invites:r.invites};modal={type:'invite',result:r};render();}catch(err){toast(err.message);b.disabled=false;}});
 setTimeout(()=>holder.querySelector('#inv-email')?.focus(),50);
};
actionHandlers.push(async(name,el)=>{
 if(name==='invite-open'){modal={type:'invite'};render();return true;}
 if(name==='invite-copy'){const pre=document.querySelector('.invite-link');await copyText(pre?.textContent||'','Ligação copiada.',pre);return true;}
 if(name==='invite-resend'){el.disabled=true;try{const r=await api(`/api/invites/${el.dataset.id}/resend`,'POST',{});invitesData={...invitesData,invites:r.invites};modal={type:'invite',result:r};render();}catch(e){toast(e.message);el.disabled=false;}return true;}
 if(name==='invite-cancel'){if(!await confirmDialog({title:'Cancelar este convite?',message:'A ligação enviada deixa de funcionar.',confirmLabel:'Cancelar convite',cancelLabel:'Manter'}))return true;try{const r=await api(`/api/invites/${el.dataset.id}`,'DELETE');invitesData={...invitesData,invites:r.invites};render();toast('Convite cancelado.');}catch(e){toast(e.message);}return true;}
 return false;
});
// Página para quem recebe o convite: escolhe o nome e a palavra-passe e entra.
async function renderInvite(token){
 const shell=(inner)=>`<div class="auth-layout"><section class="auth-aside"><div class="brand brand-primary"><img class="brand-primary-logo" src="logo-primary-light.svg" alt="Daily Casa" /></div><div><h1>A casa em dia,<br/><em>todos os dias.</em></h1><p>Um espaço comum para organizar pendências, dividir tarefas e celebrar o que já está feito.</p></div><small>O teu espaço, os teus dados, o teu ritmo.</small></section><section class="auth-form"><div class="auth-inner"><img class="auth-mobile-logo" src="logo-primary-dark.svg" alt="Daily Casa" />${inner}</div></section></div>`;
 document.querySelector('meta[name=theme-color]')?.setAttribute('content','#17261E');
 let inv;try{inv=await api('/api/invites/'+encodeURIComponent(token));}catch(e){app.innerHTML=shell(`<div class="eyebrow">DAILY CASA · CONVITE</div><h2>Convite indisponível.</h2><p>${esc(e.message)}</p><a class="button primary auth-submit" href="./">${ico('login')}<span>Ir para o login</span></a>`);return;}
 app.innerHTML=shell(`<div class="eyebrow">DAILY CASA · CONVITE</div><h2>Cria a tua conta.</h2><p>${inv.invitedBy?`${esc(inv.invitedBy)} convidou-te`:'Foste convidado'} para a Daily Casa como <b>${esc(inv.roleLabel.toLowerCase())}</b>.</p><form id="invite-accept"><div class="field"><label for="ia-name">O teu nome</label><input id="ia-name" name="name" autocomplete="name" required minlength="2" value="${esc(inv.name)}" placeholder="Como queres ser identificado"/></div><div class="field"><label for="ia-email">Email</label><input id="ia-email" name="email" type="email" autocomplete="username" value="${esc(inv.email)}" readonly/></div><div class="field"><label for="ia-pass">Palavra-passe</label><input id="ia-pass" name="password" type="password" autocomplete="new-password" minlength="10" required placeholder="Mínimo de 10 caracteres"/></div><button class="button primary auth-submit" type="submit">${ico('check')}<span>Criar conta e entrar</span></button><div class="auth-message" id="auth-error"></div></form>`);
 const f=document.getElementById('invite-accept');(inv.name?f.querySelector('#ia-pass'):f.querySelector('#ia-name')).focus();
 f.addEventListener('submit',async e=>{e.preventDefault();const b=f.querySelector('[type=submit]');b.disabled=true;
  try{const v=Object.fromEntries(new FormData(f));await api('/api/invites/'+encodeURIComponent(token)+'/accept','POST',{name:v.name,password:v.password});location.replace(location.pathname);}
  catch(err){document.getElementById('auth-error').textContent=err.message;b.disabled=false;}});
}

/* 3.9.6 · Acesso por email: conta criada pelo administrador com palavra-passe temporária. */
function accessBlock(p,other,active){
 if(!isAdmin()||!other||!active||!p.mustChangePassword)return '';
 if(!p.email)return `<p class="access-note">Sem email: acrescenta-o em Editar para poderes enviar o acesso.</p>`;
 const when=d=>new Date(d).toLocaleString('pt-PT',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
 const valid=p.accessExpiresAt&&Date.parse(p.accessExpiresAt)>Date.now();
 return `<div class="access-row"><button class="button ${p.accessSentAt?'':'primary'}" type="button" data-action="person-access-email" data-id="${esc(p.id)}">${ico('mail')} ${p.accessSentAt?'Reenviar acesso por email':'Enviar acesso por email'}</button><p class="access-note">${p.accessSentAt?(valid?`Enviado a ${esc(when(p.accessSentAt))} · válido até ${esc(new Date(p.accessExpiresAt).toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'}))}.`:'A ligação enviada expirou. Envia outra.'):'A pessoa recebe uma ligação para escolher a palavra-passe, válida durante 7 dias.'}</p></div>`;}
actionHandlers.push(async(name,el)=>{if(name!=='person-access-email')return false;
 const p=people().find(x=>x.id===el.dataset.id);if(!p)return true;
 if(p.accessSentAt&&!await confirmDialog({title:'Enviar uma nova ligação?',message:`A ligação enviada antes a ${p.email} deixa de funcionar.`,confirmLabel:'Reenviar'}))return true;
 if(demo){toast(`Na demonstração não se enviam emails (seria enviado para ${p.email}).`);return true;}
 el.disabled=true;try{const r=await api('/api/people/'+encodeURIComponent(p.id)+'/access-email','POST',{});store.people=r.people;render();toast(`Email enviado para ${p.email}.`);}catch(e){toast(e.message);el.disabled=false;}return true;});
// Página aberta pela ligação do email: escolhe a palavra-passe definitiva e entra.
async function renderAccess(token){
 const shell=(inner)=>`<div class="auth-layout"><section class="auth-aside"><div class="brand brand-primary"><img class="brand-primary-logo" src="logo-primary-light.svg" alt="Daily Casa" /></div><div><h1>A casa em dia,<br/><em>todos os dias.</em></h1><p>Um espaço comum para organizar pendências, dividir tarefas e celebrar o que já está feito.</p></div><small>O teu espaço, os teus dados, o teu ritmo.</small></section><section class="auth-form"><div class="auth-inner"><img class="auth-mobile-logo" src="logo-primary-dark.svg" alt="Daily Casa" />${inner}</div></section></div>`;
 document.querySelector('meta[name=theme-color]')?.setAttribute('content','#17261E');
 let acc;try{acc=await api('/api/access/'+encodeURIComponent(token));}catch(e){app.innerHTML=shell(`<div class="eyebrow">DAILY CASA · ACESSO</div><h2>Ligação indisponível.</h2><p>${esc(e.message)}</p><a class="button primary auth-submit" href="./">${ico('login')}<span>Ir para o login</span></a>`);return;}
 const first=String(acc.name||'').split(' ')[0];
 app.innerHTML=shell(`<div class="eyebrow">DAILY CASA · ACESSO</div><h2>Olá, ${esc(first)}.</h2><p>Escolhe a palavra-passe que vais usar daqui em diante.</p><form id="access-accept"><div class="access-who">${avatarHtml({name:acc.name},'')}<span><b>${esc(acc.email)}</b><small>${esc(acc.roleLabel)}</small></span></div><input type="email" name="username" autocomplete="username" value="${esc(acc.email)}" hidden readonly/><div class="field"><label for="ac-pass">Nova palavra-passe</label><input id="ac-pass" name="password" type="password" autocomplete="new-password" minlength="10" required placeholder="Mínimo de 10 caracteres"/></div><div class="field"><label for="ac-pass2">Repetir palavra-passe</label><input id="ac-pass2" name="password2" type="password" autocomplete="new-password" minlength="10" required/></div><label class="remember-row"><input type="checkbox" name="remember" checked/><span class="remember-box" aria-hidden="true"></span><span>Manter sessão iniciada</span></label><button class="button primary auth-submit" type="submit">${ico('check')}<span>Guardar e entrar</span></button><div class="auth-message" id="auth-error"></div></form>`);
 const f=document.getElementById('access-accept');f.querySelector('#ac-pass').focus();
 f.addEventListener('submit',async e=>{e.preventDefault();const b=f.querySelector('[type=submit]');const v=Object.fromEntries(new FormData(f));
  if(v.password!==v.password2){document.getElementById('auth-error').textContent='As duas palavras-passe não são iguais.';return;}
  b.disabled=true;try{await api('/api/access/'+encodeURIComponent(token),'POST',{password:v.password,remember:!!v.remember});location.replace(location.pathname);}
  catch(err){document.getElementById('auth-error').textContent=err.message;b.disabled=false;}});
}

/* 3.6 · «Ver como» (administrador): esconde controlos e páginas para ver a app como gestor, morador ou colaborador.
   É só na interface deste dispositivo: os dados e as permissões no servidor continuam os do administrador. */
const VIEW_ROLES={manager:'Gestor',resident:'Morador',collaborator:'Colaborador'};
const viewAsGet=()=>{try{return sessionStorage.getItem('dc-view-as')||'';}catch{return '';}};
const viewAsSet=v=>{try{v?sessionStorage.setItem('dc-view-as',v):sessionStorage.removeItem('dc-view-as');}catch{}};
const realRole=()=>store.user?.realRole||store.user?.role;
function applyViewAs(){
 if(!store?.user)return;const v=viewAsGet();
 if(store.user.realRole){store.user.role=store.user.realRole;}
 if(!v||!VIEW_ROLES[v]||(store.user.realRole||store.user.role)!=='admin'){delete store.user.realRole;const self=(store.people||[]).find(p=>p.id===store.user.id);if(self&&self._realRole){self.role=self._realRole;delete self._realRole;}return;}
 store.user.realRole='admin';store.user.role=v;
 const self=(store.people||[]).find(p=>p.id===store.user.id);if(self){self._realRole=self._realRole||'admin';self.role=v;}
}
{const loadBefore=load;load=async function(...a){const r=await loadBefore.apply(this,a);applyViewAs();return r;};}
{const renderBefore=render;render=function(...a){applyViewAs();const r=renderBefore.apply(this,a);viewAsBanner();return r;};}
function viewAsBanner(){
 const v=store?.user?.realRole?store.user.role:'';let el=document.getElementById('viewas-banner');
 if(!v){el?.remove();return;}
 if(!el){el=document.createElement('div');el.id='viewas-banner';el.className='viewas-banner';el.setAttribute('role','status');document.body.appendChild(el);}
 el.innerHTML=`${ico('eye')}<span>A ver como <b>${esc(VIEW_ROLES[v]||v)}</b></span><button type="button" data-action="view-as" data-role="">Voltar</button>`;
}
function viewAsField(){
 if(realRole()!=='admin'||demo)return '';const cur=store.user.realRole?store.user.role:'';
 const opts=[['','Administrador'],['manager','Gestor'],['resident','Morador'],['collaborator','Colaborador']];
 return `<div class="viewas-field"><h3 class="notif-types-title">Ver como</h3><p class="appearance-state">Esconde os controlos e as páginas que esse perfil não vê, para veres a app como as outras pessoas. Os dados por trás continuam os teus e nada é alterado.</p><div class="seg-control seg-small viewas-seg" role="radiogroup" aria-label="Ver a app como">${opts.map(([k,l])=>`<button type="button" role="radio" aria-checked="${cur===k}" data-action="view-as" data-role="${k}">${l}</button>`).join('')}</div></div>`;
}
actionHandlers.push(async(name,el)=>{
 if(name!=='view-as')return false;const v=el.dataset.role||'';viewAsSet(v);
 if(!v&&store.user?.realRole){store.user.role=store.user.realRole;delete store.user.realRole;}
 modal=null;page='today';render();window.scrollTo(0,0);toast(v?`A ver a app como ${VIEW_ROLES[v].toLowerCase()}.`:'De volta ao modo de administrador.');return true;
});

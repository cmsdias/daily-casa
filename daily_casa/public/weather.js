'use strict';
/* 3.11 · Meteorologia da casa no ecrã Hoje: tempo agora, próximos dias, dica ligada às tarefas e definições.
   Os dados vêm do servidor (IPMA ou Home Assistant), que os atualiza de hora a hora. */
const WX_WD=['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
const WX_WD_SHORT=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const wxKind=t=>{t=Number(t)||0;if(t===1)return 'sun';if(t===2||t===3||t===25)return 'partly';if([6,7,8,9,10,11,12,13,14,15].includes(t))return 'rain';if([19,20,23].includes(t))return 'storm';if([16,17,26].includes(t))return 'fog';if([18,21,22,28,29,30].includes(t))return 'snow';return t?'cloud':'cloud';};
const wxRainy=d=>d&&(d.prob>=60||['rain','storm'].includes(wxKind(d.type)));
function wxIcon(type,size=48){
 const k=wxKind(type);const sun='<circle cx="24" cy="24" r="10" fill="#C9A568"/>';
 const cloud='<path d="M20 46h26a10 10 0 0 0 0-20 13 13 0 0 0-25 3 8.5 8.5 0 0 0-1 17z" fill="#DCE3DE" stroke="#8FA79A" stroke-width="2"/>';
 const body={sun:'<circle cx="32" cy="32" r="12" fill="#C9A568"/><g stroke="#C9A568" stroke-width="3" stroke-linecap="round"><path d="M32 8v6M32 50v6M8 32h6M50 32h6M15 15l4 4M45 45l4 4M15 49l4-4M45 19l4-4"/></g>',
  partly:sun+cloud,cloud:cloud,rain:cloud+'<path d="M26 52l-2 5M35 52l-2 5M44 52l-2 5" stroke="#4F7A93" stroke-width="2.5" stroke-linecap="round"/>',
  storm:cloud+'<path d="M34 48l-5 8h6l-4 7" fill="none" stroke="#C9A568" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  fog:cloud+'<path d="M16 52h32M20 58h24" stroke="#8FA79A" stroke-width="2.5" stroke-linecap="round"/>',
  snow:cloud+'<g fill="#8FA79A"><circle cx="26" cy="54" r="2"/><circle cx="35" cy="57" r="2"/><circle cx="44" cy="54" r="2"/></g>'}[k];
 return `<svg class="wx-ico" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">${body}</svg>`;
}
// Tarefas de exterior (pelo título ou pela divisão) e de rega, ainda por fazer e com data nos próximos dias.
const WX_OUT_RE=/jardim|terra[çc]o|alpendre|varanda|quintal|exterior|caleir|relva|piscina|estendal|lavar (o )?carro|vidros|janelas por fora|fachada|telhado|pátio|patio/i;
const WX_WATER_RE=/\breg(a|ar|as)\b/i;
function wxTip(days){
 const t0=today();const end=CasaCore.addDays(t0,5);
 const open=tasks().filter(t=>t.status!=='done'&&t.visibility!=='private'&&(!t.dueDate||t.dueDate<=end));
 const water=open.filter(t=>WX_WATER_RE.test(t.title));
 const outdoor=open.filter(t=>!WX_WATER_RE.test(t.title)&&(WX_OUT_RE.test(t.title)||WX_OUT_RE.test(t.room||''))).sort((a,b)=>(a.dueDate||'9').localeCompare(b.dueDate||'9'));
 const wd=iso=>WX_WD[new Date(iso+'T12:00:00Z').getUTCDay()];
 if(wxRainy(days[0])||wxRainy(days[1])){
  let i=wxRainy(days[0])?0:1;let last=i;while(wxRainy(days[last+1]))last++;
  const dry=days.slice(last+1).find(d=>d.prob<40&&!wxRainy(d));
  const head=last===0?'Chuva hoje.':last===1&&i===1?'Chuva amanhã.':last===1?'Chuva hoje e amanhã.':`Chuva até ${wd(days[last].date)}.`;
  const parts=[];if(water.length)parts.push('A rega pode esperar.');
  if(outdoor.length&&dry)parts.push(`«${outdoor[0].title}» fica melhor para ${dry.date===CasaCore.addDays(t0,1)?'amanhã':wd(dry.date)}.`);
  else if(!water.length)parts.push('Bom momento para tarefas dentro de casa.');
  return {kind:'rain',head,text:parts.join(' ')};
 }
 if(days[0]&&days[0].tMax>=30)return {kind:'hot',head:'Dia quente.',text:water.length?'Rega ao fim do dia, quando o sol já não aperta.':'Fecha as persianas nas horas de mais sol.'};
 if(days.slice(0,2).some(d=>d.tMin<=2))return {kind:'cold',head:'Risco de geada.',text:'Protege os vasos mais sensíveis e evita regar ao fim do dia.'};
 if(outdoor.length&&days[0]&&days[0].prob<30)return {kind:'sun',head:'Bom tempo lá fora.',text:`Boa altura para «${outdoor[0].title}».`};
 return null;
}
function weatherCard(){
 const w=store.weather;const u=me();if(!w||u?.hideWeather)return '';
 const gear=`<button type="button" class="wx-gear" data-action="weather-settings" aria-label="Definições da meteorologia">${ico('settings')}</button>`;
 const d=w.data;
 if(!d||!d.days?.length)return `<section class="wx-card" aria-label="Meteorologia"><div class="wx-head"><span class="eyebrow">TEMPO EM CASA</span>${gear}</div><p class="wx-empty">${w.error?'A previsão não está disponível de momento. Tentamos de novo dentro de minutos.':'A obter a previsão…'}</p></section>`;
 const t0=today();const days=d.days.filter(x=>x.date>=t0);const day0=days[0]||d.days[0];
 const temp=d.now?.temp??day0.tMax;const type=d.now?.type??day0.type;const desc=d.now?.desc||day0.desc;
 const tip=w.settings.tips?wxTip(days):null;
 const updated=new Date(d.fetchedAt).toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'});
 const warn=(d.warnings||[])[0];
 return `<section class="wx-card" aria-label="Meteorologia">
  <div class="wx-head"><span class="eyebrow">TEMPO EM CASA${d.locationName?' · '+esc(d.locationName.toUpperCase()):''}</span>${gear}</div>
  <div class="wx-now">${wxIcon(type,52)}<span class="wx-temp">${esc(String(temp))}°</span><span class="wx-cond"><b>${esc(desc||'')}</b><small>Máx. ${day0.tMax}° · Mín. ${day0.tMin}°</small></span></div>
  <div class="wx-facts"><span>${ico('droplet')} ${day0.prob}% de chuva</span>${day0.windClass?`<span>${ico('wind')} Vento ${esc(day0.windClass)}${day0.windDir?' de '+esc(day0.windDir):''}</span>`:''}</div>
  ${warn?`<div class="wx-warn wx-${esc(warn.level)}"><b>Aviso ${({yellow:'amarelo',orange:'laranja',red:'vermelho'})[warn.level]||''}: ${esc(warn.type)}</b>${warn.text?`<span>${esc(warn.text)}</span>`:''}</div>`:''}
  ${tip?`<div class="wx-tip wx-tip-${tip.kind}"><b>${esc(tip.head)}</b> ${esc(tip.text)}</div>`:''}
  <div class="wx-days">${days.slice(0,5).map((x,i)=>`<div class="wx-day"><span>${i===0?'Hoje':WX_WD_SHORT[new Date(x.date+'T12:00:00Z').getUTCDay()]}</span>${wxIcon(x.type,26)}<b>${x.tMax}°</b><small>${x.tMin}°</small><em class="${x.prob>=40?'wet':''}">${x.prob}%</em></div>`).join('')}</div>
  <p class="wx-src">Fonte: ${d.source==='ha'?'Home Assistant':'IPMA'}${d.now?.station?' · '+esc(d.now.station):''} · atualizado às ${esc(updated)}${demo?' · valores de exemplo':''}</p>
 </section>`;
}

/* Definições */
modalRenderers['weather-settings']=holder=>{
 const w=store.weather||{settings:{}};const s=w.settings;const edit=w.canEdit;const hidden=!!me()?.hideWeather;
 const locs=modal.locations;
 const sw=(key,label,help,on)=>`<div class="pref-row notif-type-row"><div><span class="field-label" id="wx-${key}">${label}</span><small class="appearance-state">${help}</small></div><button type="button" class="switch" role="switch" aria-checked="${on}" aria-labelledby="wx-${key}" data-action="weather-toggle" data-key="${key}"><span></span></button></div>`;
 const body=`${edit?`<form id="weather-form">
  <div class="field"><label for="wx-source">Fonte da previsão</label><select id="wx-source" name="source">${option('ipma','IPMA',s.source)}${w.haAvailable||s.source==='ha'?option('ha','Previsão do Home Assistant',s.source):''}</select></div>
  <div class="field" data-wx="ipma" ${s.source==='ha'?'style="display:none"':''}><label for="wx-loc">Localização</label><select id="wx-loc" name="globalIdLocal">${locs?locs.map(l=>option(String(l.id),l.name,String(s.globalIdLocal||''))).join(''):`<option value="${esc(String(s.globalIdLocal||''))}">${esc(s.locationName||'A carregar…')}</option>`}</select><small class="field-help">Instituto Português do Mar e da Atmosfera: cidades com previsão. Por omissão, a mais próxima da casa definida no Home Assistant.${s.stationName?` Temperatura de agora: estação de ${esc(s.stationName)}.`:''}</small></div>
  <div class="field" data-wx="ha" ${s.source==='ha'?'':'style="display:none"'}><label for="wx-ent">Entidade de meteorologia</label><input id="wx-ent" name="haEntity" value="${esc(s.haEntity||'')}" placeholder="weather.forecast_home" autocomplete="off" spellcheck="false"/><small class="field-help">Usa a localização da casa definida no Home Assistant.</small></div>
  ${sw('tips','Dicas ligadas às tarefas','Rega, tarefas no jardim e no exterior',s.tips!==false)}
  ${sw('alerts','Avisos de tempo severo','Notificação com os avisos amarelos ou superiores do IPMA',!!s.alerts)}
  </form>`:''}
  ${sw('show','Mostrar no ecrã Hoje',edit?'Só para ti: as outras pessoas continuam a ver o cartão':'Só para ti',!hidden)}`;
 const foot=edit?`<div class="modal-actions"><span class="spacer"></span><button type="button" class="button" data-action="close">Cancelar</button><button type="submit" form="weather-form" class="button primary">${ico('check')} Guardar</button></div>`:'';
 holder.innerHTML=modalShell({title:'Meteorologia',sub:edit?'Estas definições valem para toda a casa.':'',body:body+foot,cls:'weather-modal'});
 const f=holder.querySelector('#weather-form');
 if(f){f.elements.source.addEventListener('change',()=>{const ha=f.elements.source.value==='ha';f.querySelector('[data-wx=ipma]').style.display=ha?'none':'';f.querySelector('[data-wx=ha]').style.display=ha?'':'none';});
  f.addEventListener('submit',async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(f));const btn=holder.querySelector('[type=submit]');btn.disabled=true;
   const body={source:v.source,tips:holder.querySelector('[data-key=tips]').getAttribute('aria-checked')==='true',alerts:holder.querySelector('[data-key=alerts]').getAttribute('aria-checked')==='true'};
   if(v.source==='ha')body.haEntity=v.haEntity||'';else if(v.globalIdLocal)body.globalIdLocal=Number(v.globalIdLocal);
   try{const r=await api('/api/weather','PATCH',body);store.weather=r.weather;modal=null;render();toast('Definições da meteorologia guardadas.');}catch(err){toast(err.message);btn.disabled=false;}});
  if(!locs&&!demo)api('/api/weather/locations').then(r=>{if(modal?.type==='weather-settings'){modal.locations=r.locations;const sel=holder.querySelector('#wx-loc');if(sel)sel.innerHTML=r.locations.map(l=>option(String(l.id),l.name,String(s.globalIdLocal||''))).join('');}}).catch(()=>{});
 }
};
actionHandlers.push(async(name,el)=>{
 if(name==='weather-settings'){modal={type:'weather-settings',locations:demo?WX_DEMO_LOCS:null};renderModal();return true;}
 if(name!=='weather-toggle')return false;
 const key=el.dataset.key;const on=el.getAttribute('aria-checked')!=='true';el.setAttribute('aria-checked',String(on));
 if(key==='show'){try{await api('/api/me','PATCH',{hideWeather:!on});const u=me();if(u)u.hideWeather=!on;render();toast(on?'O cartão do tempo volta a aparecer no ecrã Hoje.':'Cartão do tempo escondido. Podes voltar a mostrá-lo no teu perfil.');}catch(e){toast(e.message);el.setAttribute('aria-checked',String(!on));}}
 return true;
});
// Perfil: voltar a mostrar o cartão escondido.
function weatherProfileField(){if(!store.weather||!me()?.hideWeather)return '';return `<div class="pref-row notif-type-row"><div><span class="field-label" id="wx-show-p">Tempo no ecrã Hoje</span><small class="appearance-state">Escondido</small></div><button type="button" class="switch" role="switch" aria-checked="false" aria-labelledby="wx-show-p" data-action="weather-toggle" data-key="show"><span></span></button></div>`;}

/* Demonstração: valores de exemplo, sem ligação ao IPMA. */
const WX_DEMO_LOCS=[{id:1010500,name:'Aveiro'},{id:1030300,name:'Braga'},{id:1060300,name:'Coimbra'},{id:1080500,name:'Faro'},{id:1110600,name:'Lisboa'},{id:1131200,name:'Porto'},{id:1182300,name:'Viana do Castelo'}];
function demoWeather(){const t0=today();const ex=[[16,10,70,7],[15,11,80,9],[14,10,60,6],[17,9,10,3],[18,9,0,1]];
 return {settings:{source:'ipma',globalIdLocal:1131200,locationName:'Porto',stationName:'Porto, Serra do Pilar',tips:true,alerts:false},canEdit:true,haAvailable:false,error:null,
  data:{source:'ipma',locationName:'Porto',fetchedAt:new Date().toISOString(),now:{temp:14,at:new Date().toISOString(),station:'Porto, Serra do Pilar'},warnings:[],
   days:ex.map(([mx,mn,p,ty],i)=>({date:CasaCore.addDays(t0,i),tMax:mx,tMin:mn,prob:p,type:ty,desc:{1:'Céu limpo',3:'Céu parcialmente nublado',6:'Aguaceiros',7:'Aguaceiros fracos',9:'Chuva'}[ty],windDir:'SO',windClass:i<2?'moderado':'fraco'}))}};}
demoHandlers.push((p,method,b)=>{
 if(p==='/api/weather/locations')return {locations:WX_DEMO_LOCS};
 if(p==='/api/weather'&&method==='PATCH'){const w=store.weather||demoWeather();Object.assign(w.settings,{tips:!!b.tips,alerts:!!b.alerts});if(b.globalIdLocal){const l=WX_DEMO_LOCS.find(x=>x.id===b.globalIdLocal);if(l){w.settings.globalIdLocal=l.id;w.settings.locationName=w.data.locationName=l.name;}}store.weather=w;return {weather:w};}
 if(p==='/api/me'&&method==='PATCH'&&'hideWeather'in b){const u=me();if(u)u.hideWeather=!!b.hideWeather;if(Object.keys(b).length===1)return {ok:true};}
 return undefined;
});

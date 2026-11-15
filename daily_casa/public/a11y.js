// 3.20 · Acessibilidade com teclado (auditoria UI/UX).
// 1. «Saltar para o conteúdo»: primeira paragem do Tab, leva o foco para a área principal.
// 2. Foco preso no diálogo aberto: o Tab não sai para trás do modal.
// 3. Ao fechar um diálogo, o foco volta ao botão que o abriu (ou ao equivalente, se a página foi redesenhada).
// Não muda nada para quem usa toque.
(function(){
 'use strict';
 const DIALOG='[role="dialog"][aria-modal="true"]';
 const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
 const visible=el=>!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length)&&getComputedStyle(el).visibility!=='hidden';
 const openDialog=()=>{const all=[...document.querySelectorAll(DIALOG)].filter(visible);return all[all.length-1]||null;};

 // 1. Saltar para o conteúdo
 function addSkip(){
  if(document.querySelector('.skip-link'))return;
  const a=document.createElement('a');a.className='skip-link';a.href='#conteudo';a.textContent='Saltar para o conteúdo';
  a.addEventListener('click',e=>{const main=document.querySelector('main.main');if(!main)return;e.preventDefault();main.setAttribute('tabindex','-1');main.focus({preventScroll:false});});
  document.body.insertBefore(a,document.body.firstChild);
 }
 if(document.body)addSkip();else document.addEventListener('DOMContentLoaded',addSkip);

 // 2. Foco preso no diálogo (os de confirmação já tratam disto sozinhos)
 document.addEventListener('keydown',e=>{
  if(e.key!=='Tab'||document.querySelector('[role="alertdialog"]'))return;
  const d=openDialog();if(!d)return;
  const items=[...d.querySelectorAll(FOCUSABLE)].filter(visible);if(!items.length)return;
  const first=items[0],last=items[items.length-1],cur=document.activeElement;
  if(!d.contains(cur)){e.preventDefault();(e.shiftKey?last:first).focus();return;}
  if(e.shiftKey&&cur===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&cur===last){e.preventDefault();first.focus();}
 },true);

 // 3. Devolver o foco
 let trigger=null,wasOpen=false;
 const describe=el=>{const a=el.closest('[data-action],[data-page],button,a');if(!a)return null;const parts=[];
  for(const k of ['action','id','page','kind','view','tab'])if(a.dataset[k]!==undefined)parts.push(`[data-${k}="${CSS.escape(a.dataset[k])}"]`);
  return parts.length?a.tagName.toLowerCase()+parts.join(''):null;};
 const remember=e=>{const t=e.target;if(!(t instanceof Element)||t.closest(DIALOG+',[role="alertdialog"]'))return;
  const el=t.closest(FOCUSABLE)||t;trigger={el,sel:describe(el)};};
 document.addEventListener('pointerdown',remember,true);
 document.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')remember(e);},true);

 const check=()=>{
  const open=!!openDialog();
  if(wasOpen&&!open&&trigger){
   const act=document.activeElement;
   if(!act||act===document.body||!act.isConnected){
    let el=trigger.el&&trigger.el.isConnected?trigger.el:(trigger.sel?document.querySelector(trigger.sel):null);
    if(el&&visible(el)){try{el.focus({preventScroll:true});}catch(_){}}
   }
  }
  wasOpen=open;
 };
 let queued=false;
 const mo=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;check();});});
 const start=()=>mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});
 if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
})();

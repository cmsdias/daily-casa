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
  for(const [key,msg] of pending){const el=document.querySelector(key);if(!el){pending.delete(key);continue;}if(!el.dataset.errId)window.fieldError(el,msg,true);}
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
 // 4. Erros junto ao campo (3.21): o campo fica marcado, a mensagem aparece por baixo e o cursor volta ao campo.
 //    Uso: return fieldError(input,'Mensagem.'); — devolve undefined, para substituir «return toast(...)».
 const ERR_ICO='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></svg>';
 let errSeq=0;
 function clearFieldError(el){if(!el)return;el.classList.remove('is-invalid');el.removeAttribute('aria-invalid');const id=el.dataset.errId;if(id){document.getElementById(id)?.remove();delete el.dataset.errId;
   const d=(el.getAttribute('aria-describedby')||'').split(' ').filter(x=>x&&x!==id).join(' ');if(d)el.setAttribute('aria-describedby',d);else el.removeAttribute('aria-describedby');}}
 window.clearFieldError=clearFieldError;
 // A página pode ser redesenhada em segundo plano (atualizações, sincronização): o erro volta a ser posto no campo novo.
 const pending=new Map();
 const keyOf=el=>el.form&&el.form.id&&el.name?`#${CSS.escape(el.form.id)} [name="${CSS.escape(el.name)}"]`:(el.id&&!/^casa-field-/.test(el.id)?'#'+CSS.escape(el.id):null);
 window.fieldError=function(el,msg,quiet){
  if(!el){if(typeof toast==='function')toast(msg);return;}
  clearFieldError(el);const key=keyOf(el);if(key)pending.set(key,msg);
  const box=el.matches('input,select,textarea')?el:(el.querySelector('input,select,textarea')||el);
  const id='ferr-'+(++errSeq);const p=document.createElement('p');p.className='field-error';p.id=id;p.setAttribute('role','alert');p.innerHTML=ERR_ICO+'<span></span>';p.lastChild.textContent=msg;
  const quick=el.closest('.shop-quick'),field=el.closest('.field'),label=el.closest('label');
  if(quick)quick.appendChild(p);else if(field)field.appendChild(p);else (label||el).after(p);
  el.classList.add('is-invalid');box.setAttribute('aria-invalid','true');el.dataset.errId=id;if(box!==el)box.dataset.errId=id;
  box.setAttribute('aria-describedby',((box.getAttribute('aria-describedby')||'')+' '+id).trim());
  if(!quiet){try{box.focus({preventScroll:true});box.scrollIntoView({block:'center',behavior:'smooth'});}catch(_){}}
  const snap=()=>box.type==='checkbox'||box.type==='radio'?box.checked:box.value;const v0=snap();
  const off=ev=>{if(ev&&ev.target===box&&snap()===v0)return;if(key)pending.delete(key);clearFieldError(el);if(box!==el)clearFieldError(box);box.removeEventListener('input',off);box.removeEventListener('change',off);el.removeEventListener('change',off);};
  box.addEventListener('input',off);box.addEventListener('change',off);if(box!==el)el.addEventListener('change',off);
 };
 // Campos obrigatórios e formatos: a validação do navegador passa a mostrar o erro da app, junto ao campo.
 const nativeMsg=el=>{const v=el.validity;if(el.dataset.error)return el.dataset.error;
  if(v.valueMissing)return el.type==='checkbox'?'Assinala esta opção para continuar.':'Preenche este campo.';
  if(v.typeMismatch)return el.type==='email'?'Escreve um email válido, por exemplo nome@exemplo.pt.':el.type==='url'?'Escreve um endereço completo, a começar por https://':'Valor inválido.';
  if(v.tooShort)return `Usa pelo menos ${el.minLength} caracteres.`;
  if(v.rangeUnderflow)return `O valor mínimo é ${el.min}.`;if(v.rangeOverflow)return `O valor máximo é ${el.max}.`;
  if(v.patternMismatch)return el.title||'O formato não está certo.';return el.validationMessage||'Verifica este campo.';};
 let firstInvalidForm=null;
 document.addEventListener('invalid',e=>{const el=e.target;if(!(el instanceof HTMLElement))return;e.preventDefault();
  const form=el.form;if(form&&firstInvalidForm===form)return;firstInvalidForm=form;setTimeout(()=>{firstInvalidForm=null;},0);
  window.fieldError(el,nativeMsg(el));},true);

 let queued=false;
 const mo=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;check();});});
 const start=()=>mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});
 if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
})();

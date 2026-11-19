import {CHECKS,GUIDES,STORAGE_KEY,today,newInspection,invalidate,setCheck,addIncident,resolveIncident,getStatus,verify,restore,serialize,snapshot} from './model.mjs';
import {createCloudSync} from './cloud-client.mjs';

const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={pending:'Pendiente',blocked:'Bloqueado',review:'Por validar',ready:'Validada'};
const dateTime=value=>new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
const CACHE_KEY='imad-cnc-cloud-cache-v1',PENDING_KEY='imad-cnc-cloud-pending-v1',LEGACY_KEY='imad-cnc-before-cloud-v1',CONFLICT_KEY='imad-cnc-conflict-copy-v1';
let legacy=null,recoveredPending=null,pendingRecovery=false;
try{
  const original=localStorage.getItem(LEGACY_KEY)||localStorage.getItem(STORAGE_KEY);
  if(original){legacy=restore(original);if(!localStorage.getItem(LEGACY_KEY))localStorage.setItem(LEGACY_KEY,original);}
  const raw=localStorage.getItem(PENDING_KEY);if(raw){const candidate=JSON.parse(raw);if(candidate?.data?.current&&Number.isInteger(candidate.revision)){recoveredPending=candidate;pendingRecovery=true;}}
}catch{$('storageWarning').hidden=false;}
let current=newInspection(),history=[],selectedGuide='rebaba',currentView='checklist',dialogAction=null,toastTimer;
let sync,cloudState={ready:false,dirty:false,saving:false,conflict:false,error:'',revision:0};

function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
function data(){return JSON.parse(serialize(current,history));}
function cachePending(){try{localStorage.setItem(CACHE_KEY,serialize(current,history));localStorage.setItem(PENDING_KEY,JSON.stringify({revision:sync.state.revision,data:data()}));$('storageWarning').hidden=true;}catch{$('storageWarning').hidden=false;}}
function save(){cachePending();sync.changed();}
function archive(){const copy=snapshot(current);if(JSON.stringify(history.at(-1))!==JSON.stringify(copy))history.push(copy);history=history.slice(-50);}
function hasContent(){return current.operator||current.ot||current.notes||current.incidents.length||Object.values(current.checks).some(c=>c.value!=='pending'||c.note);}
function renderStatus(){
  const s=getStatus(current);
  $('okCount').textContent=s.ok;$('alarmCount').textContent=s.active;$('navAlarms').textContent=s.active;$('navProgress').textContent=`${s.ok}/${s.total}`;$('progressBar').style.width=`${s.ok/s.total*100}%`;
  $('alarmStatText').textContent=s.active?'Requieren intervención y comprobación':'Sin incidencias abiertas registradas';
  $('statusStat').textContent=labels[s.code];$('statusStatText').textContent={pending:'Completa los requisitos pendientes',blocked:'Resuelve las anomalías antes del uso',review:'Lista para registrar tu validación',ready:'Revisión confirmada por el operador'}[s.code];
  $('finalTitle').textContent={pending:'Revisión pendiente',blocked:'No operar: bloqueado',review:'Lista para validar',ready:'Revisión validada'}[s.code];
  $('finalDescription').textContent={pending:'Completa los requisitos antes de validar el estado previo al uso.',blocked:'Hay una condición pendiente de corregir. Consulta las acciones y registra su comprobación.',review:'Todos los puntos están conformes y no hay incidencias abiertas. Confirma el resultado de tu revisión.',ready:'Se registró una revisión conforme. Inicia una nueva revisión antes de otro turno o reinicio.'}[s.code];
  const icon={pending:'◷',blocked:'!',review:'✓',ready:'✓'}[s.code];$('statusEmblem').textContent=icon;$('statusIcon').textContent=icon;
  const card=$('finalTitle').closest('.final-card');card.className=`card final-card status-${s.code}`;
  document.querySelector('.stat-total').textContent=`/ ${s.total}`;
  $('statusReasons').innerHTML=s.reasons.length?`<ul>${s.reasons.map(r=>`<li>${escape(r)}</li>`).join('')}</ul>`:`<span class="green-text">${s.total} de ${s.total} puntos conformes · Sin incidencias abiertas</span>`;
  $('alarmReviewed').checked=current.alarmReviewed;$('alarmReviewed').disabled=s.active>0;
  $('validateButton').disabled=!s.eligible||s.code==='ready'||!cloudState.ready||cloudState.dirty||cloudState.saving||cloudState.conflict||pendingRecovery;
  $('validateButton').textContent=s.code==='ready'?'✓ Revisión validada':'Validar revisión';
  if(s.code==='ready'&&(cloudState.dirty||cloudState.saving))$('finalTitle').textContent='Validación pendiente de guardar';
  $('verifiedDetail').hidden=s.code!=='ready';$('verifiedDetail').textContent=current.verifiedAt?`${current.operator} · ${dateTime(current.verifiedAt)}`:'';
  $('inspectionDate').textContent=`Fecha de revisión: ${current.date.split('-').reverse().join('/')} · Iniciada ${dateTime(current.startedAt)}${current.date!==today()?' · Vencida: inicia una nueva revisión':''}`;
}
function renderChecklist(){
  const groups=[...new Set(CHECKS.map(c=>c.group))];
  $('checklistGroups').innerHTML=groups.map(group=>{
    const items=CHECKS.filter(c=>c.group===group);const ok=items.filter(c=>current.checks[c.id]?.value==='ok').length;
    return `<div class="group-heading"><span>${escape(group)}</span><span>${ok} / ${items.length}</span></div>${items.map(c=>{
      const entry=current.checks[c.id]||{value:'pending',note:''};
      return `<article class="check-item ${entry.value==='fault'?'fault':''}" data-check="${c.id}"><div class="check-main"><span class="check-index">${String(CHECKS.indexOf(c)+1).padStart(2,'0')}</span><div class="check-copy"><h3>${escape(c.title)}</h3><p>${escape(c.detail)}</p><span class="source">${escape(c.source)}</span><div class="check-state" role="group" aria-label="Estado: ${escape(c.title)}">${[['ok','✓ Conforme'],['fault','! Anomalía'],['pending','Pendiente']].map(([v,t])=>`<button class="choice" data-check-id="${c.id}" data-value="${v}" aria-pressed="${entry.value===v}">${t}</button>`).join('')}</div><details class="check-note" ${entry.note?'open':''}><summary>${entry.note?'Ver observación':'Añadir observación'}</summary><label for="note-${c.id}">Observación del punto</label><textarea id="note-${c.id}" data-note-id="${c.id}" maxlength="2000" rows="2" placeholder="Hallazgo, pendiente o acción realizada…">${escape(entry.note)}</textarea></details></div></div></article>`;
    }).join('')}`;
  }).join('');
}
function renderGuides(){
  const term=$('alarmSearch').value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
  const matches=GUIDES.filter(g=>`${g.name} ${g.system} ${g.cause}`.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().includes(term));
  $('guideList').innerHTML=matches.length?matches.map(g=>`<button class="guide-option ${g.id===selectedGuide?'active':''}" data-guide-id="${g.id}" aria-pressed="${g.id===selectedGuide}">${escape(g.name)}<span>${escape(g.system)}</span></button>`).join(''):'<div class="empty-state"><h3>Sin coincidencias</h3><p>Registra el mensaje como una alarma no documentada.</p><button class="button secondary compact" data-guide-id="otra" style="margin-top:15px">Otra alarma</button></div>';
  const guide=GUIDES.find(g=>g.id===selectedGuide);
  $('guideDetail').innerHTML=`<span class="pill ${guide.unknown?'unknown':''}">${guide.unknown?'Derivar a mantenimiento':'Incidencia documentada · Manual p. 28'}</span><h2>${escape(guide.name)}</h2><p class="cause"><strong>${guide.unknown?'Estado del procedimiento':'Posible causa'}</strong>${escape(guide.cause)}</p><h3>Acciones a consultar</h3><ol class="action-steps">${guide.actions.map(a=>`<li>${escape(a)}</li>`).join('')}</ol><p class="small-note">${guide.unknown?'Conserva el texto exacto. Esta guía no prescribe un reset ni una reparación.':'Aplicar ajustes e intervenciones con personal autorizado y el procedimiento validado de planta. La desaparición del mensaje por sí sola no comprueba la solución.'}</p><button class="button primary" id="registerIncident">＋ Registrar esta incidencia</button>`;
}
function renderIncidents(){
  $('incidentList').innerHTML=current.incidents.length?current.incidents.slice().reverse().map(i=>{
    const g=GUIDES.find(g=>g.id===i.guideId);
    return `<article class="incident-row ${i.resolvedAt?'resolved':''}"><div class="incident-content"><h3>${escape(i.text)}</h3><span class="pill ${i.resolvedAt?'':'unknown'}">${i.resolvedAt?'Resuelta y comprobada':'Abierta · Bloquea revisión'}</span><p>${escape(g.name)}${i.context?` · ${escape(i.context)}`:''}</p><span class="timestamp">Registrada ${dateTime(i.createdAt)}</span>${i.resolvedAt?`<p><strong>${escape(i.responsible)}</strong> · ${dateTime(i.resolvedAt)}<br>${escape(i.resolution)}</p>`:''}</div>${!i.resolvedAt?`<button class="button secondary compact" data-resolve-id="${escape(i.id)}">Registrar solución</button>`:''}</article>`;
  }).join(''):'<div class="empty-state"><span class="empty-icon">✓</span><h3>No hay incidencias registradas</h3><p>Consulta las acciones y registra cualquier anomalía que encuentres en el equipo.</p></div>';
}
function renderHistory(){
  $('exportHistory').disabled=!history.length&&!hasContent();
  $('historyList').innerHTML=history.length?history.slice().reverse().map((r,i)=>{
    const s=getStatus(r,new Date(r.verifiedAt||r.startedAt));
    return `<article class="history-row"><div><strong>${escape(r.date.split('-').reverse().join('/'))}</strong><small>${escape(r.shift)} · ${dateTime(r.verifiedAt||r.startedAt)}</small></div><div class="history-operator">${escape(r.operator||'Sin operador')}<small>${s.ok}/${s.total} conformes</small></div><div class="history-ot">${escape(r.ot||'Sin OT')}<small>${r.incidents.length} incidencias registradas</small></div><button class="button secondary compact" data-history-index="${history.length-1-i}">Ver registro</button></article>`;
  }).join(''):'<div class="empty-state"><span class="empty-icon">↺</span><h3>Tu primera revisión empieza aquí</h3><p>Valida una revisión o inicia una nueva para conservarla en el historial compartido.</p></div>';
}
function showView(view){
  if(!['checklist','alarms','history','guide'].includes(view)) view='checklist';
  currentView=view;document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==`view-${view}`);
  document.querySelectorAll('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);if(el.dataset.view===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  const config={checklist:['Revisión previa','Revisa. Confirma. Opera.','Una revisión completa antes de cada inicio de turno.'],alarms:['Alarmas e incidencias','Identifica y responde.','Consulta las acciones y registra la intervención antes de continuar.'],history:['Historial','Cada revisión, registrada.','Consulta los resultados de revisiones anteriores.'],guide:['Guía de uso','Un criterio claro antes del uso.','Cómo revisar, responder a incidencias y validar el resultado.']}[view];
  [$('pageCrumb'),$('pageTitle'),$('pageSubtitle')].forEach((el,i)=>el.textContent=config[i]);
  if(view==='history')renderHistory();if(view==='alarms'){renderGuides();renderIncidents();}
  if(location.hash!==`#${view}`)historyReplace(view);
}
function historyReplace(view){window.history.replaceState(null,'',`#${view}`);}
function fillMeta(){for(const id of ['operator','ot','shift','notes'])$(id).value=current[id];}
function renderAll(){fillMeta();renderChecklist();renderStatus();renderGuides();renderIncidents();renderHistory();}
function openDialog(title,content,confirm,action){$('dialogTitle').textContent=title;$('dialogContent').innerHTML=content;$('confirmDialog').textContent=confirm;$('cancelDialog').hidden=!action;$('confirmDialog').hidden=!action;$('dialogError').hidden=true;dialogAction=action;$('actionDialog').showModal();}
function closeDialog(){$('actionDialog').close();dialogAction=null;}

document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>showView(el.dataset.view)));
window.addEventListener('hashchange',()=>showView(location.hash.slice(1)));
$('goAlarms').addEventListener('click',()=>{showView('alarms');window.scrollTo({top:0,behavior:'smooth'});});
for(const id of ['operator','ot','shift','notes'])$(id).addEventListener(id==='shift'?'change':'input',()=>{current[id]=$(id).value;invalidate(current);save();renderStatus();});
$('checklistGroups').addEventListener('click',event=>{
  const button=event.target.closest('[data-check-id]');if(!button)return;
  setCheck(current,button.dataset.checkId,button.dataset.value);save();renderChecklist();renderStatus();
  document.querySelector(`[data-check-id="${button.dataset.checkId}"][data-value="${button.dataset.value}"]`)?.focus({preventScroll:true});
});
$('checklistGroups').addEventListener('input',event=>{
  const id=event.target.dataset.noteId;if(!id)return;
  current.checks[id] ||= {value:'pending',note:''};current.checks[id].note=event.target.value;invalidate(current);save();renderStatus();
});
$('alarmReviewed').addEventListener('change',()=>{current.alarmReviewed=$('alarmReviewed').checked;invalidate(current);save();renderStatus();});
$('validateButton').addEventListener('click',()=>{
  try{verify(current);archive();save();renderStatus();renderHistory();toast('Validación registrada. Guardando en la nube privada…');sync.flush();}catch(e){toast(e.message);}
});
$('newInspection').addEventListener('click',()=>openDialog('Iniciar una nueva revisión',`<p>Se reiniciarán las verificaciones y la confirmación de alarmas. ${hasContent()?'La revisión actual quedará guardada en el historial compartido.':''}</p><p>Las incidencias abiertas se conservarán en la nueva revisión hasta registrar su solución.</p>`,'Iniciar revisión',()=>{
  const pending=current.incidents.filter(i=>!i.resolvedAt).map(snapshot);
  const operator=current.operator;
  if(hasContent())archive();current=newInspection();current.operator=operator;current.incidents=pending;save();renderAll();showView('checklist');closeDialog();toast('Nueva revisión iniciada. Verifica cada punto nuevamente.');
}));
$('alarmSearch').addEventListener('input',renderGuides);
$('guideList').addEventListener('click',event=>{const button=event.target.closest('[data-guide-id]');if(button){selectedGuide=button.dataset.guideId;renderGuides();}});
$('guideDetail').addEventListener('click',event=>{
  if(!event.target.closest('#registerIncident'))return;
  const g=GUIDES.find(x=>x.id===selectedGuide);
  openDialog('Registrar incidencia',`<p>${escape(g.name)}. Quedará abierta y bloqueará el estado previo al uso.</p><label>Texto o código exacto <span class="required">*</span><input name="alarmText" maxlength="500" required placeholder="Mensaje del equipo o descripción del síntoma"></label><label>Contexto de aparición<textarea name="alarmContext" maxlength="2000" rows="3" placeholder="Operación, material, momento y condición observada"></textarea></label>`,'Registrar incidencia',form=>{
    addIncident(current,{guideId:g.id,text:form.get('alarmText'),context:form.get('alarmContext')});save();renderStatus();renderIncidents();closeDialog();toast('Incidencia registrada. Revisión bloqueada hasta su solución.');
  });
});
$('incidentList').addEventListener('click',event=>{
  const button=event.target.closest('[data-resolve-id]');if(!button)return;
  const i=current.incidents.find(x=>x.id===button.dataset.resolveId);
  openDialog('Registrar solución comprobada',`<p><strong>${escape(i.text)}</strong><br>Completa solo después de la intervención y la comprobación de funcionamiento. Si persiste, conserva la incidencia abierta.</p><label>Responsable de la comprobación <span class="required">*</span><input name="responsible" maxlength="120" required placeholder="Nombre de operador autorizado o mantenimiento"></label><label>Acción realizada y resultado comprobado <span class="required">*</span><textarea name="resolution" rows="4" minlength="10" maxlength="2000" required placeholder="Qué se corrigió, cómo se comprobó y cuál fue el resultado"></textarea></label>`,'Cerrar como comprobada',form=>{
    resolveIncident(current,i.id,form.get('responsible'),form.get('resolution'));save();renderStatus();renderIncidents();closeDialog();toast('Incidencia cerrada. Revisa y confirma nuevamente las alarmas.');
  });
});
$('historyList').addEventListener('click',event=>{
  const button=event.target.closest('[data-history-index]');if(!button)return;
  const r=history[Number(button.dataset.historyIndex)];
  const status=getStatus(r,new Date(r.verifiedAt||r.startedAt));
  openDialog('Registro de revisión',`<div class="report-info"><div><small>Fecha</small>${escape(r.date)}</div><div><small>Resultado en ese momento</small>${escape(labels[status.code])}</div><div><small>Operador</small>${escape(r.operator||'Sin operador')}</div><div><small>OT / momento</small>${escape(r.ot||'Sin OT')} · ${escape(r.shift)}</div></div>${CHECKS.map(c=>`<div class="report-check"><div>${escape(c.title)}${r.checks[c.id]?.note?`<p>${escape(r.checks[c.id].note)}</p>`:''}</div><span class="check-result">${({ok:'Conforme',fault:'Anomalía',pending:'Pendiente'})[r.checks[c.id]?.value||'pending']}</span></div>`).join('')}<h3 style="margin-top:20px">Incidencias (${r.incidents.length})</h3>${r.incidents.map(i=>`<p class="report-note"><strong>${escape(i.text)}</strong> · ${i.resolvedAt?'Resuelta':'Abierta'}${i.context?`<br>${escape(i.context)}`:''}${i.resolution?`<br>${escape(i.responsible)}: ${escape(i.resolution)}`:''}</p>`).join('')}<h3 style="margin-top:20px">Observaciones</h3><p class="report-note">${escape(r.notes||'Sin observaciones')}</p>${r.verifiedAt?`<p>Validada ${dateTime(r.verifiedAt)}</p>`:'<p>Sin validación registrada</p>'}`,'',null);
});
$('exportHistory').addEventListener('click',()=>{
  const data=JSON.stringify({equipment:'Senfeng SF3015HM',exportedAt:new Date().toISOString(),current,history},null,2);
  const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`CNC-revisiones-${today()}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Copia de registros descargada.');
});
$('dialogForm').addEventListener('submit',event=>{event.preventDefault();if(!dialogAction)return;try{dialogAction(new FormData(event.currentTarget));}catch(e){$('dialogError').textContent=e.message;$('dialogError').hidden=false;}});
$('closeDialog').addEventListener('click',closeDialog);$('cancelDialog').addEventListener('click',closeDialog);
function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function renderCloud(state){
  cloudState=state;
  $('cloudEditor').disabled=!state.ready||state.conflict||pendingRecovery;
  $('newInspection').disabled=!state.ready||state.conflict||state.dirty||state.saving||pendingRecovery;
  $('importLegacy').disabled=!state.ready||state.conflict||state.dirty||state.saving||pendingRecovery;
  $('cloudBar').className=`cloud-bar ${state.conflict?'cloud-conflict':state.error||pendingRecovery?'cloud-error':''}`;
  $('retryCloud').hidden=!(state.error&&!state.conflict&&(!pendingRecovery||!state.ready));
  $('downloadPending').hidden=!(state.dirty||state.conflict||pendingRecovery);
  $('loadShared').hidden=!(state.conflict||pendingRecovery);
  $('recoverPending').hidden=!(pendingRecovery&&state.ready&&recoveredPending?.revision===state.revision);
  $('cloudSignIn').hidden=!state.error||(state.ready&&!/sesión|inicia/i.test(state.error));
  let title,detail;
  if(pendingRecovery){title='Hay cambios pendientes de una sesión anterior';detail=recoveredPending?.revision===state.revision?'Puedes recuperarlos o conservar una copia y cargar la versión compartida.':'La versión compartida cambió. Conserva una copia de los cambios pendientes antes de continuar.';}
  else if(state.conflict){title='Otra persona actualizó esta revisión';detail='Tus cambios están conservados en este navegador. Descarga una copia y carga la versión compartida para continuar.';}
  else if(state.error){title=state.dirty?'Cambios pendientes de sincronizar':'No se pudo conectar con la nube';detail=state.error;}
  else if(!state.ready){title='Conectando con el registro compartido…';detail='Espera a que se cargue la revisión antes de editar.';}
  else if(state.saving||state.dirty){title='Guardando cambios en la nube privada…';detail='Mantén esta página abierta hasta confirmar el guardado.';}
  else{title='Registro compartido · Sincronizado';detail=state.updatedAt?`Último guardado: ${dateTime(state.updatedAt)} · ${state.updatedBy}`:'Completa la primera revisión. Los cambios se guardarán automáticamente.';}
  $('cloudTitle').textContent=title;$('cloudDetail').textContent=detail;
  $('saveStatus').textContent=state.saving||state.dirty?'Guardado en curso':state.ready?'Guardado en la nube privada':'Conectando con la nube';
  renderStatus();
}
const urlParams = new URLSearchParams(window.location.search);
const detectedMachine = urlParams.get('machine');
let activeMachineId = detectedMachine ? detectedMachine.trim() : 'SF3015HM';

if (detectedMachine) {
  $('qrMachineBadge').hidden = false;
  $('qrMachineName').textContent = activeMachineId;
}

sync=createCloudSync({getData:data,getMachineId:()=>activeMachineId,onStatus:renderCloud,onIdentity:user=>{if(user)$('topDate').title=`Sesión de ${user.displayName}`;},onRemote:remote=>{
  ({current,history}=remote?restore(JSON.stringify(remote)):restore(null));
  try{localStorage.setItem(CACHE_KEY,serialize(current,history));}catch{$('storageWarning').hidden=false;}
  renderAll();
},onSaved:(result,unchanged)=>{
  try{if(unchanged)localStorage.removeItem(PENDING_KEY);else cachePending();}catch{$('storageWarning').hidden=false;}
  if(unchanged&&current.verifiedAt)toast('Revisión validada y guardada en la nube privada.');
}});
$('retryCloud').addEventListener('click',()=>sync.retry());
$('downloadPending').addEventListener('click',()=>download(pendingRecovery?recoveredPending:{revision:sync.state.revision,data:data()},`CNC-cambios-pendientes-${today()}.json`));
$('recoverPending').addEventListener('click',()=>{
  if(!recoveredPending||recoveredPending.revision!==sync.state.revision)return;
  ({current,history}=restore(JSON.stringify(recoveredPending.data)));pendingRecovery=false;recoveredPending=null;renderAll();save();sync.flush();
});
$('loadShared').addEventListener('click',()=>openDialog('Cargar la versión compartida',`<p>Se conservará una copia de los cambios pendientes en este navegador y se cargará el registro compartido más reciente. Usa <strong>Conservar copia</strong> si también quieres descargar el respaldo.</p>`,'Conservar y cargar',async()=>{
  try{localStorage.setItem(CONFLICT_KEY,JSON.stringify(pendingRecovery?recoveredPending:{revision:sync.state.revision,data:data()}));}catch{toast('No se pudo conservar la copia local. Descárgala antes de continuar.');return;}
  closeDialog();const ok=await sync.load({discard:true});if(ok){pendingRecovery=false;recoveredPending=null;try{localStorage.removeItem(PENDING_KEY);}catch{}renderCloud(sync.state);toast('Versión compartida cargada. La copia local anterior sigue conservada.');}
}));
$('legacyNote').hidden=!(legacy&&(legacy.history.length||legacy.current.operator||Object.keys(legacy.current.checks).length||legacy.current.incidents.length));
$('downloadLegacy').addEventListener('click',()=>download(legacy,`CNC-copia-anterior-${today()}.json`));
$('importLegacy').addEventListener('click',()=>openDialog('Conservar registros anteriores',`<p>Se añadirán las revisiones de la versión anterior al historial compartido. La revisión actual seguirá en curso. Se conservarán hasta 50 registros.</p><p>Si la copia anterior contiene incidencias abiertas, se incorporarán a la revisión actual y bloquearán la validación hasta su comprobación.</p>`,'Añadir al historial',()=>{
  for(const record of [...legacy.history,legacy.current]){if(!history.some(r=>JSON.stringify(r)===JSON.stringify(record)))history.push(snapshot(record));}
  history=history.slice(-50);
  for(const i of legacy.current.incidents.filter(i=>!i.resolvedAt)){if(!current.incidents.some(x=>x.id===i.id))current.incidents.push(snapshot(i));}
  if(current.incidents.some(i=>!i.resolvedAt)){current.alarmReviewed=false;invalidate(current);}
  save();renderAll();$('legacyNote').hidden=true;closeDialog();toast('Registros anteriores incorporados. Guardando en la nube…');sync.flush();
}));
window.addEventListener('storage',event=>{if(event.key===CACHE_KEY&&!pendingRecovery)sync.refresh();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){renderStatus();if(!pendingRecovery)sync.refresh();}else sync.flush();});
window.addEventListener('online',()=>{if(!pendingRecovery)sync.retry();});
window.addEventListener('beforeunload',event=>{if(sync.state.dirty||sync.state.saving){event.preventDefault();event.returnValue='';}});
setInterval(()=>{if(!document.hidden&&!$('actionDialog').open&&!pendingRecovery)sync.refresh();},20000);
setInterval(renderStatus,60000);
$('topDate').textContent=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',weekday:'short',day:'numeric',month:'long',year:'numeric'}).format(new Date());

let currentUser=null;
async function checkAuth(){
  try{
    const res=await fetch('/api/auth/me',{cache:'no-store'});
    if(res.ok){
      const data=await res.json();
      currentUser=data.user;
      const roleLabel = currentUser.role === 'gerente' ? 'Gerente' : currentUser.role === 'supervisor' ? 'Supervisor' : 'Operario';
      $('userBadge').textContent = `${roleLabel}: ${currentUser.name}`;
      $('userProfile').hidden = false;
      $('manageTeamBtn').hidden = currentUser.role !== 'gerente';
      if ($('authModal').open) $('authModal').close();
      if ((currentUser.role === 'operario' || currentUser.role === 'supervisor') && !$('operator').value) {
        $('operator').value = currentUser.name; current.operator = currentUser.name; save();
      }
      sync.load(); return true;
    }
  } catch (err) { console.error('Error al verificar sesión:', err); }
  currentUser = null; $('userProfile').hidden = true; $('manageTeamBtn').hidden = true; openAuthModal(); return false;
}

async function loadOperators() {
  const select = $('operatorSelect');
  select.innerHTML = '<option value="">Cargando usuarios de planta...</option>';
  try {
    const res = await fetch('/api/auth/operators', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.operators && data.operators.length > 0) {
        select.innerHTML = '<option value="">-- Selecciona tu nombre --</option>' + data.operators.map(op => {
          const tag = op.role === 'supervisor' && !op.name.toLowerCase().includes('supervisor') ? `${op.name} (Supervisor)` : op.name;
          return `<option value="${op.id}">${tag}</option>`;
        }).join('');
        return;
      }
    }
  } catch (err) { console.error('Error al cargar operarios:', err); }
  select.innerHTML = '<option value="">No hay operarios registrados</option>';
}

function openAuthModal(){
  $('authError').hidden=true;
  loadOperators();
  if(!$('authModal').open)$('authModal').showModal();
}

$('tabOperario').addEventListener('click',()=>{
  $('tabOperario').classList.add('active');$('tabGerente').classList.remove('active');
  $('formOperario').hidden=false;$('formGerente').hidden=true;$('authError').hidden=true;
});

$('tabGerente').addEventListener('click',()=>{
  $('tabGerente').classList.add('active');$('tabOperario').classList.remove('active');
  $('formGerente').hidden=false;$('formOperario').hidden=true;$('authError').hidden=true;
});

$('formOperario').addEventListener('submit',async e=>{
  e.preventDefault();$('authError').hidden=true;
  const userId=$('operatorSelect').value;const pin=$('operatorPin').value;
  if(!userId||!pin){$('authError').textContent='Selecciona tu nombre e ingresa tu PIN.';$('authError').hidden=false;return;}
  const btn=$('submitOperario');btn.disabled=true;btn.textContent='Verificando...';
  try{
    const res=await fetch('/api/auth/login-pin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,pin})});
    const data=await res.json();
    if(!res.ok){$('authError').textContent=data.error||'PIN incorrecto.';$('authError').hidden=false;return;}
    $('operatorPin').value='';toast(`Bienvenido a planta, ${data.user.name}`);await checkAuth();
  }catch{$('authError').textContent='Error de conexión. Inténtalo de nuevo.';$('authError').hidden=false;}
  finally{btn.disabled=false;btn.textContent='Ingresar como Operario';}
});

$('formGerente').addEventListener('submit',async e=>{
  e.preventDefault();$('authError').hidden=true;
  const email=$('managerEmail').value;const password=$('managerPassword').value;
  if(!email||!password){$('authError').textContent='Ingresa correo y contraseña.';$('authError').hidden=false;return;}
  const btn=$('submitGerente');btn.disabled=true;btn.textContent='Verificando...';
  try{
    const res=await fetch('/api/auth/login-manager',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    const data=await res.json();
    if(!res.ok){$('authError').textContent=data.error||'Credenciales inválidas.';$('authError').hidden=false;return;}
    $('managerPassword').value='';toast(`Sesión iniciada: ${data.user.name}`);await checkAuth();
  }catch{$('authError').textContent='Error de conexión. Inténtalo de nuevo.';$('authError').hidden=false;}
  finally{btn.disabled=false;btn.textContent='Ingresar como Gerente';}
});

$('logoutBtn').addEventListener('click',async()=>{
  try{await fetch('/api/auth/logout',{method:'POST'});}catch(err){console.error('Error al cerrar sesión:',err);}
  currentUser=null;$('userProfile').hidden=true;$('manageTeamBtn').hidden=true;openAuthModal();toast('Sesión cerrada correctamente.');
});

$('cloudSignIn').addEventListener('click',openAuthModal);

// Panel de Gestión de Equipo (Rol Gerente)
$('manageTeamBtn').addEventListener('click',()=>{
  $('machineQrUrl').value=`${window.location.origin}/?machine=${encodeURIComponent(activeMachineId)}`;
  loadTeamUsers();
  if(!$('teamModal').open)$('teamModal').showModal();
});

$('closeTeamModal').addEventListener('click',()=>{
  $('teamModal').close();
});

$('copyQrUrlBtn').addEventListener('click',async()=>{
  try{
    await navigator.clipboard.writeText($('machineQrUrl').value);
    toast('Enlace copiado al portapapeles');
  }catch{
    $('machineQrUrl').select();document.execCommand('copy');toast('Enlace copiado');
  }
});

async function loadTeamUsers(){
  const container=$('teamUsersList');
  container.innerHTML='<p>Cargando perfiles...</p>';
  try{
    const res=await fetch('/api/users',{cache:'no-store'});
    if(!res.ok){container.innerHTML='<p class="form-error">No se pudo cargar la lista de usuarios.</p>';return;}
    const data=await res.json();
    if(!data.users||data.users.length===0){container.innerHTML='<p>No hay usuarios registrados.</p>';return;}
    container.innerHTML=data.users.map(u=>{
      const isSelf=currentUser&&currentUser.id===u.id;
      const statusBadge=u.active?'':'<span class="badge-status-inactive">Inactivo</span>';
      const toggleLabel=u.active?'Desactivar':'Activar';
      const toggleBtn=isSelf?'':`<button type="button" class="button secondary compact" data-action="toggle" data-id="${u.id}" data-active="${u.active}">${toggleLabel}</button>`;
      const pinBtn=(u.role==='operario'||u.role==='supervisor')?`<button type="button" class="button secondary compact" data-action="pin" data-id="${u.id}" data-name="${u.name}">Cambiar PIN</button>`:'';
      return `<div class="team-user-row">
        <div class="team-user-info">
          <strong>${u.name}</strong>
          <span class="badge-role ${u.role}">${u.role}</span>
          ${statusBadge}
        </div>
        <div class="team-user-actions">${pinBtn}${toggleBtn}</div>
      </div>`;
    }).join('');

    container.querySelectorAll('button[data-action="toggle"]').forEach(btn=>{
      btn.addEventListener('click',async()=>{
        const id=btn.getAttribute('data-id');
        const activeNow=btn.getAttribute('data-active')==='true';
        btn.disabled=true;
        try{
          const patchRes=await fetch(`/api/users/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:!activeNow})});
          if(patchRes.ok){toast('Estado actualizado');await loadTeamUsers();loadOperators();}
          else{toast('Error al actualizar estado');}
        }catch{toast('Error de conexión');}
        finally{btn.disabled=false;}
      });
    });

    container.querySelectorAll('button[data-action="pin"]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const id=btn.getAttribute('data-id');
        const name=btn.getAttribute('data-name');
        openDialog(`Cambiar PIN de ${name}`,`<p>Ingresa el nuevo PIN (4 a 6 dígitos) para este usuario:</p><label><strong>Nuevo PIN</strong><input id="promptNewPin" type="password" pattern="[0-9]*" inputmode="numeric" maxlength="6" placeholder="Ej. 1234" required style="width:100%;padding:8px 10px;margin-top:6px;border:1px solid var(--border);border-radius:6px;"></label>`,'Guardar PIN',async()=>{
          const newPin=$('promptNewPin')?.value?.trim();
          if(!newPin||newPin.length<4){toast('El PIN debe tener al menos 4 dígitos');return;}
          closeDialog();
          try{
            const patchRes=await fetch(`/api/users/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:newPin})});
            if(patchRes.ok){toast(`PIN de ${name} actualizado`);}
            else{toast('No se pudo actualizar el PIN');}
          }catch{toast('Error de conexión');}
        });
      });
    });
  }catch(err){console.error('Error al cargar equipo:',err);container.innerHTML='<p class="form-error">Error al cargar usuarios.</p>';}
}

$('createMemberForm').addEventListener('submit',async e=>{
  e.preventDefault();$('createMemberMsg').hidden=true;
  const name=$('newMemberName').value.trim();
  const role=$('newMemberRole').value;
  const pin=$('newMemberPin').value.trim();
  if(!name||!pin||pin.length<4){
    $('createMemberMsg').textContent='Ingresa el nombre y un PIN de al menos 4 dígitos.';
    $('createMemberMsg').hidden=false;return;
  }
  const btn=$('submitCreateMember');btn.disabled=true;btn.textContent='Creando...';
  try{
    const res=await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,role,pin})});
    const data=await res.json();
    if(!res.ok){$('createMemberMsg').textContent=data.error||'No se pudo crear el usuario.';$('createMemberMsg').hidden=false;return;}
    $('newMemberName').value='';$('newMemberPin').value='';
    toast(`Perfil creado: ${data.user.name} (${data.user.role})`);
    await loadTeamUsers();loadOperators();
  }catch{$('createMemberMsg').textContent='Error de conexión.';$('createMemberMsg').hidden=false;}
  finally{btn.disabled=false;btn.textContent='Crear perfil';}
});

renderAll();showView(location.hash.slice(1));checkAuth();

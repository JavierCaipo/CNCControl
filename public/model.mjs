export const STORAGE_KEY = 'imad-cnc-preuso-v1';
export const CHECKS = [
  {id:'cabina',group:'Seguridad y entorno',title:'Cabina cerrada y protegida del polvo',detail:'Revisar el cerramiento y retirar polvo residual de las zonas accesibles. Confirmar el cierre antes del corte.',source:'Observación de planta · 09/10/2026'},
  {id:'epp',group:'Seguridad y entorno',title:'Protección ocular y respirador verificados',detail:'Verificar gafas para láser: marcado de longitud de onda y densidad óptica (OD) adecuados al equipo, certificado y estado de lentes. Selección validada por el responsable de seguridad conforme a ANSI Z136.1; Z87.1 por sí sola no acredita protección láser. Confirmar respirador, filtros y ajuste según la evaluación de humos y polvo de planta. Mantener el área sin personas expuestas.',source:'Manual V1 · p. 4; ANSI Z136.1-2022 / OSHA · selección de protección láser'},
  {id:'gabinetes',group:'Seguridad y entorno',title:'Gabinetes eléctricos cerrados',detail:'Inspección externa. No abrir gabinetes de control con la máquina energizada.',source:'Manual V1 · p. 4'},
  {id:'gas',group:'Sistemas auxiliares',title:'Gas disponible y cilindros sujetos',detail:'Verificar Oxígeno o Nitrógeno según el trabajo, sujeción y presión conforme al parámetro aprobado.',source:'Manual V1 · pp. 4, 27'},
  {id:'mangueras',group:'Sistemas auxiliares',title:'Mangueras de gas y conexiones sin indicios de fuga',detail:'Antes del uso: inspeccionar mangueras y conexiones; la ausencia de daño visible no descarta fugas. Mantenimiento semanal: comprobar estanqueidad con el método aprobado para el gas y registrar el resultado. Ante indicios de fuga, detener el uso y derivar a mantenimiento.',source:'Manual V1 · p. 4; frecuencia semanal indicada por planta · 17/11/2026'},
  {id:'agua',group:'Sistemas auxiliares',title:'Agua destilada del chiller y tapas limpias',detail:'Revisar nivel, limpieza y cierre de las tapas. Usar agua destilada solo si cumple la especificación del fabricante; el manual V1 indica agua desionizada. Mantenimiento cada 3 meses: cambiar el agua y registrar fecha y responsable, conforme al procedimiento del chiller.',source:'Manual V1 · p. 27; frecuencia trimestral indicada por planta · 17/11/2026'},
  {id:'chiller',group:'Sistemas auxiliares',title:'Chiller en condición de arranque',detail:'El manual V1 indica esperar a 20 °C antes de continuar. Confirmar la condición según el procedimiento vigente del equipo.',source:'Manual V1 · p. 8'},
  {id:'aire',group:'Sistemas auxiliares',title:'Compresor y aire de asistencia revisados',detail:'Comprobar disponibilidad de aire y ausencia de aceite o humedad. Diario, al final de la jornada: limpiar el polvo de los filtros y purgar el compresor. Semanal: purgar los filtros y comprobar que no gotee agua después de la purga. Aplicar el procedimiento del fabricante y registrar anomalías; intervenir en condición segura.',source:'Manual V1 · pp. 7, 28; rutinas diaria y semanal indicadas por planta · 17/11/2026'},
  {id:'cabezal',group:'Cabezal y preparación',title:'Cabezal sin polvo residual',detail:'Verificar la limpieza accesible antes del uso. La limpieza física debe seguir el procedimiento de mantenimiento de planta.',source:'Manual V1 · p. 27'},
  {id:'boquilla',group:'Cabezal y preparación',title:'Boquilla limpia y sin daños',detail:'Revisar condición y selección de boquilla para el material y espesor. Derivar daños o descentrado al personal autorizado.',source:'Manual V1 · pp. 24, 27–28'},
  {id:'plancha',group:'Cabezal y preparación',title:'Plancha presente para Calibration / Follow',detail:'Verificar plancha bajo el cabezal antes de usar estas funciones. Nunca calibrar o usar Follow sin plancha.',source:'Manual V1 · pp. 21–22'},
  {id:'material',group:'Cabezal y preparación',title:'Material y parámetros verificados',detail:'Confirmar material, espesor y Layer con parámetros aprobados para el trabajo. El manual excluye PVC, madera y acrílico.',source:'Manual V1 · pp. 4, 24'},
  {id:'control',group:'Cabezal y preparación',title:'Consola y periféricos sin anomalías',detail:'Verificar las indicaciones de estado tras el encendido conforme al procedimiento vigente. Registrar cualquier alarma antes de continuar.',source:'Manual V1 · pp. 8–11'}
  ,{id:'centrado',group:'Cabezal y preparación',title:'Centrado del láser verificado',detail:'Confirmar el centrado del haz respecto a la boquilla mediante el procedimiento aprobado del fabricante y personal autorizado. Registrar la comprobación; ante descentrado, detener el uso y derivar a mantenimiento antes de cortar. No anular cerramientos ni protecciones.',source:'Manual V1 · p. 28; punto añadido por planta · 17/11/2026'}
];

export const GUIDES = [
  {id:'rebaba',name:'Rebaba en la base',system:'Proceso de corte',cause:'Velocidad de corte muy alta o presión de gas insuficiente.',actions:['Revisar velocidad y gas de asistencia del parámetro aprobado.','El manual propone reducir ligeramente la velocidad o aumentar la presión del gas.','El operador autorizado debe validar el ajuste con una prueba y revisar el acabado.']},
  {id:'atraviesa',name:'El láser no atraviesa el material',system:'Proceso de corte',cause:'Potencia insuficiente o velocidad elevada para el espesor.',actions:['Confirmar material, espesor y parámetro seleccionado.','El manual propone aumentar potencia o disminuir velocidad de avance dentro de los parámetros autorizados.','Validar con una prueba antes de continuar el trabajo.']},
  {id:'rugoso',name:'Acabado rugoso o con estrías',system:'Proceso de corte',cause:'Foco mal posicionado o presión de oxígeno muy alta en acero al carbono.',actions:['Revisar foco y presión del gas del parámetro aprobado.','El manual propone ajustar la posición del foco o reducir la presión del gas.','Comprobar el acabado de una prueba después del ajuste autorizado.']},
  {id:'fundido',name:'Metal fundido adherido a la boquilla',system:'Cabezal',cause:'Perforación demasiado baja o tiempo de perforación insuficiente.',actions:['Detener el trabajo y revisar la condición de la boquilla con el equipo en condición segura.','El manual propone aumentar Pierce Height y Pierce Time en el parámetro autorizado.','Validar la boquilla y el resultado de perforación antes de reanudar.']},
  {id:'desvia',name:'El corte se detiene o se desvía',system:'Cabezal',cause:'Boquilla dañada, sucia o mal centrada.',actions:['Revisar la boquilla con el equipo en condición segura.','El manual indica limpiar, centrar o reemplazar la boquilla deformada. La alineación debe realizarla personal autorizado con el procedimiento aprobado.','Comprobar la condición del cabezal y validar una prueba antes de continuar.']},
  {id:'esquinas',name:'Bordes quemados en esquinas',system:'Proceso de corte',cause:'Acumulación de calor por exceso de potencia en giros cerrados.',actions:['Revisar los parámetros de potencia para curvas.','El manual propone usar Power Curve para reducir potencia en curvas.','El operador autorizado debe validar el ajuste en una prueba.']},
  {id:'orificios',name:'Orificios pequeños deformados',system:'Proceso de corte',cause:'Aceleración alta o calor excesivo en un área pequeña.',actions:['Revisar velocidad y condiciones de corte de círculos pequeños.','El manual propone reducir la velocidad en esos círculos y usar Cooling Points.','Verificar dimensiones y acabado de una prueba después del ajuste autorizado.']},
  {id:'salpicadura',name:'Salpicaduras de metal al inicio',system:'Perforación',cause:'Perforación violenta por frecuencia o Duty Cycle elevados.',actions:['Revisar los parámetros de Pierce y la condición de la boquilla.','El manual propone reducir Duty Cycle en Pierce para una perforación más pulsada.','Validar el ajuste autorizado en una prueba y revisar salpicaduras.']},
  {id:'inox',name:'Superficie del inoxidable negra',system:'Aire de asistencia',cause:'Aire con poca presión o contaminación por aceite/humedad.',actions:['Verificar filtros del compresor y posibles indicios de aceite o humedad.','Revisar la presión conforme a la capacidad del equipo y al parámetro aprobado para el material.','El manual propone aumentar presión; cualquier valor debe validarse con mantenimiento antes de aplicarlo.','Validar el acabado con una prueba.']},
  {id:'ejez',name:'Fallo o alarma del eje Z',system:'Pendiente de procedimiento',cause:'El problema del eje Z no está documentado en el manual V1.',unknown:true,actions:['Detener el proceso en condición segura y conservar el texto o código exacto que muestra el equipo.','Registrar cuándo ocurrió y qué operación se ejecutaba. No forzar movimientos ni anular protecciones.','Derivar a mantenimiento. Registrar diagnóstico, intervención y comprobación de funcionamiento antes de cerrar la incidencia.']},
  {id:'otra',name:'Otra alarma / código no documentado',system:'Pendiente de identificación',cause:'No hay un procedimiento confirmado para este mensaje en las fuentes disponibles.',unknown:true,actions:['Detener el proceso en condición segura y copiar el texto o código completo.','Registrar el componente y el contexto de aparición.','Solicitar a mantenimiento el procedimiento del fabricante. Cerrar solo después de registrar la intervención y su comprobación.']}
];

export function today(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function newInspection(now = new Date()) {
  return {id:globalThis.crypto?.randomUUID?.() || `r-${now.getTime()}-${Math.random().toString(16).slice(2)}`,date:today(now),startedAt:now.toISOString(),operator:'',ot:'',shift:'Inicio de turno',checks:{},incidents:[],alarmReviewed:false,notes:'',verifiedAt:null};
}
export function invalidate(state) { state.verifiedAt = null; return state; }
export function setCheck(state, id, value) {
  if(!CHECKS.some(c=>c.id===id)||!['ok','fault','pending'].includes(value)) throw new Error('Verificación inválida');
  state.checks[id] = {value,note:state.checks[id]?.note || ''};
  return invalidate(state);
}
export function addIncident(state, {guideId,text,context}, now=new Date()) {
  if(!GUIDES.some(g=>g.id===guideId) || !String(text||'').trim()) throw new Error('Escribe el texto o código de la incidencia.');
  state.incidents.push({id:globalThis.crypto?.randomUUID?.()||`i-${now.getTime()}-${Math.random()}`,guideId,text:String(text).trim().slice(0,500),context:String(context||'').trim().slice(0,2000),createdAt:now.toISOString(),resolvedAt:null,responsible:'',resolution:''});
  state.alarmReviewed=false;
  return invalidate(state);
}
export function resolveIncident(state,id,responsible,resolution,now=new Date()) {
  const item=state.incidents.find(i=>i.id===id);
  if(!item||item.resolvedAt) throw new Error('Incidencia no disponible');
  if(!String(responsible).trim()||String(resolution).trim().length<10) throw new Error('Indica responsable y una comprobación de al menos 10 caracteres.');
  Object.assign(item,{responsible:String(responsible).trim().slice(0,120),resolution:String(resolution).trim().slice(0,2000),resolvedAt:now.toISOString()});
  state.alarmReviewed=false;
  return invalidate(state);
}
export function getStatus(state,now=new Date()) {
  const ok=CHECKS.filter(c=>state.checks[c.id]?.value==='ok').length;
  const faults=CHECKS.filter(c=>state.checks[c.id]?.value==='fault').length;
  const active=state.incidents.filter(i=>!i.resolvedAt).length;
  const reasons=[];
  if(faults) reasons.push(`${faults} verificación${faults===1?'':'es'} con anomalía`);
  if(active) reasons.push(`${active} incidencia${active===1?'':'s'} abierta${active===1?'':'s'}`);
  if(state.date!==today(now)) reasons.push('La revisión corresponde a otro día. Inicia una nueva.');
  if(ok<CHECKS.length) reasons.push(`${CHECKS.length-ok} verificación${CHECKS.length-ok===1?'':'es'} por completar`);
  if(!state.operator.trim()) reasons.push('Falta el nombre del operador');
  if(!state.alarmReviewed) reasons.push('Falta confirmar la revisión de alarmas');
  const eligible=reasons.length===0;
  const code=faults||active?'blocked':eligible?(state.verifiedAt?'ready':'review'):'pending';
  return {code,ok,faults,active,eligible,reasons,total:CHECKS.length};
}
export function verify(state,now=new Date()) {
  if(!getStatus(state,now).eligible) throw new Error('Completa las revisiones y resuelve las incidencias antes de validar.');
  state.verifiedAt=now.toISOString(); return state;
}
export function restore(raw,now=new Date()) {
  const fallback={current:newInspection(now),history:[]};
  try {
    const saved=JSON.parse(raw);
    if(saved?.version!==1||!saved.current) return fallback;
    function clean(x,isHistory=false) {
      if(!x||typeof x.id!=='string'||typeof x.startedAt!=='string'||isNaN(Date.parse(x.startedAt))||typeof x.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x.date)) return null;
      const s={...newInspection(now),id:x.id,date:x.date,startedAt:x.startedAt};
      for(const key of ['operator','ot','shift','notes']) if(typeof x[key]==='string') s[key]=x[key].slice(0,key==='notes'?4000:120);
      for(const c of CHECKS) if(['ok','fault','pending'].includes(x.checks?.[c.id]?.value)) s.checks[c.id]={value:x.checks[c.id].value,note:typeof x.checks[c.id].note==='string'?x.checks[c.id].note.slice(0,2000):''};
      if(Array.isArray(x.incidents)) s.incidents=x.incidents.slice(0,100).map(i=>{
        if(!i||typeof i.id!=='string'||typeof i.text!=='string') return null;
        const resolved=typeof i.resolvedAt==='string'&&!isNaN(Date.parse(i.resolvedAt))&&typeof i.responsible==='string'&&i.responsible.trim()&&typeof i.resolution==='string'&&i.resolution.trim().length>=10;
        return {id:i.id,guideId:GUIDES.some(g=>g.id===i.guideId)?i.guideId:'otra',text:i.text.slice(0,500),context:String(i.context||'').slice(0,2000),createdAt:typeof i.createdAt==='string'?i.createdAt:s.startedAt,resolvedAt:resolved?i.resolvedAt:null,responsible:resolved?i.responsible.slice(0,120):'',resolution:resolved?i.resolution.slice(0,2000):''};
      }).filter(Boolean);
      s.alarmReviewed=x.alarmReviewed===true;
      s.verifiedAt=typeof x.verifiedAt==='string'&&!isNaN(Date.parse(x.verifiedAt))?x.verifiedAt:null;
      const validationTime=isHistory?new Date(s.verifiedAt||s.startedAt):now;
      if(isNaN(validationTime.getTime())||!getStatus(s,validationTime).eligible) s.verifiedAt=null;
      return s;
    }
    return {current:clean(saved.current)||fallback.current,history:Array.isArray(saved.history)?saved.history.slice(-50).map(x=>clean(x,true)).filter(Boolean):[]};
  } catch { return fallback; }
}
export function serialize(current,history) { return JSON.stringify({version:1,current,history:history.slice(-50)}); }
export function snapshot(state) { return JSON.parse(JSON.stringify(state)); }

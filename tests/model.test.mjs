import test from 'node:test';
import assert from 'node:assert/strict';
import {CHECKS,GUIDES,today,newInspection,setCheck,addIncident,resolveIncident,getStatus,verify,restore,serialize,invalidate,snapshot} from '../public/model.mjs';
const now=new Date('2026-10-14T21:00:00Z');
function complete(){const state=newInspection(now);state.operator='Operador de prueba';for(const c of CHECKS)setCheck(state,c.id,'ok');state.alarmReviewed=true;return state;}

test('a prior validated checklist needs the new laser centering check after reload',()=>{
  const state=complete();verify(state,now);delete state.checks.centrado;
  const restored=restore(serialize(state,[]),now).current;
  assert.equal(restored.verifiedAt,null);
  assert.equal(getStatus(restored,now).eligible,false);
  assert.throws(()=>verify(restored,now));
  setCheck(restored,'centrado','ok');verify(restored,now);
  assert.equal(getStatus(restored,now).code,'ready');
});

test('a blank review is pending and cannot be validated',()=>{
  const state=newInspection(now);const status=getStatus(state,now);
  assert.equal(status.code,'pending');assert.equal(status.ok,0);assert.equal(status.eligible,false);assert.throws(()=>verify(state,now));
});
test('all checks, operator and alarm confirmation are mandatory',()=>{
  for(const missing of ['check','operator','alarm']){
    const s=complete();if(missing==='check')setCheck(s,CHECKS[0].id,'pending');if(missing==='operator')s.operator='  ';if(missing==='alarm')s.alarmReviewed=false;
    assert.equal(getStatus(s,now).eligible,false,missing);assert.throws(()=>verify(s,now));
  }
});
test('anomaly blocks even when all other requirements are satisfied',()=>{
  const s=complete();setCheck(s,'cabina','fault');assert.equal(getStatus(s,now).code,'blocked');assert.throws(()=>verify(s,now));
});
test('complete review requires explicit validation, and a changed check invalidates it',()=>{
  const s=complete();assert.equal(getStatus(s,now).code,'review');verify(s,now);assert.equal(getStatus(s,now).code,'ready');
  setCheck(s,'chiller','pending');assert.equal(s.verifiedAt,null);assert.equal(getStatus(s,now).code,'pending');
});
test('documented and unknown incidents block; resolution requires evidence and a fresh alarm confirmation',()=>{
  for(const guideId of ['rebaba','ejez','otra']){
    const s=complete();verify(s,now);addIncident(s,{guideId,text:'Mensaje exacto del equipo',context:'Durante el arranque'},now);
    assert.equal(s.verifiedAt,null);assert.equal(s.alarmReviewed,false);assert.equal(getStatus(s,now).code,'blocked');
    const id=s.incidents[0].id;assert.throws(()=>resolveIncident(s,id,'','El funcionamiento fue comprobado',now));assert.throws(()=>resolveIncident(s,id,'Técnico','reset',now));
    resolveIncident(s,id,'Mantenimiento','Intervención realizada y funcionamiento comprobado',now);
    assert.equal(getStatus(s,now).code,'pending');assert.equal(s.alarmReviewed,false);
    s.alarmReviewed=true;verify(s,now);assert.equal(getStatus(s,now).code,'ready');
  }
});
test('invalid inputs cannot add a guide or silently change a check',()=>{
  const s=newInspection(now);assert.throws(()=>setCheck(s,'fake','ok'));assert.throws(()=>setCheck(s,'chiller','skip'));assert.throws(()=>addIncident(s,{guideId:'otra',text:''},now));assert.throws(()=>addIncident(s,{guideId:'fake',text:'X'},now));
});
test('state, observations and resolved incident evidence survive reload',()=>{
  const s=complete();addIncident(s,{guideId:'rebaba',text:'Rebaba',context:'Plancha A36'},now);resolveIncident(s,s.incidents[0].id,'Técnico','Parámetro autorizado ajustado y acabado comprobado',now);s.alarmReviewed=true;s.checks.gas.note='Sujeción revisada';s.notes='Turno de prueba';verify(s,now);
  const restored=restore(serialize(s,[snapshot(s)]),now);assert.deepEqual(restored.current,s);assert.equal(restored.history[0].verifiedAt,s.verifiedAt);assert.equal(getStatus(restored.current,now).code,'ready');
});
test('old current reviews expire but the historical validation is retained',()=>{
  const s=complete();verify(s,now);const tomorrow=new Date('2026-10-15T21:00:00Z');
  assert.equal(getStatus(s,tomorrow).code,'pending');const restored=restore(serialize(s,[s]),tomorrow);
  assert.equal(restored.current.verifiedAt,null);assert.equal(restored.history[0].verifiedAt,s.verifiedAt);
});
test('Lima calendar boundary is used instead of UTC',()=>{
  assert.equal(today(new Date('2026-10-15T02:00:00Z')),'2026-10-14');assert.equal(today(new Date('2026-10-15T05:01:00Z')),'2026-10-15');
});
test('corrupt storage resets safely; malformed resolutions remain open',()=>{
  const initial=restore('broken json',now);assert.equal(getStatus(initial.current,now).code,'pending');
  const s=complete();addIncident(s,{guideId:'ejez',text:'Alarma Z'},now);s.incidents[0].resolvedAt=now.toISOString();s.alarmReviewed=true;s.verifiedAt=now.toISOString();
  const r=restore(serialize(s,[]),now);assert.equal(r.current.incidents[0].resolvedAt,null);assert.equal(r.current.verifiedAt,null);assert.equal(getStatus(r.current,now).code,'blocked');
});
test('new inspection resets check marks while an unresolved incident can carry forward',()=>{
  const s=complete();addIncident(s,{guideId:'ejez',text:'Alarma Z'},now);const next=newInspection(now);next.incidents=s.incidents.filter(i=>!i.resolvedAt).map(snapshot);
  assert.equal(getStatus(next,now).ok,0);assert.equal(next.alarmReviewed,false);assert.equal(getStatus(next,now).code,'blocked');assert.equal(next.incidents[0].text,'Alarma Z');
});
test('all nine manual problems plus Z and unknown guides are searchable data',()=>{
  assert.equal(GUIDES.length,11);assert.equal(GUIDES.filter(g=>!g.unknown).length,9);for(const g of GUIDES){assert.ok(g.actions.length>=3);assert.ok(g.name);}
});
test('history is bounded to fifty records and metadata changes can invalidate confirmation',()=>{
  const s=complete();verify(s,now);s.operator='Otro operador';invalidate(s);assert.equal(getStatus(s,now).code,'review');
  const out=restore(serialize(s,Array.from({length:60},()=>snapshot(s))),now);assert.equal(out.history.length,50);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleReviews} from '../server/review-store.mjs';
import {newInspection,serialize,CHECKS,setCheck,verify,addIncident,resolveIncident,snapshot} from '../public/model.mjs';
import {createCloudSync} from '../public/cloud-client.mjs';

const now=new Date('2026-10-15T19:00:00Z');
const user={userId:'user-santiago',email:'santiago@example.test',displayName:'Santiago'};
function database(){const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../drizzle/0000_futuristic_riptide.sql',import.meta.url),'utf8'));return {prepare(sql){return {bind(...args){return {async first(){return sqlite.prepare(sql).get(...args)||null;}};}};},close(){sqlite.close();}};}
function request(method,body,extra={}){return new Request('https://cnc.test/api/reviews',{method,headers:method==='PUT'?{'Content-Type':'application/json','Origin':'https://cnc.test',...extra}:extra,body:body?JSON.stringify(body):undefined});}
function state(){return JSON.parse(serialize(newInspection(now),[]));}
async function run(db,req,who=user){const result=await handleReviews(req,{db,user:who,now});return {status:result.status,body:await result.json()};}
function complete(){const s=newInspection(now);s.operator='Operador CNC';for(const c of CHECKS)setCheck(s,c.id,'ok');s.alarmReviewed=true;verify(s,now);return JSON.parse(serialize(s,[s]));}

test('authenticated access is required for both reading and writing',async()=>{
 const db=database();for(const req of [request('GET'),request('PUT',{revision:0,data:state()})])assert.equal((await run(db,req,null)).status,401);db.close();
});
test('cloud state persists and is visible to a second authorized person',async()=>{
 const db=database();const first=await run(db,request('GET'));assert.equal(first.body.revision,0);assert.equal(first.body.data,null);
 const data=state();data.current.operator='Operador CNC';data.current.ot='OT-175';setCheck(data.current,'cabina','ok');
 const saved=await run(db,request('PUT',{revision:0,data}));assert.equal(saved.status,200);assert.equal(saved.body.revision,1);
 const other=await run(db,request('GET'),{...user,userId:'operator-id',email:'operador@example.test',displayName:'Operador'});
 assert.equal(other.body.data.current.ot,'OT-175');assert.equal(other.body.data.current.checks.cabina.value,'ok');assert.equal(other.body.updatedBy,'Santiago');db.close();
});
test('stale revisions cannot overwrite another operator\'s updates',async()=>{
 const db=database();const first=state();first.current.ot='OT-real';await run(db,request('PUT',{revision:0,data:first}));
 const stale=state();stale.current.ot='OT-vieja';const rejected=await run(db,request('PUT',{revision:0,data:stale}));assert.equal(rejected.status,409);assert.equal(rejected.body.conflict,true);
 assert.equal((await run(db,request('GET'))).body.data.current.ot,'OT-real');db.close();
});
test('the API rejects cross-origin writes, malformed state and unsupported methods',async()=>{
 const db=database();assert.equal((await run(db,request('PUT',{revision:0,data:state()},{Origin:'https://other.test'}))).status,403);
 assert.equal((await run(db,request('PUT',{revision:0,data:state()},{'Content-Type':'text/plain'}))).status,415);
 assert.equal((await run(db,request('PUT',{revision:0,data:{current:{}}}))).status,400);
 assert.equal((await run(db,new Request('https://cnc.test/api/reviews',{method:'DELETE'}))).status,405);db.close();
});
test('an unresolved incident cannot be discarded when starting a new review',async()=>{
 const db=database();const data=state();addIncident(data.current,{guideId:'ejez',text:'Error eje Z'},now);await run(db,request('PUT',{revision:0,data}));
 const next=state();assert.equal((await run(db,request('PUT',{revision:1,data:next}))).status,422);
 next.current.incidents=data.current.incidents.map(snapshot);assert.equal((await run(db,request('PUT',{revision:1,data:next}))).status,200);db.close();
});
test('verified, historical records and resolution evidence survive a cloud round trip',async()=>{
 const db=database();const data=state();addIncident(data.current,{guideId:'rebaba',text:'Rebaba excesiva'},now);resolveIncident(data.current,data.current.incidents[0].id,'Mantenimiento','Ajuste aprobado y resultado de corte comprobado',now);
 for(const c of CHECKS)setCheck(data.current,c.id,'ok');data.current.operator='Operador';data.current.alarmReviewed=true;verify(data.current,now);data.history=[snapshot(data.current)];
 assert.equal((await run(db,request('PUT',{revision:0,data}))).status,200);const after=(await run(db,request('GET'))).body.data;assert.equal(after.current.verifiedAt,now.toISOString());assert.equal(after.history[0].incidents[0].responsible,'Mantenimiento');db.close();
});
test('the server refuses a forged incomplete validation',async()=>{
 const db=database();const data=state();data.current.verifiedAt=now.toISOString();assert.equal((await run(db,request('PUT',{revision:0,data}))).status,422);db.close();
});

function client(db,who=user,intercept){
 let local=state();let lastStatus;let remoteCount=0;
 const sync=createCloudSync({getData:()=>structuredClone(local),onStatus:s=>lastStatus=s,onIdentity:()=>{},onSaved:()=>{},onRemote:data=>{if(data)local=data;remoteCount++;},fetcher:async(path,options)=>{
   if(intercept)await intercept(options);
   const req=new Request('https://cnc.test'+path,options);return handleReviews(req,{db,user:who,now});
 }});
 return {sync,get local(){return local;},get status(){return lastStatus;},get remoteCount(){return remoteCount;}};
}
test('two client sessions share data and conflicts preserve pending client changes',async()=>{
 const db=database(),a=client(db),b=client(db,{...user,userId:'operator'});
 await a.sync.load();await b.sync.load();a.local.current.ot='OT-175';a.sync.changed();await a.sync.flush();assert.equal(a.sync.state.dirty,false);
 b.local.current.ot='OT-OLD';b.sync.changed();await b.sync.flush();assert.equal(b.sync.state.conflict,true);assert.equal(b.local.current.ot,'OT-OLD');
 await b.sync.load({discard:true});assert.equal(b.local.current.ot,'OT-175');assert.equal(b.sync.state.conflict,false);a.sync.dispose();b.sync.dispose();db.close();
});
test('edits entered during an in-flight save are sent in a later revision',async()=>{
 const db=database();let release;let arrived;const gate=new Promise(r=>release=r);const seen=new Promise(r=>arrived=r);let first=true;
 const a=client(db,user,async options=>{if(options.method==='PUT'&&first){first=false;arrived();await gate;}});
 await a.sync.load();a.local.current.operator='Op';a.sync.changed();const saving=a.sync.flush();await seen;
 a.local.current.ot='OT-during-save';a.sync.changed();release();await saving;assert.equal(a.sync.state.dirty,true);await a.sync.flush();
 assert.equal(a.sync.state.dirty,false);assert.equal((await run(db,request('GET'))).body.data.current.ot,'OT-during-save');assert.equal(a.sync.state.revision,2);a.sync.dispose();db.close();
});
test('network errors keep pending work and retry saves it',async()=>{
 const db=database();let offline=false;const a=client(db,user,async()=>{if(offline)throw new Error('Sin conexión');});await a.sync.load();offline=true;a.local.current.ot='OT-offline';a.sync.changed();await a.sync.flush();assert.equal(a.sync.state.dirty,true);assert.ok(a.sync.state.error);
 offline=false;await a.sync.retry();assert.equal(a.sync.state.dirty,false);assert.equal((await run(db,request('GET'))).body.data.current.ot,'OT-offline');a.sync.dispose();db.close();
});
test('refresh loads remote revisions but cannot replace pending edits',async()=>{
 const db=database();const a=client(db);await a.sync.load();const data=state();data.current.ot='OT-server';await run(db,request('PUT',{revision:0,data}));await a.sync.refresh();assert.equal(a.local.current.ot,'OT-server');
 a.local.current.ot='OT-unsaved';a.sync.changed();assert.equal(await a.sync.refresh(),false);assert.equal(a.local.current.ot,'OT-unsaved');a.sync.dispose();db.close();
});

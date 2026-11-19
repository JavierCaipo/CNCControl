export function createCloudSync({getData,onStatus,onRemote,onIdentity,onSaved,fetcher=fetch,now=()=>new Date()}){
  const state={ready:false,dirty:false,saving:false,conflict:false,error:'',revision:0,updatedAt:null,updatedBy:null,user:null,sequence:0};
  let timer;
  const emit=()=>onStatus({...state});
  async function request(method,payload){
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetcher('/api/reviews',{method,credentials:'same-origin',headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify(payload):undefined,signal:controller.signal,cache:'no-store'});
      const text=await response.text();let data;try{data=JSON.parse(text);}catch{throw new Error('No se recibió el registro compartido. Comprueba tu sesión y vuelve a intentar.');}
      if(!response.ok){const e=new Error(data.error||'No se pudo conectar con el registro compartido.');e.status=response.status;e.data=data;throw e;}
      return data;
    }catch(error){if(error.name==='AbortError')throw new Error('La conexión tardó demasiado. Los cambios pendientes siguen en este navegador.');throw error;}
    finally{clearTimeout(timeout);}
  }
  function remember(result){state.revision=result.revision;state.updatedAt=result.updatedAt;state.updatedBy=result.updatedBy;}
  async function load({discard=false}={}){
    if(state.saving||(state.dirty&&!discard))return false;
    state.error='';emit();
    try{
      const result=await request('GET');remember(result);state.ready=true;state.conflict=false;state.dirty=false;state.error='';state.user=result.user;
      onIdentity(result.user);onRemote(result.data);emit();return true;
    }catch(e){state.error=e.message;emit();return false;}
  }
  function changed(){state.sequence++;state.dirty=true;state.error='';clearTimeout(timer);emit();if(state.ready&&!state.conflict)timer=setTimeout(flush,650);}
  async function flush(){
    clearTimeout(timer);if(!state.ready||!state.dirty||state.saving||state.conflict)return false;
    const sequence=state.sequence;const data=getData();state.saving=true;state.error='';emit();
    try{
      const result=await request('PUT',{revision:state.revision,data});remember(result);state.error='';
      state.dirty=state.sequence!==sequence;onSaved(result,sequence===state.sequence);return true;
    }catch(e){state.error=e.message;if(e.status===409)state.conflict=true;return false;}
    finally{state.saving=false;emit();if(state.dirty&&!state.error&&!state.conflict)timer=setTimeout(flush,100);}
  }
  async function refresh(){
    if(!state.ready||state.dirty||state.saving||state.conflict)return false;
    try{const result=await request('GET');if(result.revision>state.revision){remember(result);onRemote(result.data);}state.error='';emit();return true;}
    catch(e){state.error=e.message;emit();return false;}
  }
  return {state,load,changed,flush,refresh,retry:()=>state.dirty?flush():load(),dispose:()=>clearTimeout(timer)};
}

// Only the public gateway address is published; data stays on the owner's computer.
let boardEndpoint='', boardChecked=0, boardLookup=null;
async function boardResolve(){
 if(boardEndpoint && Date.now()-boardChecked<30000)return boardEndpoint;
 if(!boardLookup)boardLookup=(async()=>{
  const r=await fetch('https://raw.githubusercontent.com/comet-ranger-lc/boarddc-web/main/endpoint.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error('Не удалось получить адрес сервера');
  const data=await r.json(),u=new URL(data.url);
  if(u.protocol!=='https:'||!u.hostname.endsWith('.trycloudflare.com')||u.pathname!=='/'||u.search||u.hash||u.username||u.password||u.port)throw Error('Некорректный адрес сервера');
  boardEndpoint=u.origin;boardChecked=Date.now();return boardEndpoint;
 })().finally(()=>{boardLookup=null});
 return boardLookup;
}
window.boardFetch=async function(path,options={}){
 try{
  const base=await boardResolve();
  const r=await fetch(base+path,{...options,credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!(r.headers.get('content-type')||'').includes('application/json'))throw Error('Локальный сервер или туннель недоступен. Ожидаем восстановления связи.');
  if(!r.ok){const data=await r.json();throw Error(data.error||'Ошибка сервера: '+r.status)}
  return r;
 }catch(e){boardChecked=0;throw e}
};

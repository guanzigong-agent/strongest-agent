export async function requestJson(url,options={},timeoutMs=12000){
 const controller=new AbortController();let timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
 try{
  const response=await fetch(url,{...options,signal:controller.signal});
  const body=await response.json();return{response,body};
 }catch(error){
  if(timedOut){const timeout=Error('请求超时');timeout.name='TimeoutError';throw timeout;}
  throw error;
 }finally{clearTimeout(timer);}
}

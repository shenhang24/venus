export async function proxyTunnelControl(operation,{method='GET',data={},token=''}={}){
 if(!['status','start','stop'].includes(operation))return {status:404,data:{error:'Unknown local MCP operation'}};
 try{
  const response=await fetch('http://127.0.0.1:10003/'+operation,{method,headers:{Origin:'http://127.0.0.1:10001',...(method==='POST'?{'Content-Type':'application/json','X-Venus-Token':token}:{})},...(method==='POST'?{body:JSON.stringify(operation==='start'?{key:data.key,tunnelId:data.tunnelId}:{})}:{}),signal:AbortSignal.timeout(8000)});
  return {status:response.status,data:await response.json()};
 }catch{return {status:503,data:{error:'Local MCP controller is unavailable'}};}
}

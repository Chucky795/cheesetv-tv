/* Device-specific remote recording only. Does not record in the browser or contact a provider. */
(function(root){
'use strict';
const eligible=devices=>(Array.isArray(devices)?devices:[]).filter(d=>d&&d.kind==='tv'&&d.record_protocol===2&&Number(d.receiver_build)>=51&&d.online===true&&typeof d.device_id==='string'&&d.device_id.trim()).filter((d,i,a)=>a.findIndex(x=>x.device_id===d.device_id)===i);
const label=d=>`${d.name||'Unnamed TV'} (${d.device_id.slice(-6)})`;
const uuid=()=>{const a=new Uint8Array(16);crypto.getRandomValues(a);a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;return Array.from(a,(n,i)=>([4,6,8,10].includes(i)?'-':'')+n.toString(16).padStart(2,'0')).join('')};
function create({rpc,key,origin='web',requestId=uuid()}){
 const s={devices:[],selected:null,busy:false,closed:false,finished:false};
 async function refresh(){s.selected=null;const r=await rpc('sync_get_remote',{p_key:key});if(s.closed)return [];
  if(!r||r.bad||!Array.isArray(r.devices)){s.devices=[];throw Error("Couldn't load devices. Nothing was sent. Check your connection and retry.")}
  s.devices=eligible(r.devices);return s.devices}
 function select(id){if(!s.busy&&!s.closed&&!s.finished)s.selected=s.devices.find(d=>d.device_id===id&&d.online===true)?.device_id||null}
 async function send(payload){
  if(s.closed||s.busy||s.finished)return {ok:false,message:'This request is closed or already sending.'};
  const id=s.selected;if(!id)return {ok:false,message:'Choose an online recording device first.'};
  const old=s.devices.find(d=>d.device_id===id);s.busy=true;
  try{
   const fresh=await rpc('sync_get_remote',{p_key:key});
   if(s.closed)return {ok:false,message:'Cancelled. Nothing was sent.'};
   const d=eligible(fresh?.devices).find(d=>d.device_id===id&&d.online===true);
   if(!d){s.selected=null;return {ok:false,message:`${label(old)} is offline or no longer available. Nothing was sent. Refresh and choose a device again.`}}
   // No legacy RPC fallback: a missing backend must fail closed.
   s.finished=true;
   const r=await rpc('sync_remote_record_to_device',Object.assign({},payload,{p_key:key,p_target_device_id:id,p_request_id:requestId,p_origin:origin}));
   if(!r||r.bad)return {ok:false,message:`Couldn't confirm delivery to ${label(d)}. Device-specific recording may not be available yet. Check DVR before retrying. No fallback device was used.`};
   if(!r.ok)return {ok:false,message:r.message||`Couldn't send to ${label(d)}. No other device was used.`};
   if(r.job?.target_device_id!==id)return {ok:false,message:"Couldn't confirm the destination. Check DVR before retrying."};
   const status=r.job.status;
   if(['failed','cancelled','conflict'].includes(status))return {ok:false,message:`This request on ${label(d)} is ${status}. Check Recordings before retrying.`};
   if(status==='claimed')return {ok:true,message:r.job.accepted_at?`Accepted by ${label(d)} and saved on that TV. Recording has not started yet.`:`Requested on ${label(d)}; waiting for that TV to confirm local acceptance.`};
   if(status==='recording')return {ok:true,message:`${label(d)} reports recording. Check Recordings for progress.`};
   if(status==='done')return {ok:true,message:`${label(d)} reports this request completed. Check DVR on that device.`};
   return {ok:true,message:`Sent to ${label(d)}. Waiting for that device to accept it — this does not mean recording has started. Check Recordings for its status.`};
  }catch(e){return {ok:false,message:"Couldn't confirm delivery. Check Recordings before retrying. No fallback device was used."}}
  finally{s.busy=false}
 }
 return {state:s,refresh,select,send,cancel(){if(!s.finished)s.closed=true}};
}
const api={eligible,label,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CTV_RECORD_TARGET=api;
})(typeof window!=='undefined'?window:globalThis);

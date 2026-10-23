'use strict';
/* CheeseTV Web Player v2 - blank player. No content, URLs or credentials are bundled. Nothing is proxied. */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],LS=localStorage;
const J=(k,d)=>{try{return JSON.parse(LS.getItem(k))??d}catch(e){return d}};
const S={pls:J('ctv.playlists',[]),active:LS.getItem('ctv.active'),favs:J('ctv.favs',{}),recent:J('ctv.recent',{}),resume:J('ctv.resume',{}),
 tsMin:+(LS.getItem('ctv.tsmin')||90),chans:[],group:'All',view:'guide',epg:{},epgState:'',cur:null,vod:null,vodType:'movie'};
const save=()=>{LS.setItem('ctv.playlists',JSON.stringify(S.pls));LS.setItem('ctv.favs',JSON.stringify(S.favs));LS.setItem('ctv.recent',JSON.stringify(S.recent));S.active?LS.setItem('ctv.active',S.active):LS.removeItem('ctv.active')};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pl=()=>S.pls.find(p=>p.id===S.active)||S.pls[0];
/* per-provider watch data (favorite series + last episode per series). Keyed by playlist id + server + username; never the password. */
const wKey=()=>{const p=pl();return p?'ctv.watch.'+p.id+':'+String(p.server||'').replace(/^https?:\/\//,'').replace(/\/+$/,'')+':'+(p.user||''):''};
const WD=()=>{const k=wKey();if(!k)return {fav:[],last:{}};if(WD.k!==k){WD.k=k;WD.d=J(k,{});WD.d.fav??=[];WD.d.favM??=[];if(!WD.d.favC){const p=pl(),ids=new Set(S.pls.map(x=>x.id)),o=WD.d.favC=[...new Set([...(p&&S.favs[p.id])||[],...Object.keys(S.favs).filter(id=>!ids.has(id)).flatMap(id=>S.favs[id]||[])].map(String))];o.length&&setTimeout(()=>{o.forEach(k=>{const c=S.chans.find(x=>ckey(x)===k);pushFav(k,true,c&&{name:c.name,img:c.logo},'live')});wSave()},0)}WD.d.last??={}}return WD.d};
const wSave=()=>{const k=wKey();k&&LS.setItem(k,JSON.stringify(WD()))};
const favL=t=>t==='movie'?WD().favM:WD().fav;const isFavS=(id,t)=>favL(t).includes(String(id));
function toggleFavS(id,v,t){t=t||v?.type||'series';const L=favL(t),i=String(id),x=L.indexOf(i);x<0?L.unshift(i):L.splice(x,1);wSave();pushFav(i,x<0,v||S.vod?.[t]?.find?.(s=>String(s.id)===i),t);return x<0}
/* ---------- cross-device sync (Supabase RPCs; key = sha256(host|user|pass) computed here, password never sent) ---------- */
function hostOf(server){ var s=String(server).trim().toLowerCase().replace(/^[a-z]+:\/\//,''); return s.split('/')[0].split(':')[0]; }
function utf8(str){ return unescape(encodeURIComponent(str)); }
function sha256Hex(ascii){ // pure-JS SHA-256 over a byte string
  var K=[],H=[],i,j,p=2,n=0;
  function f(x){return (x-Math.floor(x))*4294967296|0;}
  while(n<64){for(j=2;j*j<=p;j++)if(p%j===0)break; if(j*j>p){if(n<8)H[n]=f(Math.pow(p,1/2));K[n++]=f(Math.pow(p,1/3));} p++;}
  var l=ascii.length*8, w=[]; ascii+='\x80'; while(ascii.length%64-56)ascii+='\x00';
  for(i=0;i<ascii.length;i++) w[i>>2]|=ascii.charCodeAt(i)<<((3-i)%4)*8;
  w[w.length]=(l/4294967296)|0; w[w.length]=l;
  for(j=0;j<w.length;j+=16){
    var W=w.slice(j,j+16), a=H.slice(0);
    for(i=0;i<64;i++){
      if(i>=16){var x=W[i-15],y=W[i-2];
        W[i]=(W[i-16]+((x>>>7|x<<25)^(x>>>18|x<<14)^(x>>>3))+W[i-7]+((y>>>17|y<<15)^(y>>>19|y<<13)^(y>>>10)))|0;}
      var e=a[4], t1=a[7]+((e>>>6|e<<26)^(e>>>11|e<<21)^(e>>>25|e<<7))+((e&a[5])^(~e&a[6]))+K[i]+W[i],
          b=a[0], t2=((b>>>2|b<<30)^(b>>>13|b<<19)^(b>>>22|b<<10))+((b&a[1])^(b&a[2])^(a[1]&a[2]));
      a=[(t1+t2)|0].concat(a); a[4]=(a[4]+t1)|0; a.pop();
    }
    for(i=0;i<8;i++) H[i]=(H[i]+a[i])|0;
  }
  var out=''; for(i=0;i<8;i++) out+=('00000000'+(H[i]>>>0).toString(16)).slice(-8); return out;
}
async function syncKey(server,user,pass){
  var msg=hostOf(server)+'|'+user+'|'+pass;
  if (window.crypto && crypto.subtle && window.isSecureContext){
    var d=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
    return Array.from(new Uint8Array(d)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
  }
  return sha256Hex(utf8(msg));
}
const SB='https://vrmtxrtzweblakuvkwoe.supabase.co/rest/v1/rpc/',SBK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZybXR4cnR6d2VibGFrdXZrd29lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MjcyMTAsImV4cCI6MjEwODMwMzIxMH0.PrQd5VwSHcWZF2FEIoboUes5PGlAUxbprSEaio-zGkQ';
const SY={key:{}};
async function sKey(){const p=pl();if(!p||!p.user||!p.server)return null;const k=wKey();if(!SY.key[k])SY.key[k]=await syncKey(p.server,p.user,p.pass||'');return SY.key[k]}
async function rpc(fn,body){try{const c=new AbortController(),t=setTimeout(()=>c.abort(),10000);const r=await fetch(SB+fn,{method:'POST',signal:c.signal,headers:{apikey:SBK,Authorization:'Bearer '+SBK,'Content-Type':'application/json'},body:JSON.stringify(body)});clearTimeout(t);return r.ok?await r.json():(r.status===400?{bad:1}:null)}catch(e){return null}}
const iso=ms=>new Date(ms||Date.now()).toISOString();
// queue a change (stored with the cache so it is retried when back online)
function qPush(id,body){const w=WD();(w.q??={})[id]=body;wSave();clearTimeout(SY.ft);SY.ft=setTimeout(flushQ,50)}
async function flushQ(){if(SY.fl)return;SY.fl=1;try{const k=await sKey();if(!k)return;const w=WD(),q=w.q||{};
 for(const id of Object.keys(q)){const b=q[id];const r=await rpc(b.fn,{...b.a,p_key:k});if(!r)break;if(q[id]===b)delete q[id]}wSave()}finally{SY.fl=0}}
function pushProg(v,t,d){if(!v||!v.key||v.rec||!(d>0))return;const at=Date.now(),ep=!!v.sid,id=ep?v.epId:String(v.id||v.key.slice(1));
 qPush('p:'+(ep?'episode':'movie')+':'+id,{fn:'sync_put_progress',a:{p_item_type:ep?'episode':'movie',p_item_id:id,p_series_id:ep?v.sid:null,p_season:ep?+v.s||null:null,p_episode:ep?+v.e||null:null,p_title:String(ep?v.title||v.name:v.name||'').slice(0,300),p_position_s:Math.round(t||0),p_duration_s:Math.round(Math.min(d,172800)),p_watched:t/d>=.9,p_updated_at:iso(at)}})}
function pushFav(id,on,v,t='series'){qPush('f:'+t+':'+id,{fn:'sync_set_favorite',a:{p_item_type:t,p_item_id:String(id),p_title:String(v?.name||'').slice(0,300),p_poster:v?.img&&String(v.img).length<=1000?v.img:null,p_fav:on}})}
async function syncGet(){if(SY.g)return SY.g;SY.g=(async()=>{try{await flushQ();const k=await sKey();if(!k)return false;const r=await rpc('sync_get',{p_key:k});if(!r||r.bad||!r.progress)return false;
 const w=WD(),q=w.q||{};let ch=false;
 // favorites: server list wins, except toggles still waiting to be pushed
  for(const [t,F] of [['series','fav'],['movie','favM'],['live','favC']]){const fav=new Set((r.favorites||[]).filter(f=>f.item_type===t).map(f=>String(f.item_id))),pre='f:'+t+':';
 for(const id in q)if(id.startsWith(pre)){const i=id.slice(pre.length);q[id].a.p_fav?fav.add(i):fav.delete(i)}
 const nf=[...w[F].filter(i=>fav.has(i)),...[...fav].filter(i=>!w[F].includes(i))];if(nf.join()!==w[F].join()){w[F]=nf;ch=true}}
 // progress: newest updated_at wins
 for(const p of r.progress||[]){const at=Date.parse(p.updated_at)||0,ep=p.item_type==='episode',k2=ep?'e'+p.series_id+':'+p.item_id:'m'+p.item_id,lo=S.resume[k2];
  if(!lo||(lo.at||0)<at){S.resume[k2]={t:+p.position_s||0,d:+p.duration_s||0,at};ch=true}
  if(ep&&p.series_id){const L=w.last[p.series_id];if(!L||(L.at||0)<at){w.last[p.series_id]={s:String(p.season??''),e:String(p.episode??''),epId:String(p.item_id),ext:L&&L.epId===String(p.item_id)?L.ext:'mp4',title:L?.epId===String(p.item_id)?L.title:'',name:L?.name||'',img:L?.img,t:+p.position_s||0,d:+p.duration_s||0,at};ch=true}}}
 // local-newer episode progress the server doesn't have yet
 const sv={};(r.progress||[]).forEach(p=>sv[p.item_type+':'+p.item_id]=Date.parse(p.updated_at)||0);
 for(const sid in w.last){const L=w.last[sid];if(L.d>0&&(sv['episode:'+L.epId]||0)<L.at)qPush('p:episode:'+L.epId,{fn:'sync_put_progress',a:{p_item_type:'episode',p_item_id:L.epId,p_series_id:sid,p_season:+L.s||null,p_episode:+L.e||null,p_title:String(L.title||'').slice(0,300),p_position_s:Math.round(L.t||0),p_duration_s:Math.round(L.d),p_watched:L.t/L.d>=.9,p_updated_at:iso(L.at)}})}
 if(ch){wSave();LS.setItem('ctv.resume',JSON.stringify(S.resume))}return ch}finally{setTimeout(()=>SY.g=null,0)}})();return SY.g}
window.addEventListener('online',()=>flushQ());
function noteLast(v,t,d){if(!v||!v.sid)return;const w=WD(),o=w.last[v.sid]||{};w.last[v.sid]={s:v.s,e:v.e,epId:v.epId,ext:v.ext,title:v.title||'',name:v.sname,img:v.img,t:t??(o.epId===v.epId?o.t:0)??0,d:d??(o.epId===v.epId?o.d:0)??0,at:Date.now()};wSave()}
const isMixed=u=>location.protocol==='https:'&&/^http:\/\//i.test(u||'');
const IOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const ckey=c=>String(c.id||c.url);const favSet=()=>new Set(WD().favC||[]);
const hm=t=>new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
const fmt=s=>{s=Math.max(0,Math.round(s));const h=s/3600|0,m=(s%3600)/60|0,x=s%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0')};
const initials=n=>(n||'TV').replace(/\(.*?\)|\[.*?\]/g,'').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
const logo=(c,cls='')=>c.logo&&!isMixed(c.logo)?`<div class="lg ${cls}" style="background-image:url('${esc(c.logo)}')"></div>`:`<div class="lg fb ${cls}">${esc(initials(c.name))}</div>`;
function toast(t,ms=3200){const e=$('#toast');e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,ms)}

/* ---------- network (direct from the viewer's browser; no proxy) ---------- */
const WHY="Browsers have security rules that apps don't. A secure page (https) can't load http:// links (\"mixed content\"), and the provider's server must allow web access (CORS). Many IPTV providers only offer http or block browsers. Those channels still work in the CheeseTV Android / Google TV app, on Roku, and in the upcoming CheeseTV iPhone app.";
async function getText(url,what,o,ms=15000,sig){try{return await getText1(url,what,o,ms,sig)}catch(e){if(sig?.aborted||!e.retry)throw e.err||e;await new Promise(r=>setTimeout(r,1500));return getText1(url,what,o,ms,sig).catch(x=>{throw x.err||x})}}
async function getText1(url,what,o,ms=15000,sig){
 if(isMixed(url))throw new Error(`This ${what} link uses http:// (not secure). Web browsers (Safari and Chrome) block http links on secure websites, so the CheeseTV web app can't load it. ${APPS}`);
 let r;const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),ms);sig?.addEventListener('abort',()=>ac.abort());try{r=await fetch(url,{cache:'no-store',signal:ac.signal});if(r.ok){const tx=await r.text();if(o)o.url=r.url||url;return tx}}catch(e){if(ac.signal.aborted&&!sig?.aborted)throw new Error(`The ${what} didn't answer within ${ms/1000} seconds.`);throw {retry:!sig?.aborted,err:new Error(`Couldn't reach the ${what}. The server is offline, or it blocks web browsers (CORS). The CheeseTV Android/Roku app can still load it.`)}}finally{clearTimeout(tm)}
 if(!r.ok)throw new Error(`The ${what} server answered with error ${r.status}.`);if(o)o.url=r.url||url;return r.text();
}
const getJSON=async(u,w)=>{const t=await getText(u,w);try{return JSON.parse(t)}catch(e){throw new Error(`The ${w} sent something that isn't valid data.`)}};
function parseM3U(t){
 const out=[];let meta=null;const head=t.match(/#EXTM3U[^\n]*/);const epg=head&&(head[0].match(/(?:url-tvg|x-tvg-url)="([^"]+)"/)||[])[1];
 for(let l of t.split(/\r?\n/)){l=l.trim();if(!l)continue;
  if(l.startsWith('#EXTINF')){const a=k=>(l.match(new RegExp(k+'="([^"]*)"'))||[])[1]||'';meta={name:l.slice(l.lastIndexOf(',')+1).trim(),tvg:a('tvg-id'),logo:a('tvg-logo'),group:a('group-title')||'Other',num:a('tvg-chno')}}
  else if(l.startsWith('#EXTGRP:')&&meta)meta.group=l.slice(8).trim();
  else if(!l.startsWith('#')){const m=meta||{name:l.split('/').pop(),group:'Other'};out.push({...m,name:m.name||'Channel',url:l});meta=null}}
 if(!out.length)throw new Error("That link loaded, but it isn't an M3U playlist with channels. Check the URL.");
 return {chans:out,epg};
}
const xb=p=>p.server.replace(/\/+$/,''),xq=p=>`username=${encodeURIComponent(p.user)}&password=${encodeURIComponent(p.pass)}`,xp=p=>`${encodeURIComponent(p.user)}/${encodeURIComponent(p.pass)}`;
let XTI=null; // reuse the sign-in answer: some providers reject the same request repeated within ~1s (404, no CORS)
async function loadXtream(p){
 const ck=p.server+'|'+p.user;const info=XTI&&XTI.k===ck&&Date.now()-XTI.t<60000?XTI.j:await getJSON(`${xb(p)}/player_api.php?${xq(p)}`,'Xtream server');XTI=null;
 if(!info.user_info||String(info.user_info.auth)!=='1')throw new Error('Sign in failed. Check the server URL, username and password.');
 const fm=info.user_info.allowed_output_formats||[];p.fmt=fm.includes('m3u8')||!fm.length?'m3u8':'ts';
 const [cats,streams]=await Promise.all([getJSON(`${xb(p)}/player_api.php?${xq(p)}&action=get_live_categories`,'Xtream server'),getJSON(`${xb(p)}/player_api.php?${xq(p)}&action=get_live_streams`,'Xtream server')]);
 const cn={};(cats||[]).forEach(c=>cn[c.category_id]=c.category_name);
 return {chans:(streams||[]).map(s=>({id:'x'+s.stream_id,num:s.num,name:s.name,logo:s.stream_icon,tvg:s.epg_channel_id||'',group:cn[s.category_id]||'Other',
  url:`${xb(p)}/live/${xp(p)}/${s.stream_id}.${p.fmt}`,alt:`${xb(p)}/live/${xp(p)}/${s.stream_id}.${p.fmt==='m3u8'?'ts':'m3u8'}`})),epg:`${xb(p)}/xmltv.php?${xq(p)}`};
}
async function loadActive(){syncGet().then(ch=>{if(ch&&S.chans.length&&S.view!=='vod')render()});
 const p=pl();S.chans=[];S.epg={};S.epgState='';S.vod=null;
 if(!p){showSignin();return}
 S.active=p.id;S.sepg={};S.sepgQ=[];$('#signin').hidden=true;$('#shell').hidden=false;$('#tabVod').hidden=p.type!=='xt';if(p.type!=='xt'&&S.view==='vod')S.view='guide';
 skeleton();
 try{const r=p.type==='xt'?await loadXtream(p):parseM3U(await getText(p.url,'playlist'));S.chans=r.chans.map((c,i)=>({...c,n:i+1}));S.epgUrl=p.epg||r.epg||''}
 catch(e){$('#hero').innerHTML='';$('#guide').innerHTML=`<div class="perr" style="position:static;transform:none"><h4>Couldn't load "${esc(p.name)}"</h4><p>${esc(e.message)}</p><div class="row"><button class="btn gold" onclick="loadActive()">Try again</button><button class="btn dark" onclick="openSettings()">Playlists</button></div></div>`;return}
 render();loadEpg();
}
function skeleton(){$('#hero').innerHTML='<div class="sk" style="position:absolute;inset:0;border-radius:0"></div>';$('#groups').innerHTML=Array(5).fill('<div class="sk" style="width:90px;height:38px;flex:none"></div>').join('');$('#guide').innerHTML=Array(7).fill('<div class="sk skrow"></div>').join('')}
/* ---------- EPG ---------- */
function xt(s){const m=s.match(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)\s*([+-]\d{4})?/);if(!m)return 0;const z=m[7]||'+0000';return Date.UTC(m[1],m[2]-1,m[3],m[4],m[5],m[6])-(z[0]==='-'?-1:1)*(parseInt(z.slice(1,3))*60+parseInt(z.slice(3)))*60000}
async function loadEpg(){
 if(!S.epgUrl||!S.chans.some(c=>c.tvg)){S.epgState='none';return}
 if(/\.gz(\?|$)/i.test(S.epgUrl)){S.epgState='gz';render();return}
 S.epgState='loading';
 try{const doc=new DOMParser().parseFromString(await getText(S.epgUrl,'TV guide',null,45000),'text/xml');const n=Date.now(),lo=n-3*36e5,hi=n+12*36e5,e={};
  for(const p of doc.getElementsByTagName('programme')){const a=xt(p.getAttribute('start')||''),b=xt(p.getAttribute('stop')||'');if(b<lo||a>hi)continue;
   (e[p.getAttribute('channel')]??=[]).push({a,b,t:p.getElementsByTagName('title')[0]?.textContent||'',d:p.getElementsByTagName('desc')[0]?.textContent||''})}
  Object.values(e).forEach(v=>v.sort((x,y)=>x.a-y.a));S.epg=e;S.epgState='ok'}catch(err){S.epgState='err'}
 render();
}
const progs=c=>S.epg[c.tvg]||S.sepg?.[c.id]||[];const nowProg=c=>{const n=Date.now();return progs(c).find(p=>p.a<=n&&p.b>n)};

/* ---------- IndexedDB segment store (timeshift + recordings) ---------- */
const DB={db:null,open(){return this.db||(this.db=new Promise((res,rej)=>{const r=indexedDB.open('cheesetv',1);r.onupgradeneeded=()=>{r.result.createObjectStore('segs');r.result.createObjectStore('recs',{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}))},
 async tx(st,mode,fn){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction(st,mode),s=t.objectStore(st);const r=fn(s);t.oncomplete=()=>res(r&&r.result);t.onerror=t.onabort=()=>rej(t.error)})},
 put(k,v){return this.tx('segs','readwrite',s=>s.put(v,k))},get(k){return this.tx('segs','readonly',s=>s.get(k))},del(keys){return keys.length?this.tx('segs','readwrite',s=>{keys.forEach(k=>s.delete(k))}):Promise.resolve()},
 recs(){return this.tx('recs','readonly',s=>s.getAll())},putRec(r){return this.tx('recs','readwrite',s=>s.put(r))},delRec(id){return this.tx('recs','readwrite',s=>s.delete(id))},
 allKeys(){return this.tx('segs','readonly',s=>s.getAllKeys())}};
async function sweep(){try{const recs=await DB.recs(),keep=new Set();recs.forEach(r=>Object.values(r.tracks).forEach(t=>{t.segs.forEach(s=>keep.add(s.k));t.segs.forEach(s=>s.init&&keep.add(s.init))}));
 await DB.del((await DB.allKeys()).filter(k=>!keep.has(k)))}catch(e){}}

/* ---------- HLS recorder: fetches the stream's own playlist + segments in the viewer's browser and keeps them locally ---------- */
const attrs=l=>{const o={};l.replace(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g,(_,k,v)=>o[k]=v.replace(/^"|"$/g,''));return o};
const abs=(u,b)=>new URL(u,b).href;
class Recorder{
 constructor(url){this.url=url;this.sid='s'+Date.now().toString(36);this.tracks={};this.stopped=false;this.started=Date.now();this.rec=null;this.pinned=new Set();this.err=null;this.ac=new AbortController()}
 async start(){
  const o={};const txt=await getText(this.url,'stream',o,8000,this.ac.signal);this.url=o.url;if(!/#EXTM3U/.test(txt))throw new Error('not hls');
  let mainUrl=this.url,audioUrl=null,inf='';
  if(/#EXT-X-STREAM-INF/.test(txt)){
   const L=txt.split(/\r?\n/),vars=[],aud={};
   L.forEach((l,i)=>{if(l.startsWith('#EXT-X-STREAM-INF:')){let j=i+1;while(L[j]&&L[j].startsWith('#'))j++;vars.push({a:attrs(l.slice(18)),raw:l.slice(18),u:abs(L[j].trim(),this.url)})}
    if(l.startsWith('#EXT-X-MEDIA:')){const a=attrs(l.slice(13));if(a.TYPE==='AUDIO'&&a.URI){(aud[a['GROUP-ID']]??=[]).push(a)}}});
   vars.sort((x,y)=>(+x.a.BANDWIDTH||0)-(+y.a.BANDWIDTH||0));
   const MS=window.ManagedMediaSource||window.MediaSource,okc=x=>!x.a.CODECS||!MS||MS.isTypeSupported(`video/mp4; codecs="${x.a.CODECS}"`)||x.a.CODECS.split(',').every(c=>/^\s*(avc1|mp4a\.40)/.test(c));
   let good=vars.filter(okc);if(!good.length)throw new Error('codecs');const vid=good.filter(x=>x.a.RESOLUTION||/avc|hvc|hev/.test(x.a.CODECS||''));if(vid.length)good=vid;
   const v=[...good].reverse().find(x=>(+x.a.BANDWIDTH||0)<=4.5e6)||good[0];
   mainUrl=v.u;inf=v.raw.replace(/,?(AUDIO|SUBTITLES|CLOSED-CAPTIONS|VIDEO)=("[^"]*"|[^,]*)/g,'').replace(/^,/,'');
   const g=v.a.AUDIO&&aud[v.a.AUDIO];if(g){const d=g.find(a=>a.DEFAULT==='YES')||g[0];audioUrl=abs(d.URI,this.url)}
  }
  this.inf=inf||'BANDWIDTH=2000000';
  this.tracks.main=this.mk('main',mainUrl);if(audioUrl)this.tracks.audio=this.mk('audio',audioUrl);
  await Promise.all(Object.values(this.tracks).map(t=>this.poll(t,true)));
  Object.values(this.tracks).forEach(t=>this.loop(t));
 }
 mk(name,url){return {name,url,segs:[],queue:[],seen:-1,idx:0,td:6,ended:false,inits:{},fetched:0}}
 async poll(t,first){
  const o={};const txt=await getText(t.url,'stream',o,8000,this.ac.signal);if(o.url)t.url=o.url;const L=txt.split(/\r?\n/);let seq=0,dur=0,disc=false,map=null,key=null,br=null,nextOff=0;const list=[];
  const rng=(v,prevUrl)=>{const [n,o]=v.split('@');return [o!==undefined?+o:nextOff,+n]};
  for(let l of L){l=l.trim();if(!l)continue;
   if(l.startsWith('#EXT-X-MEDIA-SEQUENCE:'))seq=+l.slice(22);else if(l.startsWith('#EXT-X-TARGETDURATION:'))t.td=+l.slice(22)||6;
   else if(l.startsWith('#EXTINF:'))dur=parseFloat(l.slice(8));else if(l.startsWith('#EXT-X-DISCONTINUITY')&&!l.includes('SEQ'))disc=true;
   else if(l.startsWith('#EXT-X-MAP:')){const a=attrs(l.slice(11));map=abs(a.URI,t.url)+(a.BYTERANGE?'#br='+(()=>{const [n,o]=a.BYTERANGE.split('@');return (+o||0)+'-'+n})():'')}
   else if(l.startsWith('#EXT-X-BYTERANGE:'))br=rng(l.slice(17));
   else if(l.startsWith('#EXT-X-KEY:')){const a=attrs(l.slice(11));key=a.METHOD==='NONE'?null:l.replace(/URI="([^"]*)"/,(_,u)=>`URI="${abs(u,t.url)}"`);if(a.METHOD&&a.METHOD!=='NONE'&&a.METHOD!=='AES-128')throw new Error('drm')}
   else if(l.startsWith('#EXT-X-ENDLIST'))t.ended=true;
   else if(!l.startsWith('#')){list.push({sn:seq++,d:dur,u:abs(l,t.url),disc,map,key,br});if(br)nextOff=br[0]+br[1];br=null;disc=false}}
  if(first&&!t.ended&&list.length>3)list.splice(0,list.length-3);
  for(const s of list)if(s.sn>t.seen){t.queue.push(s);t.seen=s.sn}
 }
 async loop(t){let lastPoll=Date.now(),fails=0;
  while(!this.stopped){
   const elapsed=(Date.now()-this.started)/1000;
   if(t.queue.length&&t.fetched<elapsed+25){const s=t.queue.shift();
    try{await this.fetchSeg(t,s);fails=0}catch(e){if(++fails<3){t.queue.unshift(s);await new Promise(r=>setTimeout(r,1000))}else{fails=0;if(t.segs.length===0){this.err=e;return}}}
    continue}
   if(!t.ended&&Date.now()-lastPoll>t.td*500){lastPoll=Date.now();try{await this.poll(t)}catch(e){}}
   await new Promise(r=>setTimeout(r,400));
  }}
 async fetchSeg(t,s){
  if(s.map&&!t.inits[s.map]){const [mu,mb]=s.map.split('#br=');let o;if(mb){const [a,n]=mb.split('-');o={headers:{Range:`bytes=${a}-${+a+ +n-1}`}}}const r=await fetch(mu,{...(o||{}),signal:AbortSignal.any?AbortSignal.any([this.ac.signal,AbortSignal.timeout(10000)]):this.ac.signal});if(!r.ok)throw new Error(r.status);const k=`${this.sid}/${t.name}/init${Object.keys(t.inits).length}`;await DB.put(k,await r.arrayBuffer());t.inits[s.map]=k}
  const r=await fetch(s.u,{...(s.br?{headers:{Range:`bytes=${s.br[0]}-${s.br[0]+s.br[1]-1}`}}:{}),signal:AbortSignal.any?AbortSignal.any([this.ac.signal,AbortSignal.timeout(10000)]):this.ac.signal});if(!r.ok)throw new Error('HTTP '+r.status);if(s.br&&r.status!==206)throw new Error('no range');const buf=await r.arrayBuffer();if(this.stopped)return;
  const k=`${this.sid}/${t.name}/${t.idx}`;await DB.put(k,buf);
  const seg={i:t.idx++,k,d:s.d,disc:s.disc,init:s.map?t.inits[s.map]:null,key:s.key,size:buf.byteLength,at:Date.now()};t.segs.push(seg);t.fetched+=s.d;
  if(this.rec){this.rec.tracks[t.name]?.segs.push(seg)??(this.rec.tracks[t.name]={segs:[seg]});this.pinned.add(k);seg.init&&this.pinned.add(seg.init)}
  let tot=t.segs.reduce((a,x)=>a+x.d,0);const drop=[];
  while(tot>S.tsMin*60&&t.segs.length>3){const o=t.segs.shift();tot-=o.d;if(!this.pinned.has(o.k))drop.push(o.k)}
  if(drop.length)DB.del(drop).catch(()=>{});
 }
 dur(){return (this.tracks.main?.segs||[]).reduce((a,x)=>a+x.d,0)}
 bytes(){return Object.values(this.tracks).reduce((a,t)=>a+t.segs.reduce((b,x)=>b+x.size,0),0)}
 stop(){this.stopped=true;try{this.ac.abort()}catch(e){}const keys=[];Object.values(this.tracks).forEach(t=>{t.segs.forEach(s=>!this.pinned.has(s.k)&&keys.push(s.k));Object.values(t.inits).forEach(k=>!this.pinned.has(k)&&keys.push(k))});DB.del(keys).catch(()=>{})}
}
const LOC='https://ctv.local/';
function mediaPlaylist(segs,ended){
 const td=Math.ceil(Math.max(1,...segs.map(s=>s.d)));let o=`#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:${td}\n#EXT-X-MEDIA-SEQUENCE:${segs[0]?.i||0}\n${ended?'#EXT-X-PLAYLIST-TYPE:VOD\n':''}`;let lastInit=null,lastKey=null;
 segs.forEach((s,n)=>{if(s.disc&&n)o+='#EXT-X-DISCONTINUITY\n';if(s.init&&s.init!==lastInit){o+=`#EXT-X-MAP:URI="${LOC}seg/${encodeURIComponent(s.init)}"\n`;lastInit=s.init}
  if((s.key||null)!==lastKey){o+=(s.key||'#EXT-X-KEY:METHOD=NONE')+'\n';lastKey=s.key||null}o+=`#EXTINF:${s.d.toFixed(3)},\n${LOC}seg/${encodeURIComponent(s.k)}\n`});
 return o+(ended?'#EXT-X-ENDLIST\n':'');
}
const masterPlaylist=(base,inf,hasAudio)=>`#EXTM3U\n${hasAudio?`#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",NAME="Audio",DEFAULT=YES,AUTOSELECT=YES,URI="${base}audio.m3u8"\n`:''}#EXT-X-STREAM-INF:${inf}${hasAudio?',AUDIO="a"':''}\n${base}main.m3u8\n`;
const Local={live:null,recs:{}};
async function localFetch(u){
 const p=u.slice(LOC.length).split('/');
 if(p[0]==='seg'){const b=await DB.get(decodeURIComponent(p[1]));if(!b)throw new Error('missing segment');return b}
 const src=p[0]==='live'?(Local.live&&Local.live.sid===p[1]?{tracks:Local.live.tracks,inf:Local.live.inf,ended:false}:null):Local.recs[p[1]];
 if(!src)throw new Error('gone');
 if(p[2]==='master.m3u8')return masterPlaylist(`${LOC}${p[0]}/${p[1]}/`,src.inf,!!src.tracks.audio);
 const t=src.tracks[p[2].replace('.m3u8','')];return mediaPlaylist(t.segs,src.ended);
}
function makeLoader(){const D=Hls.DefaultConfig.loader;
 return class LocalLoader{constructor(c){this.c=c;this.d=null;this._s=mkStats()}get stats(){return this.d?this.d.stats:this._s}
  load(ctx,cfg,cb){this.context=ctx;if(!ctx.url.startsWith(LOC)){this.d=new D(this.c);return this.d.load(ctx,cfg,cb)}
   const st=this._s=mkStats();st.loading.start=performance.now();
   localFetch(ctx.url).then(data=>{if(this.aborted)return;const n=performance.now();st.loading.first=st.loading.end=n;st.loaded=st.total=data.byteLength??data.length;
    cb.onSuccess({url:ctx.url,data},st,ctx,null)}).catch(e=>{if(!this.aborted)cb.onError({code:404,text:String(e.message||e)},ctx,null,st)})}
  abort(){this.aborted=true;this._s.aborted=true;this.d?.abort()}destroy(){this.d?.destroy();this.d=null}}}
const mkStats=()=>({aborted:false,loaded:0,retry:0,total:0,chunkCount:0,bwEstimate:0,loading:{start:0,first:0,end:0},parsing:{start:0,end:0},buffering:{start:0,first:0,end:0}});

/* ---------- player ---------- */
const V=$('#video');const P={hls:null,ts:null,rec:null,mode:'',list:[],idx:0,vod:null,recording:null,token:0};
const kind=u=>{const p=(u||'').split('?')[0].toLowerCase();return /\.m3u8?$/.test(p)?'hls':p.endsWith('.ts')?'ts':/\.(mp4|m4v|webm|mov|mkv|avi)$/.test(p)?'file':'unknown'};
const hlsOK=()=>!!(window.Hls&&Hls.isSupported());
const nativeOK=()=>!!V.canPlayType('application/vnd.apple.mpegurl');
function teardown(){stopRecording(true);try{V.pause()}catch(e){}if(P.eng){try{P.eng.destroy()}catch(e){}P.eng=null}try{P.hls&&P.hls.destroy()}catch(e){}try{P.ts&&P.ts.destroy()}catch(e){}P.hls=P.ts=null;if(P.rec){P.rec.stop();if(Local.live===P.rec)Local.live=null;P.rec=null}
 V.onerror=V.onplaying=null;V.removeAttribute('src');V.load()}
function spin(on){$('#pSpin').classList.toggle('on',!!on);if(!on)status('')}
function status(t){let e=$('#pSpinT');if(!e){e=document.createElement('b');e.id='pSpinT';e.className='pspin-t';$('#pSpin').appendChild(e);const b=document.createElement('button');b.id='pSpinB';b.className='pspin-b';b.textContent='Details';const d=document.createElement('pre');d.id='pSpinD';d.className='pspin-d';d.hidden=true;b.onclick=ev=>{ev.stopPropagation();d.hidden=!d.hidden;d.textContent=netTxt()};$('#pSpin').append(b,d)}e.textContent=t;$('#pSpinB').hidden=!t}
function showErr(title,msg,detail){spin(false);$('#pErr').innerHTML=`<h4>${esc(title)}</h4><p>${esc(msg)}</p>${detail?`<button class="pspin-b" onclick="this.nextElementSibling.hidden=!this.nextElementSibling.hidden">Details</button><p class="d" hidden>${esc(detail)}</p>`:''}${P.vod&&P.vod.url?`<p class="note">${IOS?'Play it in the free VLC app instead: tap Open in VLC.':ANDROID?'Play it in the free VLC app (Open in VLC), or in the CheeseTV app.':'Copy the stream link and open it in VLC (Media › Open Network Stream), or use the CheeseTV app.'} It uses your same one connection.</p><div class="row">${IOS?`<button class="btn gold vlc" id="eVlc">&#9654; Open in VLC</button><button class="btn dark" id="eRetry">Try again</button>`:`<button class="btn dark" id="eRetry">Try again</button><button class="btn gold vlc" id="eVlc">${ANDROID?'&#9654; Open in VLC':'Copy stream link'}</button>`}</div>${IOS?'':`<div class="row"><a class="btn dark" href="${APP_URL}"${ANDROID?'':' target="_blank" rel="noopener"'}>Get the app</a></div>`}<div id="eVlcGet"></div>`:`<p class="note">Channels that won't play in a browser usually still work in the CheeseTV ${IOS?'iPhone app (coming soon to the App Store)':'Android / Google TV app'} or on Roku. If CheeseTV is open in other browser tabs, close them.</p><div class="row"><button class="btn dark" id="eRetry">Try again</button><a class="btn gold" href="${APP_URL}"${ANDROID?'':' target="_blank" rel="noopener"'}>Get the app</a></div>`}`;
 $('#pErr').hidden=false;$('#eRetry').onclick=()=>P.vod?playVod(P.vod):playChannel(P.idx,P.list);$('#eVlc')&&($('#eVlc').onclick=()=>openVlc(P.vod.url,$('#eVlcGet')))}
/* Open in VLC: hand the real movie/episode URL to the VLC app. The browser's video is fully released first (1-connection plans). */
const VLC_IOS='https://apps.apple.com/'+'app/vlc-media-player/id650377962',VLC_PLAY='https://play.google.com/store/apps/details?id=org.videolan.vlc';
const vlcHref=u=>IOS?'vlc-x-callback://x-callback-url/stream?url='+encodeURIComponent(u):ANDROID?'intent:'+u+'#Intent;package=org.videolan.vlc;type=video/*;S.browser_fallback_url='+encodeURIComponent(VLC_PLAY)+';end':'';
function openVlc(u,box,v){if(!u)return;v=v||P.vod;if(v&&v.url===u){v.sid&&noteLast(v);const r=S.resume[v.key]||{},L=v.sid&&WD().last[v.sid];pushProg(v,r.t||L?.t||0,r.d||L?.d||1)}
 if(!IOS&&!ANDROID){const ok=()=>toast('Stream link copied. In VLC: Media › Open Network Stream, then paste.',6000);
  (navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(ok,()=>{window.prompt('Copy this link, then in VLC choose Media › Open Network Stream:',u)});return}
 tabClaim();++P.token;teardown();spin(false);let left=false;const vis=()=>{if(document.hidden)left=true};document.addEventListener('visibilitychange',vis);window.addEventListener('pagehide',vis);
 location.href=vlcHref(u);
 if(IOS)setTimeout(()=>{document.removeEventListener('visibilitychange',vis);if(left||document.hidden)return;
  const g=box||document.body,h=`<p class="note">Don't have VLC? It's free on the App Store.</p><a class="btn gold" href="${VLC_IOS}" target="_blank" rel="noopener">Get VLC (free)</a>`;
  if(box){box.innerHTML=h}else toast("VLC didn't open. Get VLC (free) from the App Store.",6000),window.open(VLC_IOS,'_blank')},2000)}
function openPlayer(){if($('#player').hidden)hpush('player');$('#player').hidden=false;$('#pErr').hidden=true;$('#mini').hidden=true;osdShow();if(!$('#player').dataset.k){$('#player').dataset.k=1}}
function playChannel(i,list){
 list=list||P.list;if(!list.length)return;i=(i+list.length)%list.length;const c=list[i];P.list=list;P.idx=i;P.vod=null;S.cur=c;
 const r=S.recent[pl().id]=(S.recent[pl().id]||[]).filter(k=>k!==ckey(c));r.unshift(ckey(c));r.length=Math.min(r.length,20);save();
 openPlayer();$('#pName').textContent=(c.num||c.n?`${c.num||c.n}  `:'')+c.name;updFavBtn();$('#pLogo').outerHTML=logo(c,'ologo').replace('class="lg','id="pLogo" class="lg');updNow();
 $('#pRec').hidden=false;$('#pVlc').hidden=true;$('#pChUp').hidden=$('#pChDn').hidden=false;
 const urls=[c.url];if(c.alt)urls.push(c.alt);else if(kind(c.url)==='unknown')urls.push(c.url+'.m3u8');
 urls.sort((a,b)=>(kind(b)==='hls')-(kind(a)==='hls'));start(urls,true);
}
function updNow(){const c=S.cur;if(!c||P.vod)return;const np=nowProg(c);$('#pNow').textContent=np?`${np.t} · ${hm(np.a)} – ${hm(np.b)}`:(c.group||'Live TV')}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function netLog(d){P.net={t:new Date().toLocaleTimeString(),...d};const e=$('#pSpinD');if(e&&!e.hidden)e.textContent=netTxt()}
const redact=u=>{try{const x=new URL(u);return x.host+x.pathname.replace(/\/live\/[^/]+\/[^/]+\//,'/live/…/…/').replace(/\/(play|hls)\/[^/]+\//,'/$1/…/')}catch(e){return String(u||'').slice(0,60)}};
const netTxt=()=>{const n=P.net;if(!n)return 'No network errors yet.';return [`${n.t} ${n.step||''}`,n.status!==undefined?`status: ${n.status}`:'',n.err?`error: ${n.err}`:'',n.url?`url: ${redact(n.url)}`:''].filter(Boolean).join('\n')};
async function start(urls,live){
tabClaim();
 const tok=++P.token,had=!!(P.hls||P.ts||P.rec||P.eng||P.recording||V.getAttribute('src'));teardown();spin(true);$('#pErr').hidden=true;$('#mini').hidden=true;P.live=live;P.net=null;
 if(had){status('Closing the previous stream…');await sleep(1000);if(tok!==P.token)return} // 1-connection plans: the old stream must be fully closed first
 const T0=Date.now(),DEADLINE=60000,fresh=()=>tok===P.token&&Date.now()-T0<DEADLINE&&!document.hidden;status('Connecting…');let lastErr=null;
 // 1) simplest first: plain hls.js (or native HLS), 2) direct .ts via mpegts.js, 3) native <video>. Pause & rewind (local segment store) only when the user wants it.
 const steps=[];
 // movies/series files (mp4/mkv/…): plain <video src>, no crossOrigin, so no CORS or preflight is needed
 const files=urls.filter(u=>kind(u)==='file');if(files.length&&!live){V.removeAttribute('crossorigin');files.forEach(u=>steps.push(['file',u]))}
 const rest=urls.filter(u=>kind(u)!=='file');if(files.length&&!live)urls=rest;
 const hlsU=urls.filter(u=>kind(u)!=='ts'),tsU=urls.filter(u=>kind(u)==='ts'||kind(u)==='unknown');
 if(live&&P.wantShift&&hlsOK())hlsU.forEach(u=>steps.push(['shift',u]));
 // Direct .ts first where MSE exists (Android/desktop): Xtream frees a .ts connection within seconds, while an HLS session holds the 1-connection slot for ~1 minute.
 if(live&&!P.wantShift&&!P.forceNative&&window.mpegts&&mpegts.getFeatureList().mseLivePlayback)tsU.forEach(u=>steps.push(['ts',u]));
 hlsU.forEach(u=>steps.push([(P.forceNative||IOS&&!hlsOK())&&nativeOK()?'native':hlsOK()?'hls':'native',u]));
 if(!(live&&!P.wantShift&&!P.forceNative)&&window.mpegts&&mpegts.getFeatureList().mseLivePlayback)tsU.forEach(u=>steps.push(['ts',u]));
 else if(tsU.length&&!steps.length)lastErr={t:"This channel can't play in this browser",m:'This is a raw .ts stream. iPhone Safari can only play HLS (.m3u8) streams in a web page.'};
 let first=true;
 for(let si=0,busy=0;si<steps.length;si++){const [how,u]=steps[si];
  if(!fresh())break;const ta=Date.now();
  if(isMixed(u)){lastErr={t:"This channel can't play in a browser",m:'The stream link starts with http://, and secure web pages (https) are not allowed to play http streams.',d:redact(u)};continue}
  if(!first){teardown();await sleep(800);if(!fresh())break} // let the provider free its single connection slot
  first=false;P.lastErr=null;
  if(how==='shift'){status('Starting pause & rewind…');const rec=new Recorder(u);
   try{await Promise.race([rec.start(),sleep(9000).then(()=>{throw new Error('timeout')})]);const t0=Date.now();
    while(fresh()&&!rec.err&&rec.tracks.main.segs.length<1&&Date.now()-t0<12000)await sleep(250);
    if(fresh()&&rec.tracks.main.segs.length>=1){P.rec=rec;Local.live=rec;if(await tryHls(`${LOC}live/${rec.sid}/master.m3u8`,true,tok))return setMode('shift')}
    netLog({step:'pause&rewind',err:rec.err?.message||'no segments',url:u})}catch(e){netLog({step:'pause&rewind',err:e.message,url:u})}
   rec.stop();if(P.rec===rec){P.rec=null;Local.live=null}lastErr=P.lastErr||lastErr;continue}
  if(how==='hls'){status(busy?`Waiting for your provider to free your connection… (${busy})`:'Trying HLS stream…');if(await tryHls(u,false,tok,live))return setMode(live?'buffer':'vod');lastErr=P.lastErr||lastErr;
   if(P.net?.status===458&&busy<10&&fresh()){busy++;lastErr={t:'Your provider says your connection is in use',m:'Your plan allows 1 connection at a time. Close CheeseTV or other IPTV apps on your other devices, wait a minute, and try again. If CheeseTV is open in other browser tabs, close them.',d:'error 458'};await sleep(Math.min(4000+busy*1000,8000));si--;}continue}
  if(how==='ts'){status(busy?`Waiting for your provider to free your connection… (${busy})`:'Starting stream…');if(await tryTs(u,tok))return setMode('ts');lastErr=P.lastErr||lastErr;
   // quick refusal = the provider's 1-connection slot is still held (error 458 / 407); wait and retry the same stream
   if(Date.now()-ta<4000&&busy<10&&fresh()){busy++;lastErr={t:'Your provider says your connection is in use',m:'Your plan allows 1 connection at a time. Close CheeseTV or other IPTV apps on your other devices, wait a minute, and try again. If CheeseTV is open in other browser tabs, close them.',d:'busy (458/407)'};await sleep(Math.min(3000+busy*1000,8000));si--;}continue}
  if(how==='file'){status('Opening movie…');if(await tryNative(u,tok,20000))return setMode('vod');lastErr=P.lastErr||lastErr;
   if(Date.now()-ta<4000&&busy<4&&fresh()){busy++;status(`Waiting for your provider to free your connection… (${busy})`);teardown();await sleep(3000+busy*2000);si--;continue} // quick refusal: 1-connection slot still held
   if(fresh()){teardown();status('Trying the single-connection player…');await sleep(1000);if(await tryEngine(u,tok))return setMode('vod');lastErr=P.lastErr||lastErr}
   const fmt=/media error 3/.test(lastErr?.d||'');
   lastErr=fmt?{t:"This movie's format can't play in a browser",m:"This file uses a video format (for example HEVC/H.265 10-bit) that this browser can't play. Use the CheeseTV Android / Google TV app or Roku, or pick another version of this title (MP4) if your provider lists one.",d:lastErr?.d}
    :{t:"This movie couldn't start",m:"Your provider allows 1 connection at a time, so close other devices using your login, wait a minute and try again. If CheeseTV is open in other browser tabs, close them. If it still fails, this file's format (for example MKV or HEVC/H.265) can't play in a browser: use the CheeseTV Android / Google TV app or Roku, or pick the MP4 version if your provider lists one.",d:lastErr?.d};continue}
  status('Opening stream…');if(await tryNative(u,tok))return setMode(live?'native':'vod');lastErr=P.lastErr||lastErr;
 }
 if(tok===P.token&&document.hidden){teardown();spin(false);P.bg='retry';return} // never keep retrying in a background tab
 if(tok===P.token){if(Date.now()-T0>=DEADLINE)lastErr=lastErr||{t:'The channel is taking too long',m:"No stream format started within a minute. The channel may be offline, your provider may allow only one connection at a time (close other apps using your login), or it blocks web browsers. If CheeseTV is open in other browser tabs, close them.",d:'timeout'};
  teardown();const e=lastErr||{};if(S.pendRec&&!P.vod&&S.cur&&ckey(S.cur)===S.pendRec.k){const x=S.pendRec;S.pendRec=null;recLog({id:x.id,title:x.title,chan:x.chan,a:x.a},'failed',P.net&&!(P.net.status>0)&&/TS|HLS/.test(P.net.step||'')?"The provider's server refused this web page without an answer: it blocks browser access to the stream (CORS), or your 1 connection was busy. If live TV also won't play in this browser, it's a CORS block: use the CheeseTV Android / Fire TV app to record.":(e.t?e.t+'. ':'')+(e.m||"The channel didn't start."))}if(P.vod?.fmt?.label)e.m=(e.m||'')+` Detected format: ${P.vod.fmt.label}.`;showErr(e.t||"This channel can't play here",e.m||"The stream didn't start. It may be offline, or the provider blocks web playback (CORS).",[e.d,P.net&&netTxt().replace(/\n/g,' · ')].filter(Boolean).join(' · '))}
}
function waitPlaying(tok,ms=14000){return new Promise(res=>{let done=false;const fin=v=>{if(!done){done=true;clearTimeout(t);V.removeEventListener('playing',ok);res(v)}};const ok=()=>fin(true);
 V.addEventListener('playing',ok);const t=setTimeout(()=>{P.lastErr={t:'The channel is taking too long',m:"The stream didn't start within 14 seconds. The channel may be offline, or the provider blocks web browsers.",d:'timeout'};fin(false)},ms);P.failNow=e=>{P.lastErr=e;fin(false)};
 const iv=setInterval(()=>{if(tok!==P.token){clearInterval(iv);fin(false)}if(done)clearInterval(iv)},300)})}
function tryHls(u,local,tok,live){
 const h=P.hls=new Hls(local?{loader:makeLoader(),backBufferLength:90,liveSyncDurationCount:2,maxBufferLength:30,manifestLoadingMaxRetry:4,levelLoadingMaxRetry:6,fragLoadingMaxRetry:6}
  :{backBufferLength:S.tsMin*60,maxBufferLength:live?12:30,maxMaxBufferLength:live?30:600,liveSyncDurationCount:live?2:3,startFragPrefetch:true,liveMaxLatencyDurationCount:Infinity,manifestLoadingMaxRetry:1,levelLoadingMaxRetry:2,fragLoadingMaxRetry:2,manifestLoadingTimeOut:8000,levelLoadingTimeOut:8000,fragLoadingTimeOut:20000});
 h.on(Hls.Events.ERROR,(_,d)=>{if(window.CTV_DEBUG)console.log('hlserr',d.type,d.details,d.fatal,d.response?.code,d.error?.message);if(d.type==='networkError'||d.fatal)netLog({step:'HLS '+d.details+(d.fatal?' (fatal)':''),status:d.response?.code,err:d.error?.message||d.reason,url:d.url||d.frag?.url||d.context?.url||u});if(!d.fatal)return;if(d.type===Hls.ErrorTypes.MEDIA_ERROR&&!h._rec){h._rec=1;h.recoverMediaError();return}const code=d.response?.code;
  P.failNow?.(code===0||code===undefined&&d.type==='networkError'?{t:'The provider blocks web playback',m:"The stream server didn't allow this web page to load it (CORS), or it is offline. The CheeseTV apps don't have this limit.",d:d.details}:code&&!local?{t:'Stream unavailable',m:`The provider's server answered with error ${code}. The channel may be offline or your login may have expired.`,d:d.details}:{t:"This channel can't play here",m:'The stream format is not supported in this browser.',d:d.details})});
 const w=waitPlaying(tok);h.loadSource(u);h.attachMedia(V);h.on(Hls.Events.MANIFEST_PARSED,()=>V.play().catch(()=>{}));
 return w.then(ok=>{if(!ok){try{h.destroy()}catch(e){}if(P.hls===h)P.hls=null}return ok});
}
function tryNative(u,tok,ms){const w=waitPlaying(tok,ms);V.onerror=()=>P.failNow?.({t:"This channel can't play here",m:'The browser could not open this stream. It may be offline, use a format browsers do not support, or block web playback.',d:'media error '+(V.error?.code||'')});
 V.src=u;V.play().catch(()=>{});if(P.vod&&P.vodStart)V.addEventListener('loadedmetadata',()=>{V.currentTime=P.vodStart},{once:true});return w}
function tryTs(u,tok){const p=P.ts=mpegts.createPlayer({type:'mpegts',isLive:true,url:u},{enableStashBuffer:false,liveBufferLatencyChasing:false,autoCleanupSourceBuffer:true,autoCleanupMaxBackwardDuration:S.tsMin*60});
 p.on(mpegts.Events.ERROR,(t,d,info)=>(netLog({step:'TS '+t+' '+d,status:info?.code,err:info?.msg,url:u}),P.failNow)?.({t:t===mpegts.ErrorTypes.NETWORK_ERROR?'The provider blocks web playback':"This channel can't play here",m:t===mpegts.ErrorTypes.NETWORK_ERROR?"The stream server didn't allow this web page to load it (CORS), or it is offline.":'This stream format is not supported in this browser.',d:`${d} ${info?.msg||''}`}));
 const w=waitPlaying(tok);p.attachMediaElement(V);p.load();V.play().catch(()=>{});return w.then(ok=>{if(!ok){try{p.destroy()}catch(e){}P.ts=null}return ok})}
function setMode(m){P.mode=m;spin(false);P.wantShift=false;if(P.recAfter){P.recAfter=false;if(m==='shift')setTimeout(()=>$('#pRec').click(),300);else if(S.pendRec&&S.cur&&ckey(S.cur)===S.pendRec.k&&m!=='vod')setTimeout(()=>tsRecord(S.cur,S.pendRec),300)}$('#pMode').textContent={shift:'⏪ PAUSE & REWIND',buffer:'⏪ REWIND (buffer)',native:'NATIVE PLAYER',ts:'TS',vod:'ON DEMAND',rec:'RECORDING'}[m]||'';
 $('#pMode').title={shift:`You can pause and rewind up to ${S.tsMin} minutes, back to when you started watching this channel.`,buffer:'This provider blocks segment access, so rewind is limited to what the browser keeps in memory.',native:"iPhone's built-in player: AirPlay works, but pause & rewind and recording are not available."}[m]||'';
 $('#pAir').hidden=!window.WebKitPlaybackTargetAvailabilityEvent;$('#pLive').hidden=!(P.live);tick()}
/* scrubber */
function range(){const s=V.seekable,b=V.buffered;if(P.mode==='buffer'||P.mode==='ts'){if(b.length)return [b.start(0),b.end(b.length-1)]}
 if(s.length&&isFinite(s.end(s.length-1)))return [s.start(0),s.end(s.length-1)];if(b.length)return [b.start(0),b.end(b.length-1)];if(isFinite(V.duration))return [0,V.duration];return [0,0]}
function tick(){if($('#player').hidden)return;const [a,b]=range(),t=V.currentTime,span=Math.max(.001,b-a),f=Math.min(1,Math.max(0,(t-a)/span));
 $('#sFill').style.width=f*100+'%';$('#sKnob').style.left=f*100+'%';const bb=V.buffered;$('#sBuf').style.left='0';$('#sBuf').style.width=(bb.length?Math.min(1,(bb.end(bb.length-1)-a)/span):0)*100+'%';
 const behind=b-t;if(P.live){$('#pPos').textContent=behind>8?'-'+fmt(behind):'LIVE';$('#pLive').classList.toggle('on',behind<=8)}else $('#pPos').textContent=`${fmt(t)} / ${fmt(b)}`;
 $('#pPlay').innerHTML=V.paused?'&#9654;':'&#10074;&#10074;';
 if(P.recording){$('#pRecT').textContent=fmt(recDur(P.recording))}
 if(P.vod&&V.duration>0&&isFinite(V.duration)&&t>5){S.resume[P.vod.key]={t,d:V.duration,at:Date.now()};if(!tick.n||Date.now()-tick.n>4000){tick.n=Date.now();LS.setItem('ctv.resume',JSON.stringify(S.resume))}if(P.vod.sid&&(!tick.w||Date.now()-tick.w>10000)){tick.w=Date.now();noteLast(P.vod,t,V.duration)}if(!tick.s||Date.now()-tick.s>30000){tick.s=Date.now();pushProg(P.vod,t,V.duration)}}}
setInterval(tick,500);V.addEventListener('timeupdate',tick);V.addEventListener('waiting',()=>spin(true));V.addEventListener('playing',()=>spin(false));V.addEventListener('pause',()=>{tick();if(P.vod&&V.currentTime>5)pushProg(P.vod,V.currentTime,V.duration)});V.addEventListener('play',tick);
function seekTo(t){const [a,b]=range();V.currentTime=Math.min(b-(P.live?1.5:0),Math.max(a+.1,t));tick()}
const sc=$('#scrub');let drag=false;const scrubAt=e=>{const r=sc.getBoundingClientRect(),[a,b]=range();seekTo(a+(b-a)*Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)))};
sc.addEventListener('pointerdown',e=>{drag=true;sc.setPointerCapture(e.pointerId);scrubAt(e)});sc.addEventListener('pointermove',e=>{if(drag){scrubAt(e);osdShow()}});sc.addEventListener('pointerup',()=>drag=false);
$('#pRw').onclick=()=>{seekTo(V.currentTime-10);osdShow()};$('#pFf').onclick=()=>{seekTo(V.currentTime+10);osdShow()};
$('#pPlay').onclick=()=>{V.paused?V.play():V.pause();osdShow()};
$('#pLive').onclick=()=>{const [,b]=range();seekTo(P.hls?.liveSyncPosition||b-4);V.play();osdShow()};
$('#pChUp').onclick=()=>playChannel(P.idx-1);$('#pChDn').onclick=()=>playChannel(P.idx+1);
$('#pBack').onclick=()=>uiBack(closePlayer);
$('#pFs').onclick=()=>{const el=$('#player');if(document.fullscreenElement||document.webkitFullscreenElement){(document.exitFullscreen||document.webkitExitFullscreen).call(document)}else if(el.requestFullscreen)el.requestFullscreen().then(()=>hpush('fs')).catch(()=>{});else if(el.webkitRequestFullscreen)el.webkitRequestFullscreen();else if(V.webkitEnterFullscreen)V.webkitEnterFullscreen()};
$('#pAir').onclick=()=>{if(P.mode!=='native'&&!P.vod){if(!confirm("AirPlay uses the iPhone's built-in player. Pause & rewind and recording are turned off while using it. Continue?"))return;P.forceNative=true;playChannel(P.idx);setTimeout(()=>V.webkitShowPlaybackTargetPicker?.(),1500);return}V.webkitShowPlaybackTargetPicker?.()};
function closePlayer(){LS.setItem('ctv.resume',JSON.stringify(S.resume));if(P.vod&&V.duration>0&&V.currentTime>5){P.vod.sid&&noteLast(P.vod,V.currentTime,V.duration);pushProg(P.vod,V.currentTime,V.duration)}P.token++;teardown();P.forceNative=false;$('#player').hidden=true;if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});render()}
/* auto-hide OSD */
function osdShow(){$('#osd').classList.remove('hide');$('#player').classList.remove('hidecur');clearTimeout(osdShow.t);osdShow.t=setTimeout(()=>{if(!V.paused&&$('#mini').hidden&&$('#pErr').hidden){$('#osd').classList.add('hide');$('#player').classList.add('hidecur')}},4500)}
$('#player').addEventListener('pointermove',osdShow);$('#player').addEventListener('click',e=>{if(e.target===V||e.target.id==='osd'){if($('#osd').classList.contains('hide'))osdShow();else if(e.target.id==='osd'){$('#osd').classList.add('hide')}}});
document.addEventListener('keydown',e=>{if($('#player').hidden||e.target.tagName==='INPUT')return;const k=e.key;
 if(k==='Escape')$('#mini').hidden?closePlayer():$('#mini').hidden=true;else if(k===' '){e.preventDefault();$('#pPlay').click()}else if(k==='ArrowLeft')$('#pRw').click();else if(k==='ArrowRight')$('#pFf').click();
 else if(k==='ArrowUp'||k==='PageUp'){e.preventDefault();P.vod||$('#pChUp').click()}else if(k==='ArrowDown'||k==='PageDown'){e.preventDefault();P.vod||$('#pChDn').click()}else if(k==='g')$('#pMini').click();else if(k==='r')$('#pRec').click();osdShow()});
/* mini guide */
$('#miniX').onclick=()=>uiBack(()=>$('#mini').hidden=true);
$('#pMini').onclick=()=>{const m=$('#mini');if(!m.hidden){uiBack(()=>m.hidden=true);return}hpush('mini');m.hidden=false;
 $('#miniList').innerHTML=P.list.map((c,i)=>{const np=nowProg(c);return `<div class="ch ${i===P.idx?'cur':''}" data-i="${i}">${logo(c)}<div class="t"><b>${esc(c.name)}</b><small class="${np?'now':''}">${esc(np?np.t:c.group)}</small></div></div>`}).join('');
 $$('#miniList .ch').forEach(el=>el.onclick=()=>playChannel(+el.dataset.i));$('#miniList .cur')?.scrollIntoView({block:'center'})};

/* ---------- recording ---------- */
const recDur=r=>(r.tracks.main?.segs||[]).reduce((a,s)=>a+s.d,0);
$('#pFavC').onclick=e=>{e.stopPropagation();const c=S.cur;if(c&&!P.vod){favToast(toggleFav(c),c)}};
$('#pVlc').onclick=()=>{P.vod&&openVlc(P.vod.url)};
$('#pRec').onclick=()=>{if(P.recording){stopRecording();return}
 if((P.mode==='buffer'||P.mode==='ts')&&hlsOK()&&!P.vod&&!P.wantShift){P.wantShift=true;P.recAfter=true;toast('Switching to pause & rewind mode to record…');playChannel(P.idx,P.list);return}
 if(P.mode==='ts'&&!P.vod&&S.cur){if(confirm('Your plan allows 1 connection, so CheeseTV records this channel without showing the video (direct .ts). Tap Stop to finish. Record now?'))tsRecord(S.cur,null);return}
 if(P.mode!=='shift'||!P.rec){toast(P.mode==='native'?"Recording isn't available in the iPhone's built-in player (AirPlay mode).":"This channel can't be recorded in a browser: the provider doesn't allow web access to the stream segments (CORS). Use the CheeseTV Android app to record.",6000);return}
 const c=S.cur,np=nowProg(c);const R=P.recording={id:'r'+Date.now(),chan:c.name,logo:c.logo||'',title:np?np.t:c.name,start:Date.now(),inf:P.rec.inf,tracks:{}};
 // start from what's on screen now (the part already kept for rewind), then keep adding new segments
 const [a]=range(),from=Math.max(0,V.currentTime-a-1);
 for(const [n,t] of Object.entries(P.rec.tracks)){let acc=0;const segs=[];for(const sg of t.segs){if(acc+sg.d>from){segs.push(sg);P.rec.pinned.add(sg.k);sg.init&&P.rec.pinned.add(sg.init)}acc+=sg.d}R.tracks[n]={segs}}
 P.rec.rec=R;if(S.pendRec&&S.pendRec.k===ckey(c)){R.title=S.pendRec.title;R.until=S.pendRec.until;R.sched=S.pendRec.id;S.pendRec=null;wakeOn()}
 $('#pRec').classList.add('on');$('#pRec').querySelector('span').textContent='Stop';$('#pRecBadge').hidden=false;toast('● Recording started. It keeps going until you tap Stop or leave the channel.')};
async function stopRecording(silent){const r=P.recording;if(!r)return;P.recording=null;if(P.tsrec){try{P.tsrec.abort()}catch(e){}P.tsrec=null;if(P.mode==='tsrec'){$('#pErr').hidden=true;P.mode=''}}delete r.partial;if(P.rec)P.rec.rec=null;$('#pRec').classList.remove('on');$('#pRec').querySelector('span').textContent='Record';$('#pRecBadge').hidden=true;
 r.dur=recDur(r);r.size=Object.values(r.tracks).reduce((a,t)=>a+t.segs.reduce((b,s)=>b+s.size,0),0);if(!r.dur||!r.size){if(r.sched)recLog({id:r.sched,title:r.title,chan:r.chan,a:r.start},'failed',r.err||'Nothing was saved: the stream sent no data.');else if(!silent)toast('Nothing was recorded yet.');DB.delRec(r.id).catch(()=>{});return}
 await DB.putRec(r);toast(`Saved "${r.title}" (${fmt(r.dur)}) to Recordings.`)}
async function renderRecs(){renderSched();const L=$('#recList');L.innerHTML='<div class="sk skrow"></div><div class="sk skrow"></div>';let recs=[];try{recs=(await DB.recs()).sort((a,b)=>b.start-a.start)}catch(e){}
 let info='Recordings are saved on this device only.';try{const e=await navigator.storage?.estimate?.();if(e)info+=` Using ${(e.usage/1e6).toFixed(0)} MB of about ${(e.quota/1e9).toFixed(1)} GB available to this site.`}catch(e){}
 $('#recInfo').textContent=info;
 L.innerHTML=recs.length?recs.map(r=>`<div class="rec" data-id="${r.id}"><div style="display:flex;gap:12px;align-items:center">${logo({name:r.chan,logo:r.logo})}<div style="min-width:0"><b>${esc(r.title)}</b><small>${esc(r.chan)} · ${new Date(r.start).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} · ${fmt(r.dur)} · ${(r.size/1e6).toFixed(1)} MB${r.partial?' · <b style="color:var(--red)">Interrupted (tab was closed)</b>':''}</small></div></div><div class="row"><button class="p" data-a="play">&#9654; Play</button><button data-a="dl">&#11015; Download</button><button data-a="del">Delete</button></div></div>`).join('')
  :`<div class="empty"><div class="rec-ic" style="width:40px;height:40px;color:var(--gold)"></div><p>No recordings yet.<br>Open a channel and tap <b style="color:var(--red)">●</b> Record.</p><p class="note">Recording works when the provider lets web pages fetch its HLS segments (CORS). Otherwise use the CheeseTV Android app.</p></div>`;
 $$('#recList .rec button').forEach(b=>b.onclick=async()=>{const r=recs.find(x=>x.id===b.closest('.rec').dataset.id);
  if(b.dataset.a==='play')playRec(r);else if(b.dataset.a==='del'){if(!confirm('Delete this recording?'))return;await DB.delRec(r.id);await sweep();renderRecs()}else downloadRec(r,b)})}
function playRec(r){if(r.raw)return playRaw(r);if(!hlsOK()){toast('Playing recordings needs iOS 17.1 or newer (or a desktop browser).',5000);return}
 Local.recs[r.id]={tracks:r.tracks,inf:r.inf,ended:true};P.vod={key:'rec:'+r.id,rec:true};P.list=[];openPlayer();$('#pName').textContent=r.title;$('#pNow').textContent=`Recorded from ${r.chan}`;
 $('#pLogo').outerHTML=logo({name:r.chan,logo:r.logo},'ologo').replace('class="lg','id="pLogo" class="lg');$('#pRec').hidden=$('#pChUp').hidden=$('#pChDn').hidden=true;
 const tok=++P.token;teardown();spin(true);tryHls(`${LOC}rec/${r.id}/master.m3u8`,true,tok).then(ok=>{if(ok)setMode('vod');else showErr("This recording can't play",'Part of the recording is missing from this device.',P.lastErr?.d)})}
async function downloadRec(r,btn){btn.textContent='Preparing…';try{
  for(const [name,t] of Object.entries(r.tracks)){const parts=[],init=t.segs.find(s=>s.init)?.init;let li=null;
   for(const s of t.segs){if(s.init&&s.init!==li){parts.push(await DB.get(s.init));li=s.init}parts.push(await DB.get(s.k))}
   const ext=init?'mp4':'ts',a=document.createElement('a');a.href=URL.createObjectURL(new Blob(parts,{type:init?'video/mp4':'video/mp2t'}));
   a.download=`CheeseTV ${r.chan} ${new Date(r.start).toISOString().slice(0,16).replace('T',' ').replace(':','-')}${name==='audio'?' (audio)':''}.${ext}`.replace(/[\\/:*?"<>|]/g,'');document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),60000)}
  if(r.tracks.audio)toast('This channel sends sound separately, so the sound downloads as a second file.',6000);if(r.tracks.main.segs.some(s=>s.key))toast('This channel is encrypted, so the downloaded file only plays inside CheeseTV.',6000)}
 catch(e){toast('Download failed: '+e.message)}btn.innerHTML='&#11015; Download'}

/* ---------- Movies & Series (Xtream VOD) ---------- */
async function vodGet(B,a){let last;for(let n=0;n<5;n++){if(n)await sleep([0,1500,3000,6000,10000][n]);try{const r=await getJSON(`${B}&action=${a}${n?'&_r='+n:''}`,'Xtream server');if(Array.isArray(r))return r;if(r&&typeof r==='object'&&!r.user_info)return Object.values(r);last=new Error('The provider sent an unexpected answer.')}catch(e){last=e}}throw last}
async function loadVod(type){const p=pl();if(S.vod?.pid!==p.id)S.vod={pid:p.id};const V=S.vod;if(V[type])return V;const B=`${xb(p)}/player_api.php?${xq(p)}`;
 const [ca,li]=type==='movie'?['get_vod_categories','get_vod_streams']:['get_series_categories','get_series'];
 const c=await vodGet(B,ca).catch(()=>[]);await sleep(1200);const l=await vodGet(B,li);
 if(!l.length)throw new Error('The provider sent an empty list.');const m={};c.forEach(x=>m[x.category_id]=x.category_name);
 V[type]=type==='movie'?l.map(v=>({type:'movie',id:v.stream_id,name:v.name,img:v.stream_icon,rating:v.rating,group:m[v.category_id]||'Movies',ext:v.container_extension||'mp4',key:'m'+v.stream_id})):l.map(v=>({type:'series',id:v.series_id,name:v.name,img:v.cover,rating:v.rating,plot:v.plot,group:m[v.category_id]||'Series',key:'s'+v.series_id}));return V}
const posterCard=v=>{const r=S.resume[v.key]||(v.type==='series'&&Object.entries(S.resume).filter(([k])=>k.startsWith('e'+v.id+':')).sort((a,b)=>b[1].at-a[1].at)[0]?.[1]);
 return `<button class="poster" data-k="${esc(v.key)}"><div class="im" style="${v.img&&!isMixed(v.img)?`background-image:url('${esc(v.img)}')`:''}">${v.img&&!isMixed(v.img)?'':esc(v.name)}${r&&r.d?`<div class="pbar"><i style="width:${Math.min(100,r.t/r.d*100)}%"></i></div>`:''}</div>${HEART(v.id,v.type)}<small>${esc(v.name)}</small></button>`};
async function renderVod(sync=true){if(sync)syncGet().then(ch=>{if(ch&&!$('#vodBody').closest('[hidden]'))renderVod(false)});const B=$('#vodBody');B.innerHTML=Array(3).fill('<div class="vrow"><h3><span class="sk" style="display:inline-block;width:120px;height:18px"></span></h3><div class="vscroll">'+Array(8).fill('<div class="sk" style="width:128px;height:190px;flex:none"></div>').join('')+'</div></div>').join('');
 if(S.vodType==='fav')return renderFavs(B);
 const T=S.vodType,W=T==='movie'?'movies':'series';let d;try{d=await loadVod(T)}catch(e){if(S.vodType!==T)return;B.innerHTML=`<div class="empty"><p>Couldn't load ${W}. Your provider may be busy. Wait a moment and try again.</p><p><button class="btn" id="vodRetry">Try again</button></p><details><summary>Details</summary><small>${esc(e.message||String(e))}</small></details></div>`;$('#vodRetry').onclick=renderVod;return}if(S.vodType!==T)return
 const items=d[T],groups={};items.forEach(v=>(groups[v.group]??=[]).push(v));
 const Wd=WD(),cont=T==='series'?items.filter(v=>Wd.last[v.id]).sort((a,b)=>Wd.last[b.id].at-Wd.last[a.id].at).slice(0,20):items.filter(v=>S.resume[v.key]&&S.resume[v.key].t/S.resume[v.key].d<.9).sort((a,b)=>S.resume[b.key].at-S.resume[a.key].at).slice(0,20);
 const rows=(cont.length?[['Continue watching',cont,1]]:[]).concat(Object.entries(groups));
 B.innerHTML=rows.length?rows.map(([g,l,c])=>`<div class="vrow${c?' cont':''}"><h3>${esc(g)}</h3><div class="vscroll">${l.slice(0,60).map(v=>c&&T==='series'&&Wd.last[v.id]?posterCard(v).replace('<small>',`<small class="cw">S${esc(Wd.last[v.id].s)}E${esc(Wd.last[v.id].e)} · `):posterCard(v)).join('')}</div></div>`).join(''):`<p class="empty">No ${W} from this provider.</p>`;
 $$('#vodBody .poster').forEach(b=>b.onclick=ev=>{const v=items.find(x=>x.key===b.dataset.k),h=ev.target.closest('.heart');
  if(h){ev.stopPropagation();const on=toggleFavS(h.dataset.fav,v,h.dataset.ft);h.classList.toggle('on',on);h.innerHTML=on?'&#9829;':'&#9825;';toast(on?'Saved to ♥ Favorites':'Removed from Favorites');return}
  if(b.closest('.vrow.cont')){if(v.type==='series'&&resumeSeries(v))return;if(v.type==='movie'){const p=pl();playVod({...v,url:`${xb(p)}/movie/${xp(p)}/${v.id}.${v.ext}`},S.resume[v.key]?.t);return}}
  openDetail(v)})}
async function renderFavs(B){let d;try{d=await loadVod('series')}catch(e){d=S.vod||{}}try{await loadVod('movie')}catch(e){}if(S.vodType!=='fav')return;d=S.vod||{};
 const w=WD(),pick=(L,t)=>L.map(id=>(d[t]||[]).find(v=>String(v.id)===id)).filter(Boolean),se=pick(w.fav,'series'),mo=pick(w.favM,'movie'),all=[...se,...mo];
 if(!all.length){B.innerHTML='<div class="empty favempty"><div class="bigheart">&#9825;</div><p><b>No favorites yet</b></p><p>Tap &#9829; on any show to save it here.</p></div>';return}
 B.innerHTML=[['♥ Series',se],['♥ Movies',mo]].filter(r=>r[1].length).map(([g,l])=>`<div class="vrow"><h3>${g}</h3><div class="vgrid">${l.map(posterCard).join('')}</div></div>`).join('');
 $$('#vodBody .poster').forEach(b=>b.onclick=ev=>{const v=all.find(x=>x.key===b.dataset.k),h=ev.target.closest('.heart');
  if(h){ev.stopPropagation();toggleFavS(h.dataset.fav,v,h.dataset.ft);toast('Removed from Favorites');renderFavs(B);return}openDetail(v)})}
$$('#vodSeg button').forEach(b=>b.onclick=()=>{$$('#vodSeg button').forEach(x=>x.classList.toggle('on',x===b));S.vodType=b.dataset.t;renderVod()});

/* web playability from provider metadata (get_vod_info / episode info) */
const ANDROID=/Android/i.test(navigator.userAgent),APP_URL=ANDROID?'https://watchcheesetv.com/cheesetv-player.apk':'https://watchcheesetv.com/#devices';
function webFmt(inf,ext){inf=inf||{};const v=inf.video||{},a=inf.audio||{},vc=String(v.codec_name||'').toLowerCase().replace(/^(png|mjpeg|bmp|gif|jpeg)$/,''),ac=String(a.codec_name||'').toLowerCase(),pr=String(v.profile||''),pf=String(v.pix_fmt||'');
 if(!vc&&!ac)return null;const MS=window.MediaSource||window.ManagedMediaSource,el=document.createElement('video');
 const can=t=>{try{return !!(MS&&MS.isTypeSupported(t))||el.canPlayType(t)==='probably'}catch(e){return false}};
 const bad=[];let label=[vc.toUpperCase()||'?',ac.toUpperCase()||'?'].join(' / ');
 if(/hevc|h265/.test(vc)&&!can('video/mp4; codecs="hvc1.1.6.L120.90"')&&!can('video/mp4; codecs="hev1.1.6.L120.90"'))bad.push('HEVC');
 if(/h264|avc/.test(vc)&&(/10|4:2:2|4:4:4/.test(pr)||/10le|422|444/.test(pf)))bad.push('10-bit H.264');
 if(vc&&!/hevc|h265|h264|avc|vp8|vp9|av1/.test(vc))bad.push(vc.toUpperCase());
 if(/^e?ac-?3$/.test(ac)&&!can('audio/mp4; codecs="'+(ac.startsWith('e')?'ec-3':'ac-3')+'"'))bad.push('Dolby audio');
 if(/dts|truehd|mlp/.test(ac))bad.push('DTS/TrueHD audio');
 if(/^(avi|wmv|flv)$/i.test(ext||''))bad.push(String(ext).toUpperCase());
 const eng=!!bad.length&&bad.every(b=>b==='Dolby audio')&&!!MS&&!!window.WebAssembly&&!!(window.AudioContext||window.webkitAudioContext)&&!!window.WritableStream;
 return {ok:!bad.length,bad,eng,vc,ac,label:label+(ext?` · ${String(ext).toUpperCase()}`:'')}}
const titleKey=n=>String(n||'').replace(/^[A-Z0-9+]{1,4}\s*-\s*/i,'').replace(/\s+/g,' ').trim().toLowerCase();
const BETA='<span class="apponly beta" title="Plays in the browser with audio conversion (beta)">Beta</span>';
const APP_ONLY='<span class="apponly" title="This format can\'t play in a web browser">App only</span>';
function fmtBlockErr(v){const f=v.fmt;const w=f.bad.join(' / ');
 showErr(`This movie's format (${w}) can't play in a web browser`,`${IOS?'Open it in the free VLC app':'Watch it in VLC or the CheeseTV app'}. Detected format: ${f.label}.`,'');
 if(v.alts?.length){const box=document.createElement('div');box.className='alts';box.innerHTML='<p><b>Try this version instead:</b></p>'+v.alts.map((a,i)=>`<button class="btn gold" data-i="${i}">&#9654; ${esc(a.name)} <small>(${esc(a.fmt.label)})</small></button>`).join('');
  $('#pErr .row')?.before(box);box.querySelectorAll('button').forEach(b=>b.onclick=()=>playVod(v.alts[+b.dataset.i]))}}
async function findAlts(v){const p=pl();if(!S.vod?.movie||v.type!=='movie')return [];const k=titleKey(v.name),c=S.vod.movie.filter(x=>x.id!==v.id&&titleKey(x.name)===k).slice(0,4),B=`${xb(p)}/player_api.php?${xq(p)}`,out=[];
 for(const x of c){try{const inf=(await getJSON(`${B}&action=get_vod_info&vod_id=${x.id}`,'Xtream server')).info||{},f=webFmt(inf,x.ext);if(f&&f.ok)out.push({...x,fmt:f,url:`${xb(p)}/movie/${xp(p)}/${x.id}.${x.ext}`})}catch(e){}await sleep(400)}return out}
function epObj(v,s,e){const p=pl(),ext=e.container_extension||e.ext||'mp4',id=e.id||e.epId;return {type:'ep',fmt:e.info?webFmt(e.info,ext):null,name:`${v.name} · S${s}E${e.episode_num??e.e}`,img:v.img,key:'e'+v.id+':'+id,url:`${xb(p)}/series/${xp(p)}/${id}.${ext}`,sid:String(v.id),s:String(s),e:String(e.episode_num??e.e),epId:String(id),ext,title:e.title||'',sname:v.name}}
function resumeSeries(v){const L=WD().last[v.id];if(!L)return false;const o=epObj(v,L.s,{epId:L.epId,e:L.e,ext:L.ext,title:L.title});playVod(o,S.resume[o.key]?.t??L.t);return true}
const HEART=(id,t='series')=>`<span class="heart${isFavS(id,t)?' on':''}" data-fav="${esc(id)}" data-ft="${t}" role="button" aria-label="Favorite">${isFavS(id,t)?'&#9829;':'&#9825;'}</span>`;
async function openDetail(v){stopLive();const p=pl(),B=`${xb(p)}/player_api.php?${xq(p)}`;sheet('<div class="sk" style="height:220px"></div>');let info={},eps=null;
 try{if(v.type==='movie'){info=(await getJSON(`${B}&action=get_vod_info&vod_id=${v.id}`,'Xtream server')).info||{}}else{const r=await getJSON(`${B}&action=get_series_info&series_id=${v.id}`,'Xtream server');info=r.info||{};eps=r.episodes||{}}}catch(e){}
 const fm=v.type==='movie'?webFmt(info,v.ext):null;v.fmt=fm;
 const res=S.resume[v.key],plot=info.plot||info.description||v.plot||'',rating=info.rating||v.rating,yr=(info.releasedate||info.releaseDate||'').slice(0,4);
 let h=`<div class="shd"><h3>${esc(v.name)}</h3>${HEART(v.id,v.type)}<button class="ic" onclick="uiBack(closeSheet)">&#10005;</button></div><div class="det"><div class="im" style="${v.img&&!isMixed(v.img)?`background-image:url('${esc(v.img)}')`:''}"></div><div><div class="meta">${[rating&&`★ ${esc(rating)}`,yr,info.genre&&esc(info.genre),info.duration&&esc(info.duration)].filter(Boolean).join(' · ')}${fm&&!fm.ok?' '+(fm.eng?BETA:APP_ONLY):''}</div>${fm&&!fm.ok&&fm.eng?`<p class="note">This movie has Dolby audio, which browsers can't play directly. The web player decodes it on your device (beta, uses more battery; seeking takes a few seconds).</p>`:''}${fm&&!fm.ok&&!fm.eng?`<p class="note">This movie's format (${esc(fm.bad.join(' / '))}) can't play in a web browser. Use Open in VLC or the CheeseTV app.</p>`:''}<p>${esc(plot)||'No description.'}</p>`;
 if(v.type==='movie')h+=`<button class="btn gold" id="dPlay" style="width:auto">&#9654; ${res?'Resume '+fmt(res.t):'Play'}</button>${res?' <button class="btn dark" id="dStart" style="width:auto">From start</button>':''}`+` <button class="btn dark vlcs" id="dVlc" style="width:auto">${IOS||ANDROID?'Open in VLC':'Copy link for VLC'}</button>`;
 if(v.type==='series'){const L=WD().last[v.id];if(L)h+=`<button class="btn gold" id="dCont" style="width:auto">&#9654; Continue S${esc(L.s)}E${esc(L.e)}</button>${L.title?` <small class="note">${esc(L.title)}</small>`:''}`}
 h+='</div></div>';
 if(eps){const ss=Object.keys(eps).sort((a,b)=>a-b);h+=`<div class="chips" style="padding:12px 0 6px" id="dSeas">${ss.map((s,i)=>`<button class="${i?'':'on'}" data-s="${esc(s)}">Season ${esc(s)}</button>`).join('')}</div><div class="eps" id="dEps"></div>`}
 sheet(h);
 $('#dCont')&&($('#dCont').onclick=()=>{closeSheet();resumeSeries(v)});$$('#sheetCard .heart').forEach(x=>x.onclick=ev=>{ev.stopPropagation();const on=toggleFavS(x.dataset.fav,v,x.dataset.ft);x.classList.toggle('on',on);x.innerHTML=on?'&#9829;':'&#9825;';toast(on?'Saved to ♥ Favorites':'Removed from Favorites')});
 if(v.type==='movie'){$('#dPlay').onclick=async()=>{closeSheet();if(fm&&!fm.ok&&!fm.eng){const vv={...v,url:`${xb(p)}/movie/${xp(p)}/${v.id}.${v.ext}`};playVod(vv);vv.alts=await findAlts(v);if(P.vod===vv&&vv.alts.length)fmtBlockErr(vv);return}playVod({...v,url:`${xb(p)}/movie/${xp(p)}/${v.id}.${v.ext}`},res?.t)};$('#dVlc').onclick=()=>{closeSheet();openVlc(`${xb(p)}/movie/${xp(p)}/${v.id}.${v.ext}`)};$('#dStart')&&($('#dStart').onclick=()=>{closeSheet();playVod({...v,url:`${xb(p)}/movie/${xp(p)}/${v.id}.${v.ext}`},0)})}
 if(eps){const show=s=>{$('#dEps').innerHTML=(eps[s]||[]).map(e=>{const k='e'+v.id+':'+e.id,r=S.resume[k],ef=webFmt(e.info,e.container_extension);return `<div class="ep" data-id="${esc(e.id)}"><div><b>${r&&r.d&&r.t/r.d>.9?'<span class="wchk">&#10003;</span> ':''}${esc(e.episode_num)}. ${esc(e.title)}</b>${ef&&!ef.ok?' '+(ef.eng?BETA:APP_ONLY):''}${r?`<div class="pbar" style="width:160px"><i style="width:${Math.min(100,r.t/r.d*100)}%"></i></div>`:''}</div><span style="color:var(--gold)">${r?'Resume':'&#9654;'}</span></div>`}).join('')||'<p class="note">No episodes.</p>';
   $$('#dEps .ep').forEach(el=>el.onclick=()=>{const e=eps[s].find(x=>String(x.id)===el.dataset.id);closeSheet();const o=epObj(v,s,e);playVod(o,S.resume[o.key]?.t)})};
  $$('#dSeas button').forEach(b=>b.onclick=()=>{$$('#dSeas button').forEach(x=>x.classList.toggle('on',x===b));show(b.dataset.s)});show(Object.keys(eps).sort((a,b)=>a-b)[0])}}
/* In-browser engine (lazy): demux MKV/MP4, decode Dolby audio in WASM, re-encode, remux to MSE. One sequential connection. */
// fallback for plain files the <video> element can't open (moov at the end needs a 2nd parallel request; untagged MKV): demux over one connection
async function tryEngine(u,tok){let E;try{E=await import('/vendor/ctv-engine.js?v=20')}catch(e){P.lastErr={t:"This movie couldn't start",m:"Couldn't load the single-connection player.",d:String(e)};return false}
 if(tok!==P.token)return false;try{P.actx=P.actx||new (window.AudioContext||window.webkitAudioContext)();P.actx.resume()}catch(e){}
 const w=waitPlaying(tok,40000);let failed=null;
 try{P.eng=await E.open(V,u,{start:P.vodStart||0,ctx:P.actx,onStatus:t=>{if(tok===P.token&&t)status(t)},onError:e=>{failed=e;P.failNow&&P.failNow({t:"This movie couldn't start",m:'The single-connection player could not read this file.',d:'engine: '+redact(String(e&&e.message||e))})}})}catch(e){return false}
 if(tok!==P.token)return false;V.play().catch(()=>{});const ok=await w;if(!ok&&P.eng){try{P.eng.destroy()}catch(e){}P.eng=null}return ok}
async function playEngine(v,at){const tok=++P.token;teardown();$('#pRec').hidden=$('#pChUp').hidden=$('#pChDn').hidden=true;
 $('#pLogo').outerHTML=`<div id="pLogo" class="lg ologo" style="${v.img?`background-image:url('${esc(v.img)}');background-size:cover`:''}"></div>`;
 try{P.actx=P.actx||new (window.AudioContext||window.webkitAudioContext)();P.actx.resume()}catch(e){}
 spin(true);status('Loading the beta player…');let E;
 try{E=await import('/vendor/ctv-engine.js?v=20')}catch(e){if(tok===P.token)showErr("Couldn't load the beta player",'Check your connection and try again.',String(e));return}
 if(tok!==P.token)return;const c=await E.canHandle(v.fmt.vc,v.fmt.ac);if(tok!==P.token)return;
 if(!c.ok){fmtBlockErr({...v,fmt:{...v.fmt,bad:[...v.fmt.bad,c.why]}});return}
 try{P.eng=await E.open(V,v.url,{start:at||0,ctx:P.actx,onStatus:t=>{if(tok===P.token){if(t){spin(true);status(t)}else spin(false)}},
  onError:e=>{if(tok===P.token){teardown();showErr("This movie couldn't play in the browser",'The beta player failed. Try again, or watch it in the CheeseTV app.',redact(String(e&&e.message||e))+` · ${v.fmt.label}`)}}});
  if(tok!==P.token){P.eng.destroy();return}V.play().catch(()=>{})}catch(e){if(tok===P.token)showErr("This movie couldn't play in the browser",'Try again, or watch it in the CheeseTV app.',String(e))}}
function playVod(v,at){P.vod=v;setTimeout(updFavBtn);v.sid&&noteLast(v);$('#pVlc').hidden=!v.url;P.list=[];P.vodStart=at||0;openPlayer();$('#pName').textContent=v.name;$('#pNow').textContent=v.type==='movie'?'Movie':'Series';
 if(v.fmt&&!v.fmt.ok&&v.fmt.eng){playEngine(v,at);return}
 if(v.fmt&&!v.fmt.ok){++P.token;teardown();$('#pRec').hidden=$('#pChUp').hidden=$('#pChDn').hidden=true;fmtBlockErr(v);return}
 $('#pLogo').outerHTML=`<div id="pLogo" class="lg ologo" style="${v.img?`background-image:url('${esc(v.img)}');background-size:cover`:''}"></div>`;$('#pRec').hidden=$('#pChUp').hidden=$('#pChDn').hidden=true;
 const urls=[v.url];start(urls,false).then(()=>{if(at&&P.hls)V.currentTime=at})}

/* ---------- views ---------- */
function groupsFor(){const r=(S.recent[pl()?.id]||[]).length;return ['All','★ Favorites',...(r?['Recent']:[]),...new Set(S.chans.map(c=>c.group))]}
function filtered(){const f=favSet(),g=S.group;if(g==='Recent'){const m=new Map(S.chans.map(c=>[ckey(c),c]));return (S.recent[pl().id]||[]).map(k=>m.get(k)).filter(Boolean)}
 return S.chans.filter(c=>g==='★ Favorites'?f.has(ckey(c)):g==='All'||c.group===g)}
function chips(el){const g=groupsFor();el.innerHTML=g.map(x=>`<button class="${x===S.group?'on':''}">${esc(x)}</button>`).join('');[...el.children].forEach((b,i)=>b.onclick=()=>{S.group=g[i];render()})}
// XCIPTV-style: browsing Movies/Series frees the provider's single connection. Live stops fully; it resumes only when a channel is tapped.
function stopLive(){if(P.vod&&!$('#player').hidden)return;const on=!!(P.hls||P.ts||P.rec||P.eng||V.getAttribute('src'));if(!on&&$('#player').hidden)return;
 P.token++;teardown();$('#mini').hidden=true;if(!$('#player').hidden&&!P.vod)closePlayer()}
function render(){if(!pl()||$('#shell').hidden)return;if(S.view==='vod')stopLive();
 $$('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===S.view));
 for(const [v,id] of [['guide','vGuide'],['chans','vChans'],['recs','vRecs'],['vod','vVod'],['search','vSearch']])$('#'+id).hidden=S.view!==v;
 if(S.view==='guide'){renderHero();chips($('#groups'));renderGuide()}else if(S.view==='chans'){chips($('#groups2'));renderList()}else if(S.view==='recs')renderRecs();else if(S.view==='vod')renderVod();else if(S.view==='search')renderSearch()}
function renderHero(){const rk=(S.recent[pl().id]||[])[0],c=S.chans.find(x=>ckey(x)===rk)||S.chans.find(x=>nowProg(x))||S.chans[0];if(!c){$('#hero').innerHTML='';return}const np=nowProg(c);
 $('#hero').innerHTML=`${c.logo&&!isMixed(c.logo)?`<div class="hlogo" style="background-image:url('${esc(c.logo)}')"></div>`:`<div class="hlogo lg fb" style="font-size:30px">${esc(initials(c.name))}</div>`}<div class="kick"><span class="livedot"></span>${rk?'CONTINUE WATCHING':'ON NOW'} · ${esc(c.group)}</div><h2>${esc(np?np.t:c.name)}</h2><p>${np?`${esc(c.name)} · ${hm(np.a)} – ${hm(np.b)}`:'Live TV · Pause, rewind &amp; record'}</p><button class="btn gold" id="heroGo">&#9654; Watch Now</button>`;
 $('#heroGo').onclick=()=>{const l=filtered().includes(c)?filtered():S.chans;playChannel(l.indexOf(c),l)}}
function renderGuide(){const G=$('#guide'),list=filtered(),PX=4.6/60000,n=Date.now(),t0=Math.floor(n/18e5)*18e5,W=8*36e5*PX;
 if(!list.length){G.innerHTML=`<p class="empty">${S.group==='★ Favorites'?'No favorite channels yet. Tap ☆ in the player, or long-press a channel, to add it here.':'No channels here.'}</p>`;return}
 const note=S.epgState==='loading'?'Loading TV guide…':S.epgState==='gz'||S.epgState==='err'?'No guide info':S.epgState==='none'?'No guide info':'';
 let h=`<div class="ghead"><div class="gch">${hm(n).replace(/ /,'&nbsp;')}</div><div class="gtl" style="width:${W}px">${Array.from({length:16},(_,i)=>`<span style="left:${i*18e5*PX+6}px">${hm(t0+i*18e5)}</span>`).join('')}</div></div>`;
 const fs=favSet();h+=(S.group==='★ Favorites'?list:list.slice(0,400)).map((c,i)=>{const ps=progs(c).filter(p=>p.b>t0&&p.a<t0+8*36e5);return `<div class="grow" data-i="${i}"><div class="gch">${logo(c)}<span class="nm">${esc(c.name)}</span>${fs.has(ckey(c))?'<i class="gstar" aria-label="Favorite">&#9733;</i>':''}</div><div class="gtl" style="width:${W}px"><div class="nowline" style="left:${(n-t0)*PX}px"></div>${ps.length?ps.map(p=>{const l=Math.max(0,(p.a-t0)*PX),w=(Math.min(p.b,t0+8*36e5)-Math.max(p.a,t0))*PX-5;const sc=schedHas(c,p);return `<div class="gp ${p.a<=n&&p.b>n?'now':''}${sc?' sched':''}" data-a="${p.a}" style="left:${l}px;width:${w}px">${sc?'<i class="recdot">⏺</i> ':''}${esc(p.t)}<small>${hm(p.a)} – ${hm(p.b)}</small></div>`}).join(''):`<div class="gp noepg" style="left:0;width:${W-5}px">${esc(c.name)}<small>${note||'No guide info'} · Tap to watch</small></div>`}</div></div>`}).join('');
 G.innerHTML=h;shortEpg(list.slice(0,40));$$('#guide .grow').forEach(r=>{r.addEventListener('pointerdown',e=>{r._gp=e.target.closest('.gp')},true);longPress(r,()=>{const c=list[r.dataset.i],p=gpProg(c,r._gp);if(p&&p.a>Date.now())return progMenu(c,p,list,+r.dataset.i);favToast(toggleFav(c),c);renderGuide()});r.onclick=e=>{if(lpDone(r))return;const c=list[r.dataset.i],p=gpProg(c,e.target.closest('.gp'));if(p&&p.a>Date.now())return progMenu(c,p,list,+r.dataset.i);playChannel(+r.dataset.i,list)}});G.scrollLeft=0}
function chRow(c,i,f){const np=nowProg(c);const pr=np?Math.min(100,(Date.now()-np.a)/(np.b-np.a)*100):0;return `<div class="ch" data-i="${i}"><span class="num">${esc(c.num||c.n)}</span>${logo(c)}<div class="t"><b>${esc(c.name)}</b>${np?`<small class="now">${esc(np.t)}</small><div class="pbar"><i style="width:${pr}%"></i></div>`:`<small>${esc(c.group)}</small>`}</div><button class="star ${f.has(ckey(c))?'on':''}" aria-label="Favorite">${f.has(ckey(c))?'★':'☆'}</button></div>`}
function bindRows(el,list){el.querySelectorAll('.ch').forEach(r=>{const c=list[r.dataset.i];longPress(r,()=>{favToast(toggleFav(c),c);S.view==='search'?renderSearch():render()});r.onclick=e=>{if(lpDone(r))return;if(e.target.closest('.star')){e.stopPropagation();favToast(toggleFav(c),c);S.view==='search'?renderSearch():render()}else playChannel(+r.dataset.i,list)}})}
function renderList(){const list=filtered(),f=favSet();$('#clist').innerHTML=list.length?(S.group==='★ Favorites'?list:list.slice(0,2000)).map((c,i)=>chRow(c,i,f)).join(''):`<p class="empty">${S.group==='★ Favorites'?'No favorite channels yet. Tap ☆ or long-press a channel to add it.':'No channels here.'}</p>`;bindRows($('#clist'),list)}
function renderSearch(){const q=$('#q').value.trim().toLowerCase(),R=$('#sres');if(!q){R.innerHTML='<p class="empty">Search your channels, what\'s on now'+(S.vod?', movies and series':'')+'.</p>';return}
 const ch=S.chans.filter(c=>c.name.toLowerCase().includes(q)||(nowProg(c)?.t||'').toLowerCase().includes(q)).slice(0,100),f=favSet();
 const v=S.vod?[...(S.vod.movie||[]),...(S.vod.series||[])].filter(x=>x.name.toLowerCase().includes(q)).slice(0,40):[];
 R.innerHTML=(ch.length?`<h3 class="h" style="font-size:16px">Channels</h3><div class="clist">${ch.map((c,i)=>chRow(c,i,f)).join('')}</div>`:'')+(v.length?`<div class="vrow"><h3>Movies &amp; Series</h3><div class="vscroll">${v.map(posterCard).join('')}</div></div>`:'')||'<p class="empty">No matches.</p>';
 bindRows(R,ch);$$('#sres .poster').forEach(b=>b.onclick=()=>openDetail(v.find(x=>x.key===b.dataset.k)))}
$('#q').oninput=renderSearch;
function toggleFav(c){const w=WD(),k=ckey(c),x=w.favC.indexOf(k);x<0?w.favC.unshift(k):w.favC.splice(x,1);wSave();pushFav(k,x<0,{name:c.name,img:c.logo},'live');updFavBtn();return x<0}
function favToast(on,c){toast(on?`★ ${c.name} saved to Favorites`:`Removed ${c.name} from Favorites`)}
function updFavBtn(){const b=$('#pFavC');if(!b)return;const c=S.cur,on=!P.vod&&c&&favSet().has(ckey(c));b.hidden=!!P.vod||!c;b.classList.toggle('on',!!on);b.innerHTML=on?'&#9733;':'&#9734;';b.setAttribute('aria-label',on?'Remove from Favorites':'Add to Favorites')}
// long-press a Guide/Channels row to add or remove the channel from Favorites
function longPress(el,fn){let t=null,sx=0,sy=0;el.addEventListener('pointerdown',e=>{sx=e.clientX;sy=e.clientY;clearTimeout(t);t=setTimeout(()=>{t=null;el.dataset.lp=1;window.__lpAt=Date.now();navigator.vibrate?.(30);fn()},550)});
 const cancel=()=>{clearTimeout(t);t=null};el.addEventListener('pointerup',cancel);el.addEventListener('pointermove',e=>{if(Math.abs(e.clientX-sx)+Math.abs(e.clientY-sy)>10)cancel()});
 // touch: Chrome fires pointercancel when the page starts scrolling, and contextmenu on a long hold. Scroll = cancel; long hold = fire now.
 el.addEventListener('pointercancel',()=>setTimeout(()=>{if(t&&window.__lpScroll)cancel()},0));el.addEventListener('contextmenu',e=>{e.preventDefault();if(t){cancel();el.dataset.lp=1;window.__lpAt=Date.now();navigator.vibrate?.(30);fn()}})}
window.addEventListener('scroll',()=>{window.__lpScroll=1;clearTimeout(window.__lpT);window.__lpT=setTimeout(()=>window.__lpScroll=0,150)},{passive:true,capture:true});
// the row is redrawn by the long-press, so the click that follows lands on a new element: suppress by time, not by element
const lpDone=el=>{if(el.dataset.lp||Date.now()-(window.__lpAt||0)<900){delete el.dataset.lp;window.__lpAt=0;return true}return false};
$$('#tabs button').forEach(b=>b.onclick=()=>{const was=S.view;S.view=b.dataset.v;if(S.view!==was){if(S.view==='guide'&&history.state?.ctv==='tab'){history.back();return}if(S.view!=='guide')history.state?.ctv==='tab'?history.replaceState({ctv:'tab'},''):hpush('tab')}if(S.view==='vod'&&pl()?.type!=='xt')S.view='guide';render();if(S.view==='search')setTimeout(()=>$('#q').focus(),50);window.scrollTo({top:0,behavior:'smooth'})});
$('#home').onclick=e=>{e.preventDefault();if(S.view!=='guide'&&history.state?.ctv==='tab'){history.back();return}S.view='guide';render()};
$('#pFavHint')&&0;

/* ---------- sheets: settings ---------- */
function sheet(h){$('#sheetCard').innerHTML=h;if($('#sheet').hidden)hpush('sheet');$('#sheet').hidden=false}function closeSheet(){$('#sheet').hidden=true}
$('#sheet').onclick=e=>{if(e.target.id==='sheet')uiBack(closeSheet)};
function openSettings(){sheet(`<div class="shd"><h3>Settings <small class="appver">v${APPV}</small></h3><button class="ic" onclick="uiBack(closeSheet)">&#10005;</button></div>
 <div class="vpn-set"><b>Buffering a lot?</b> Your internet provider may be slowing streams. Turn on a free VPN like Proton VPN, then reload. <a href="https://protonvpn.com/download" target="_blank" rel="noopener">Get Proton VPN</a></div>
 <h4 style="margin:6px 0 8px">Playlists</h4>${S.pls.map(p=>`<div class="pl ${p.id===pl()?.id?'on':''}"><b>${esc(p.name)}</b><small style="color:var(--mut)">${p.type==='xt'?'Xtream':'M3U'}</small><button data-a="use" data-id="${p.id}">Use</button><button data-a="del" data-id="${p.id}">Remove</button></div>`).join('')}
 <button class="btn gold" id="stAdd" style="margin:6px 0 16px">+ Add playlist / sign in</button>
 <h4 style="margin:6px 0 8px">Pause &amp; rewind length</h4><div class="seg" id="stTs">${[30,60,90].map(m=>`<button data-m="${m}" class="${S.tsMin===m?'on':''}">${m} min</button>`).join('')}</div>
 <p class="note">Rewind reaches back to when you started watching a channel, up to this limit. Longer uses more storage on your device (about 1–2 GB per hour in HD).</p>
 <details class="note"><summary>Why won't some channels play in a browser?</summary><p>${WHY}</p></details>
 <p class="note">Your playlists, logins, favorites and recordings are saved only on this device. CheeseTV never receives them.</p>
 ${IOS&&!navigator.standalone?'<p class="note"><b>Install on iPhone:</b> tap Share &#8679; then <b>Add to Home Screen</b>.</p>':''}`);
 $$('#sheetCard .pl button').forEach(b=>b.onclick=()=>{const id=b.dataset.id;if(b.dataset.a==='del'){if(!confirm('Remove this playlist and its login from this device?'))return;S.pls=S.pls.filter(p=>p.id!==id);delete S.favs[id];delete S.recent[id];if(S.active===id)S.active=S.pls[0]?.id||null;save();closeSheet();loadActive()}else{S.active=id;S.group='All';save();closeSheet();loadActive()}});
 $('#stAdd').onclick=()=>{closeSheet();showSignin(true)};$$('#stTs button').forEach(b=>b.onclick=()=>{S.tsMin=+b.dataset.m;LS.setItem('ctv.tsmin',S.tsMin);$$('#stTs button').forEach(x=>x.classList.toggle('on',x===b))})}
$('#btnSettings').onclick=openSettings;
/* ---------- sign in ---------- */
function showSignin(cancel){if(cancel&&$('#signin').hidden)hpush('signin');$('#signin').hidden=false;$('#siSeg [data-t=xt]').click();$('#siCancel').hidden=!cancel;$('#siMsg').textContent=''}
$('#siCancel').onclick=()=>uiBack(()=>{$('#signin').hidden=true});
$('#siWhy').onclick=e=>{e.preventDefault();const m=$('#siMsg');m.className='msg';m.textContent=WHY};
$$('#siSeg button').forEach(b=>b.onclick=()=>{$$('#siSeg button').forEach(x=>x.classList.toggle('on',x===b));$('#fXt').hidden=b.dataset.t!=='xt';$('#fM3u').hidden=b.dataset.t!=='m3u';$('#siMsg').textContent=''});
const HTTP_COPY='';
const APPS="Please use the CheeseTV Android / Google TV app or Roku, or the upcoming CheeseTV iPhone app. Or ask your provider for an https:// server address.";
function normXt(raw,user,pass){raw=(raw||'').trim().replace(/\s+/g,'');user=(user||'').trim();pass=(pass||'').trim();
 if(!raw)throw new Error('Enter your server URL (for example http://provider.com:8080).');
 if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw))raw='http://'+raw.replace(/^\/+/,'');
 let u;try{u=new URL(raw)}catch(e){throw new Error("That server address doesn't look right. It usually looks like http://provider.com:8080")}
 if(!/^https?:$/.test(u.protocol)||!u.hostname.includes('.')&&u.hostname!=='localhost')throw new Error("That server address doesn't look right. It usually looks like http://provider.com:8080");
 const q=u.searchParams;if(q.get('username')&&!user)user=q.get('username');if(q.get('password')&&!pass)pass=q.get('password');
 let path=u.pathname.replace(/\/(get|player_api|xmltv|panel_api|portal)\.php$/i,'').replace(/\/(c|live|movie|series)(\/.*)?$/i,'').replace(/\/+$/,'');
 if(!user)throw new Error('Enter your username.');if(!pass)throw new Error('Enter your password.');
 return {server:u.protocol+'//'+u.host+path,user,pass,wasHttp:u.protocol==='http:'};
}
async function fetchT(url,ms=15000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{cache:'no-store',signal:c.signal})}finally{clearTimeout(t)}}
async function xtProbe(server,user,pass){const host=new URL(server).host;let r;
 try{r=await fetchT(`${server}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`)}
 catch(e){if(e.name==='AbortError')throw {k:'timeout',m:`${host} didn't answer within 15 seconds. Check the server address and port (for example :8080), or try again later.`};
  throw {k:'net',m:`Couldn't connect to ${host}. The server may be offline, the address or port may be wrong, or your provider blocks web browsers (CORS). If this login works in the CheeseTV Android or Roku app, your provider is blocking browsers. ${APPS}`}}
 if(r.status===401||r.status===403)throw {k:'auth',m:`The server refused this login (error ${r.status}). Check your username and password, or your account may be blocked or expired.`};
 if(r.status===404)throw {k:'http',m:`There's no Xtream service at this address (error 404). Check the server URL and port.`};
 if(!r.ok)throw {k:'http',m:`The provider's server is having problems (error ${r.status}). Try again later.`};
 let j;try{j=JSON.parse(await r.text())}catch(e){throw {k:'notxt',m:"That address answered, but it isn't an Xtream server. Check the server URL. It usually looks like http://provider.com:8080"}}
 const ui=j&&j.user_info;if(!ui||String(ui.auth)!=='1')throw {k:'auth',m:'Wrong username or password. The server answered but rejected this login. Usernames and passwords are case-sensitive, so check capital letters and typos.'};
 if(ui.status&&!/active/i.test(ui.status))throw {k:'auth',m:`The server says this account is "${ui.status}". Contact your provider.`};
 return j}
async function xtResolve(p){
 const pageHttps=location.protocol==='https:';
 if(pageHttps&&/^http:/i.test(p.server)){const u=new URL(p.server),https='https://'+u.host+u.pathname.replace(/\/+$/,'');
  try{await xtProbe(https,p.user,p.pass);p.server=https;return}catch(e){if(e.k==='auth')throw new Error(e.m)}
  throw new Error(`Your provider's server uses http:// (not secure), and it doesn't support https://. Web browsers (Safari and Chrome) block http connections from secure websites, so the CheeseTV web app can't sign in to this provider. This is a browser rule, not a problem with your login. ${APPS}`)}
 try{XTI={k:p.server+'|'+p.user,t:Date.now(),j:await xtProbe(p.server,p.user,p.pass)}}catch(e){throw new Error(e.m||String(e))}}
async function addPl(p,form){const m=$('#siMsg'),btn=form.querySelector('.btn'),bt=btn.textContent;m.className='msg';m.textContent='';btn.textContent='Signing in…';btn.disabled=true;
 const fail=t=>{m.className='msg e';m.textContent=t;if(location.protocol==='https:'&&/uses http:\/\//.test(t)){const a=document.createElement('a');a.className='btn gold';a.id='btnHttpCopy';a.href=HTTP_COPY;a.onclick=ev=>{ev.preventDefault();headsUp(HTTP_COPY)};a.style.marginTop='12px';a.textContent='Open CheeseTV for http providers';m.appendChild(a);
  const n=document.createElement('p');n.className='fine';n.textContent="It opens a non-secure (http) copy of this player that can connect to http providers. You'll sign in again there.";m.appendChild(n)}m.scrollIntoView({block:'center',behavior:'smooth'})};
 try{if(p.type==='xt'){await xtResolve(p);await loadXtream(p)}else{if(isMixed(p.url)){const h='https://'+p.url.slice(7);try{parseM3U(await getText(h,'playlist'));p.url=h}catch(e){}}parseM3U(await getText(p.url,'playlist'))}}catch(e){const t=e.message||String(e);if(HTTP_COPY&&location.protocol==='https:'&&/uses http:\/\//.test(t)){btn.textContent=bt;btn.disabled=false;goHttp(p);return}fail(t);return}finally{btn.textContent=bt;btn.disabled=false}
 form.reset();p.id='p'+Date.now();S.pls.push(p);S.active=p.id;S.group='All';S.view='guide';save();loadActive()}
$('#fXt').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),m=$('#siMsg');let n;
 try{n=normXt(f.get('server'),f.get('user'),f.get('pass'))}catch(x){m.className='msg e';m.textContent=x.message;return}
 const F=e.target.elements;F.server.value=n.server;F.user.value=n.user;if(!F.pass.value)F.pass.value=n.pass;
 addPl({type:'xt',name:new URL(n.server).hostname,server:n.server,user:n.user,pass:n.pass},e.target)};
$('#fM3u').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),m=$('#siMsg');let url=(f.get('url')||'').trim();
 if(!url){m.className='msg e';m.textContent='Paste your playlist (M3U) link.';return}if(!/^[a-z]+:\/\//i.test(url))url='http://'+url;
 const xm=url.match(/get\.php\?/i)&&new URL(url).searchParams;
 if(xm&&xm.get('username')&&xm.get('password')){ // an Xtream M3U link: sign in with Xtream instead (works better, adds Movies & Series)
  let n;try{n=normXt(url,'','')}catch(x){m.className='msg e';m.textContent=x.message;return}addPl({type:'xt',name:new URL(n.server).hostname,server:n.server,user:n.user,pass:n.pass},e.target);return}
 addPl({type:'m3u',name:(f.get('name')||'').trim()||'My playlist',url,epg:(f.get('epg')||'').trim()},e.target)};
setInterval(()=>{if(!$('#shell').hidden&&$('#player').hidden&&S.view==='guide')renderGuide();updNow()},60000);
try{if('serviceWorker' in navigator)navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});if(window.caches)caches.keys().then(k=>k.forEach(x=>caches.delete(x))).catch(()=>{})}catch(e){}
try{if(window.isSecureContext)navigator.storage?.persist?.().catch(()=>{})}catch(e){}
try{sweep();loadActive()}catch(e){console.error(e);try{$('#shell').hidden=true;$('#player').hidden=true;$('#signin').hidden=false;const m=$('#siMsg');if(m){m.className='msg e';m.textContent='Something went wrong loading your saved playlist. Please sign in again.'}}catch(_){}}
(()=>{const q=new URLSearchParams(location.search),sv=q.get('server'),us=q.get('user');if(!sv&&!us)return;
 try{const F=$('#fXt').elements;$$('#siSeg button').forEach(b=>b.dataset.t==='xt'&&b.click());if(sv)F.server.value=sv;if(us)F.user.value=us;setTimeout(()=>F.pass.focus(),300);
  const m=$('#siMsg');m.className='msg';m.textContent='Enter your password to finish signing in.'}catch(e){}
 q.delete('server');q.delete('user');history.replaceState(history.state,'',location.pathname+(q.toString()?'?'+q:'')+location.hash)})();

function headsUp(url){let d=$('#headsUp');if(!d){d=document.createElement('div');d.id='headsUp';d.className='hu-back';d.innerHTML=`<div class="hu-card" role="dialog" aria-modal="true" aria-labelledby="huT"><div class="hu-ico">🧀</div><h3 id="huT">Quick heads-up</h3><p>Your browser will show a <b>“doesn't support a secure connection”</b> notice next. That's normal for TV providers. Just tap <b>Continue to site</b>.</p><p class="fine">Your provider uses http, so the CheeseTV player has to as well. You only sign in to your own provider there.</p><div class="row"><button class="btn dark" id="huNo">Cancel</button><button class="btn gold" id="huGo">Continue</button></div></div>`;document.body.appendChild(d);
 d.addEventListener('click',e=>{if(e.target===d)d.hidden=true});$('#huNo').onclick=()=>d.hidden=true}
 $('#huGo').onclick=()=>{d.hidden=true;location.href=url};d.hidden=false;$('#huGo').focus()}

function goHttp(p){let url=HTTP_COPY;if(p.type==='xt'){const q=new URLSearchParams({server:p.server.replace(/^https:/i,'http:'),user:p.user});url+='?'+q}
 let d=$('#goHttp');if(!d){d=document.createElement('div');d.id='goHttp';d.className='hu-back';document.body.appendChild(d)}
 d.innerHTML=`<div class="hu-card" role="status"><div class="hu-ico">🧀</div><h3>Opening CheeseTV…</h3><p>Your browser may show a notice next. Tap <b>Continue to site</b>.</p><div class="pspin on" style="position:static;opacity:1;margin:8px auto"><i></i></div><p class="fine"><a id="goNow" href="${esc(url)}" style="color:#ffd76a">Go now</a></p></div>`;d.hidden=false;
 clearTimeout(goHttp.t);goHttp.t=setTimeout(()=>location.href=url,2000)}

/* buffering tip: link only, no VPN built in */
(()=>{const st=[];let ws=0,shown=false,tm=null;
 const show=()=>{if(shown||sessionStorage.getItem('ctvVpnNo')||$('#player').hidden)return;shown=true;let d=$('#vpnTip');
  if(!d){d=document.createElement('div');d.id='vpnTip';d.className='vpn-tip';d.setAttribute('role','status');d.innerHTML='<p><b>Buffering a lot?</b> Your internet provider may be slowing streams. Turn on a free VPN like Proton VPN, then reload.</p><div class="row"><a class="btn gold" href="https://protonvpn.com/download" target="_blank" rel="noopener">Get Proton VPN</a><button class="btn dark" id="vpnNo">Not now</button></div>';
   $('#player').appendChild(d);$('#vpnNo').onclick=e=>{e.stopPropagation();sessionStorage.setItem('ctvVpnNo','1');d.hidden=true}}d.hidden=false};
 V.addEventListener('waiting',()=>{if(!P.mode)return;const n=Date.now();ws=n;st.push(n);while(st.length&&n-st[0]>60000)st.shift();if(st.length>2)show();clearTimeout(tm);tm=setTimeout(()=>{if(ws&&V.readyState<3)show()},5000)});
 V.addEventListener('playing',()=>{ws=0;clearTimeout(tm)});
})();

/* ---------- version + stale-cache check (v18) ---------- */
const APPV=22;
async function verCheck(){try{const r=await fetch('/version.json?n='+Date.now(),{cache:'no-store'});if(!r.ok)return;const v=+(await r.json()).v;
 if(v>APPV&&!recBusy()&&sessionStorage.getItem('ctv.vr')!==String(v)){sessionStorage.setItem('ctv.vr',String(v));const u=new URL(location.href);u.searchParams.set('v',v);location.replace(u.href)}}catch(e){}}
verCheck();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('#player').hidden)verCheck()});
/* ---------- Back button: in-app history (v17, v18: gesture-armed guard) ---------- */
function hpush(n){hArm();try{history.pushState({ctv:n==='tab'?'tab':'L',n},'')}catch(e){}}
// on-screen close buttons: go through history when the layer has its own entry, so the stack stays in step
function uiBack(fn){const s=history.state?.ctv;if(s==='L'||s==='tab')history.back();else fn()}
const H={skip:0,exitAt:0};
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&history.state?.n==='fs'){H.skip=1;history.back()}});
function closeTop(){
 if(document.fullscreenElement||document.webkitFullscreenElement){(document.exitFullscreen||document.webkitExitFullscreen).call(document);return true}
 if(!$('#mini').hidden&&!$('#player').hidden){$('#mini').hidden=true;return true}
 if(!$('#player').hidden){closePlayer();return true} // stops and releases the stream
 if(!$('#sheet').hidden){closeSheet();return true}
 if(!$('#headsUp')?.hidden&&$('#headsUp')){$('#headsUp').hidden=true;return true}
 if(!$('#signin').hidden&&!$('#siCancel').hidden&&pl()){$('#signin').hidden=true;return true}
 if(!$('#shell').hidden&&S.view!=='guide'){S.view='guide';render();window.scrollTo({top:0});return true}
 return false}
window.addEventListener('popstate',e=>{if(H.skip){H.skip=0;return}const st=e.state?.ctv;
 if(closeTop())return;
 if(st==='L'||st==='tab'){history.back();return} // stale entry (layer already closed): skip it
 if(st===1)return; // guard
 // popped past the guard at the Guide root
 if(Date.now()-H.exitAt<2000){history.back();return}
 // no pushState here: an entry pushed without a user gesture is skipped by Chrome's Back. The guard is re-armed on the next tap.
 H.exitAt=Date.now();toast('Press back again to exit CheeseTV',2000)});
// Guide-root guard: created inside a real user gesture (Chrome ignores history entries added without one, e.g. at page load)
// a guard left by an earlier load may have been made without a gesture (v17 did that), so start from the root again
try{const s=history.state?.ctv;if(s==null||s===1)history.replaceState({ctv:0},'')}catch(e){}
function hArm(){try{if(history.state?.ctv===0&&navigator.userActivation?.isActive!==false)history.pushState({ctv:1},'')}catch(e){}}
['pointerup','touchend','click','keydown'].forEach(t=>window.addEventListener(t,hArm,{capture:true,passive:true}));

/* ---------- single-tab playback + background release (v18) ---------- */
const TAB=Math.random().toString(36).slice(2),BC='BroadcastChannel' in window?new BroadcastChannel('ctv-play'):null;
const streaming=()=>!!(P.hls||P.ts||P.rec||P.eng||V.getAttribute('src'));
function tabClaim(){const m={t:'play',id:TAB,at:Date.now()};try{BC&&BC.postMessage(m)}catch(e){}try{LS.setItem('ctv.play',JSON.stringify(m))}catch(e){}P.bg=null;$('#pElse')?.remove()}
function savePos(){if(P.vod&&V.duration>0&&V.currentTime>5){P.vodPos=V.currentTime;S.resume[P.vod.key]={t:V.currentTime,d:V.duration,at:Date.now()};LS.setItem('ctv.resume',JSON.stringify(S.resume));pushProg(P.vod,V.currentTime,V.duration)}}
function resumeHere(){const v=P.vod;if(v){v.rec?toast('Open the recording again from Recordings.'):playVod(v,P.vodPos??S.resume[v.key]?.t)}else if(P.list.length)playChannel(P.idx,P.list)}
// another CheeseTV tab started playing: fully stop here (aborts fetches and any wait-for-slot loop via the token)
function otherTabPlays(){if($('#player').hidden&&!streaming())return;savePos();P.token++;teardown();spin(false);$('#pErr').hidden=true;$('#mini').hidden=true;P.bg='tab';
 let d=$('#pElse');if(!d){d=document.createElement('button');d.id='pElse';d.className='pelse';d.innerHTML='<b>&#9654;</b><span>Playing in another tab. Tap to play here</span>';d.onclick=e=>{e.stopPropagation();d.remove();resumeHere()};$('#player').appendChild(d)}}
BC&&(BC.onmessage=e=>{if(e.data?.t==='play'&&e.data.id!==TAB)otherTabPlays()});
window.addEventListener('storage',e=>{if(e.key!=='ctv.play'||!e.newValue)return;try{const m=JSON.parse(e.newValue);if(m.id!==TAB)otherTabPlays()}catch(x){}});
document.addEventListener('visibilitychange',()=>{clearTimeout(H.hid);
 if(document.hidden){if($('#player').hidden)return;H.hid=setTimeout(()=>{if(P.vod){savePos();try{V.pause()}catch(e){}P.bg='movie'}else if(streaming()||P.bg==='retry'){P.token++;teardown();spin(false);P.bg='live'}},H.bgMs||60000);return}
 if($('#player').hidden||P.bg==='tab')return;
 if(P.bg==='live'||P.bg==='retry'){P.bg=null;resumeHere()}else if(P.bg==='movie'){P.bg=null;tabClaim();V.play().catch(()=>resumeHere())}});

/* ---------- per-channel guide fallback (v19): Xtream get_short_epg, a few at a time, only for rows on screen ---------- */
const b64=s=>{try{return decodeURIComponent(escape(atob(s||'')))}catch(e){try{return atob(s||'')}catch(x){return String(s||'')}}};
function shortEpg(list){const p=pl();if(!p||p.type!=='xt'||S.epgState==='loading')return;S.sepg??={};S.sepgQ??=[];
 for(const c of list)if(c.id&&!(S.epg[c.tvg]?.length)&&!(c.id in S.sepg)){S.sepg[c.id]=null;S.sepgQ.push(c)}
 for(let k=S.sepgN||0;k<3&&S.sepgQ.length;k++)sepgWork(p)}
async function sepgWork(p){S.sepgN=(S.sepgN||0)+1;try{while(S.sepgQ.length&&pl()===p){const c=S.sepgQ.shift(),sid=String(c.id).replace(/^x/,'');
  try{const r=await getJSON(`${xb(p)}/player_api.php?${xq(p)}&action=get_short_epg&stream_id=${encodeURIComponent(sid)}&limit=6`,'Xtream server');
   S.sepg[c.id]=(r?.epg_listings||[]).map(e=>({a:(+e.start_timestamp||Date.parse(e.start))*((+e.start_timestamp)?1000:1),b:(+e.stop_timestamp||Date.parse(e.end||e.stop))*((+e.stop_timestamp)?1000:1),t:b64(e.title),d:b64(e.description)})).filter(e=>e.a&&e.b&&e.t).sort((x,y)=>x.a-y.a)}
  catch(e){S.sepg[c.id]=[]}
  clearTimeout(S.sepgT);S.sepgT=setTimeout(()=>{if(!$('#shell').hidden&&S.view==='guide'){const sl=$('#guide').scrollLeft,y=window.scrollY;renderGuide();$('#guide').scrollLeft=sl;window.scrollTo(0,y)}},400)}}finally{S.sepgN--}}

// ---------------------------------------------------------------- v21: scheduled recordings (no server, no proxy)
// Schedules live in localStorage. At start time, with THIS TAB OPEN, the player opens the channel
// (one connection, the same one you watch) in pause & rewind mode and records it into IndexedDB;
// the .ts file is offered for download from Recordings. Padding: 2 min before, 5 min after.
const SCH_KEY='ctv_sched',PRE=2*6e4,POST=5*6e4;
const schedAll=()=>{try{return JSON.parse(localStorage.getItem(SCH_KEY)||'[]')}catch(e){return []}};
const schedSave=l=>localStorage.setItem(SCH_KEY,JSON.stringify(l));
const schedId=(c,p)=>ckey(c)+'@'+p.a;
function schedHas(c,p){return schedAll().some(x=>x.id===schedId(c,p))}
function gpProg(c,el){const a=+(el?.dataset?.a||0);return a?progs(c).find(p=>p.a===a):null}
function progMenu(c,p,list,i){const on=schedHas(c,p),fav=favSet().has(ckey(c));
 sheet(`<div class="shd"><h3>${esc(p.t)}</h3><button class="ic" onclick="uiBack(closeSheet)">&#10005;</button></div>
 <p style="margin:0 0 4px"><b>${esc(c.name)}</b> · ${new Date(p.a).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'})} – ${hm(p.b)}</p>
 <div style="display:grid;gap:8px;margin:12px 0">
  <button class="btn ${on?'dark':'gold'}" id="pmRec">${on?'✕ Cancel recording':'⏺ Record this show'}</button>
  <button class="btn dark" id="pmFav">${fav?'★ Remove from Favorites':'☆ Add to Favorites'}</button>
  <button class="btn dark" id="pmWatch">▶ Watch channel now</button></div>
 <p class="note">Web recording runs only while this tab stays open and the screen stays on. It starts 2 min early, ends 5 min late, and the file downloads from Recordings when it's done. For reliable recordings (screen off, app closed) use the <a href="https://watchcheesetv.com/#devices">CheeseTV Android / Fire TV app</a>.</p>`);
 $('#pmRec').onclick=()=>{let l=schedAll();if(on){l=l.filter(x=>x.id!==schedId(c,p));toast('Recording cancelled')}else{if(!confirm('Keep this tab open and the screen on until the show ends. Closing it cancels the recording.\n\nFor background recording use the CheeseTV Android / Fire TV app.\n\nSchedule this recording?'))return;l.push({id:schedId(c,p),k:ckey(c),chan:c.name,title:p.t||c.name,a:p.a,b:p.b,pl:pl()?.id});toast(`⏺ "${p.t}" will record at ${hm(p.a)}. Keep this tab open.`,6000);try{Notification?.permission==='default'&&Notification.requestPermission()}catch(e){}}
  schedSave(l.sort((x,y)=>x.a-y.a));uiBack(closeSheet);renderGuide()};
 $('#pmFav').onclick=()=>{favToast(toggleFav(c),c);uiBack(closeSheet);renderGuide()};
 $('#pmWatch').onclick=()=>{uiBack(closeSheet);playChannel(i,list)}}
function renderSched(){let box=$('#schedList');if(!box){box=document.createElement('div');box.id='schedList';$('#recList').before(box)}
 const l=schedAll().filter(x=>x.b+POST>Date.now());
 const lg=recLogAll();box.innerHTML=(lg.length?`<h4 style="margin:8px 0">Didn't record</h4>`+lg.map(x=>`<div class="rec recfail" data-lid="${esc(x.lid)}"><div><b style="color:var(--red)">${x.status==='missed'?'⚠ Missed':'✕ Failed'}: ${esc(x.title)}</b><small>${esc(x.chan||'')}${x.a?' · '+new Date(x.a).toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):''}</small><small>${esc(x.msg)}</small></div><button class="btn dark" data-a="dismiss">Dismiss</button></div>`).join(''):'')+`<p class="note">⏺ Scheduled shows record only while this tab is open and the screen stays on (CheeseTV keeps it awake). Your plan allows 1 connection, so at start time CheeseTV switches to that channel. For reliable recordings use the CheeseTV Android / Fire TV app.</p>`+
  (l.length?`<h4 style="margin:8px 0">Scheduled</h4>`+l.map(x=>`<div class="rec" data-sid="${esc(x.id)}"><div><b>⏺ ${esc(x.title)}</b><small>${esc(x.chan)} · ${new Date(x.a).toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} – ${hm(x.b)}${x.fired?' · recording now':' · <b style="color:var(--gold)">Scheduled</b>'}</small></div><button class="btn dark" data-a="cancel">Cancel</button></div>`).join('')+`<h4 style="margin:12px 0 8px">Recorded</h4>`:'');
 box.querySelectorAll('[data-a=dismiss]').forEach(b=>b.onclick=()=>{const id=b.closest('.rec').dataset.lid;localStorage.setItem(LOG_KEY,JSON.stringify(recLogAll().filter(y=>y.lid!==id)));renderSched()});
 box.querySelectorAll('[data-a=cancel]').forEach(b=>b.onclick=()=>{const id=b.closest('.rec').dataset.sid,x=schedAll().find(y=>y.id===id);
  if(x?.fired&&P.recording?.sched===id)stopRecording();schedSave(schedAll().filter(y=>y.id!==id));toast('Recording cancelled');renderSched()})}
let WL=null;async function wakeOn(){try{if(!WL&&navigator.wakeLock&&!document.hidden){WL=await navigator.wakeLock.request('screen');WL.addEventListener('release',()=>WL=null)}}catch(e){}}
function wakeOff(){try{WL?.release()}catch(e){}WL=null}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&(P.recording||schedAll().some(x=>x.a-PRE-Date.now()<15*6e4&&x.b+POST>Date.now())))wakeOn()});
function recNotify(t,b){toast(t+(b?' · '+b:''),6000);try{if(Notification?.permission==='granted')new Notification(t,{body:b||'',icon:'/icons/icon-192.png'})}catch(e){}}
function findChan(k){return (S.chans||[]).map((c,i)=>[c,i]).find(([c])=>ckey(c)===k)}
function schedFire(x){const hit=findChan(x.k);if(!hit){recLog(x,'failed','That channel is not in the current playlist.');return}banner(`⏺ Recording "${x.title}" is starting on ${x.chan}. Keep this tab open and the screen on.`);
 const [c,i]=hit,go=()=>{closeSheet();S.pendRec={id:x.id,k:x.k,title:x.title,chan:x.chan,a:x.a,until:x.b+POST,at:Date.now()};
  if(S.cur&&ckey(S.cur)===x.k&&!$('#player').hidden&&P.mode==='shift'&&P.rec&&!P.recording){$('#pRec').click();return}
  if(P.recording)stopRecording();P.wantShift=true;P.recAfter=true;playChannel(i,S.chans)};
 recNotify(`⏺ Recording "${x.title}" starts now`,x.chan);
 const watching=S.cur&&!$('#player').hidden&&!P.vod;
 if(watching&&ckey(S.cur)!==x.k){let left=15;
  sheet(`<div class="shd"><h3>⏺ Recording "${esc(x.title)}" starts now</h3></div><p>Switch to <b>${esc(x.chan)}</b>? Your plan allows 1 connection, so in <b id="schLeft">15</b> s CheeseTV switches and records.</p>
   <div style="display:grid;gap:8px;margin-top:12px"><button class="btn gold" id="schGo">Switch now</button><button class="btn dark" id="schSkip">Keep watching (skip recording)</button></div>`);
  const t=setInterval(()=>{left--;const e=$('#schLeft');if(e)e.textContent=left;if(left<=0){clearInterval(t);go()}},1000);
  $('#schGo').onclick=()=>{clearInterval(t);go()};$('#schSkip').onclick=()=>{clearInterval(t);closeSheet();schedSave(schedAll().filter(y=>y.id!==x.id));toast('Recording skipped')};return}
 go()}
function schedTick(){const now=Date.now();let l=schedAll(),ch=false;
 for(const x of l){if(x.fired&&!FIRED.has(x.id)){ // fired in an earlier page load (tab closed / reloaded)
   if(now<x.b+POST){delete x.fired;ch=true}else if(!x.logged){x.logged=1;ch=true;recLog(x,'missed','Interrupted: the tab was closed or reloaded during the show. Any part that was saved is under Recorded.')}}
  if(!x.fired&&now>=x.b+POST&&!x.logged){x.logged=1;ch=true;recLog(x,'missed','Missed (tab was closed). The CheeseTV tab must stay open with the screen on until the show ends.')}}
 for(const x of l){if(!x.fired&&now>=x.a-PRE&&now<x.b+POST&&(!x.pl||x.pl===pl()?.id)&&S.chans?.length){x.fired=now;FIRED.add(x.id);ch=true;schedFire(x)}}
 const before=l.length;l=l.filter(x=>x.b+POST>now||(P.recording&&P.recording.sched===x.id));if(l.length!==before)ch=true;
 if(ch)schedSave(l);
 if(P.recording?.until&&now>=P.recording.until){const t=P.recording.title,sid=P.recording.sched;stopRecording().then(()=>{recNotify(`Recording finished: "${t}"`,'Open Recordings to download the .ts file.');banner(`✓ Recording finished: "${t}". It's in Recordings.`,'ok');schedSave(schedAll().filter(y=>y.id!==sid&&y.b+POST>Date.now()));if(S.view==='recs')renderRecs()})}
 if(S.pendRec&&!P.recording&&!P.tsrecStarting&&now-S.pendRec.at>90000){const x=S.pendRec;S.pendRec=null;recLog({id:x.id,title:x.title,chan:x.chan,a:x.a},'failed',"The channel didn't start"+(P.net?` (${netTxt().replace(/\n/g,' · ')})`:'')+'. Your 1 connection may be in use on another device, or the provider blocks web playback.')}
 if(P.recording?.sched&&now-(P.recording.savedAt||0)>20000){P.recording.savedAt=now;const r=P.recording;DB.putRec({...r,dur:recDur(r),size:Object.values(r.tracks).reduce((a,t)=>a+t.segs.reduce((b,x)=>b+x.size,0),0),partial:true}).catch(()=>{})}
 if(P.recording||l.some(x=>x.a-PRE-now<10*6e4&&x.b+POST>now))wakeOn();else if(WL)wakeOff()}
setInterval(schedTick,5000);setTimeout(schedTick,3000);setTimeout(schedTick,800);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedTick()});window.addEventListener('pageshow',()=>schedTick());
window.CTV_SCHED={schedAll,schedSave,schedTick,schedFire,progMenu};

// ---------------------------------------------------------------- v22: robust scheduled recordings
const FIRED=new Set(),LOG_KEY='ctv_reclog';
const recLogAll=()=>{try{return JSON.parse(localStorage.getItem(LOG_KEY)||'[]')}catch(e){return []}};
function recLog(x,status,msg){const l=recLogAll().filter(y=>y.id!==x.id||y.status!==status);l.unshift({lid:'l'+Date.now()+Math.random().toString(36).slice(2,6),id:x.id,title:x.title,chan:x.chan,a:x.a,status,msg,at:Date.now()});localStorage.setItem(LOG_KEY,JSON.stringify(l.slice(0,30)));
 banner(`${status==='missed'?'⚠ Missed':'✕ Recording failed'}: "${x.title}". ${msg}`,'err');try{if(Notification?.permission==='granted')new Notification(`Recording ${status}: ${x.title}`,{body:msg,icon:'/icons/icon-192.png'})}catch(e){}if(S.view==='recs')renderRecs()}
function banner(t,kind){let b=$('#recBanner');if(!b){b=document.createElement('div');b.id='recBanner';b.style.cssText='position:fixed;left:8px;right:8px;top:calc(8px + env(safe-area-inset-top));z-index:60;padding:12px 40px 12px 14px;border-radius:12px;font-weight:600;box-shadow:0 8px 24px #000;font-size:14px;line-height:1.35';document.body.appendChild(b)}
 b.style.background=kind==='err'?'#5a1010':kind==='ok'?'#12401f':'#3a2a05';b.style.border='1px solid '+(kind==='err'?'#ff5a5a':kind==='ok'?'#4cd964':'#f7c23b');b.innerHTML=`<span></span><button aria-label="Close" style="position:absolute;right:8px;top:8px;background:none;border:0;color:#fff;font-size:18px">✕</button>`;b.firstChild.textContent=t;b.lastChild.onclick=()=>b.hidden=true;b.hidden=false;
 clearTimeout(banner.t);if(kind==='ok')banner.t=setTimeout(()=>b.hidden=true,15000)}
function recBusy(){const n=Date.now();return !!P.recording||schedAll().some(x=>x.a-PRE-n<15*6e4&&x.b+POST>n)}
window.addEventListener('beforeunload',e=>{const n=Date.now();if(P.recording||schedAll().some(x=>x.b+POST>n&&!x.logged)){e.preventDefault();e.returnValue='A CheeseTV recording is scheduled or in progress. Closing this tab cancels it.';return e.returnValue}});
// Direct .ts recorder: ONE fetch of the provider's .ts stream (your single connection), streamed into IndexedDB in ~1 MB pieces.
// Video isn't shown meanwhile (showing it would need a 2nd connection).
async function tsRecord(c,pend){const tsu=[c.url,c.alt].find(u=>u&&kind(u)==='ts')||c.url;P.tsrecStarting=true;
 ++P.token;teardown();spin(false);await sleep(1200);const ac=new AbortController();P.tsrec=ac;P.mode='tsrec';
 const R=P.recording={id:'r'+Date.now(),chan:c.name,logo:c.logo||'',title:pend?.title||nowProg(c)?.t||c.name,start:Date.now(),inf:'',raw:true,tracks:{main:{segs:[]}}};
 if(pend){R.until=pend.until;R.sched=pend.id;S.pendRec=null}P.tsrecStarting=false;wakeOn();
 const box=$('#pErr');box.innerHTML=`<h4 style="color:var(--red)">● Recording ${esc(R.title)}</h4><p>Saving the stream to this device. The video is hidden while recording because your plan allows 1 connection.</p><p id="tsrecInfo" class="note">Connecting…</p><div class="row"><button class="btn dark" id="tsrecStop">■ Stop recording</button></div>`;box.hidden=false;
 $('#tsrecStop').onclick=()=>stopRecording();$('#pRec').classList.add('on');$('#pRec').querySelector('span').textContent='Stop';$('#pRecBadge').hidden=false;
 const fail=m=>{R.err=m;banner('✕ Recording failed: "'+R.title+'". '+m,'err');netLog({step:'record .ts',err:m,url:tsu})};
 let tries=0,idx=0,last=Date.now();
 while(P.tsrec===ac&&!ac.signal.aborted){let r;
  try{r=await fetch(tsu,{signal:ac.signal,cache:'no-store'})}catch(e){if(ac.signal.aborted)break;
   if(!R.tracks.main.segs.length&&++tries>=3){fail("Your provider doesn't let web pages save its stream (blocked by CORS). Playback may still work, but recording in a browser can't. Use the CheeseTV Android / Fire TV app to record.");break}await sleep(3000);continue}
  if(!r.ok||!r.body){if(++tries>=(r.status===458||r.status===407?8:3)){fail(r.status===458||r.status===407?'Your provider says your 1 connection is in use (error '+r.status+'). Close CheeseTV and other IPTV apps on other devices.':'The provider answered with error '+r.status+'. The channel may be offline or your login expired.');break}await sleep(4000);continue}
  const rd=r.body.getReader();let buf=[],n=0;const flush=async()=>{if(!n)return;const b=new Blob(buf),k=`ts${R.id}/${idx}`;const ab=await b.arrayBuffer();await DB.put(k,ab);const now=Date.now();R.tracks.main.segs.push({i:idx++,k,d:(now-last)/1000,size:ab.byteLength,at:now});last=now;buf=[];n=0;
   const e=$('#tsrecInfo');if(e)e.textContent=`${fmt(recDur(R))} · ${(R.tracks.main.segs.reduce((a,s)=>a+s.size,0)/1e6).toFixed(1)} MB saved`};
  try{for(;;){const {done,value}=await rd.read();if(done)break;tries=0;buf.push(value);n+=value.byteLength;if(n>=1<<20||Date.now()-last>4000)await flush();if(P.tsrec!==ac)break}}catch(e){}
  try{await flush()}catch(e){fail('This device is out of storage for recordings.');break}
  if(P.tsrec===ac&&!ac.signal.aborted){await sleep(1500)} // stream ended: reconnect
 }
 if(P.tsrec===ac){P.tsrec=null;stopRecording()}}
async function playRaw(r){openPlayer();$('#pName').textContent=r.title;$('#pNow').textContent=`Recorded from ${r.chan}`;$('#pRec').hidden=$('#pChUp').hidden=$('#pChDn').hidden=true;P.vod={key:'rec:'+r.id,rec:true};P.list=[];
 const tok=++P.token;teardown();spin(true);const parts=[];for(const s of r.tracks.main.segs)parts.push(await DB.get(s.k));const url=URL.createObjectURL(new Blob(parts,{type:'video/mp2t'}));
 if(!window.mpegts){showErr("This recording can't play here",'Download it and open it in VLC.');return}
 const p=P.ts=mpegts.createPlayer({type:'mpegts',isLive:false,url});const w=waitPlaying(tok);p.attachMediaElement(V);p.load();V.play().catch(()=>{});if(await w)setMode('vod');else showErr("This recording can't play here",'Download it and open it in VLC.')}

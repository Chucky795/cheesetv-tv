'use strict';
/* CheeseTV Web Player v2 - blank player. No content, URLs or credentials are bundled. Nothing is proxied. */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],LS=localStorage;
const J=(k,d)=>{try{return JSON.parse(LS.getItem(k))??d}catch(e){return d}};
const S={pls:J('ctv.playlists',[]),active:LS.getItem('ctv.active'),favs:J('ctv.favs',{}),recent:J('ctv.recent',{}),resume:J('ctv.resume',{}),
 tsMin:+(LS.getItem('ctv.tsmin')||90),chans:[],group:'All',view:'guide',epg:{},epgState:'',cur:null,vod:null,vodType:'movie'};
const save=()=>{LS.setItem('ctv.playlists',JSON.stringify(S.pls));LS.setItem('ctv.favs',JSON.stringify(S.favs));LS.setItem('ctv.recent',JSON.stringify(S.recent));S.active?LS.setItem('ctv.active',S.active):LS.removeItem('ctv.active')};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pl=()=>S.pls.find(p=>p.id===S.active)||S.pls[0];
const isMixed=u=>location.protocol==='https:'&&/^http:\/\//i.test(u||'');
const IOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const ckey=c=>c.id||c.url;const favSet=()=>new Set(S.favs[pl()?.id]||[]);
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
async function loadActive(){
 const p=pl();S.chans=[];S.epg={};S.epgState='';S.vod=null;
 if(!p){showSignin();return}
 S.active=p.id;$('#signin').hidden=true;$('#shell').hidden=false;$('#tabVod').hidden=p.type!=='xt';if(p.type!=='xt'&&S.view==='vod')S.view='guide';
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
 try{const doc=new DOMParser().parseFromString(await getText(S.epgUrl,'TV guide'),'text/xml');const n=Date.now(),lo=n-3*36e5,hi=n+12*36e5,e={};
  for(const p of doc.getElementsByTagName('programme')){const a=xt(p.getAttribute('start')||''),b=xt(p.getAttribute('stop')||'');if(b<lo||a>hi)continue;
   (e[p.getAttribute('channel')]??=[]).push({a,b,t:p.getElementsByTagName('title')[0]?.textContent||'',d:p.getElementsByTagName('desc')[0]?.textContent||''})}
  Object.values(e).forEach(v=>v.sort((x,y)=>x.a-y.a));S.epg=e;S.epgState='ok'}catch(err){S.epgState='err'}
 render();
}
const progs=c=>S.epg[c.tvg]||[];const nowProg=c=>{const n=Date.now();return progs(c).find(p=>p.a<=n&&p.b>n)};

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
function teardown(){stopRecording(true);try{P.hls&&P.hls.destroy()}catch(e){}try{P.ts&&P.ts.destroy()}catch(e){}P.hls=P.ts=null;if(P.rec){P.rec.stop();if(Local.live===P.rec)Local.live=null;P.rec=null}
 V.onerror=V.onplaying=null;V.removeAttribute('src');V.load()}
function spin(on){$('#pSpin').classList.toggle('on',!!on);if(!on)status('')}
function status(t){let e=$('#pSpinT');if(!e){e=document.createElement('b');e.id='pSpinT';e.className='pspin-t';$('#pSpin').appendChild(e)}e.textContent=t}
function showErr(title,msg,detail){spin(false);$('#pErr').innerHTML=`<h4>${esc(title)}</h4><p>${esc(msg)}</p>${detail?`<p class="d">Details: ${esc(detail)}</p>`:''}<p class="note">Channels that won't play in a browser usually still work in the CheeseTV ${IOS?'iPhone app (coming soon to the App Store)':'Android / Google TV app'} or on Roku.</p><div class="row"><button class="btn dark" id="eRetry">Try again</button><a class="btn gold" href="https://watchcheesetv.com/#devices">Get the app</a></div>`;
 $('#pErr').hidden=false;$('#eRetry').onclick=()=>P.vod?playVod(P.vod):playChannel(P.idx,P.list)}
function openPlayer(){$('#player').hidden=false;$('#pErr').hidden=true;$('#mini').hidden=true;osdShow();if(!$('#player').dataset.k){$('#player').dataset.k=1}}
function playChannel(i,list){
 list=list||P.list;if(!list.length)return;i=(i+list.length)%list.length;const c=list[i];P.list=list;P.idx=i;P.vod=null;S.cur=c;
 const r=S.recent[pl().id]=(S.recent[pl().id]||[]).filter(k=>k!==ckey(c));r.unshift(ckey(c));r.length=Math.min(r.length,20);save();
 openPlayer();$('#pName').textContent=(c.num||c.n?`${c.num||c.n}  `:'')+c.name;$('#pLogo').outerHTML=logo(c,'ologo').replace('class="lg','id="pLogo" class="lg');updNow();
 $('#pRec').hidden=false;$('#pChUp').hidden=$('#pChDn').hidden=false;
 const urls=[c.url];if(c.alt)urls.push(c.alt);else if(kind(c.url)==='unknown')urls.push(c.url+'.m3u8');
 urls.sort((a,b)=>(kind(b)==='hls')-(kind(a)==='hls'));start(urls,true);
}
function updNow(){const c=S.cur;if(!c||P.vod)return;const np=nowProg(c);$('#pNow').textContent=np?`${np.t} · ${hm(np.a)} – ${hm(np.b)}`:(c.group||'Live TV')}
async function start(urls,live){
 const tok=++P.token;teardown();spin(true);$('#pErr').hidden=true;P.live=live;
 const T0=Date.now(),DEADLINE=60000,fresh=()=>tok===P.token&&Date.now()-T0<DEADLINE;status('Connecting…');let lastErr=null;
 for(const u of urls){
  if(!fresh())return;
  if(isMixed(u)){lastErr={t:"This channel can't play in a browser",m:'The stream link starts with http://, and secure web pages (https) are not allowed to play http streams. This is a browser security rule, not a problem with your channel.',d:u.replace(/\/\/([^/]+)\/.*/,'//$1/…')};continue}
  const k=kind(u);
  if(live&&(k==='hls'||k==='unknown')&&hlsOK()&&!P.forceNative){ // timeshift mode: we keep the segments ourselves
   const rec=new Recorder(u);try{await Promise.race([rec.start(),new Promise((_,j)=>setTimeout(()=>j(new Error('timeout')),9000))]);
    status('Buffering…');const t0=Date.now();while(fresh()&&!rec.err&&(rec.tracks.main.segs.length<2||rec.tracks.audio&&rec.tracks.audio.segs.length<2)&&Date.now()-t0<10000)await new Promise(r=>setTimeout(r,250));
    if(!fresh()){rec.stop();if(tok!==P.token)return;break}
    if(rec.tracks.main.segs.length>=1){P.rec=rec;Local.live=rec;if(await tryHls(`${LOC}live/${rec.sid}/master.m3u8`,true,tok))return setMode('shift');teardown()}else rec.stop()}
   catch(e){rec.stop();if(e.message==='not hls'&&k==='hls'){lastErr={t:"This channel can't play here",m:"The link didn't return a video stream."}}}
  }
  if(!fresh())return;
  if((k==='hls'||k==='unknown')&&(P.forceNative||IOS&&!hlsOK())&&nativeOK()){if(await tryNative(u,tok))return setMode('native');lastErr=lastErr||P.lastErr;continue}
  if((k==='hls'||k==='unknown')&&hlsOK()){status('Trying HLS stream…');if(await tryHls(u,false,tok))return setMode(live?'buffer':'vod');lastErr=P.lastErr;continue}
  if((k==='ts'||k==='unknown')&&window.mpegts&&mpegts.getFeatureList().mseLivePlayback){status('Trying TS stream…');if(await tryTs(u,tok))return setMode('ts');lastErr=P.lastErr;continue}
  if(k==='ts'){lastErr={t:"This channel can't play in this browser",m:'This is a raw .ts stream. iPhone Safari can only play HLS (.m3u8) streams in a web page.'};continue}
  if(await tryNative(u,tok))return setMode(live?'native':'vod');lastErr=P.lastErr;
 }
 if(tok===P.token){if(Date.now()-T0>=DEADLINE)lastErr=lastErr||{t:'The channel is taking too long',m:"No stream format started within a minute. The channel may be offline, your provider may allow only one connection at a time (close other apps using your login), or it blocks web browsers.",d:'timeout'};teardown();const e=lastErr||{};showErr(e.t||"This channel can't play here",e.m||"The stream didn't start. It may be offline, or the provider blocks web playback (CORS).",e.d)}
}
function waitPlaying(tok,ms=15000){return new Promise(res=>{let done=false;const fin=v=>{if(!done){done=true;clearTimeout(t);V.removeEventListener('playing',ok);res(v)}};const ok=()=>fin(true);
 V.addEventListener('playing',ok);const t=setTimeout(()=>{P.lastErr={t:'The channel is taking too long',m:"The stream didn't start within 15 seconds. The channel may be offline, or the provider blocks web browsers.",d:'timeout'};fin(false)},ms);P.failNow=e=>{P.lastErr=e;fin(false)};
 const iv=setInterval(()=>{if(tok!==P.token){clearInterval(iv);fin(false)}if(done)clearInterval(iv)},300)})}
function tryHls(u,local,tok){
 const h=P.hls=new Hls(local?{loader:makeLoader(),backBufferLength:90,liveSyncDurationCount:2,maxBufferLength:30,manifestLoadingMaxRetry:4,levelLoadingMaxRetry:6,fragLoadingMaxRetry:6}
  :{backBufferLength:S.tsMin*60,maxBufferLength:30,liveMaxLatencyDurationCount:Infinity,manifestLoadingMaxRetry:1,levelLoadingMaxRetry:2});
 h.on(Hls.Events.ERROR,(_,d)=>{if(window.CTV_DEBUG)console.log('hlserr',d.type,d.details,d.fatal,d.response?.code,d.error?.message);if(!d.fatal)return;if(d.type===Hls.ErrorTypes.MEDIA_ERROR&&!h._rec){h._rec=1;h.recoverMediaError();return}const code=d.response?.code;
  P.failNow?.(code===0||code===undefined&&d.type==='networkError'?{t:'The provider blocks web playback',m:"The stream server didn't allow this web page to load it (CORS), or it is offline. The CheeseTV apps don't have this limit.",d:d.details}:code&&!local?{t:'Stream unavailable',m:`The provider's server answered with error ${code}. The channel may be offline or your login may have expired.`,d:d.details}:{t:"This channel can't play here",m:'The stream format is not supported in this browser.',d:d.details})});
 const w=waitPlaying(tok);h.loadSource(u);h.attachMedia(V);h.on(Hls.Events.MANIFEST_PARSED,()=>V.play().catch(()=>{}));
 return w.then(ok=>{if(!ok){try{h.destroy()}catch(e){}if(P.hls===h)P.hls=null}return ok});
}
function tryNative(u,tok){const w=waitPlaying(tok);V.onerror=()=>P.failNow?.({t:"This channel can't play here",m:'The browser could not open this stream. It may be offline, use a format browsers do not support, or block web playback.',d:'media error '+(V.error?.code||'')});
 V.src=u;V.play().catch(()=>{});if(P.vod&&P.vodStart)V.addEventListener('loadedmetadata',()=>{V.currentTime=P.vodStart},{once:true});return w}
function tryTs(u,tok){const p=P.ts=mpegts.createPlayer({type:'mpegts',isLive:true,url:u},{enableStashBuffer:false,liveBufferLatencyChasing:false,autoCleanupSourceBuffer:true,autoCleanupMaxBackwardDuration:S.tsMin*60});
 p.on(mpegts.Events.ERROR,(t,d,info)=>P.failNow?.({t:t===mpegts.ErrorTypes.NETWORK_ERROR?'The provider blocks web playback':"This channel can't play here",m:t===mpegts.ErrorTypes.NETWORK_ERROR?"The stream server didn't allow this web page to load it (CORS), or it is offline.":'This stream format is not supported in this browser.',d:`${d} ${info?.msg||''}`}));
 const w=waitPlaying(tok);p.attachMediaElement(V);p.load();V.play().catch(()=>{});return w.then(ok=>{if(!ok){try{p.destroy()}catch(e){}P.ts=null}return ok})}
function setMode(m){P.mode=m;spin(false);$('#pMode').textContent={shift:'⏪ PAUSE & REWIND',buffer:'⏪ REWIND (buffer)',native:'NATIVE PLAYER',ts:'TS',vod:'ON DEMAND',rec:'RECORDING'}[m]||'';
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
 if(P.vod&&V.duration>0&&isFinite(V.duration)&&t>5){S.resume[P.vod.key]={t,d:V.duration,at:Date.now()};if(!tick.n||Date.now()-tick.n>4000){tick.n=Date.now();LS.setItem('ctv.resume',JSON.stringify(S.resume))}}}
setInterval(tick,500);V.addEventListener('timeupdate',tick);V.addEventListener('waiting',()=>spin(true));V.addEventListener('playing',()=>spin(false));V.addEventListener('pause',tick);V.addEventListener('play',tick);
function seekTo(t){const [a,b]=range();V.currentTime=Math.min(b-(P.live?1.5:0),Math.max(a+.1,t));tick()}
const sc=$('#scrub');let drag=false;const scrubAt=e=>{const r=sc.getBoundingClientRect(),[a,b]=range();seekTo(a+(b-a)*Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)))};
sc.addEventListener('pointerdown',e=>{drag=true;sc.setPointerCapture(e.pointerId);scrubAt(e)});sc.addEventListener('pointermove',e=>{if(drag){scrubAt(e);osdShow()}});sc.addEventListener('pointerup',()=>drag=false);
$('#pRw').onclick=()=>{seekTo(V.currentTime-10);osdShow()};$('#pFf').onclick=()=>{seekTo(V.currentTime+10);osdShow()};
$('#pPlay').onclick=()=>{V.paused?V.play():V.pause();osdShow()};
$('#pLive').onclick=()=>{const [,b]=range();seekTo(P.hls?.liveSyncPosition||b-4);V.play();osdShow()};
$('#pChUp').onclick=()=>playChannel(P.idx-1);$('#pChDn').onclick=()=>playChannel(P.idx+1);
$('#pBack').onclick=closePlayer;
$('#pFs').onclick=()=>{const el=$('#player');if(document.fullscreenElement||document.webkitFullscreenElement){(document.exitFullscreen||document.webkitExitFullscreen).call(document)}else if(el.requestFullscreen)el.requestFullscreen().catch(()=>{});else if(el.webkitRequestFullscreen)el.webkitRequestFullscreen();else if(V.webkitEnterFullscreen)V.webkitEnterFullscreen()};
$('#pAir').onclick=()=>{if(P.mode!=='native'&&!P.vod){if(!confirm("AirPlay uses the iPhone's built-in player. Pause & rewind and recording are turned off while using it. Continue?"))return;P.forceNative=true;playChannel(P.idx);setTimeout(()=>V.webkitShowPlaybackTargetPicker?.(),1500);return}V.webkitShowPlaybackTargetPicker?.()};
function closePlayer(){LS.setItem('ctv.resume',JSON.stringify(S.resume));P.token++;teardown();P.forceNative=false;$('#player').hidden=true;if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});render()}
/* auto-hide OSD */
function osdShow(){$('#osd').classList.remove('hide');$('#player').classList.remove('hidecur');clearTimeout(osdShow.t);osdShow.t=setTimeout(()=>{if(!V.paused&&$('#mini').hidden&&$('#pErr').hidden){$('#osd').classList.add('hide');$('#player').classList.add('hidecur')}},4500)}
$('#player').addEventListener('pointermove',osdShow);$('#player').addEventListener('click',e=>{if(e.target===V||e.target.id==='osd'){if($('#osd').classList.contains('hide'))osdShow();else if(e.target.id==='osd'){$('#osd').classList.add('hide')}}});
document.addEventListener('keydown',e=>{if($('#player').hidden||e.target.tagName==='INPUT')return;const k=e.key;
 if(k==='Escape')$('#mini').hidden?closePlayer():$('#mini').hidden=true;else if(k===' '){e.preventDefault();$('#pPlay').click()}else if(k==='ArrowLeft')$('#pRw').click();else if(k==='ArrowRight')$('#pFf').click();
 else if(k==='ArrowUp'||k==='PageUp'){e.preventDefault();P.vod||$('#pChUp').click()}else if(k==='ArrowDown'||k==='PageDown'){e.preventDefault();P.vod||$('#pChDn').click()}else if(k==='g')$('#pMini').click();else if(k==='r')$('#pRec').click();osdShow()});
/* mini guide */
$('#miniX').onclick=()=>$('#mini').hidden=true;
$('#pMini').onclick=()=>{const m=$('#mini');if(!m.hidden){m.hidden=true;return}m.hidden=false;
 $('#miniList').innerHTML=P.list.map((c,i)=>{const np=nowProg(c);return `<div class="ch ${i===P.idx?'cur':''}" data-i="${i}">${logo(c)}<div class="t"><b>${esc(c.name)}</b><small class="${np?'now':''}">${esc(np?np.t:c.group)}</small></div></div>`}).join('');
 $$('#miniList .ch').forEach(el=>el.onclick=()=>playChannel(+el.dataset.i));$('#miniList .cur')?.scrollIntoView({block:'center'})};

/* ---------- recording ---------- */
const recDur=r=>(r.tracks.main?.segs||[]).reduce((a,s)=>a+s.d,0);
$('#pRec').onclick=()=>{if(P.recording){stopRecording();return}
 if(P.mode!=='shift'||!P.rec){toast(P.mode==='native'?"Recording isn't available in the iPhone's built-in player (AirPlay mode).":"This channel can't be recorded in a browser: the provider doesn't allow web access to the stream segments (CORS). Use the CheeseTV Android app to record.",6000);return}
 const c=S.cur,np=nowProg(c);const R=P.recording={id:'r'+Date.now(),chan:c.name,logo:c.logo||'',title:np?np.t:c.name,start:Date.now(),inf:P.rec.inf,tracks:{}};
 // start from what's on screen now (the part already kept for rewind), then keep adding new segments
 const [a]=range(),from=Math.max(0,V.currentTime-a-1);
 for(const [n,t] of Object.entries(P.rec.tracks)){let acc=0;const segs=[];for(const sg of t.segs){if(acc+sg.d>from){segs.push(sg);P.rec.pinned.add(sg.k);sg.init&&P.rec.pinned.add(sg.init)}acc+=sg.d}R.tracks[n]={segs}}
 P.rec.rec=R;
 $('#pRec').classList.add('on');$('#pRec').querySelector('span').textContent='Stop';$('#pRecBadge').hidden=false;toast('● Recording started. It keeps going until you tap Stop or leave the channel.')};
async function stopRecording(silent){const r=P.recording;if(!r)return;P.recording=null;if(P.rec)P.rec.rec=null;$('#pRec').classList.remove('on');$('#pRec').querySelector('span').textContent='Record';$('#pRecBadge').hidden=true;
 r.dur=recDur(r);r.size=Object.values(r.tracks).reduce((a,t)=>a+t.segs.reduce((b,s)=>b+s.size,0),0);if(!r.dur){if(!silent)toast('Nothing was recorded yet.');return}
 await DB.putRec(r);toast(`Saved "${r.title}" (${fmt(r.dur)}) to Recordings.`)}
async function renderRecs(){const L=$('#recList');L.innerHTML='<div class="sk skrow"></div><div class="sk skrow"></div>';let recs=[];try{recs=(await DB.recs()).sort((a,b)=>b.start-a.start)}catch(e){}
 let info='Recordings are saved on this device only.';try{const e=await navigator.storage?.estimate?.();if(e)info+=` Using ${(e.usage/1e6).toFixed(0)} MB of about ${(e.quota/1e9).toFixed(1)} GB available to this site.`}catch(e){}
 $('#recInfo').textContent=info;
 L.innerHTML=recs.length?recs.map(r=>`<div class="rec" data-id="${r.id}"><div style="display:flex;gap:12px;align-items:center">${logo({name:r.chan,logo:r.logo})}<div style="min-width:0"><b>${esc(r.title)}</b><small>${esc(r.chan)} · ${new Date(r.start).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} · ${fmt(r.dur)} · ${(r.size/1e6).toFixed(1)} MB</small></div></div><div class="row"><button class="p" data-a="play">&#9654; Play</button><button data-a="dl">&#11015; Download</button><button data-a="del">Delete</button></div></div>`).join('')
  :`<div class="empty"><div class="rec-ic" style="width:40px;height:40px;color:var(--gold)"></div><p>No recordings yet.<br>Open a channel and tap <b style="color:var(--red)">●</b> Record.</p><p class="note">Recording works when the provider lets web pages fetch its HLS segments (CORS). Otherwise use the CheeseTV Android app.</p></div>`;
 $$('#recList .rec button').forEach(b=>b.onclick=async()=>{const r=recs.find(x=>x.id===b.closest('.rec').dataset.id);
  if(b.dataset.a==='play')playRec(r);else if(b.dataset.a==='del'){if(!confirm('Delete this recording?'))return;await DB.delRec(r.id);await sweep();renderRecs()}else downloadRec(r,b)})}
function playRec(r){if(!hlsOK()){toast('Playing recordings needs iOS 17.1 or newer (or a desktop browser).',5000);return}
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
async function loadVod(){const p=pl();if(S.vod?.pid===p.id)return S.vod;const B=`${xb(p)}/player_api.php?${xq(p)}`;
 const [mc,ms,sc,ss]=await Promise.all(['get_vod_categories','get_vod_streams','get_series_categories','get_series'].map(a=>getJSON(`${B}&action=${a}`,'Xtream server').catch(()=>[])));
 const cn=a=>{const o={};(a||[]).forEach(c=>o[c.category_id]=c.category_name);return o},m=cn(mc),s=cn(sc);
 S.vod={pid:p.id,movie:(ms||[]).map(v=>({type:'movie',id:v.stream_id,name:v.name,img:v.stream_icon,rating:v.rating,group:m[v.category_id]||'Movies',ext:v.container_extension||'mp4',key:'m'+v.stream_id})),
  series:(ss||[]).map(v=>({type:'series',id:v.series_id,name:v.name,img:v.cover,rating:v.rating,plot:v.plot,group:s[v.category_id]||'Series',key:'s'+v.series_id}))};return S.vod}
const posterCard=v=>{const r=S.resume[v.key]||(v.type==='series'&&Object.entries(S.resume).filter(([k])=>k.startsWith('e'+v.id+':')).sort((a,b)=>b[1].at-a[1].at)[0]?.[1]);
 return `<button class="poster" data-k="${esc(v.key)}"><div class="im" style="${v.img&&!isMixed(v.img)?`background-image:url('${esc(v.img)}')`:''}">${v.img&&!isMixed(v.img)?'':esc(v.name)}${r&&r.d?`<div class="pbar"><i style="width:${Math.min(100,r.t/r.d*100)}%"></i></div>`:''}</div><small>${esc(v.name)}</small></button>`};
async function renderVod(){const B=$('#vodBody');B.innerHTML=Array(3).fill('<div class="vrow"><h3><span class="sk" style="display:inline-block;width:120px;height:18px"></span></h3><div class="vscroll">'+Array(8).fill('<div class="sk" style="width:128px;height:190px;flex:none"></div>').join('')+'</div></div>').join('');
 let d;try{d=await loadVod()}catch(e){B.innerHTML=`<p class="empty">${esc(e.message)}</p>`;return}
 const items=d[S.vodType],groups={};items.forEach(v=>(groups[v.group]??=[]).push(v));
 const cont=items.filter(v=>S.resume[v.key]||v.type==='series'&&Object.keys(S.resume).some(k=>k.startsWith('e'+v.id+':'))).slice(0,20);
 const rows=(cont.length?[['Continue Watching',cont]]:[]).concat(Object.entries(groups));
 B.innerHTML=rows.length?rows.map(([g,l])=>`<div class="vrow"><h3>${esc(g)}</h3><div class="vscroll">${l.slice(0,60).map(posterCard).join('')}</div></div>`).join(''):`<p class="empty">No ${S.vodType==='movie'?'movies':'series'} from this provider.</p>`;
 $$('#vodBody .poster').forEach(b=>b.onclick=()=>openDetail(items.find(v=>v.key===b.dataset.k)))}
$$('#vodSeg button').forEach(b=>b.onclick=()=>{$$('#vodSeg button').forEach(x=>x.classList.toggle('on',x===b));S.vodType=b.dataset.t;renderVod()});
async function openDetail(v){const p=pl(),B=`${xb(p)}/player_api.php?${xq(p)}`;sheet('<div class="sk" style="height:220px"></div>');let info={},eps=null;
 try{if(v.type==='movie'){info=(await getJSON(`${B}&action=get_vod_info&vod_id=${v.id}`,'Xtream server')).info||{}}else{const r=await getJSON(`${B}&action=get_series_info&series_id=${v.id}`,'Xtream server');info=r.info||{};eps=r.episodes||{}}}catch(e){}
 const res=S.resume[v.key],plot=info.plot||info.description||v.plot||'',rating=info.rating||v.rating,yr=(info.releasedate||info.releaseDate||'').slice(0,4);
 let h=`<div class="shd"><h3>${esc(v.name)}</h3><button class="ic" onclick="closeSheet()">&#10005;</button></div><div class="det"><div class="im" style="${v.img&&!isMixed(v.img)?`background-image:url('${esc(v.img)}')`:''}"></div><div><div class="meta">${[rating&&`★ ${esc(rating)}`,yr,info.genre&&esc(info.genre),info.duration&&esc(info.duration)].filter(Boolean).join(' · ')}</div><p>${esc(plot)||'No description.'}</p>`;
 if(v.type==='movie')h+=`<button class="btn gold" id="dPlay" style="width:auto">&#9654; ${res?'Resume '+fmt(res.t):'Play'}</button>${res?' <button class="btn dark" id="dStart" style="width:auto">From start</button>':''}`;
 h+='</div></div>';
 if(eps){const ss=Object.keys(eps).sort((a,b)=>a-b);h+=`<div class="chips" style="padding:12px 0 6px" id="dSeas">${ss.map((s,i)=>`<button class="${i?'':'on'}" data-s="${esc(s)}">Season ${esc(s)}</button>`).join('')}</div><div class="eps" id="dEps"></div>`}
 sheet(h);
 if(v.type==='movie'){$('#dPlay').onclick=()=>{closeSheet();playVod({...v,url:`${xb(p)}/movie/${xp(p)}/${v.id}.${v.ext}`},res?.t)};$('#dStart')&&($('#dStart').onclick=()=>{closeSheet();playVod({...v,url:`${xb(p)}/movie/${xp(p)}/${v.id}.${v.ext}`},0)})}
 if(eps){const show=s=>{$('#dEps').innerHTML=(eps[s]||[]).map(e=>{const k='e'+v.id+':'+e.id,r=S.resume[k];return `<div class="ep" data-id="${esc(e.id)}"><div><b>${esc(e.episode_num)}. ${esc(e.title)}</b>${r?`<div class="pbar" style="width:160px"><i style="width:${Math.min(100,r.t/r.d*100)}%"></i></div>`:''}</div><span style="color:var(--gold)">${r?'Resume':'&#9654;'}</span></div>`}).join('')||'<p class="note">No episodes.</p>';
   $$('#dEps .ep').forEach(el=>el.onclick=()=>{const e=eps[s].find(x=>String(x.id)===el.dataset.id),k='e'+v.id+':'+e.id;closeSheet();playVod({type:'ep',name:`${v.name} · S${s}E${e.episode_num}`,img:v.img,key:k,url:`${xb(p)}/series/${xp(p)}/${e.id}.${e.container_extension||'mp4'}`},S.resume[k]?.t)})};
  $$('#dSeas button').forEach(b=>b.onclick=()=>{$$('#dSeas button').forEach(x=>x.classList.toggle('on',x===b));show(b.dataset.s)});show(Object.keys(eps).sort((a,b)=>a-b)[0])}}
function playVod(v,at){P.vod=v;P.list=[];P.vodStart=at||0;openPlayer();$('#pName').textContent=v.name;$('#pNow').textContent=v.type==='movie'?'Movie':'Series';
 $('#pLogo').outerHTML=`<div id="pLogo" class="lg ologo" style="${v.img?`background-image:url('${esc(v.img)}');background-size:cover`:''}"></div>`;$('#pRec').hidden=$('#pChUp').hidden=$('#pChDn').hidden=true;
 const urls=[v.url];start(urls,false).then(()=>{if(at&&P.hls)V.currentTime=at})}

/* ---------- views ---------- */
function groupsFor(){const r=(S.recent[pl()?.id]||[]).length;return ['All','★ Favorites',...(r?['Recent']:[]),...new Set(S.chans.map(c=>c.group))]}
function filtered(){const f=favSet(),g=S.group;if(g==='Recent'){const m=new Map(S.chans.map(c=>[ckey(c),c]));return (S.recent[pl().id]||[]).map(k=>m.get(k)).filter(Boolean)}
 return S.chans.filter(c=>g==='★ Favorites'?f.has(ckey(c)):g==='All'||c.group===g)}
function chips(el){const g=groupsFor();el.innerHTML=g.map(x=>`<button class="${x===S.group?'on':''}">${esc(x)}</button>`).join('');[...el.children].forEach((b,i)=>b.onclick=()=>{S.group=g[i];render()})}
function render(){if(!pl()||$('#shell').hidden)return;
 $$('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===S.view));
 for(const [v,id] of [['guide','vGuide'],['chans','vChans'],['recs','vRecs'],['vod','vVod'],['search','vSearch']])$('#'+id).hidden=S.view!==v;
 if(S.view==='guide'){renderHero();chips($('#groups'));renderGuide()}else if(S.view==='chans'){chips($('#groups2'));renderList()}else if(S.view==='recs')renderRecs();else if(S.view==='vod')renderVod();else if(S.view==='search')renderSearch()}
function renderHero(){const rk=(S.recent[pl().id]||[])[0],c=S.chans.find(x=>ckey(x)===rk)||S.chans.find(x=>nowProg(x))||S.chans[0];if(!c){$('#hero').innerHTML='';return}const np=nowProg(c);
 $('#hero').innerHTML=`${c.logo&&!isMixed(c.logo)?`<div class="hlogo" style="background-image:url('${esc(c.logo)}')"></div>`:`<div class="hlogo lg fb" style="font-size:30px">${esc(initials(c.name))}</div>`}<div class="kick"><span class="livedot"></span>${rk?'CONTINUE WATCHING':'ON NOW'} · ${esc(c.group)}</div><h2>${esc(np?np.t:c.name)}</h2><p>${np?`${esc(c.name)} · ${hm(np.a)} – ${hm(np.b)}`:'Live TV · Pause, rewind &amp; record'}</p><button class="btn gold" id="heroGo">&#9654; Watch Now</button>`;
 $('#heroGo').onclick=()=>{const l=filtered().includes(c)?filtered():S.chans;playChannel(l.indexOf(c),l)}}
function renderGuide(){const G=$('#guide'),list=filtered(),PX=4.6/60000,n=Date.now(),t0=Math.floor(n/18e5)*18e5,W=8*36e5*PX;
 if(!list.length){G.innerHTML=`<p class="empty">${S.group==='★ Favorites'?'No favorites yet. Open the Channels tab and tap ☆ to add some.':'No channels here.'}</p>`;return}
 const note=S.epgState==='loading'?'Loading TV guide…':S.epgState==='gz'?'Guide file is .gz (compressed); browsers can’t open it.':S.epgState==='err'?'TV guide couldn’t load (CORS/offline).':S.epgState==='none'?'No guide info':'';
 let h=`<div class="ghead"><div class="gch">${hm(n).replace(/ /,'&nbsp;')}</div><div class="gtl" style="width:${W}px">${Array.from({length:16},(_,i)=>`<span style="left:${i*18e5*PX+6}px">${hm(t0+i*18e5)}</span>`).join('')}</div></div>`;
 h+=list.slice(0,400).map((c,i)=>{const ps=progs(c).filter(p=>p.b>t0&&p.a<t0+8*36e5);return `<div class="grow" data-i="${i}"><div class="gch">${logo(c)}<span class="nm">${esc(c.name)}</span></div><div class="gtl" style="width:${W}px"><div class="nowline" style="left:${(n-t0)*PX}px"></div>${ps.length?ps.map(p=>{const l=Math.max(0,(p.a-t0)*PX),w=(Math.min(p.b,t0+8*36e5)-Math.max(p.a,t0))*PX-5;return `<div class="gp ${p.a<=n&&p.b>n?'now':''}" style="left:${l}px;width:${w}px">${esc(p.t)}<small>${hm(p.a)} – ${hm(p.b)}</small></div>`}).join(''):`<div class="gp noepg" style="left:0;width:${W-5}px">${esc(c.name)}<small>${note||'No guide info'} · Tap to watch</small></div>`}</div></div>`}).join('');
 G.innerHTML=h;$$('#guide .grow').forEach(r=>r.onclick=()=>playChannel(+r.dataset.i,list));G.scrollLeft=0}
function chRow(c,i,f){const np=nowProg(c);const pr=np?Math.min(100,(Date.now()-np.a)/(np.b-np.a)*100):0;return `<div class="ch" data-i="${i}"><span class="num">${esc(c.num||c.n)}</span>${logo(c)}<div class="t"><b>${esc(c.name)}</b>${np?`<small class="now">${esc(np.t)}</small><div class="pbar"><i style="width:${pr}%"></i></div>`:`<small>${esc(c.group)}</small>`}</div><button class="star ${f.has(ckey(c))?'on':''}" aria-label="Favorite">${f.has(ckey(c))?'★':'☆'}</button></div>`}
function bindRows(el,list){el.querySelectorAll('.ch').forEach(r=>r.onclick=e=>{const c=list[r.dataset.i];if(e.target.classList.contains('star')){toggleFav(c);render()}else playChannel(+r.dataset.i,list)})}
function renderList(){const list=filtered(),f=favSet();$('#clist').innerHTML=list.length?list.slice(0,2000).map((c,i)=>chRow(c,i,f)).join(''):`<p class="empty">${S.group==='★ Favorites'?'No favorites yet. Tap ☆ on a channel to add it.':'No channels here.'}</p>`;bindRows($('#clist'),list)}
function renderSearch(){const q=$('#q').value.trim().toLowerCase(),R=$('#sres');if(!q){R.innerHTML='<p class="empty">Search your channels, what\'s on now'+(S.vod?', movies and series':'')+'.</p>';return}
 const ch=S.chans.filter(c=>c.name.toLowerCase().includes(q)||(nowProg(c)?.t||'').toLowerCase().includes(q)).slice(0,100),f=favSet();
 const v=S.vod?[...S.vod.movie,...S.vod.series].filter(x=>x.name.toLowerCase().includes(q)).slice(0,40):[];
 R.innerHTML=(ch.length?`<h3 class="h" style="font-size:16px">Channels</h3><div class="clist">${ch.map((c,i)=>chRow(c,i,f)).join('')}</div>`:'')+(v.length?`<div class="vrow"><h3>Movies &amp; Series</h3><div class="vscroll">${v.map(posterCard).join('')}</div></div>`:'')||'<p class="empty">No matches.</p>';
 bindRows(R,ch);$$('#sres .poster').forEach(b=>b.onclick=()=>openDetail(v.find(x=>x.key===b.dataset.k)))}
$('#q').oninput=renderSearch;
function toggleFav(c){const p=pl(),s=favSet(),k=ckey(c);s.has(k)?s.delete(k):s.add(k);S.favs[p.id]=[...s];save()}
$$('#tabs button').forEach(b=>b.onclick=()=>{S.view=b.dataset.v;if(S.view==='vod'&&pl()?.type!=='xt')S.view='guide';render();if(S.view==='search')setTimeout(()=>$('#q').focus(),50);window.scrollTo({top:0,behavior:'smooth'})});
$('#home').onclick=e=>{e.preventDefault();S.view='guide';render()};
$('#pFavHint')&&0;

/* ---------- sheets: settings ---------- */
function sheet(h){$('#sheetCard').innerHTML=h;$('#sheet').hidden=false}function closeSheet(){$('#sheet').hidden=true}
$('#sheet').onclick=e=>{if(e.target.id==='sheet')closeSheet()};
function openSettings(){sheet(`<div class="shd"><h3>Settings</h3><button class="ic" onclick="closeSheet()">&#10005;</button></div>
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
function showSignin(cancel){$('#signin').hidden=false;$('#siSeg [data-t=xt]').click();$('#siCancel').hidden=!cancel;$('#siMsg').textContent=''}
$('#siCancel').onclick=()=>{$('#signin').hidden=true};
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
 try{if(p.type==='xt'){await xtResolve(p);await loadXtream(p)}else{if(isMixed(p.url)){const h='https://'+p.url.slice(7);try{parseM3U(await getText(h,'playlist'));p.url=h}catch(e){}}parseM3U(await getText(p.url,'playlist'))}}catch(e){fail(e.message||String(e));return}finally{btn.textContent=bt;btn.disabled=false}
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

function headsUp(url){let d=$('#headsUp');if(!d){d=document.createElement('div');d.id='headsUp';d.className='hu-back';d.innerHTML=`<div class="hu-card" role="dialog" aria-modal="true" aria-labelledby="huT"><div class="hu-ico">🧀</div><h3 id="huT">Quick heads-up</h3><p>Your browser will show a <b>“doesn't support a secure connection”</b> notice next. That's normal for TV providers. Just tap <b>Continue to site</b>.</p><p class="fine">Your provider uses http, so the CheeseTV player has to as well. You only sign in to your own provider there.</p><div class="row"><button class="btn dark" id="huNo">Cancel</button><button class="btn gold" id="huGo">Continue</button></div></div>`;document.body.appendChild(d);
 d.addEventListener('click',e=>{if(e.target===d)d.hidden=true});$('#huNo').onclick=()=>d.hidden=true}
 $('#huGo').onclick=()=>{d.hidden=true;location.href=url};d.hidden=false;$('#huGo').focus()}

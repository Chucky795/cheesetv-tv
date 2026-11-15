/* CheeseTV web player v34: Multi-view (watch up to 4 live channels at once).
   Rules mirror the Android CheeseMultiView.kt. No proxy, no transcoding: every tile streams
   straight from the provider, capped to Xtream user_info.max_connections. */
(function(root){
'use strict';
const MVR={
 MAX:4,
 layouts:{four:4,two:2},
 parseMax(info){const v=info&&info.user_info&&info.user_info.max_connections;const n=parseInt(v,10);return n>0?n:null},
 cap(st){return Math.max(1,Math.min(st.layout,st.plan||st.layout,st.device))},
 live(t){return !!(t&&t.ch&&t.status!=='error'&&t.status!=='blocked')},
 liveCount(st){return st.tiles.slice(0,st.layout).filter(MVR.live).length},
 planMsg(st){return st.plan&&st.plan<st.layout?`Your plan allows ${st.plan} screen${st.plan===1?'':'s'} at once`:null},
 devMsg(n){return `This device can only play ${n} stream${n===1?'':'s'} at once here, so a tile was closed`},
 banner(st){return MVR.planMsg(st)||(st.device<st.layout?MVR.devMsg(st.device):null)},
 init(device){const st={layout:4,tiles:[0,1,2,3].map(i=>({i,ch:null,status:'empty',msg:null})),sel:0,full:null,plan:null,planChecked:false,device:device||4,banner:null};st.banner=MVR.banner(st);return st},
 empty(i){return {i,ch:null,status:'empty',msg:null}},
 fit(st){const cap=MVR.cap(st);st.tiles.forEach((t,i)=>{if(i>=st.layout&&t.ch)st.tiles[i]=MVR.empty(i)});
  let live=st.tiles.slice(0,st.layout).filter(MVR.live).map(t=>t.i);
  if(live.length>cap){const keep=new Set([...(live.includes(st.sel)?[st.sel]:[]),...live.filter(i=>i!==st.sel)].slice(0,cap));live.forEach(i=>{if(!keep.has(i))st.tiles[i]=MVR.empty(i)})}
  if(st.full!=null&&(st.full>=st.layout||!st.tiles[st.full].ch))st.full=null;st.sel=Math.min(Math.max(st.sel,0),st.layout-1);return st},
 setLayout(st,n){st.layout=n;MVR.fit(st);st.banner=MVR.banner(st);return st},
 setPlan(st,n){st.plan=n||null;st.planChecked=true;MVR.fit(st);st.banner=MVR.banner(st);return st},
 select(st,i){if(i>=0&&i<st.layout)st.sel=i;return st},
 assign(st,i,ch){if(i<0||i>=st.layout)return st;const add=!MVR.live(st.tiles[i]);
  if(add&&MVR.liveCount(st)>=MVR.cap(st)){st.banner=MVR.planMsg(st)||(st.device<st.layout?MVR.devMsg(st.device):'All screens are in use');return st}
  st.tiles[i]={i,ch,status:'loading',msg:null};st.sel=i;st.banner=MVR.banner(st);return st},
 clear(st,i){st.tiles[i]=MVR.empty(i);if(st.full===i)st.full=null;return st},
 swap(st,a,b){if(a===b||a<0||b<0||a>=st.layout||b>=st.layout)return st;const ta=st.tiles[a],tb=st.tiles[b];st.tiles[a]={...tb,i:a};st.tiles[b]={...ta,i:b};st.sel=st.sel===a?b:st.sel===b?a:st.sel;return st},
 toggleFull(st,i){if(st.full!=null)st.full=null;else if(i>=0&&i<st.layout&&st.tiles[i].ch){st.full=i;st.sel=i}return st},
 status(st,i,s,msg){const t=st.tiles[i];if(t&&t.ch){t.status=s;t.msg=msg||null}return st},
 decoderFailed(st,i){const others=st.tiles.slice(0,st.layout).filter(t=>MVR.live(t)&&t.i!==i).length;const lim=Math.min(Math.max(others,1),st.device);
  st.tiles[i]=MVR.empty(i);st.device=lim;if(st.full===i)st.full=null;MVR.fit(st);st.banner=MVR.planMsg(st)||MVR.devMsg(lim);return st},
 refused(st,i,code){const m=code?`Provider refused (HTTP ${code}) — your plan may be at its screen limit`:'The provider stopped this stream';MVR.status(st,i,'blocked',m);st.banner=MVR.planMsg(st)||m;return st},
 wanted(st){return st.tiles.slice(0,st.layout).filter(MVR.live).map(t=>t.i)},
 move(st,dx,dy){const rows=st.layout/2,r=Math.floor(st.sel/2),c=st.sel%2;return Math.min(Math.max(r+dy,0),rows-1)*2+Math.min(Math.max(c+dx,0),1)},
 deviceLimit(cores,mem,lowEnd){return lowEnd||(cores&&cores<=2)||(mem&&mem<=1)?2:(mem&&mem<=2)?3:4},
 urls(c){const u=[c.url];if(c.alt)u.push(c.alt);return u.sort((a,b)=>(/\.m3u8?(\?|$)/i.test(b))-(/\.m3u8?(\?|$)/i.test(a)))}
};
if(typeof module!=='undefined'&&module.exports){module.exports=MVR;return}
root.MVR=MVR;

/* ---------------- browser UI ---------------- */
const d=document,$=s=>d.querySelector(s);
let st=null,el=null,pick=null,menu=null,swapFrom=null,players={},pq='',pTab='fav',pGroup='All';
const h=s=>esc(String(s==null?'':s));
function stateInit(){const lowEnd=/SMART-TV|SmartTV|Tizen|Web0S|webOS|AFT|Android TV|BRAVIA|CrKey|GoogleTV|HbbTV/i.test(navigator.userAgent);
 st=MVR.init(MVR.deviceLimit(navigator.hardwareConcurrency||0,navigator.deviceMemory||0,lowEnd));}

function open(){
 if(!pl()){toast('Add a playlist first');return}
 try{if(!$('#player').hidden)closePlayer();stopLive()}catch(e){} // the single player's connection goes first
 if(!st)stateInit();
 const p=pl();if(p&&p.type==='xt'){if(S.maxCon!==undefined)MVR.setPlan(st,S.maxCon);else loadPlan(p)}else MVR.setPlan(st,null);
 if(!el){el=d.createElement('div');el.id='mv';el.className='mv';el.setAttribute('role','dialog');el.setAttribute('aria-label','Multi-view');d.body.appendChild(el);bind()}
 el.hidden=false;d.body.classList.add('mv-open');hpush('mv');
 if(MV.parked){MV.parked.forEach((c,i)=>{if(c)MVR.assign(st,i,c)});MVR.select(st,MV.parkedSel||0);MV.parked=null}
 render();sync();
}
async function loadPlan(p){
 try{const j=await getJSON(`${xb(p)}/player_api.php?${xq(p)}`,'Xtream server');S.maxCon=MVR.parseMax(j)}catch(e){S.maxCon=null}
 if(st){MVR.setPlan(st,S.maxCon);render();sync()}
}
function close(){
 const vis=st.tiles.slice(0,st.layout);if(vis.some(t=>t.ch)){MV.parked=vis.map(t=>t.ch);MV.parkedSel=st.sel}
 Object.keys(players).forEach(k=>stop(+k));
 st.tiles=st.tiles.map((t,i)=>MVR.empty(i));st.full=null;pick=menu=swapFrom=null;
 if(el){el.hidden=true;el.innerHTML=''}d.body.classList.remove('mv-open');
 if(document.fullscreenElement)try{document.exitFullscreen()}catch(e){}
}
/* Back / Esc: innermost layer first. Returns true when Multi-view consumed it. */
function back(){
 if(!el||el.hidden)return false;
 if(pick!=null){pick=null;render();return 'stay'}
 if(menu!=null){menu=null;render();return 'stay'}
 if(swapFrom!=null){swapFrom=null;render();return 'stay'}
 if(st.full!=null){MVR.toggleFull(st,st.full);render();sync();return 'stay'}
 close();return true;
}

/* ---------------- players ---------------- */
function stop(i){const p=players[i];if(!p)return;delete players[i];
 try{p.hls&&p.hls.destroy()}catch(e){}try{p.ts&&(p.ts.unload(),p.ts.detachMediaElement(),p.ts.destroy())}catch(e){}
 try{p.v.pause();p.v.removeAttribute('src');p.v.load()}catch(e){}}
function sync(){
 if(!st||!el||el.hidden)return;const want=new Set(MVR.wanted(st));
 Object.keys(players).forEach(k=>{const i=+k,t=st.tiles[i];if(!want.has(i)||!t.ch||ckey(t.ch)!==players[i].key)stop(i)});
 if(st.planChecked)want.forEach(i=>{if(!players[i])startTile(i)});
 Object.keys(players).forEach(k=>role(+k));
 // re-attach videos to their tiles (render() rebuilds the grid)
 Object.keys(players).forEach(k=>{const box=el.querySelector(`.mvt[data-i="${k}"] .mvv`),v=players[k].v;if(box&&v.parentNode!==box){box.appendChild(v);v.play().catch(()=>{})}});
}
function role(i){const p=players[i];if(!p)return;const audio=st.sel===i,full=st.full===i;
 p.v.muted=!audio;if(audio){const pr=p.v.play();pr&&pr.catch(()=>{p.v.muted=true;p.v.play().catch(()=>{});toast('Tap the screen to turn the sound on')})}
 // muted tiles: lowest HLS variant; the sound tile: capped to its size; full screen: free
 if(p.hls){const big=audio||full;p.hls.capLevelToPlayerSize=big;p.hls.autoLevelCapping=big?-1:0;if(!big&&p.hls.currentLevel>0)p.hls.nextLevel=0}
}
function startTile(i){const t=st.tiles[i],c=t.ch;const v=d.createElement('video');v.playsInline=true;v.setAttribute('playsinline','');v.muted=true;v.autoplay=true;v.crossOrigin='anonymous';
 const p=players[i]={key:ckey(c),v,urls:MVR.urls(c),n:0,hls:null,ts:null,recovered:false,tok:0};
 v.addEventListener('playing',()=>{if(players[i]===p){MVR.status(st,i,'playing');paintTile(i)}});
 v.addEventListener('waiting',()=>{if(players[i]===p&&st.tiles[i].status==='playing'){MVR.status(st,i,'buffering');paintTile(i)}});
 v.addEventListener('error',()=>{if(players[i]!==p)return;const e=v.error;if(e&&e.code===3)decoderFail(i);else next(i,p)});
 tryUrl(i,p);
}
function tryUrl(i,p){const u=p.urls[p.n];const tok=++p.tok;
 if(isMixed(u)){fail(i,p,null,"Secure (https) pages can't play http streams. Use live.watchcheesetv.com.");return}
 try{p.hls&&p.hls.destroy()}catch(e){}try{p.ts&&p.ts.destroy()}catch(e){}p.hls=p.ts=null;
 const k=kind(u),v=p.v;
 if(k!=='ts'&&hlsOK()&&!(IOS&&nativeOK())){
  const hl=p.hls=new Hls({startLevel:0,capLevelToPlayerSize:false,maxBufferLength:10,backBufferLength:10,liveSyncDurationCount:3,manifestLoadingMaxRetry:2,levelLoadingMaxRetry:3,fragLoadingMaxRetry:3});
  hl.on(Hls.Events.ERROR,(ev,x)=>{if(players[i]!==p||tok!==p.tok||!x.fatal)return;
   if(x.type===Hls.ErrorTypes.MEDIA_ERROR){if(!p.recovered){p.recovered=true;hl.recoverMediaError()}else decoderFail(i)}
   else{const code=x.response&&x.response.code;p.lastCode=code>=400?code:p.lastCode;next(i,p)}});
  hl.on(Hls.Events.MANIFEST_PARSED,()=>{if(players[i]===p)role(i)});
  hl.loadSource(u);hl.attachMedia(v);
 }else if(k==='ts'||(k==='unknown'&&!nativeOK())){
  if(!(window.mpegts&&mpegts.getFeatureList().mseLivePlayback)){next(i,p);return}
  const tp=p.ts=mpegts.createPlayer({type:'mpegts',isLive:true,url:u},{enableStashBuffer:false,autoCleanupSourceBuffer:true,autoCleanupMaxBackwardDuration:30});
  tp.on(mpegts.Events.ERROR,(t,dd,info)=>{if(players[i]!==p||tok!==p.tok)return;if(t===mpegts.ErrorTypes.MEDIA_ERROR)decoderFail(i);else{if(info&&info.code>=400)p.lastCode=info.code;next(i,p)}});
  tp.attachMediaElement(v);tp.load();v.play().catch(()=>{});
 }else{v.src=u;v.play().catch(()=>{})}
 // Nothing after 20 s: try the next format.
 setTimeout(()=>{if(players[i]===p&&tok===p.tok&&st.tiles[i].status==='loading')next(i,p)},20000);
}
function next(i,p){if(players[i]!==p)return;if(p.n+1<p.urls.length){p.n++;tryUrl(i,p)}else fail(i,p,p.lastCode)}
function fail(i,p,code,msg){stop(i);if(code)MVR.refused(st,i,code);else MVR.status(st,i,'error',msg||"Can't play this channel here");render();sync()}
function decoderFail(i){stop(i);MVR.decoderFailed(st,i);render();sync()}

/* ---------------- actions ---------------- */
function act(fn){fn();render();sync()}
function tap(i,dbl){const t=st.tiles[i];
 if(swapFrom!=null){const a=swapFrom;swapFrom=null;// move the players with their tiles
  const pa=players[a],pb=players[i];delete players[a];delete players[i];if(pa)players[i]=pa;if(pb)players[a]=pb;return act(()=>MVR.swap(st,a,i))}
 if(!t.ch){pick=i;pq='';pTab=favList().length?'fav':'all';return render()}
 if(t.status==='blocked'||t.status==='error'){const c=t.ch;return act(()=>{MVR.clear(st,i);MVR.assign(st,i,c)})}
 if(dbl||st.sel===i)return act(()=>MVR.toggleFull(st,i));
 act(()=>MVR.select(st,i));
}
const favList=()=>{const f=favSet();return S.chans.filter(c=>f.has(ckey(c)))};
function pickList(){if(pTab==='fav')return favList();if(pTab==='search'){const q=pq.trim().toLowerCase();return q?S.chans.filter(c=>c.name.toLowerCase().includes(q)).slice(0,120):[]}
 return (pGroup==='All'?S.chans:S.chans.filter(c=>c.group===pGroup)).slice(0,400)}

/* ---------------- render ---------------- */
function tileHtml(t){const audio=st.sel===t.i,c=t.ch;let body='';
 if(!c)body=`<div class="mve"><b>＋</b><span>${MVR.liveCount(st)<MVR.cap(st)?'Add a channel':'Screen limit reached'}</span></div>`;
 else if(t.status==='loading'||t.status==='buffering')body=`<div class="mvs">${!st.planChecked?'Checking your plan…':t.status==='loading'?'Tuning…':'Buffering…'}</div>`;
 else if(t.status==='error'||t.status==='blocked')body=`<div class="mvx"><b>${h(t.msg||"Can't play")}</b><span>Click to retry · hold or right-click for options</span></div>`;
 return `<div class="mvt${audio?' aud':''}${swapFrom===t.i?' swp':''}" data-i="${t.i}" tabindex="0" role="button" aria-label="${h(c?c.name:'Empty screen '+(t.i+1))}"><div class="mvv"></div>${body}${c?`<div class="mvl">${audio?'🔊':'🔇'} ${h(c.name)}</div>`:''}</div>`}
function paintTile(i){const n=el&&el.querySelector(`.mvt[data-i="${i}"]`);if(!n)return;const t=st.tiles[i];
 n.querySelectorAll('.mvs,.mvx,.mve').forEach(x=>x.remove());if(t.status==='loading'||t.status==='buffering'){const s=d.createElement('div');s.className='mvs';s.textContent=t.status==='loading'?'Tuning…':'Buffering…';n.appendChild(s)}}
function render(){if(!el||el.hidden)return;
 const full=st.full;
 const head=`<div class="mvh"><button class="btn dark mvb" data-a="close">‹ Back</button><b class="mvtitle">Multi-view</b>
  <span class="mvlay">${[['four','2×2'],['two','2-up']].map(([k,l])=>`<button class="chip${st.layout===MVR.layouts[k]?' on':''}" data-a="lay" data-n="${MVR.layouts[k]}">${l}</button>`).join('')}</span>
  <span class="mvhint">${swapFrom!=null?`Click the screen to swap with screen ${swapFrom+1} · Esc cancels`:(matchMedia('(pointer:coarse)').matches?'Tap: sound · Tap again: full screen · Hold: options':'Click: sound · Click again or double-click: full screen · Right-click: options · Arrows + Enter on a keyboard')}</span></div>
  ${CTV_XMAS()?'<div class="mvlights" aria-hidden="true">'+'<i></i>'.repeat(innerWidth<700?14:30)+'</div>':''}
  ${st.banner?`<div class="mvban">🎄 ${h(st.banner)}</div>`:''}`;
 const grid=full!=null?`<div class="mvfull">${tileHtml(st.tiles[full])}<button class="btn dark mvgrid" data-a="grid">‹ Grid</button></div>`
  :`<div class="mvg ${st.layout===2?'two':'four'}">${st.tiles.slice(0,st.layout).map(tileHtml).join('')}</div>`;
 let over='';
 if(menu!=null){const t=st.tiles[menu];over=`<div class="mvo" data-a="menuX"><div class="mvm" role="menu"><b>${h(t.ch?t.ch.name:'Screen '+(menu+1))}</b>
  <button class="btn dark" data-a="change">${t.ch?'Change channel':'Pick a channel'}</button>${t.ch?'<button class="btn dark" data-a="full">Full screen</button>':''}
  <button class="btn dark" data-a="swap">Swap with another screen</button>${t.ch?'<button class="btn dark" data-a="remove" style="color:#ff8a80">Remove from Multi-view</button>':''}<button class="btn dark" data-a="menuX">Cancel</button></div></div>`}
 if(pick!=null){const L=pickList(),groups=['All',...new Set(S.chans.map(c=>c.group))];
  over=`<div class="mvo" data-a="pickX"><div class="mvp"><div class="mvph"><b>Screen ${pick+1} · pick a channel</b><button class="ic" data-a="pickX" aria-label="Close">&#10005;</button></div>
  <div class="mvpt">${[['fav','♥ Favorites'],['all','Channels'],['search','Search']].map(([k,l])=>`<button class="chip${pTab===k?' on':''}" data-a="ptab" data-t="${k}">${l}</button>`).join('')}</div>
  ${pTab==='all'?`<select class="mvsel" data-a="grp">${groups.map(g=>`<option${g===pGroup?' selected':''}>${h(g)}</option>`).join('')}</select>`:''}
  ${pTab==='search'?`<input class="mvq" type="search" placeholder="Channel name (e.g. NFL, ESPN)…" value="${h(pq)}" autocomplete="off">`:''}
  <div class="mvpl">${L.length?L.map(c=>`<button class="mvpc" data-k="${h(ckey(c))}">${logo(c,'mvlg')}<span>${h(c.name)}</span></button>`).join(''):`<p class="note">${pTab==='fav'?'No favorite channels yet (long-press a channel to add one)':pTab==='search'?(pq?'No matches':'Type to search'):'No channels'}</p>`}</div></div></div>`}
 el.innerHTML=head+grid+over;
 // put the running videos back into the rebuilt tiles (a detached <video> pauses)
 Object.keys(players).forEach(k=>{const box=el.querySelector(`.mvt[data-i="${k}"] .mvv`),v=players[k].v;if(box&&v.parentNode!==box){box.appendChild(v);v.play().catch(()=>{})}});
 const q=el.querySelector('.mvq');if(q){q.focus();q.setSelectionRange(q.value.length,q.value.length)}
 else if(pick==null&&menu==null){const f=el.querySelector(`.mvt[data-i="${st.sel}"]`);f&&f.focus({preventScroll:true})}
}
const CTV_XMAS=()=>d.documentElement.classList.contains('xmas');

function bind(){
 el.addEventListener('click',e=>{const a=e.target.closest('[data-a]'),tile=e.target.closest('.mvt'),pc=e.target.closest('.mvpc');
  if(pc){const c=S.chans.find(x=>ckey(x)===pc.dataset.k);const i=pick;pick=null;if(c)act(()=>MVR.assign(st,i,c));else render();return}
  if(a){const x=a.dataset.a;if((x==='menuX'||x==='pickX')&&a!==e.target&&e.target.closest('.mvm,.mvp'))return;
   if(x==='close')return uiBack(close);if(x==='grid')return act(()=>MVR.toggleFull(st,st.full));
   if(x==='lay')return act(()=>MVR.setLayout(st,+a.dataset.n));
   if(x==='menuX'){menu=null;return render()}if(x==='pickX'){pick=null;return render()}
   if(x==='ptab'){pTab=a.dataset.t;return render()}
   const i=menu;menu=null;
   if(x==='change'){pick=i;pq='';pTab=favList().length?'fav':'all';return render()}
   if(x==='full')return act(()=>MVR.toggleFull(st,i));if(x==='swap'){swapFrom=i;return render()}if(x==='remove')return act(()=>MVR.clear(st,i));
   return}
  if(tile)tap(+tile.dataset.i,false)});
 el.addEventListener('dblclick',e=>{const tile=e.target.closest('.mvt');if(tile&&st.tiles[+tile.dataset.i].ch&&st.full==null){e.preventDefault();act(()=>MVR.toggleFull(st,+tile.dataset.i))}});
 el.addEventListener('contextmenu',e=>{const tile=e.target.closest('.mvt');if(tile){e.preventDefault();menu=+tile.dataset.i;render()}});
 // touch: long-press opens the options
 let lp=null;el.addEventListener('touchstart',e=>{const tile=e.target.closest('.mvt');if(!tile)return;lp=setTimeout(()=>{lp='fired';menu=+tile.dataset.i;render()},600)},{passive:true});
 el.addEventListener('touchend',e=>{if(lp==='fired'){e.preventDefault()}else clearTimeout(lp);lp=null});
 el.addEventListener('touchmove',()=>{clearTimeout(lp);lp=null},{passive:true});
 el.addEventListener('input',e=>{if(e.target.classList.contains('mvq')){pq=e.target.value;clearTimeout(MV.qt);MV.qt=setTimeout(render,250)}});
 el.addEventListener('change',e=>{if(e.target.dataset.a==='grp'){pGroup=e.target.value;render()}});
 el.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'){if(e.key==='Escape'){pick=null;render()}return}
  const k=e.key;
  if(k==='Escape'||k==='Backspace'){e.preventDefault();if(pick!=null||menu!=null||swapFrom!=null||st.full!=null)back();else uiBack(close);return}
  if(pick!=null||menu!=null)return;
  const mv={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[k];
  if(mv&&st.full==null){e.preventDefault();act(()=>MVR.select(st,MVR.move(st,mv[0],mv[1])));return}
  if(k==='Enter'||k===' '){e.preventDefault();tap(st.sel,true);return}
  if(/^[1-4]$/.test(k)&&+k<=st.layout){act(()=>MVR.select(st,+k-1));return}
  if(k==='m'||k==='ContextMenu'){menu=st.sel;render();return}
  if(k==='s'){swapFrom=st.sel;render();return}
  if(k==='Delete'){act(()=>MVR.clear(st,st.sel))}});
 d.addEventListener('visibilitychange',()=>{if(d.hidden&&el&&!el.hidden){// background: free every connection, come back to the same games
  const vis=st.tiles.slice(0,st.layout);MV.bg=vis.map(t=>t.ch);MV.bgSel=st.sel;Object.keys(players).forEach(k=>stop(+k));st.tiles=st.tiles.map((t,i)=>MVR.empty(i));render()}
  else if(!d.hidden&&el&&!el.hidden&&MV.bg){MV.bg.forEach((c,i)=>{if(c)MVR.assign(st,i,c)});MVR.select(st,MV.bgSel||0);MV.bg=null;render();sync()}});
}
const MV=root.MV={open,close,back,get state(){return st},get _players(){return players},parked:null};
const btn=d.getElementById('btnMv');if(btn)btn.addEventListener('click',open);
})(typeof window!=='undefined'?window:globalThis);

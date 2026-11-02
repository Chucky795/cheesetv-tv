/* CheeseTV app Christmas theme. XMAS_END is the off switch: after it nothing runs. */
(function(){
var XMAS_START=new Date(2026,10,1),XMAS_END=new Date(2027,0,7); // on Nov 1 2026 through Jan 6 2027
var now=new Date(),q=location.search;
if(!/xmas=1/.test(q)&&(now<XMAS_START||now>=XMAS_END||/xmas=0/.test(q)))return;
var d=document,h=d.documentElement;h.classList.add('xmas');
var ua=navigator.userAgent,tv=/SMART-TV|SmartTV|Tizen|Web0S|webOS|AFT|Android TV|BRAVIA|CrKey|GoogleTV|HbbTV/i.test(ua)||/[?&]tv=1/.test(q);
var lite=tv||(navigator.hardwareConcurrency||4)<=2||(navigator.deviceMemory||4)<=1;if(lite)h.classList.add('xmas-lite');
var top=d.querySelector('header.top');if(top){var l=d.createElement('div');l.className='xmas-lights';l.setAttribute('aria-hidden','true');l.innerHTML=new Array(innerWidth<700?15:31).join('<i></i>');top.appendChild(l)}
if(lite||matchMedia('(prefers-reduced-motion: reduce)').matches)return; // no snow on TVs / low-end
var c=d.createElement('canvas');c.id='xmas-snow';c.setAttribute('aria-hidden','true');d.body.appendChild(c);
var g=c.getContext('2d'),w,H,f=[],n=innerWidth<700?25:45;
function rs(){w=c.width=innerWidth;H=c.height=innerHeight}rs();addEventListener('resize',rs);
for(var i=0;i<n;i++)f.push({x:Math.random()*w,y:Math.random()*H,r:1+Math.random()*2,s:.3+Math.random()*.8,o:Math.random()*6});
function playing(){var p=d.getElementById('player');return p&&!p.hidden&&p.offsetParent!==null}
(function t(){if(d.hidden||playing()){c.style.display='none';return setTimeout(t,700)}c.style.display='';g.clearRect(0,0,w,H);g.fillStyle='rgba(255,255,255,.75)';for(var i=0;i<n;i++){var p=f[i];p.y+=p.s;p.o+=.01;p.x+=Math.sin(p.o)*.4;if(p.y>H){p.y=-5;p.x=Math.random()*w}g.beginPath();g.arc(p.x,p.y,p.r,0,6.3);g.fill()}requestAnimationFrame(t)})();
})();

const C='cheesetv-app-v4',A=['/','/index.html','/app.css','/app.js','/manifest.webmanifest','/vendor/hls.min.js','/vendor/mpegts.js','/icons/icon-192.png','/icons/apple-touch-icon.png','/assets/logo-112.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('cheesetv-app')&&x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==location.origin||!A.includes(u.pathname))return;
e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put(r,cp));return res}).catch(()=>caches.match(r).then(m=>m||caches.match('/'))))});

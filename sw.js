const CACHE='bandplayer-pwa-v0-2-6';
const SHELL=['./','./index.html','./css/styles.css','./js/app.js','./js/pwa.js','./js/audio/mkv-loader.js','./js/audio/playback-engine.js','./js/ui/mixer.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('bandplayer-pwa-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})())});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(request);
    if(cached)return cached;
    const response=await fetch(request);
    if(response.ok){try{await cache.put(request,response.clone())}catch(e){console.warn('BandPlayer cache limit:',e)}}
    return response;
  })());
});

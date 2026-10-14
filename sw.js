self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={title:'DC Watch',body:'Получен новый сигнал. Откройте дашборд для проверки.',tag:'dc-watch'};
 try{if(event.data)data={...data,...event.data.json()}}catch{}
 event.waitUntil(self.registration.showNotification(data.title,{body:data.body,tag:data.tag,icon:new URL('icon-192.png',self.registration.scope).href,data:{url:self.registration.scope}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows)if(client.url.startsWith(self.registration.scope)){await client.focus();return}
  await self.clients.openWindow(self.registration.scope);
 })());
});

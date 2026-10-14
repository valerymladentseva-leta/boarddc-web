(async function(){
 const button=document.querySelector('#push-toggle'),test=document.querySelector('#push-test'),label=document.querySelector('#push-status');
 let registration,subscription=null,key,token;
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
 if(ios&&!standalone){button.textContent='Push на iPhone';label.textContent='Добавьте этот адрес на экран «Домой» и откройте приложение с иконки.';return}
 if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){button.textContent='Push недоступен';label.textContent='Откройте приложение на iPhone с iOS 16.4+ или в браузере с Web Push.';return}
 async function api(path,data){const response=await window.boardFetch('/api/push/'+path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});const result=await response.json();if(!response.ok)throw Error(result.error||'Ошибка сервера');return result}
 function render(){button.disabled=false;button.textContent=subscription?'Отключить push на устройстве':'Включить push на устройстве';test.hidden=!subscription;label.textContent=subscription?'Красный ДЦ → push, даже когда приложение закрыто.':'Уведомления при переходе любого ДЦ в красный статус.'}
 function bytes(value){const b=atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4));return Uint8Array.from(b,c=>c.charCodeAt(0))}
 try{
  token=localStorage.getItem('dc-watch-push-token');
  if(!token){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');localStorage.setItem('dc-watch-push-token',token)}
  key=(await api('key')).publicKey;
  await navigator.serviceWorker.register('./sw.js');registration=await navigator.serviceWorker.ready;
  subscription=await registration.pushManager.getSubscription();
  if(subscription){await api('subscribe',{subscription:subscription.toJSON(),token})}
  render();
 }catch(e){button.textContent='Push не подключён';label.textContent=e.message+' Обновите страницу для повтора.';return}
 button.onclick=async()=>{
  button.disabled=true;
  try{
   if(subscription){await api('unsubscribe',{endpoint:subscription.endpoint,token});await subscription.unsubscribe();subscription=null;render();return}
   // Request permission directly inside a user gesture, before any network call (required on iOS).
   const permission=await Notification.requestPermission();
   if(permission!=='granted'){render();label.textContent='Разрешите уведомления для приложения в настройках iPhone / браузера.';return}
   subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(key)});
   try{await api('subscribe',{subscription:subscription.toJSON(),token})}catch(e){await subscription.unsubscribe();subscription=null;throw e}
   render();
  }catch(e){render();label.textContent='Не удалось изменить подписку: '+e.message}
 };
 test.onclick=async()=>{
  test.disabled=true;
  try{await api('test',{endpoint:subscription.endpoint,token});label.textContent='Тест поставлен в очередь. Ожидайте уведомление; можно свернуть приложение.';
   setTimeout(async()=>{try{const s=await api('status',{endpoint:subscription.endpoint,token});label.textContent=s.error?s.error:s.last_sent?'Push-сервис принял отправку. Проверьте уведомления iPhone.':'Отправка ещё ожидается.'}catch(e){label.textContent=e.message}},8000)
  }catch(e){label.textContent=e.message}finally{test.disabled=false}
 };
})();

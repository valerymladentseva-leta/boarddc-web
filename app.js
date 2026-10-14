/* Browser-only opt-in alerts. No backend messages or subscriptions. */
(function(){
 let enabled=false, previous=null;
 try{enabled=localStorage.getItem('dc-watch-notifications')==='true'}catch{}
 const button=document.querySelector('#notifications-toggle');
 const status=document.querySelector('#notifications-status');
 const supported=typeof Notification!=='undefined';
 function save(){try{localStorage.setItem('dc-watch-notifications',String(enabled))}catch{}}
 function render(){
  button.disabled=!supported;
  button.textContent=enabled?'Выключить уведомления':'Включить уведомления';
  button.setAttribute('aria-pressed',String(enabled));
  status.textContent=!supported?'Браузер не поддерживает уведомления':Notification.permission==='denied'?'Разрешите уведомления для этого сайта в настройках браузера':enabled&&Notification.permission==='granted'?'Включены · пока страница открыта':'Зелёный → жёлтый или красный. Пока страница открыта.';
 }
 button.onclick=async()=>{
  if(enabled){enabled=false;previous=null;save();render();return}
  try{
   const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
   enabled=permission==='granted';previous=null;save();render();
  }catch{status.textContent='Не удалось включить уведомления в этом браузере'}
 };
 window.updateTrafficNotifications=function(traffic,reachable,demo){
  render();
  const fresh=traffic&&reachable&&!demo&&Number.isFinite(Date.parse(traffic.generated_at))&&Date.now()-Date.parse(traffic.generated_at)<=60000;
  if(!fresh||!enabled||!supported||Notification.permission!=='granted'){previous=null;return}
  const tiles=traffic.tiles||[];
  const changed=previous?tiles.filter(t=>previous[t.kind+':'+t.key]==='green'&&(t.color==='yellow'||t.color==='red')):[];
  previous=Object.fromEntries(tiles.map(t=>[t.kind+':'+t.key,t.color]));
  if(!changed.length)return;
  const body=changed.map(t=>`${t.kind==='site'?'ДЦ · ':''}${t.label}: ${t.color==='red'?'красный':'жёлтый'}`).join('\n');
  try{
   const notification=new Notification('DC Watch · изменение светофора',{body:body+'\nСообщения требуют проверки.',tag:'dc-watch-traffic'});
   notification.onclick=()=>{window.focus();notification.close()};
  }catch{status.textContent='Браузер не смог показать уведомление. Проверьте его настройки.'}
 };
 render();
})();

const $=s=>document.querySelector(s);let state={sources:[],messages:[],settings:{}},demo=false,view='feed',visible=[],selectedTile=null,serverReachable=true;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>s?new Date(s).toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'Время не указано';
function notice(s){$('#notice').textContent=s;$('#notice').hidden=false;setTimeout(()=>$('#notice').hidden=true,8000)}
async function api(path,data){const r=await window.boardFetch('/api/'+path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});const result=await r.json();if(!r.ok)throw Error(result.error||'Ошибка запроса');return result}
async function load(){try{state=await api('state');serverReachable=true;render()}catch(e){serverReachable=false;renderTraffic();notice('Сервер недоступен: '+e.message)}}
async function action(path,data){try{await api(path,data);await load();return true}catch(e){notice(e.message);return false}}
function switchView(v){view=v;for(const name of ['feed','sources','settings'])$('#'+name).hidden=name!==v;document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view===v));$('#section').textContent={feed:'ЛЕНТА СИГНАЛОВ',sources:'ИСТОЧНИКИ',settings:'ПРАВИЛА'}[v];$('#title').textContent={feed:'Сигналы под контролем.',sources:'Источники информации.',settings:'Ваши правила мониторинга.'}[v];if(v==='settings')for(const [k,val]of Object.entries(state.settings))$('#settings-form').elements[k].value=val}
function demoData(){return [
{title:'Учебный пример: сообщение о возможной атаке на дата-центр',text:'ДЕМО · Вымышленное сообщение для проверки интерфейса. Упоминаются Яндекс, дата-центр и атака. Это не новость и не сообщение о реальном событии.',source:'Демонстрационный канал',hits:['яндекс','дата-центр','атак'],status:'unverified',match:true},
{title:'Учебный пример: сообщение о пожаре требует проверки',text:'ДЕМО · Вымышленный текст: Яндекс, ЦОД, пожар. Совпадение слов не устанавливает связь события с объектом и не подтверждает происшествие.',source:'Демонстрационный паблик',hits:['яндекс','цод','пожар'],status:'unverified',match:true},
{title:'Учебный пример: нерелевантное упоминание отклонено',text:'ДЕМО · Условный материал об учениях: защита дата-центра Яндекса от атак. Статус выставлен только для демонстрации.',source:'Демонстрационный чат',hits:['яндекс','дата-центр','атак'],status:'dismissed',match:true}
].map((m,i)=>({...m,id:'demo-'+i,published:new Date(Date.now()-(i+1)*1800000).toISOString(),url:''}))}
function sourceRows(sources,full=false){if(!sources.length)return '<p class="muted">Пока нет источников.<br>Добавьте канал, RSS или экспорт чата.</p>';return sources.map(s=>`<div class="source-row"><div><strong>${esc(s.name)}</strong><small>${esc({telegram:'Telegram',rss:'RSS / Atom',import:'Импорт чата'}[s.kind])} · ${s.last_check?date(s.last_check):'Ожидает загрузки'}</small>${s.error?`<small class="error">${esc(s.error)}</small>`:''}${full?`<small>${esc(s.url)}</small>`:''}</div>${full?`<button data-remove="${s.id}">Удалить</button>`:`<span>${s.error?'!':s.last_check?'✓':'·'}</span>`}</div>`).join('')}
function render(){renderTraffic();const messages=demo?demoData():state.messages;$('#mode-title').textContent=demo?'Демонстрационный режим':'Реальные данные';$('#mode-desc').textContent=demo?'· Все сообщения вымышлены':state.sources.length?`· Опрос каждые ${state.settings.interval} сек. Пока сервер запущен`:'· Добавьте источники, чтобы начать сбор';$('#demo').textContent=demo?'Вернуться к данным':'Посмотреть демо';$('#pending').textContent=messages.filter(m=>m.match&&m.status==='unverified').length;$('#confirmed').textContent=messages.filter(m=>m.status==='confirmed').length;$('#total').textContent=messages.length;$('#source-count').textContent=demo?'—':state.sources.length;const errors=state.sources.filter(s=>s.error).length;$('#health').textContent=demo?'Демо не подключает источники':errors?`Ошибки загрузки: ${errors}`:state.sources.length?'Проверки доступны в источниках':'Не подключены';$('#refresh').disabled=state.refreshing;$('#refresh').textContent=state.refreshing?'↻ Идёт загрузка…':'↻ Обновить источники';$('#source-summary').innerHTML=sourceRows(state.sources.slice(0,4));$('#source-list').innerHTML=sourceRows(state.sources,true);
const query=$('#search').value.toLowerCase(),filter=$('#filter').value,geo=$('#geo').value;visible=messages.filter(m=>(!geo||(m.locations||[]).some(l=>l.code===geo)||(geo==='REG'&&m.moscow_region))&&(m.title+' '+m.text+' '+m.source).toLowerCase().includes(query)&&(filter==='all'||['direct','regional'].includes(filter)&&m.signal_type===filter||filter==='matches'&&m.match||filter==='unverified'&&m.match&&m.status==='unverified'||['confirmed','dismissed'].includes(filter)&&m.status===filter));$('#count').textContent=visible.length;
$('#messages').innerHTML=visible.length?visible.map(m=>`<article class="message"><div class="message-top"><span class="source-name">${demo?'ДЕМО · ':''}${esc(m.source)} <span class="muted"> / ${date(m.published)}</span></span><span class="badge ${m.status}">${{unverified:m.match?'ТРЕБУЕТ ПРОВЕРКИ':'БЕЗ ОЦЕНКИ',confirmed:'ПОДТВЕРЖДЕНО ВРУЧНУЮ',dismissed:'ОТКЛОНЕНО'}[m.status]}</span></div><h3>${esc(m.title)}</h3><p>${esc(m.text)}</p><div class="tags">${!demo&&Date.now()-Date.parse(m.published)>=900000?'<span class="tag">Устарело · не учитывается в светофоре</span>':''}${m.signal_type==='regional'?'<span class="tag">РЕГИОНАЛЬНЫЙ КОНТЕКСТ · связь с ДЦ не установлена</span>':''}${(m.locations||[]).map(l=>`<span class="tag">${esc(l.city)}</span>`).join('')}${m.moscow_region?'<span class="tag">Московская область</span>':''}${m.hits.map(h=>`<span class="tag">${esc(h)}</span>`).join('')}</div><div class="message-bottom">${/^https?:\/\//i.test(m.url)?`<a target="_blank" rel="noopener noreferrer" href="${esc(m.url)}">Открыть оригинал ↗</a>`:'<span class="muted">'+(demo?'Вымышленный пример':'Импортированное сообщение')+'</span>'}<select aria-label="Оценка сообщения" data-status="${m.id}" ${demo?'disabled':''}>${[['unverified','Без подтверждения'],['confirmed','Подтвердить вручную'],['dismissed','Отклонить']].map(([v,l])=>`<option value="${v}" ${v===m.status?'selected':''}>${l}</option>`).join('')}</select></div></article>`).join(''):`<div class="empty"><div class="icon">◎</div><h3>${state.sources.length?'Подходящих сообщений нет':'Мониторинг начинается с источников'}</h3><p>${state.sources.length?'Измените фильтр или дождитесь загрузки. Отсутствие совпадений не означает отсутствие событий.':'Добавьте публичный Telegram-канал, RSS-ленту или импортируйте переписку. Найденные сообщения появятся здесь.'}</p><button data-go="sources">+ Добавить источник</button></div>`}
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.tile){selectedTile=selectedTile===b.dataset.tile?null:b.dataset.tile;renderTraffic()}if(b.dataset.view||b.dataset.go)switchView(b.dataset.view||b.dataset.go);if(b.dataset.remove&&confirm('Удалить источник и его сохранённые сообщения?'))await action('remove',{id:Number(b.dataset.remove)})});
document.addEventListener('change',e=>{if(e.target.dataset.status)action('status',{id:e.target.dataset.status,status:e.target.value})});
$('#search').oninput=render;$('#filter').onchange=render;$('#geo').onchange=render;$('#demo').onclick=()=>{demo=!demo;render()};$('#refresh').onclick=()=>action('refresh',{});
$('#source-form').onsubmit=async e=>{e.preventDefault();if(await action('sources',Object.fromEntries(new FormData(e.target)))){e.target.reset();notice('Источник добавлен. Началась загрузка.')}};
$('#settings-form').onsubmit=async e=>{e.preventDefault();if(await action('settings',Object.fromEntries(new FormData(e.target))))notice('Правила сохранены')};
$('#import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>9_000_000)throw Error('Выберите JSON до 9 МБ');const data=JSON.parse(await file.text());if(await action('import',{export:data})){demo=false;render();notice('Переписка импортирована')}}catch(err){notice(err.message)}e.target.value=''};
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify({demo,exported_at:new Date().toISOString(),messages:visible},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=demo?'dc-watch-DEMO.json':'dc-watch-messages.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
function clock(){$('#clock').textContent=new Date().toLocaleString('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}clock();load();setInterval(load,5000);setInterval(clock,30000);

function renderTraffic(){
 window.updateTrafficNotifications(state.traffic,serverReachable,demo);
 updateAlarm();
 const t=state.traffic, labels={red:'Сообщение о происшествии',yellow:'Требует проверки',green:'Свежих сигналов нет',gray:'Недостаточно данных'};
 if(!t){$('#traffic-title').textContent='Светофор недоступен — обновите сервер';return}
 const offline=!serverReachable || Date.now()-Date.parse(t.generated_at)>60000;
 $('#traffic-title').textContent=demo?'Светофор скрыт в демо-режиме':offline?'Нет связи с сервером — статусы устарели':labels[t.color];
 $('#traffic-health').textContent=offline?'Нет связи':t.healthy?'Источники обновляются':'Есть ошибки или устаревшие источники';
 $('#traffic-health').className=offline||!t.healthy?'traffic-warning':'muted';
 for(const [kind,id]of [['region','region-tiles'],['site','site-tiles']])$('#'+id).innerHTML=demo?'':t.tiles.filter(x=>x.kind===kind).map(x=>{const c=offline?'gray':x.color;return `<button class="signal-tile ${c} ${selectedTile===x.key?'selected':''}" data-tile="${esc(x.key)}" aria-pressed="${selectedTile===x.key}"><span class="tile-top"><span class="signal-dot"></span>${kind==='region'?'<span>ОБЛАСТЬ</span>':''}</span><strong>${esc(x.label)}</strong><span class="tile-status">${labels[c]}</span><small>${x.evidence.length} сообщений · открыть</small></button>`}).join('');
 $('#unlocated').textContent=!demo&&t.unlocated.length?`Сообщений о ДЦ без точного определения площадки: ${t.unlocated.length}. Они влияют на общий индикатор, но не окрашивают все ДЦ красным.`:'';
 if(!demo&&t.unlocated.length){const b=document.createElement('button');b.dataset.tile='unlocated';b.textContent='Показать сообщения';$('#unlocated').append(' ',b)}
 const tile=selectedTile==='unlocated'?{label:'ДЦ без точной площадки',evidence:t.unlocated}:t.tiles.find(x=>x.key===selectedTile), panel=$('#traffic-evidence');panel.hidden=demo||!tile;
 if(tile){const items=t.evidence.filter(x=>tile.evidence.includes(x.id));panel.innerHTML=`<h3>${esc(tile.label)} · основания индикатора</h3>`+(items.length?items.map(e=>`<article class="traffic-proof"><strong>${esc(e.title)}</strong><p>${esc(e.source)} · ${date(e.published)} · ${e.status==='confirmed'?'Подтверждено оператором':'Без подтверждения'}</p>${/^https?:\/\//i.test(e.url)?`<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">Читать источник ↗</a>`:'<span>Импортированное сообщение</span>'}</article>`).join(''):'<p class="muted">За последние 15 минут подходящих сообщений не найдено.</p>')}
}

let alarmMuted=false;
try{alarmMuted=localStorage.getItem('dc-watch-alarm-muted')==='true'}catch{}
function updateAlarm(){
 const t=state.traffic, fresh=t&&serverReachable&&Date.now()-Date.parse(t.generated_at)<=60000;
 const active=!alarmMuted&&!demo&&fresh&&t.tiles.some(tile=>tile.kind==='site'&&tile.color==='red');
 const lamp=$('#alarm-lamp'),toggle=$('#alarm-toggle');
 lamp.classList.toggle('flashing',Boolean(active));
 const label=alarmMuted?'Лампа выключена':demo?'Демо · лампа погашена':!fresh?'Нет свежих данных':active?'Красный сигнал · требует проверки':'Лампа погашена';
 lamp.setAttribute('aria-label',label);
 if($('#alarm-status').textContent!==label)$('#alarm-status').textContent=label;
 toggle.textContent=alarmMuted?'Вкл':'Выкл';
 toggle.setAttribute('aria-pressed',String(alarmMuted));
 toggle.setAttribute('aria-label',alarmMuted?'Включить аварийную лампу':'Выключить аварийную лампу');
}
$('#alarm-toggle').onclick=()=>{alarmMuted=!alarmMuted;try{localStorage.setItem('dc-watch-alarm-muted',String(alarmMuted))}catch{}updateAlarm()};
updateAlarm();setInterval(updateAlarm,1000);

(function(){
 const root=document.documentElement,button=document.querySelector('#theme-toggle');
 let theme='dark';try{theme=localStorage.getItem('dc-watch-theme')==='light'?'light':'dark'}catch{}
 function apply(){root.dataset.theme=theme;button.textContent=theme==='dark'?'☀ Светлая тема':'☾ Тёмная тема';button.setAttribute('aria-label',theme==='dark'?'Включить светлую тему':'Включить тёмную тему')}
 button.onclick=()=>{theme=theme==='dark'?'light':'dark';try{localStorage.setItem('dc-watch-theme',theme)}catch{}apply()};apply();
})();

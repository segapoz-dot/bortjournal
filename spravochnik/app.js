'use strict';
const $ = id => document.getElementById(id);
// Один каталог = один пункт здесь. Чтобы добавить список ошибок своего станка:
// 1) положить JSON-файл рядом (формат как fanuc.json/siemens.json — code/title/series/source/page);
// 2) добавить сюда одну строку {key, label, symbol, file};
// 3) (не обязательно) добавить цвет значка в app.css — класс .symbol.<key>, иначе будет серый по умолчанию.
const CATALOGS = [
  {key:'fanuc', label:'Аварии FANUC', symbol:'F', file:'fanuc.json'},
  {key:'siemens', label:'Аварии SINUMERIK', symbol:'S', file:'siemens.json'},
  {key:'gcodes', label:'G-команды SINUMERIK', symbol:'G', file:'gcodes.json'},
  {key:'fanuc_drives', label:'Привода FANUC (LED-коды)', symbol:'P', file:'fanuc_drives.json'},
];
const labels = Object.fromEntries(CATALOGS.map(c=>[c.key,c.label]));
const symbols = Object.fromEntries(CATALOGS.map(c=>[c.key,c.symbol]));
const fanucPrefixes = {PS:'Программа и работа',BG:'Фоновое редактирование',SR:'Связь',SV:'Сервопривод',OT:'Выход за пределы',IO:'Файлы и ввод-вывод',SW:'Запись параметров',PW:'Требуется выключение питания',SP:'Шпиндель',OH:'Перегрев',DS:'Прочие аварии',IE:'Предотвращение сбоев'};
const catalogs = {};
let limit = 30;
function element(tag, text, cls) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
function normal(text) { return text.trim().toUpperCase().replaceAll('Ё','Е'); }
function codeKey(text) { return normal(text).replace(/[\s-]+/g,'').replace(/^([A-Z]*)0+(?=\d)/,'$1'); }
function populate(select, values, label) {
  select.replaceChildren(new Option(label,''));
  for (const val of [...new Set(values)].sort()) select.add(new Option(val,val));
}
function updateFilters() {
  const key = $('section').value;
  const rows = key ? catalogs[key] : Object.values(catalogs).flat();
  populate($('series'),rows.map(r=>r.series),'Все стойки');
  $('prefixBox').hidden = key !== 'fanuc';
  populate($('prefix'),key === 'fanuc' ? catalogs.fanuc.flatMap(r=>r.keys.map(k=>k.match(/^[A-Z]+/)?.[0])).filter(Boolean) : [],'Все');
  limit=30; render();
}
function showCatalogs() {
  $('listTitle').textContent='Каталоги';
  $('count').textContent='';
  for (const {key,label,symbol} of CATALOGS) {
    const button=element('button',undefined,'catalog');
    const name=element('span');
    const n=new Set(catalogs[key].map(r=>r.code)).size;
    name.append(element('strong',label),element('small',n.toLocaleString('ru')+' кодов','meta'));
    button.append(element('span',symbol,'symbol '+key),name,element('span','›','chevron'));
    button.onclick=()=>{ $('section').value=key; updateFilters(); };
    $('results').append(button);
  }
}
function showCard(group, requestedPrefix) {
  const row=group[0], card=element('article',undefined,'card');
  const selectedCode=requestedPrefix && row.category==='fanuc'
    ? [row.code,...(row.aliases||[])].find(code=>code.startsWith(requestedPrefix)) : null;
  const code=selectedCode || row.code;
  const kind=selectedCode ? fanucPrefixes[requestedPrefix] : labels[row.category];
  card.append(element('h3',code),element('div',kind,'meta'));
  const isStub = /указатель$/i.test((row.title||'').trim());
  if(row.title && !isStub)card.append(element('p',row.title));
  if(row.message_en)card.append(element('p',(isStub?'На английском (ещё не переведено): ':'В руководстве: ')+row.message_en,'original-message'));
  if(isStub && row.desc_en)card.append(element('p',row.desc_en));
  if(!row.title && !row.message_en)card.append(element('p','Для этого кода в каталоге пока нет расшифровки. Сверь сообщение на стойке с руководством.'));
  const refs=element('div',undefined,'refs');
  for(const item of group) {
    const a=element('a',item.series+(item.page ? (item.source.includes('studylib.net') ? ' · стр. руководства ' : ' · стр. PDF ')+item.page : ' · руководство')+' ↗');
    const link=new URL(item.source, location.href);
    if(link.protocol!=='https:' && link.protocol!=='http:')continue;
    if(item.page && /\.pdf$/i.test(link.pathname))link.hash='page='+item.page;
    a.href=link.href; a.target='_blank'; a.rel='noopener noreferrer'; refs.append(a);
  }
  card.append(refs); $('results').append(card);
}
function render() {
  if(!Object.keys(labels).every(k=>catalogs[k])) return;
  const q=normal($('query').value), k=codeKey(q);
  const section=$('section').value, series=$('series').value, prefix=$('prefix').value;
  const requestedPrefix=prefix || q.match(/^[A-Z]+/)?.[0] || '';
  $('results').replaceChildren(); $('more').hidden=true;
  if (!q && !section && !series) { showCatalogs(); return; }
  const groups = new Map();
  const numeric=/^\d+$/.test(k);
  const isCode=/^[A-Z]*\d+(?:\.\d+)?$/.test(k);
  for(const [category,rows] of Object.entries(catalogs)) {
    if(section && section!==category) continue;
    for(const row of rows) {
      if(series && series!==row.series) continue;
      const keys=prefix ? row.keys.filter(s=>(s.match(/^[A-Z]+/)||[''])[0]===prefix) : row.keys;
      if(!keys.length) continue;
      const exact=keys.some(s=>s===k || (numeric && s.replace(/^[A-Z]+/,'')===k));
      if(q && !exact && (isCode || (!keys.some(s=>s.startsWith(k)) && !row.words.includes(q)))) continue;
      const groupKey=[category,row.code,row.title,row.message_en].join('|');
      if(!groups.has(groupKey)) groups.set(groupKey,[]);
      groups.get(groupKey).push(row);
    }
  }
  $('listTitle').textContent=q?'Результаты поиска':(labels[section]||'Результаты');
  $('count').textContent=groups.size.toLocaleString('ru');
  if(!groups.size) $('results').textContent='Совпадений в загруженных каталогах нет. Проверь код или выбери все стойки.';
  for(const group of [...groups.values()].slice(0,limit)) showCard(group,requestedPrefix);
  $('more').hidden=limit>=groups.size;
}
function populateSections() {
  const sel = $('section');
  for (const {key,label} of CATALOGS) sel.add(new Option(label,key));
}
async function load() {
  populateSections();
  try {
    await Promise.all(CATALOGS.map(async ({key,file})=>{
      const response=await fetch(file);
      if(!response.ok)throw Error(response.status);
      catalogs[key]=(await response.json()).map(row=>({...row,category:key,
        keys:[row.code,...(row.aliases||[])].map(codeKey),words:normal([row.title,row.message_en,row.desc_en].filter(Boolean).join(' '))}));
    }));
    updateFilters();
  } catch { $('results').textContent='Не удалось загрузить каталог. Открой страницу снова при доступной сети.'; }
  $('results').setAttribute('aria-busy','false');
}
$('query').oninput=()=>{limit=30;render();};
$('search').onsubmit=e=>{e.preventDefault();$('query').blur();render();};
$('section').onchange=updateFilters;
$('series').onchange=$('prefix').onchange=()=>{limit=30;render();};
$('more').onclick=()=>{limit+=30;render();};
if ('serviceWorker' in navigator) {
  $('network').textContent='Сохранение на телефон…';
  navigator.serviceWorker.register('../sw.js').then(()=>navigator.serviceWorker.ready)
    .then(()=>{$('network').textContent='● Доступен без интернета';})
    .catch(()=>{$('network').textContent='Офлайн-копия пока недоступна';});
}
load();

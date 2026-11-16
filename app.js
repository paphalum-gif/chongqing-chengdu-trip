const KEY = 'tripdash-v4-local';
const cfg = window.SUPABASE_CONFIG || {};
const hasCloudConfig = !!(cfg.url && cfg.anonKey && window.supabase);
let sb = hasCloudConfig ? window.supabase.createClient(cfg.url, cfg.anonKey) : null;
let session = null;
let cloudTrip = null;
let cloudMembers = [];
let bookingFilter = 'all';
let dayFilter = 'all';

const seed = {
  days: [
    ['1','17 Dec','Chongqing',['11:50 BKK → CKG · 16:15 arrival','Check-in · Chongqing Anchor-Anzhou Vacation Apartment','Jiefangbei 解放碑','Hongyadong 洪崖洞 · night view']],
    ['2','18 Dec','Chongqing',['10:00 leave hotel','11:40 Qingyu Banquet 庆渝宴 · Yangpaoju 1862','Liziba 李子坝 · train-through-building','Sunset · Wild Tea Collection · Qiansimen Bridge']],
    ['3','19 Dec','Chongqing',['10:00 Ciqikou 磁器口','Eling Park 鹅岭公园','Drone Show · tentative · Changjiahui / Nanbin Road']],
    ['4','20 Dec','Chongqing',['10:00 Jiefangbei 解放碑','Guotai Arts Center · Chopsticks Building','1941 Tea House & Theater · show','Kuixinglou → Shibati','Luohan Temple','Yangtze River Cableway','Hongyadong · night view']],
    ['5','21 Dec','Travel',['Check-out Chongqing','HSR Chongqing → Chengdu','Check-in · Do A LAND LAB Hotel','SKP Chengdu · Taikoo Li · IFS Panda']],
    ['6','22 Dec','Chengdu',['SKP 成都SKP','IFS Panda','Taikoo Li 太古里','Binsheng Street / Chongde Li Alley','Stackway Cafe / Obibi Cafe']],
    ['7','23 Dec','Chengdu',['Chengdu Panda Base 成都大熊猫繁育研究基地','Panda Selfie','Binsheng Street','Dinner · Chunxi / Hotpot']],
    ['8','24 Dec','Chengdu',["People's Park 人民公园 · Heming Tea House 鹤鸣茶社",'Wenshu Monastery 文殊院','Chongde Li Alley','Doll House Residential','Tianfu Art Park · Shuyuan · night reflection']],
    ['9','25 Dec','Chengdu',['Check-out / luggage','Sanxingdui Museum 三星堆博物馆','Dujiangyan Zhongshuge 都江堰钟书阁','Langqiao Gate / Fanghua Street','Eastern Suburb Memory / Dongjiao Jiyi','15:05–17:20 TFU → BKK']]
  ],
  bookings: [
    {title:'BKK → CKG',date:'2026-12-17',status:'booked',provider:'Flight',ref:'Flight confirmation',url:''},
    {title:'Chongqing hotel · Anchor-Anzhou',date:'2026-12-17',status:'booked',provider:'Trip.com',ref:'',url:''},
    {title:'Qingyu Banquet',date:'2026-12-18',status:'booked',provider:'Yangpaoju 1862',ref:'',url:''},
    {title:'1941 Theater',date:'2026-12-20',status:'todo',provider:'',ref:'',url:''},
    {title:'Yangtze River Cableway',date:'2026-12-20',status:'todo',provider:'',ref:'',url:''},
    {title:'Chongqing → Chengdu HSR',date:'2026-12-21',status:'todo',provider:'',ref:'',url:''},
    {title:'Do A LAND LAB · 21–22',date:'2026-12-21',status:'booked',provider:'Trip.com',ref:'',url:''},
    {title:'Do A LAND LAB · 22–25',date:'2026-12-22',status:'booked',provider:'Trip.com',ref:'',url:''},
    {title:'Panda Base',date:'2026-12-23',status:'todo',provider:'',ref:'',url:''},
    {title:'Sanxingdui Museum',date:'2026-12-25',status:'todo',provider:'',ref:'',url:''},
    {title:'TFU → BKK',date:'2026-12-25',status:'booked',provider:'Flight',ref:'Flight confirmation',url:''}
  ],
  expenses: [
    {title:'Chongqing hotel · 4 nights',date:'2026-12-17',amount:4615.98,paidBy:'A',splitA:2307.99,splitB:2307.99,settled:false},
    {title:'Chengdu hotel · 21–22',date:'2026-12-21',amount:2143.12,paidBy:'A',splitA:1071.56,splitB:1071.56,settled:false},
    {title:'Chengdu hotel · 22–25',date:'2026-12-22',amount:5808.78,paidBy:'A',splitA:2904.39,splitB:2904.39,settled:false}
  ]
};

let state = JSON.parse(localStorage.getItem(KEY) || 'null') || structuredClone(seed);
const money = n => '฿' + Number(n || 0).toLocaleString('th-TH',{maximumFractionDigits:2});
const esc = s => String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const saveLocal = () => localStorage.setItem(KEY, JSON.stringify(state));
const isCloud = () => !!(sb && session && cloudTrip);

function currentNames(){
  if(cloudMembers.length>=2) return {A: cloudMembers[0], B: cloudMembers[1]};
  if(cloudMembers.length===1) return {A: cloudMembers[0], B:{id:'B',display_name:'B'}};
  return {A:{id:'A',display_name:'A'}, B:{id:'B',display_name:'B'}};
}

function go(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===id));
  window.scrollTo({top:0,behavior:'smooth'}); render();
}

function render(){
  const gate=document.querySelector('#authGate'), shell=document.querySelector('#appShell');
  const loggedIn=!!session;
  gate?.classList.toggle('hidden',loggedIn);
  shell?.classList.toggle('hidden',!loggedIn);
  if(!loggedIn) return;
  renderHome(); renderPlan(); renderBookings(); renderExpenses(); renderSettlement();
  const pill=document.querySelector('#modePill');
  if(pill) pill.textContent = isCloud() ? '☁ Connected' : 'Cloud';
}

function renderHome(){
  const total = state.expenses.reduce((a,x)=>a+x.amount,0);
  const booked = state.bookings.filter(x=>x.status==='booked').length;
  const outstanding = calculateBalance().amount;
  document.querySelector('#total').textContent=money(total); document.querySelector('#per').textContent=money(total/2);
  document.querySelector('#books').textContent=`${booked}/${state.bookings.length}`; document.querySelector('#settleTop').textContent=money(outstanding);
  const next=state.bookings.find(x=>x.status!=='booked');
  document.querySelector('#priorityCard').innerHTML=next
    ? `<button class="priority-card" onclick="go('booking')"><span class="priority-icon">🎟️</span><span><small>สิ่งที่ควรจัดการต่อ</small><b>${esc(next.title)}</b><em>${esc(formatDate(next.date))} · ยังไม่ได้จอง</em></span><strong>→</strong></button>`
    : `<div class="success-card"><span>✓</span><div><b>Booking ครบแล้ว</b><small>พร้อมเที่ยวได้เลย</small></div></div>`;
  const todos=state.bookings.filter(x=>x.status!=='booked');
  document.querySelector('#bookingHint').textContent=todos.length?`${todos.length} รายการยังต้องจัดการ`:'ครบแล้ว';
  document.querySelector('#homeBookings').innerHTML=todos.slice(0,3).map(x=>bookingCard(x,true)).join('')||`<div class="empty-card">🎉 ไม่มี Booking ที่ค้างอยู่</div>`;
}

function formatDate(d){
  if(!d) return '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(d)){ const x=new Date(d+'T00:00:00'); return x.toLocaleDateString('th-TH',{day:'numeric',month:'short'}); }
  return d;
}

function renderPlan(){
  const filtered=state.days.filter(d=>dayFilter==='all'||d[2]===dayFilter||(dayFilter==='Chengdu'&&d[2]==='Travel'));
  document.querySelector('#days').innerHTML=filtered.map((d,idx)=>{
    const originalIndex=state.days.indexOf(d);
    return `<details class="day-card" ${idx===0?'open':''}>
      <summary><span class="day-number">D${esc(d[0])}</span><span class="day-meta"><b>${esc(formatDate(d[1]))}</b><small>${esc(d[2])}</small></span><span class="chev">⌄</span></summary>
      <div class="day-content">
        <div class="day-edit-row"><span class="plan-title">${esc(d[5]||('Day '+d[0]))}</span><button class="small-btn" onclick="event.preventDefault();openPlanEditor(${originalIndex})">แก้ไขวันนี้</button></div>
        ${d[3].map((item,i)=>`<div class="stop"><span class="stop-num">${i+1}</span><span>${esc(item)}</span></div>`).join('')}
        ${d[3].length===0?'<div class="empty-plan">ยังไม่มีกิจกรรม · กด “แก้ไขวันนี้” เพื่อเพิ่ม</div>':''}
      </div>
    </details>`;
  }).join('') || '<div class="empty-card">ยังไม่มีวันในแผน</div>';
}

function renderBookings(){
  const arr=state.bookings.filter(x=>bookingFilter==='all'||x.status===bookingFilter);
  const todo=state.bookings.filter(x=>x.status==='todo').length;
  document.querySelector('#bookingSummary').textContent=`${todo} รายการยังต้องจอง · ${state.bookings.length-todo} จองแล้ว`;
  document.querySelector('#bookingList').innerHTML=arr.map(x=>bookingCard(x,false)).join('')||`<div class="empty-card">ไม่มีรายการในหมวดนี้</div>`;
}
function bookingCard(x,compact){
  const i=state.bookings.indexOf(x);
  return `<article class="booking-card ${compact?'compact':''}"><div class="booking-main"><span class="booking-icon">${x.status==='booked'?'✓':'!'}</span><div><b>${esc(x.title)}</b><small>${esc(formatDate(x.date))}${x.provider?' · '+esc(x.provider):''}</small>${x.ref?`<small class="muted-line">Ref: ${esc(x.ref)}</small>`:''}</div><span class="status ${x.status}">${x.status==='booked'?'จองแล้ว':'ต้องจอง'}</span></div><div class="card-actions"><button onclick="toggleBook(${i})">${x.status==='booked'?'เปลี่ยนเป็นต้องจอง':'✓ จองแล้ว'}</button>${x.url?`<a href="${esc(x.url)}" target="_blank" rel="noopener"><button>เปิด Ref ↗</button></a>`:''}</div></article>`;
}

function renderExpenses(){
  const total=state.expenses.reduce((a,x)=>a+x.amount,0), aPaid=state.expenses.filter(x=>x.paidBy==='A').reduce((a,x)=>a+x.amount,0);
  document.querySelector('#eTotal').textContent=money(total);document.querySelector('#aPaid').textContent=money(aPaid);document.querySelector('#bPaid').textContent=money(total-aPaid);
  document.querySelector('#expenseList').innerHTML=state.expenses.slice().reverse().map(x=>{
    const i=state.expenses.indexOf(x);
    return `<article class="expense-card"><div class="expense-top"><div><b>${esc(x.title)}</b><small>${esc(formatDate(x.date))} · ${x.paidBy==='A'?'A จ่าย':'B จ่าย'}</small></div><strong>${money(x.amount)}</strong></div><div class="split-line"><span>A ${money(x.splitA)}</span><span>B ${money(x.splitB)}</span></div>${x.settled?`<div class="settled-line">✓ เคลียร์แล้ว</div>`:`<button class="settle-btn" onclick="settleExp(${i})">เคลียร์รายการนี้</button>`}</article>`;
  }).join('');
}
function calculateBalance(){
  let bal=0;
  state.expenses.filter(x=>!x.settled).forEach(x=>{bal += x.paidBy==='A'?x.amount-x.splitA:-(x.amount-x.splitB);});
  return {amount:Math.abs(bal),direction:bal>0?'B → A':bal<0?'A → B':'เคลียร์แล้ว'};
}
function renderSettlement(){
  const b=calculateBalance();
  document.querySelector('#settlement').innerHTML=b.amount<0.01?`<div class="settle-hero clear"><span>✓</span><small>สถานะปัจจุบัน</small><h3>เคลียร์หมดแล้ว</h3><b>฿0</b></div>`:`<div class="settle-hero"><span>↔</span><small>ยอดสุทธิ</small><h3>${b.direction}</h3><b>${money(b.amount)}</b><p>จากรายการที่ยังไม่เคลียร์</p></div>`;
}

function filterBooks(f,btn){bookingFilter=f;document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));btn?.classList.add('active');renderBookings();}
function filterDays(f,btn){dayFilter=f;document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));btn?.classList.add('active');renderPlan();}

async function toggleBook(i){
  const x=state.bookings[i]; const newStatus=x.status==='booked'?'todo':'booked';
  if(isCloud()){ const {error}=await sb.from('bookings').update({status:newStatus,updated_at:new Date().toISOString()}).eq('id',x.id); if(error){alert(error.message);return;} }
  x.status=newStatus; saveLocal(); render();
}

async function settleExp(i){
  const x=state.expenses[i];
  if(isCloud()){ const {error}=await sb.from('expenses').update({settled:true,updated_at:new Date().toISOString()}).eq('id',x.id); if(error){alert(error.message);return;} }
  x.settled=true; saveLocal(); render();
}

function addBooking(){
  openModal(`<div class="modal-title"><div><div class="eyebrow">NEW BOOKING</div><h3>เพิ่มสิ่งที่ต้องจอง</h3></div></div><label>ชื่อรายการ<input id="mTitle" placeholder="เช่น 1941 Theater"></label><label>วันที่<input id="mDate" type="date"></label><label>Provider <small>(ถ้ามี)</small><input id="mProvider" placeholder="เช่น Trip.com"></label><label>Reference URL <small>(ถ้ามี)</small><input id="mUrl" placeholder="https://..."></label><label>Reference <small>(ถ้ามี)</small><input id="mRef" placeholder="Booking number"></label><button class="primary-btn wide" onclick="submitBooking()">บันทึก Booking</button>`);
}
async function submitBooking(){
  const item={title:document.querySelector('#mTitle').value.trim(),date:document.querySelector('#mDate').value,provider:document.querySelector('#mProvider').value.trim(),ref:document.querySelector('#mRef').value.trim(),url:document.querySelector('#mUrl').value.trim(),status:'todo'};
  if(!item.title)return;
  if(isCloud()){
    const {data,error}=await sb.from('bookings').insert({trip_id:cloudTrip.id,...item,created_by:session.user.id}).select().single();
    if(error){alert(error.message);return;} state.bookings.push(data);
  } else state.bookings.push(item);
  saveLocal();closeModal();render();
}

function addExpense(){
  openModal(`<div class="modal-title"><div><div class="eyebrow">NEW EXPENSE</div><h3>เพิ่มค่าใช้จ่าย</h3></div></div><label>รายการ<input id="eTitle" placeholder="เช่น Dinner"></label><label>วันที่<input id="eDate" type="date"></label><label>ยอดรวม<input id="eAmount" type="number" min="0" step="0.01" placeholder="1200"></label><label>ใครจ่าย<select id="ePaid"><option value="A">A จ่าย</option><option value="B">B จ่าย</option></select></label><div class="split-toggle"><button type="button" class="active" id="equalBtn" onclick="setEqualSplit()">แบ่งเท่ากัน</button><button type="button" onclick="setCustomSplit()">กำหนดเอง</button></div><div class="split-inputs"><label>A<input id="eA" type="number" min="0" step="0.01"></label><label>B<input id="eB" type="number" min="0" step="0.01"></label></div><button class="primary-btn wide" onclick="submitExpense()">บันทึกค่าใช้จ่าย</button>`);
  document.querySelector('#eAmount').addEventListener('input',setEqualSplit);
}
function setEqualSplit(){const amount=Number(document.querySelector('#eAmount')?.value||0);document.querySelector('#eA').value=(amount/2).toFixed(2);document.querySelector('#eB').value=(amount/2).toFixed(2);document.querySelector('#equalBtn')?.classList.add('active');}
function setCustomSplit(){document.querySelector('#equalBtn')?.classList.remove('active');}

async function submitExpense(){
  const title=document.querySelector('#eTitle').value.trim(),amount=Number(document.querySelector('#eAmount').value||0),a=Number(document.querySelector('#eA').value||amount/2),b=Number(document.querySelector('#eB').value||amount/2),payer=document.querySelector('#ePaid').value;
  if(!title||!amount||Math.abs(a+b-amount)>0.01){alert('เช็กยอดแบ่ง A + B ให้เท่ากับยอดรวม');return;}
  if(isCloud()){
    const names=currentNames(), paidBy=payer==='A'?names.A.id:names.B.id;
    const {data,error}=await sb.from('expenses').insert({trip_id:cloudTrip.id,title,expense_date:document.querySelector('#eDate').value,amount,currency:'THB',paid_by:paidBy,created_by:session.user.id,settled:false}).select().single();
    if(error){alert(error.message);return;}
    const rows=[{expense_id:data.id,user_id:names.A.id,share_amount:a},{expense_id:data.id,user_id:names.B.id,share_amount:b}];
    const sr=await sb.from('expense_splits').insert(rows); if(sr.error){alert(sr.error.message);return;}
    state.expenses.push({id:data.id,title,date:data.expense_date,amount,paidBy:payer,splitA:a,splitB:b,settled:false});
  } else state.expenses.push({title,date:document.querySelector('#eDate').value,amount,paidBy:payer,splitA:a,splitB:b,settled:false});
  saveLocal();closeModal();render();
}

function dateForInput(value){
  return /^\d{4}-\d{2}-\d{2}$/.test(value)?value:'';
}

function openPlanEditor(index){
  if(!session){return;}
  const d=state.days[index];
  if(!d)return;
  openModal(`<div class="modal-title"><div><div class="eyebrow">EDIT DAY ${esc(d[0])}</div><h3>ปรับแผนวันนี้</h3></div></div>
    <div class="form-grid">
      <label>วันที่<input id="pDate" type="date" value="${esc(dateForInput(d[1]))}"></label>
      <label>เมือง<input id="pCity" value="${esc(d[2]||'')}"></label>
    </div>
    <label>ชื่อวัน / จุดประสงค์<input id="pTitle" value="${esc(d[5]||('Day '+d[0]))}" placeholder="เช่น Chongqing · Old Town & Night View"></label>
    <label>กิจกรรม <small>หนึ่งบรรทัดต่อ 1 กิจกรรม</small><textarea id="pNotes" rows="8" placeholder="10:00 ออกจากโรงแรม\n11:30 午餐\n14:00 ...">${esc(d[3].join('\n'))}</textarea></label>
    <button class="primary-btn wide" onclick="savePlanDay(${index})">บันทึกแผน</button>`);
}

async function savePlanDay(index){
  const d=state.days[index];
  const payload={plan_date:document.querySelector('#pDate').value||null,city:document.querySelector('#pCity').value.trim(),title:document.querySelector('#pTitle').value.trim()||('Day '+d[0]),notes:document.querySelector('#pNotes').value.split('\n').map(x=>x.trim()).filter(Boolean).join(' · ')};
  if(isCloud()){
    const {error}=await sb.from('daily_plans').update(payload).eq('id',d[4]);
    if(error){alert(error.message);return;}
  }
  d[1]=payload.plan_date||''; d[2]=payload.city; d[5]=payload.title; d[3]=payload.notes?payload.notes.split(' · '):[];
  saveLocal(); closeModal(); renderPlan(); renderHome();
}

function addPlanDay(){
  if(!session){return;}
  const nextNo=state.days.reduce((m,d)=>Math.max(m,Number(d[0])||0),0)+1;
  openModal(`<div class="modal-title"><div><div class="eyebrow">NEW DAY</div><h3>เพิ่มวันในแผน</h3></div></div>
    <div class="form-grid">
      <label>วันที่<input id="pDate" type="date"></label>
      <label>เมือง<input id="pCity" placeholder="Chongqing / Chengdu"></label>
    </div>
    <label>ชื่อวัน / จุดประสงค์<input id="pTitle" value="Day ${nextNo}"></label>
    <label>กิจกรรม <small>หนึ่งบรรทัดต่อ 1 กิจกรรม</small><textarea id="pNotes" rows="7" placeholder="เพิ่มกิจกรรมทีละบรรทัด"></textarea></label>
    <button class="primary-btn wide" onclick="saveNewPlanDay(${nextNo})">เพิ่มวัน</button>`);
}

async function saveNewPlanDay(dayNo){
  const payload={trip_id:cloudTrip.id,day_no:dayNo,plan_date:document.querySelector('#pDate').value||null,city:document.querySelector('#pCity').value.trim(),title:document.querySelector('#pTitle').value.trim()||('Day '+dayNo),notes:document.querySelector('#pNotes').value.split('\\n').map(x=>x.trim()).filter(Boolean).join(' · '),sort_order:dayNo};
  const {data,error}=await sb.from('daily_plans').insert(payload).select().single();
  if(error){alert(error.message);return;}
  state.days.push([String(data.day_no),data.plan_date||'',data.city||'',(data.notes||'').split(' · ').filter(Boolean),data.id,data.title]);
  state.days.sort((a,b)=>Number(a[0])-Number(b[0]));
  saveLocal(); closeModal(); renderPlan(); renderHome();
}

function openTripInfo(){
  openModal(`<div class="modal-title"><div><div class="eyebrow">TRIP INFO</div><h3>Chongqing → Chengdu</h3></div></div><div class="info-grid"><div><small>Dates</small><b>17–25 Dec 2026</b></div><div><small>People</small><b>${cloudMembers.length||2} people</b></div><div><small>Hotel · Chongqing</small><b>Anchor-Anzhou</b></div><div><small>Hotel · Chengdu</small><b>Do A LAND LAB</b></div></div><div class="note">${isCloud()?'☁ ข้อมูล sync ผ่าน Supabase':'Demo Mode · ข้อมูลอยู่ใน browser เครื่องนี้'}</div>`);
}

function openCloudPanel(){
  if(!hasCloudConfig){openModal(`<div class="modal-title"><div class="eyebrow">CLOUD SYNC</div><h3>ยังไม่ได้ตั้งค่า Supabase</h3></div><p>ตรวจ config.js ก่อนใช้งาน</p>`);return;}
  if(session){
    openModal(`<div class="modal-title"><div class="eyebrow">ACCOUNT</div><h3>เชื่อมต่อแล้ว ☁</h3></div><p>${esc(session.user.email||'Signed in')}</p><p>Trip Code: <b>${esc(cloudTrip?.share_code||'—')}</b></p><div class="note">แชร์ Trip Code นี้ให้อีกคน แล้วให้อีกคน login และกด Join Trip</div><button class="secondary-btn wide" onclick="openJoinPanel()">Join Trip</button><button class="primary-btn wide" onclick="signOut()">ออกจากระบบ</button>`);
  }
}

async function sendMagicLink(){
  const email=document.querySelector('#loginEmail')?.value.trim();
  const msg=document.querySelector('#authMessage');
  if(!email){ if(msg) msg.textContent='กรอกอีเมลก่อน'; return; }
  if(!sb){ if(msg) msg.textContent='ยังเชื่อมต่อ Cloud ไม่สำเร็จ'; return; }
  const redirectTo='https://chongqing-chengdu-trip.netlify.app/';
  if(msg) msg.textContent='กำลังส่ง Login Link…';
  try{
    const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo}});
    if(error) throw error;
    const modalBody=document.querySelector('#modalBody');
    if(modalBody) modalBody.innerHTML=`<div class="modal-title"><div class="eyebrow">CHECK EMAIL</div><h3>ส่ง Login Link แล้ว</h3></div><p>เปิดอีเมล <b>${esc(email)}</b> แล้วกดลิงก์เพื่อกลับเข้า Trip Planning</p><div class="note">ถ้าไม่เห็นอีเมล ให้เช็ก Spam / Promotions และรอประมาณ 1 นาที</div>`;
    if(msg) msg.textContent='ส่งแล้ว · เช็กอีเมลของคุณ';
  }catch(error){
    console.error('Magic Link error',error);
    const detail=error?.message||error?.name||'Unknown auth error';
    if(msg) msg.textContent=`ส่งไม่สำเร็จ: ${detail}`;
    else alert(`ส่ง Login Link ไม่สำเร็จ: ${detail}`);
  }
}

async function signOut(){await sb.auth.signOut();session=null;cloudTrip=null;cloudMembers=[];state=JSON.parse(localStorage.getItem(KEY)||'null')||structuredClone(seed);closeModal();render();}

async function ensureCloudTrip(){
  const {data:mine}=await sb.from('trips').select('*').order('created_at',{ascending:true}).limit(1);
  if(mine?.length){cloudTrip=mine[0];}
  else{
    const {data,error}=await sb.from('trips').insert({name:'Chongqing → Chengdu',start_date:'2026-12-17',end_date:'2026-12-25',currency:'THB',created_by:session.user.id}).select().single();
    if(error){console.error(error);return;}
    cloudTrip=data;
    await sb.from('trip_members').insert({trip_id:data.id,user_id:session.user.id,display_name:'A'});
    await seedCloudTrip();
  }
  await loadCloudTrip();
}

async function seedCloudTrip(){
  const days=seed.days.map(d=>({trip_id:cloudTrip.id,day_no:Number(d[0]),plan_date:`2026-12-${String(16+Number(d[0])).padStart(2,'0')}`,city:d[2],title:`Day ${d[0]} · ${d[1]}`,notes:d[3].join(' · '),sort_order:Number(d[0])}));
  await sb.from('daily_plans').insert(days);
  await sb.from('bookings').insert(seed.bookings.map(x=>({trip_id:cloudTrip.id,title:x.title,booking_date:x.date,status:x.status,provider:x.provider,reference:x.ref,booking_url:x.url,created_by:session.user.id})));
}

async function loadCloudTrip(){
  const [m,d,b,e]=await Promise.all([
    sb.from('trip_members').select('*').eq('trip_id',cloudTrip.id).order('created_at'),
    sb.from('daily_plans').select('*').eq('trip_id',cloudTrip.id).order('day_no').order('sort_order'),
    sb.from('bookings').select('*').eq('trip_id',cloudTrip.id).order('booking_date'),
    sb.from('expenses').select('*, expense_splits(*)').eq('trip_id',cloudTrip.id).order('expense_date')
  ]);
  cloudMembers=m.data||[];
  state.days=(d.data||[]).map(x=>[String(x.day_no),x.plan_date||'',x.city||'',(x.notes||'').split(' · ').filter(Boolean),x.id,x.title||('Day '+x.day_no)]);
  state.bookings=(b.data||[]).map(x=>({id:x.id,title:x.title,date:x.booking_date,status:x.status,provider:x.provider||'',ref:x.reference||'',url:x.booking_url||''}));
  const names=currentNames();
  state.expenses=(e.data||[]).map(x=>{
    const sa=x.expense_splits?.find(s=>s.user_id===names.A.id)?.share_amount||0;
    const sbx=x.expense_splits?.find(s=>s.user_id===names.B.id)?.share_amount||0;
    return {id:x.id,title:x.title,date:x.expense_date,amount:Number(x.amount),paidBy:x.paid_by===names.A.id?'A':'B',splitA:Number(sa),splitB:Number(sbx),settled:x.settled};
  });
  saveLocal(); render();
}

async function joinTrip(){
  const code=document.querySelector('#joinCode').value.trim(), name=document.querySelector('#joinName').value.trim()||'B';
  if(!code)return;
  const {data,error}=await sb.rpc('join_trip_by_code',{p_share_code:code,p_display_name:name});
  if(error){alert(error.message);return;}
  const {data:trip}=await sb.from('trips').select('*').eq('id',data).single();
  cloudTrip=trip; await loadCloudTrip(); closeModal(); render();
}

function openJoinPanel(){
  if(!session){openCloudPanel();return;}
  openModal(`<div class="modal-title"><div class="eyebrow">JOIN TRIP</div><h3>เข้าทริปของอีกคน</h3></div><label>ชื่อที่ใช้ในทริป<input id="joinName" placeholder="B"></label><label>Trip Code<input id="joinCode" placeholder="เช่น A8F4K2Q1"></label><button class="primary-btn wide" onclick="joinTrip()">Join Trip</button>`);
}

async function bootCloud(){
  if(!sb){render();return;}
  const {data,error}=await sb.auth.getSession();
  if(error) console.error('Auth session error',error);
  session=data?.session||null;
  render();
  sb.auth.onAuthStateChange(async (_event,s)=>{
    session=s||null;
    if(session){
      render();
      try{ await ensureCloudTrip(); }catch(err){ console.error('Cloud trip load error',err); render(); }
    }else{
      cloudTrip=null; cloudMembers=[];
      render();
    }
  });
  if(session){
    try{await ensureCloudTrip();}catch(err){console.error('Cloud trip load error',err);}
  }
  render();
}

window.openCloudPanel=openCloudPanel; window.openTripInfo=openTripInfo; window.openJoinPanel=openJoinPanel; window.openPlanEditor=openPlanEditor; window.addPlanDay=addPlanDay; window.savePlanDay=savePlanDay; window.saveNewPlanDay=saveNewPlanDay; window.go=go;
window.filterBooks=filterBooks;window.filterDays=filterDays;window.toggleBook=toggleBook;window.settleExp=settleExp;window.addBooking=addBooking;window.addExpense=addExpense;window.submitBooking=submitBooking;window.submitExpense=submitExpense;window.setEqualSplit=setEqualSplit;window.setCustomSplit=setCustomSplit;window.sendMagicLink=sendMagicLink;window.signOut=signOut;window.joinTrip=joinTrip;

render(); bootCloud();

function openModal(html){document.querySelector('#modalBody').innerHTML=html;document.querySelector('#modal').classList.remove('hidden');}
function closeModal(){document.querySelector('#modal').classList.add('hidden');}
window.closeModal=closeModal;
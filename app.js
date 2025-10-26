
(function(){
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const pad2 = n => (n<10? '0'+n : ''+n);
  const today = new Date();
  const LS_SHIFT_MAP = 'shiftMap-manual';
  const LS_SCHEDULE_PREFIX = 'manualSchedule-';

  const DEFAULT_SHIFT_MAP = {
    "早": { label:"早", color:"#4CAF50", start:"07:00", end:"15:00", off:false, note:"" },
    "午": { label:"午", color:"#03A9F4", start:"15:00", end:"23:00", off:false, note:"" },
    "夜": { label:"夜", color:"#9C27B0", start:"23:00", end:"07:00+1", off:false, note:"" },
    "休": { label:"休", color:"#90A4AE", off:true, note:"" }
  };

  const state = {
    year: today.getFullYear(),
    month: today.getMonth()+1,
    schedule: {},
    shiftMap: loadShiftMap(),
    copiedDay: null,
    autosave: true
  };

  function daysInMonth(y,m){ return new Date(y, m, 0).getDate(); }
  function yKey(){ return `${state.year}-${pad2(state.month)}`; }
  function scheduleKey(){ return LS_SCHEDULE_PREFIX + yKey(); }
  function loadShiftMap(){ try{ const raw = localStorage.getItem(LS_SHIFT_MAP); return raw? JSON.parse(raw) : {...DEFAULT_SHIFT_MAP}; }catch(e){ return {...DEFAULT_SHIFT_MAP}; } }
  function saveShiftMap(){ localStorage.setItem(LS_SHIFT_MAP, JSON.stringify(state.shiftMap)); }
  function loadSchedule(){ try{ const raw = localStorage.getItem(scheduleKey()); state.schedule = raw? JSON.parse(raw) : {}; }catch(e){ state.schedule = {}; } }
  function saveSchedule(){ localStorage.setItem(scheduleKey(), JSON.stringify(state.schedule)); }

  function setMonthInputToState(){
    $('#monthInput').value = `${state.year}-${pad2(state.month)}`;
    $('#calTitle').textContent = `${state.year}年${state.month}月`;
  }

  function renderShiftList(){
    const host = $('#shiftList'); host.innerHTML = '';
    const codes = Object.keys(state.shiftMap);
    if(codes.length===0){ host.innerHTML = '<div class="muted">尚無班別，請於下方輸入欄新增。</div>'; return; }
    for(const code of codes){
      const conf = state.shiftMap[code];
      const div = document.createElement('div'); div.className='shift-item';
      div.innerHTML = `
        <div class="shift-head">
          <div class="shift-tag">
            <span class="shift-circle" style="background:${conf.color||'#607D8B'}"></span>
            <strong>${code}</strong>${conf.label && conf.label!==code? `（${conf.label}）` : ''} ${conf.off? '<span class="shift-meta">休</span>':''}
          </div>
          <span class="shift-meta">${conf.off? '' : `${(conf.start||'--:--')}–${(conf.end||'--:--')}`}</span>
        </div>
        ${conf.note? `<div class="shift-meta">備註：${conf.note}</div>`:''}
        <div class="shift-actions">
          <button data-act="edit" data-code="${code}">編輯</button>
          <button class="ghost" data-act="del" data-code="${code}">刪除</button>
        </div>`;
      host.appendChild(div);
    }
    host.onclick = (ev)=>{
      const btn = ev.target.closest('button'); if(!btn) return; const act=btn.dataset.act, code=btn.dataset.code;
      if(act==='edit'){ fillShiftEditor(code, state.shiftMap[code]); }
      if(act==='del'){ if(confirm(`確定刪除班別「${code}」？`)){ delete state.shiftMap[code]; saveShiftMap(); renderShiftList(); renderDayEditorSelect(); renderCalendar(); } }
    };
  }

  function fillShiftEditor(code, conf){
    $('#sCode').value = code || '';
    $('#sLabel').value = conf?.label || '';
    $('#sColor').value = conf?.color || '#4CAF50';
    $('#sStart').value = (conf?.start || '07:00').replace('+1','');
    $('#sEnd').value = (conf?.end || '15:00').replace('+1','');
    $('#sOver').checked = (conf?.end||'').includes('+1');
    $('#sOff').checked = !!conf?.off;
    $('#sNote').value = conf?.note || '';
  }

  function addOrUpdateShift(){
    const code = $('#sCode').value.trim(); if(!code){ alert('請輸入班別代碼'); return; }
    const off = $('#sOff').checked;
    const conf = { label: $('#sLabel').value.trim() || code, color: $('#sColor').value || '#607D8B', off, note: $('#sNote').value.trim() };
    if(!off){ const s=$('#sStart').value||'00:00'; let e=$('#sEnd').value||'00:00'; if($('#sOver').checked) e=e+'+1'; conf.start=s; conf.end=e; } else { delete conf.start; delete conf.end; }
    state.shiftMap[code] = conf; saveShiftMap(); renderShiftList(); renderDayEditorSelect(); $('#sCode').value=''; $('#sLabel').value=''; $('#sNote').value='';
  }

  function renderCalendar(){
    $('#calTitle').textContent = `${state.year}年${state.month}月`;
    const grid = $('#calendar'); grid.innerHTML='';
    const first = new Date(state.year, state.month-1, 1); const startIdx = first.getDay(); const days = daysInMonth(state.year, state.month);
    const totalCells = Math.ceil((startIdx + days)/7)*7;
    for(let i=0;i<totalCells;i++){
      const cell = document.createElement('div'); cell.className='cell';
      const day = i - startIdx + 1;
      if(day>=1 && day<=days){
        const head = document.createElement('div'); head.className='day-num'; head.textContent = day; cell.appendChild(head);
        const codes = state.schedule[day] || [];
        if(codes.length){ const wrap=document.createElement('div'); wrap.className='badge-wrap'; for(const code of codes){ const conf=state.shiftMap[code]; const b=document.createElement('span'); b.className='badge'; b.style.background = conf? conf.color:'#607D8B'; b.textContent=code; wrap.appendChild(b);} cell.appendChild(wrap); }
        cell.addEventListener('click', ()=> openDayEditor(day));
      } else { cell.style.background='#0f1730'; }
      grid.appendChild(cell);
    }
  }

  const sheet = $('#dayEditor'); let currentDay = null;
  function renderDayEditorSelect(){ const sel=$('#addFromShift'); sel.innerHTML=''; const o=document.createElement('option'); o.value=''; o.textContent='選擇班別…'; sel.appendChild(o); for(const code of Object.keys(state.shiftMap)){ const op=document.createElement('option'); op.value=code; op.textContent=`${code} ${state.shiftMap[code].off? '(休)':''}`; sel.appendChild(op);} }
  function openDayEditor(day){ currentDay=day; $('#sheetDate').textContent = `${state.year}年${state.month}月${day}日（週${'日一二三四五六'[new Date(state.year,state.month-1,day).getDay()]}）`; renderDayList(); renderDayEditorSelect(); sheet.classList.remove('hidden'); }
  function closeDayEditor(){ sheet.classList.add('hidden'); currentDay=null; }
  function renderDayList(){ const ul=$('#dayShiftList'); ul.innerHTML=''; const codes=state.schedule[currentDay]||[]; if(!codes.length){ const li=document.createElement('li'); li.className='muted'; li.textContent='尚未加入班別'; ul.appendChild(li); return;} codes.forEach((code,idx)=>{ const conf=state.shiftMap[code]; const li=document.createElement('li'); li.className='chip'; li.style.background=conf? conf.color:'#607D8B'; li.innerHTML=`<span>${code}</span><button data-act="up" data-idx="${idx}">↑</button><button data-act="down" data-idx="${idx}">↓</button><button data-act="del" data-idx="${idx}">刪除</button>`; ul.appendChild(li); }); ul.onclick=(ev)=>{ const btn=ev.target.closest('button'); if(!btn) return; const act=btn.dataset.act, idx=+btn.dataset.idx; const arr=state.schedule[currentDay]||[]; if(act==='del'){arr.splice(idx,1);} if(act==='up'&&idx>0){[arr[idx-1],arr[idx]]=[arr[idx],arr[idx-1]];} if(act==='down'&&idx<arr.length-1){[arr[idx+1],arr[idx]]=[arr[idx],arr[idx+1]];} state.schedule[currentDay]=arr; if(state.autosave) saveSchedule(); renderDayList(); renderCalendar(); } } 
  function addSelectedShiftToDay(){ if(currentDay==null) return; const code=$('#addFromShift').value; if(!code) return; const arr=state.schedule[currentDay]||[]; arr.push(code); state.schedule[currentDay]=arr; if(state.autosave) saveSchedule(); renderDayList(); renderCalendar(); }
  function addFreeCodeToDay(){ if(currentDay==null) return; const code=$('#freeCode').value.trim(); if(!code) return; if(!state.shiftMap[code]){ state.shiftMap[code]={label:code,color:'#607D8B',start:'08:00',end:'17:00',off:false,note:''}; saveShiftMap(); renderShiftList(); renderDayEditorSelect(); } const arr=state.schedule[currentDay]||[]; arr.push(code); state.schedule[currentDay]=arr; $('#freeCode').value=''; if(state.autosave) saveSchedule(); renderDayList(); renderCalendar(); }

  $('#copyDayBtn').onclick = ()=>{ if(currentDay==null) return; state.copiedDay = (state.schedule[currentDay]||[]).slice(); };
  $('#pasteDayBtn').onclick = ()=>{ if(currentDay==null || !state.copiedDay) return; state.schedule[currentDay] = state.copiedDay.slice(); if(state.autosave) saveSchedule(); renderDayList(); renderCalendar(); };

  function applyToTargets(getTargets){ if(currentDay==null) return; const src=(state.schedule[currentDay]||[]).slice(); for(const d of getTargets()){ if(d<1 || d>daysInMonth(state.year,state.month)) continue; state.schedule[d]=src.slice(); } if(state.autosave) saveSchedule(); renderCalendar(); }
  sheet.addEventListener('click', (ev)=>{ const btn=ev.target.closest('button.ghost'); if(!btn) return; const type=btn.dataset.apply; if(type==='weekday'){ applyToTargets(()=> Array.from({length:daysInMonth(state.year,state.month)},(_,i)=>i+1).filter(d=>{const dw=new Date(state.year,state.month-1,d).getDay(); return dw>=1 && dw<=5;})); } else if(type==='weekend'){ applyToTargets(()=> Array.from({length:daysInMonth(state.year,state.month)},(_,i)=>i+1).filter(d=>{const dw=new Date(state.year,state.month-1,d).getDay(); return dw===0 || dw===6;})); } else if(type==='sameDow'){ const baseDow=new Date(state.year,state.month-1,currentDay).getDay(); applyToTargets(()=> Array.from({length:daysInMonth(state.year,state.month)},(_,i)=>i+1).filter(d=> new Date(state.year,state.month-1,d).getDay()===baseDow)); } });
  $('#applyRangeBtn').onclick = ()=>{ const s=+$('#rangeStart').value, e=+$('#rangeEnd').value; if(!s||!e||s>e){ alert('請輸入正確的日期範圍'); return; } applyToTargets(()=> Array.from({length:e-s+1},(_,k)=>s+k)); };

  function exportPNG(){ html2canvas($('#calendarWrapper'), {backgroundColor:'#121a2b', scale:2}).then(canvas=>{ const a=document.createElement('a'); a.download=`${state.year}-${pad2(state.month)}-班表.png`; a.href=canvas.toDataURL('image/png'); a.click(); }); }
  function makeUTC(dt){ const y=dt.getUTCFullYear(), m=pad2(dt.getUTCMonth()+1), d=pad2(dt.getUTCDate()); const H=pad2(dt.getUTCHours()), M=pad2(dt.getUTCMinutes()), S=pad2(dt.getUTCSeconds()); return `${y}${m}${d}T${H}${M}${S}Z`; }
  function exportICS(){ const tzOffset=8; const lines=['BEGIN:VCALENDAR','VERSION:2.0','CALSCALE:GREGORIAN','PRODID:-//ShiftApp Manual//EN','METHOD:PUBLISH']; const now=new Date(), dtstamp=makeUTC(now); const days=daysInMonth(state.year,state.month); for(let d=1; d<=days; d++){ const codes=state.schedule[d]||[]; for(let i=0;i<codes.length;i++){ const code=codes[i]; const conf=state.shiftMap[code]; if(!conf || conf.off) continue; const [sh,sm]=(conf.start||'00:00').split(':').map(n=>+n); const [eh,emRaw]=(conf.end||'00:00').split(':'); const em=+(emRaw||'0').replace('+1',''); const overnight=(conf.end||'').includes('+1'); const startLocal=new Date(state.year,state.month-1,d,sh,sm||0,0); const endLocal=new Date(state.year,state.month-1,d+(overnight?1:0), +eh||0, em||0, 0); const startUTC=new Date(startLocal.getTime()-tzOffset*3600*1000); const endUTC=new Date(endLocal.getTime()-tzOffset*3600*1000); const uid=`${state.year}${pad2(state.month)}${pad2(d)}-${code}-${i}-${Math.random().toString(36).slice(2)}@shiftapp`; lines.push('BEGIN:VEVENT'); lines.push(`UID:${uid}`); lines.push(`DTSTAMP:${dtstamp}`); lines.push(`DTSTART:${makeUTC(startUTC)}`); lines.push(`DTEND:${makeUTC(endUTC)}`); lines.push(`SUMMARY:${code}班`); lines.push(`DESCRIPTION:${state.year}年${state.month}月${d}日 ${code}班`); lines.push('END:VEVENT'); } } lines.push('END:VCALENDAR'); const blob=new Blob([lines.join('
')], {type:'text/calendar;charset=utf-8'}); const a=document.createElement('a'); a.download=`${state.year}-${pad2(state.month)}-班表.ics`; a.href=URL.createObjectURL(blob); a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 4000); }

  $('#addShiftBtn').onclick=addOrUpdateShift; $('#exportPNGBtn').onclick=exportPNG; $('#exportICSBtn').onclick=exportICS; $('#closeSheetBtn').onclick=()=>{sheet.classList.add('hidden');}; $('#addShiftToDayBtn').onclick=addSelectedShiftToDay; $('#addFreeCodeBtn').onclick=addFreeCodeToDay; $('#newMonthBtn').onclick=()=>{ if(confirm(`清空 ${state.year}年${state.month}月 的排班？`)){ state.schedule={}; saveSchedule(); renderCalendar(); } }; $('#saveBtn').onclick=()=>{ saveSchedule(); alert('已儲存'); };
  $('#monthInput').onchange=()=>{ const v=$('#monthInput').value; if(v){ const [y,m]=v.split('-').map(x=>+x); state.year=y; state.month=m; loadSchedule(); renderCalendar(); setMonthInputToState(); } };

  setMonthInputToState(); loadSchedule(); renderShiftList(); renderCalendar(); renderDayEditorSelect();
})();

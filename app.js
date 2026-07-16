(() => {
  const $ = id => document.getElementById(id);
  const views = ['homeView','testView','resultView'];
  const meta = {
    disc:{symbol:'D',accent:'#f05a47',count:30,time:'5–7 นาที'},
    mbti:{symbol:'M',accent:'#1768e8',count:32,time:'5–8 นาที'},
    enneagram:{symbol:'9',accent:'#8e5bb7',count:81,time:'10–15 นาที'}
  };
  const DB_KEY = 'personality-lab:profiles:v1';
  let db = loadDb();
  let activeId = null;
  let test = null;
  let flat = [];
  let answers = {};
  let current = 0;
  let lastResultText = '';
  let pendingTestId = null;

  function loadDb(){
    try {
      const parsed = JSON.parse(localStorage.getItem(DB_KEY) || '{}');
      return {currentId:parsed.currentId || null, profiles:parsed.profiles || {}};
    } catch { return {currentId:null,profiles:{}}; }
  }
  function saveDb(){ localStorage.setItem(DB_KEY,JSON.stringify(db)); }
  function currentProfile(){ return db.currentId && db.profiles[db.currentId] ? db.profiles[db.currentId] : null; }
  function createProfile(name){
    const id = `p_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    db.profiles[id] = {id,name,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),results:{}};
    db.currentId=id; saveDb(); return db.profiles[id];
  }
  function selectProfile(id){
    if(!db.profiles[id]) return null;
    db.currentId=id; db.profiles[id].updatedAt=new Date().toISOString(); saveDb(); return db.profiles[id];
  }
  function answerKey(id){ const p=currentProfile(); return p ? `personality-lab:answers:${p.id}:${id}` : ''; }
  function mbtiSchemaKey(){ const p=currentProfile(); return p ? `personality-lab:mbti-schema:${p.id}` : ''; }
  function migrateMbtiAnswers(parsed){
    const schemaKey=mbtiSchemaKey();
    if(!schemaKey || localStorage.getItem(schemaKey)==='32-v2' || Object.keys(parsed).length===0) return parsed;
    const migrated={};
    Object.entries(parsed).forEach(([index,value])=>{const n=Number(index);migrated[n>=24?n+1:n]=value;});
    localStorage.setItem(answerKey('mbti'),JSON.stringify(migrated));
    localStorage.setItem(schemaKey,'32-v2');
    const p=currentProfile();
    if(p?.results?.mbti){delete p.results.mbti;p.updatedAt=new Date().toISOString();saveDb();}
    return migrated;
  }
  function loadAnswers(id){
    const key=answerKey(id); if(!key) return {};
    try { const parsed=JSON.parse(localStorage.getItem(key) || '{}'); return id==='mbti'?migrateMbtiAnswers(parsed):parsed; }
    catch { return {}; }
  }
  function saveAnswers(){
    const key=answerKey(activeId); if(key)localStorage.setItem(key,JSON.stringify(answers));
    if(activeId==='mbti'&&mbtiSchemaKey())localStorage.setItem(mbtiSchemaKey(),'32-v2');
  }
  function clearTestData(id){
    const p=currentProfile(); if(!p) return;
    localStorage.removeItem(answerKey(id));
    if(id==='mbti'&&mbtiSchemaKey())localStorage.removeItem(mbtiSchemaKey());
    delete p.results[id]; p.updatedAt=new Date().toISOString(); saveDb();
  }
  function saveResult(id,payload){
    const p=currentProfile(); if(!p) return;
    p.results[id]={...payload,completedAt:new Date().toISOString()};
    p.updatedAt=new Date().toISOString(); saveDb();
  }

  function showView(id){
    views.forEach(v => $(v).classList.toggle('active', v === id));
    $('homeBtn').hidden = id === 'homeView';
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function setAccent(id){ $('appRoot').style.setProperty('--accent',meta[id]?.accent || '#1768e8'); }
  function totalFor(id){ return id === 'enneagram' ? 81 : TEST_DATA[id].questions.length; }
  function answeredFor(id){ const a=loadAnswers(id); return Object.keys(a).filter(k=>a[k]!==undefined).length; }
  function formatDate(iso){
    if(!iso) return '';
    try { return new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso)); }
    catch { return new Date(iso).toLocaleString('th-TH'); }
  }
  function initials(name){ return [...name.trim()].slice(0,1).join('').toUpperCase() || '?'; }

  function renderProfile(){
    const p=currentProfile();
    $('profileName').textContent=p ? p.name : 'ยังไม่ได้ระบุชื่อ';
    $('profileAvatar').textContent=p ? initials(p.name) : '?';
    $('changeNameBtn').textContent=p ? 'เปลี่ยนผู้ทำแบบประเมิน' : 'กรอกชื่อก่อนเริ่ม';
    renderSavedResults();
  }
  function renderSavedResults(){
    const p=currentProfile();
    $('summaryPanel').hidden=!p;
    if(!p) return;
    const ids=['disc','mbti','enneagram'];
    const labels={disc:'DISC Profile',mbti:'MBTI',enneagram:'Enneagram'};
    const results=p.results || {};
    const done=ids.filter(id=>results[id]).length;
    $('summaryTitle').textContent=`ผลของ ${p.name}`;
    $('summarySubtitle').textContent=done===3 ? 'บันทึกผลครบทั้ง 3 แบบแล้ว' : `ทำเสร็จแล้ว ${done} จาก 3 แบบ`;
    $('completeBadge').textContent=done===3 ? '✓ ครบ 3 แบบ' : `${done}/3 แบบ`;
    $('savedResults').innerHTML=ids.map(id=>{
      const r=results[id];
      if(!r) return `<div class="saved-result pending"><small>${labels[id]}</small><strong>ยังไม่มีผล</strong><span>เลือกแบบประเมินด้านล่างเพื่อเริ่มทำ</span></div>`;
      return `<div class="saved-result"><small>${labels[id]}</small><strong>${r.code}</strong><span>${r.short || ''}<br>${formatDate(r.completedAt)}</span></div>`;
    }).join('');
    $('copyAllBtn').disabled=done===0;
    $('copyAllBtn').textContent=done===3 ? 'คัดลอกผลทั้ง 3 แบบ' : 'คัดลอกผลที่มี';
    $('downloadBtn').disabled=done===0;
  }
  function renderHome(){
    const answerCounts=Object.fromEntries(['disc','mbti','enneagram'].map(id=>[id,answeredFor(id)]));
    renderProfile();
    const p=currentProfile();
    const cards=[
      ['disc','DISC Profile','พฤติกรรมการทำงานและการสื่อสาร','D · I · S · C'],
      ['mbti','MBTI','แนวโน้มการรับรู้และตัดสินใจ','E/I · S/N · T/F · J/P'],
      ['enneagram','Enneagram','แรงขับ ความกลัว และรูปแบบภายใน','บุคลิกภาพ 9 Type']
    ];
    $('testCards').innerHTML=cards.map(([id,title,desc,tag])=>{
      const answered=answerCounts[id],total=totalFor(id),done=Boolean(p?.results?.[id]);
      const pct=done?100:Math.round(answered/total*100);
      const cta=done?'ดูผลลัพธ์':answered?'ทำแบบประเมินต่อ':'เริ่มทำแบบประเมิน';
      return `<button class="test-card" data-test="${id}" style="--card-color:${meta[id].accent}"><span class="card-icon">${meta[id].symbol}</span><h3>${title}</h3><p>${desc}</p><div class="card-meta"><span>${tag}</span><span>${total} ข้อ · ${meta[id].time}</span></div><div class="card-progress"><span style="width:${pct}%"></span></div>${answered||done?`<div class="card-meta"><span>${done?'บันทึกผลแล้ว':`ทำแล้ว ${answered}/${total}`}</span><span>${pct}%</span></div>`:''}<div class="card-cta"><span>${cta}</span><b>→</b></div></button>`;
    }).join('');
    document.querySelectorAll('[data-test]').forEach(btn=>btn.addEventListener('click',()=>startTest(btn.dataset.test)));
  }

  function buildFlat(id){
    if(id==='enneagram') return TEST_DATA.enneagram.types.flatMap(type=>type.items.map((text,itemIndex)=>({typeNo:type.no,type,itemIndex,text})));
    return TEST_DATA[id].questions.map(q=>({...q}));
  }
  function startTest(id){
    if(!currentProfile()){ openNameDialog(id); return; }
    activeId=id; test=TEST_DATA[id]; flat=buildFlat(id); answers=loadAnswers(id);
    setAccent(id); $('testSymbol').textContent=meta[id].symbol; $('testTitle').textContent=test.title; $('testInstruction').textContent=test.instruction;
    history.replaceState(null,'',`${location.pathname}?test=${id}`);
    const firstUnanswered=flat.findIndex((_,i)=>answers[i]===undefined);
    if(firstUnanswered<0 && currentProfile().results?.[id]){ current=flat.length-1; renderResult(); return; }
    current=firstUnanswered>=0?firstUnanswered:Math.max(0,flat.length-1);
    renderQuestion(); showView('testView');
  }

  function answeredCount(){ return Object.keys(answers).filter(k=>answers[k]!==undefined).length; }
  function optionHTML(key,text,selected){
    return `<button class="option ${selected?'selected':''}" data-value="${key}" aria-pressed="${selected}"><span class="option-key">${key}</span><span>${text}</span><span class="radio" aria-hidden="true"></span></button>`;
  }
  function renderQuestion(){
    const item=flat[current]; let title='',overline='',options='';
    if(activeId==='enneagram'){
      title=item.text; overline=`Type ${item.typeNo} · ${item.type.th} · ข้อ ${item.itemIndex+1} จาก 9`;
      options=test.scale.map(s=>optionHTML(s.value,s.label,Number(answers[current])===s.value)).join(''); $('pagePill').textContent=item.type.en;
    } else if(activeId==='disc'){
      title='ข้อความใดเป็นตัวคุณมากที่สุด?'; overline=`คำถามข้อ ${item.no}`;
      options=item.options.map((o,i)=>optionHTML(String.fromCharCode(65+i),o[0],Number(answers[current])===i)).join(''); $('pagePill').textContent=item.no<=20?'หน้า 1 จาก 2':'หน้า 2 จาก 2';
    } else {
      title=item.q; overline=`คำถามข้อ ${item.no}`;
      options=['a','b'].map(k=>optionHTML(k.toUpperCase(),item[k],answers[current]===k)).join(''); $('pagePill').textContent=item.no<=18?'หน้า 1 จาก 2':'หน้า 2 จาก 2';
    }
    $('questionTitle').textContent=title; $('questionOverline').textContent=overline; $('options').innerHTML=options;
    document.querySelectorAll('.option').forEach(btn=>btn.addEventListener('click',()=>selectAnswer(btn.dataset.value)));
    $('prevBtn').disabled=current===0; $('prevBtn').style.visibility=current===0?'hidden':'visible';
    $('nextBtn').disabled=answers[current]===undefined; $('nextBtn').textContent=current===flat.length-1?'ดูผลลัพธ์ →':'ถัดไป →';
    const count=answeredCount(),pct=Math.round(count/flat.length*100);
    $('progressText').textContent=`ตอบแล้ว ${count} จาก ${flat.length} ข้อ`; $('progressPercent').textContent=`${pct}%`; $('progressFill').style.width=`${pct}%`;
    document.querySelector('.progress-track').setAttribute('aria-valuemax',flat.length); document.querySelector('.progress-track').setAttribute('aria-valuenow',count);
  }
  function selectAnswer(raw){
    if(activeId==='enneagram') answers[current]=Number(raw); else if(activeId==='disc') answers[current]=raw.charCodeAt(0)-65; else answers[current]=raw.toLowerCase();
    saveAnswers(); renderQuestion(); setTimeout(()=>{if(answeredCount()===flat.length)renderResult();else if(current<flat.length-1)next();},210);
  }
  function next(){
    if(answers[current]===undefined) return;
    if(current<flat.length-1){current++;renderQuestion();}
    else if(answeredCount()===flat.length)renderResult();
    else{current=flat.findIndex((_,i)=>answers[i]===undefined);renderQuestion();}
  }

  function scoreCard(label,sub,value,max,color,foot=''){
    const pct=Math.max(0,Math.min(100,Math.round(value/max*100)));
    return `<div class="score-card"><div class="score-top"><span>${label}</span><small>${sub}</small></div><div class="score-track"><div class="score-fill" style="width:${pct}%;--score-color:${color}"></div></div><div class="score-foot"><span>${value} คะแนน</span><span>${foot||pct+'%'}</span></div></div>`;
  }
  function renderDisc(){
    const p=currentProfile(),scores={D:0,I:0,S:0,C:0};
    test.questions.forEach((q,i)=>{const selected=q.options[answers[i]];if(selected)scores[selected[1]]++;});
    const sorted=Object.keys(scores).sort((a,b)=>scores[b]-scores[a]),primary=sorted[0],secondary=sorted[1],d=test.dimensions,code=`${primary} / ${secondary}`;
    $('resultHeading').textContent=`ผล DISC ของ ${p.name}`; $('resultCode').textContent=code;
    $('resultSub').textContent=`เด่นด้าน ${d[primary].th} (${d[primary].name}) รองลงมาคือ ${d[secondary].th} (${d[secondary].name}) — ${d[primary].desc}`;
    $('resultGrid').innerHTML=['D','I','S','C'].map(k=>scoreCard(`${k} — ${d[k].name}`,d[k].th,scores[k],30,d[k].color,`${Math.round(scores[k]/30*100)}%`)).join('');
    $('resultNote').innerHTML='<strong>การอ่านผล:</strong> คะแนนสูงสะท้อนรูปแบบพฤติกรรมที่คุณมักเลือกใช้ ไม่ได้หมายความว่ารูปแบบอื่นไม่มีอยู่ในตัวคุณ ผลอาจเปลี่ยนตามบทบาทและบริบทการทำงาน';
    lastResultText=`ชื่อ: ${p.name}\nผล DISC: ${code}\nD ${scores.D} · I ${scores.I} · S ${scores.S} · C ${scores.C}`;
    saveResult('disc',{code,short:`D ${scores.D} · I ${scores.I} · S ${scores.S} · C ${scores.C}`,scores,text:lastResultText});
  }
  function renderMbti(){
    const p=currentProfile(),scores={E:0,I:0,S:0,N:0,T:0,F:0,J:0,P:0};
    test.questions.forEach((q,i)=>{if(answers[i])scores[q.map[answers[i]]]++;});
    const pairs=[['E','I',11],['S','N',16],['T','F',24],['J','P',23]],adjusted={...scores},tieNotes=[];
    pairs.forEach(([l,r,tieNo])=>{if(adjusted[l]!==adjusted[r])return;const idx=test.questions.findIndex(q=>q.no===tieNo);const selected=idx>=0&&answers[idx]?test.questions[idx].map[answers[idx]]:null;if(selected){adjusted[selected]--;tieNotes.push(`ไม่นับข้อ ${tieNo} เมื่อ ${l}/${r} เสมอกัน`);}});
    const type=pairs.map(([l,r])=>adjusted[l]>adjusted[r]?l:r).join(''),names=test.dimensions;
    $('resultHeading').textContent=`ผล MBTI ของ ${p.name}`; $('resultCode').textContent=type; $('resultSub').textContent=`คุณมีแนวโน้มไปทาง ${type.split('').map(k=>names[k].th).join(' · ')}`;
    $('resultGrid').innerHTML=pairs.map(([l,r])=>{const total=adjusted[l]+adjusted[r]||1,lp=Math.round(adjusted[l]/total*100),rp=100-lp;return `<div class="score-card"><div class="score-top"><span>${l} — ${names[l].th}</span><small>${names[r].th} — ${r}</small></div><div class="score-track" style="display:flex"><div class="score-fill" style="width:${lp}%;--score-color:#071f4c"></div><div class="score-fill" style="width:${rp}%;--score-color:#67b9ff"></div></div><div class="score-foot"><span>${adjusted[l]} คะแนน · ${lp}%</span><span>${rp}% · ${adjusted[r]} คะแนน</span></div></div>`;}).join('');
    $('resultNote').innerHTML=`<strong>หมายเหตุ:</strong> คำนวณครบทั้ง 32 ข้อตามตารางให้คะแนนจากต้นฉบับ${tieNotes.length?` (${tieNotes.join(' และ ')})`:''}`;
    const pairText=pairs.map(([l,r])=>`${l} ${adjusted[l]} / ${r} ${adjusted[r]}`).join(' · ');
    lastResultText=`ชื่อ: ${p.name}\nผล MBTI: ${type}\n${pairText}`;
    saveResult('mbti',{code:type,short:pairText,scores:adjusted,text:lastResultText});
  }
  function renderEnneagram(){
    const p=currentProfile(),scores={}; test.types.forEach(t=>scores[t.no]=0); flat.forEach((q,i)=>{scores[q.typeNo]+=Number(answers[i]||0);});
    const sorted=test.types.slice().sort((a,b)=>scores[b.no]-scores[a.no]),first=sorted[0],second=sorted[1],code=`Type ${first.no}`;
    $('resultHeading').textContent=`ผล Enneagram ของ ${p.name}`; $('resultCode').textContent=code;
    $('resultSub').textContent=`อันดับหนึ่งคือ ${first.th} (${first.en}) — ${first.desc} รองลงมาคือ Type ${second.no} ${second.th}`;
    $('resultGrid').innerHTML=sorted.map(t=>scoreCard(`Type ${t.no} — ${t.th}`,t.en,scores[t.no],45,t.color,`${Math.round(scores[t.no]/45*100)}%`)).join('');
    $('resultNote').innerHTML='<strong>การอ่านผล:</strong> คะแนนสูงสุด 1–2 อันดับแรกสะท้อนรูปแบบหลักที่ควรสำรวจต่อ Enneagram เน้นแรงขับภายในมากกว่าพฤติกรรมภายนอก จึงควรอ่านคำอธิบายและพิจารณาด้วยตนเองร่วมด้วย';
    lastResultText=`ชื่อ: ${p.name}\nผล Enneagram: ${code} ${first.th}\nรองลงมา Type ${second.no} ${second.th}\n${sorted.map(t=>`Type ${t.no}: ${scores[t.no]}`).join(' · ')}`;
    saveResult('enneagram',{code,short:`${first.th} · รอง Type ${second.no} ${second.th}`,scores,text:lastResultText});
  }
  function renderResult(){
    if(activeId==='disc')renderDisc(); else if(activeId==='mbti')renderMbti(); else renderEnneagram();
    showView('resultView');
  }

  function openNameDialog(testId=null){
    pendingTestId=testId;
    const profiles=Object.values(db.profiles).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    $('existingWrap').hidden=profiles.length===0;
    $('existingProfile').innerHTML='<option value="">— เลือกชื่อเดิม —</option>'+profiles.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
    $('nameInput').value=''; $('nameDialog').showModal(); setTimeout(()=>$('nameInput').focus(),80);
  }
  function closeNameDialog(){ pendingTestId=null; $('nameDialog').close(); }
  function composeAllResults(){
    const p=currentProfile(); if(!p)return '';
    const labels={disc:'DISC',mbti:'MBTI',enneagram:'Enneagram'};
    const sections=['disc','mbti','enneagram'].filter(id=>p.results?.[id]).map(id=>`${labels[id]}\n${p.results[id].text.replace(/^ชื่อ:.*\n/,'')}\nบันทึกเมื่อ: ${formatDate(p.results[id].completedAt)}`);
    return `PERSONALITY LAB\nชื่อ: ${p.name}\n\n${sections.join('\n\n')}`;
  }
  async function copyText(text,message='คัดลอกผลลัพธ์แล้ว'){
    try{await navigator.clipboard.writeText(text);}catch{const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();}
    $('toast').textContent=message; $('toast').classList.add('show'); setTimeout(()=>$('toast').classList.remove('show'),1700);
  }
  function downloadResults(){
    const p=currentProfile(),text=composeAllResults(); if(!p||!text)return;
    const blob=new Blob([text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    const safe=p.name.replace(/[^\p{L}\p{N}_-]+/gu,'-').replace(/^-|-$/g,'')||'result';
    a.href=url;a.download=`personality-${safe}-${new Date().toISOString().slice(0,10)}.txt`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function goHome(){ history.replaceState(null,'',location.pathname);renderHome();showView('homeView'); }
  function restart(){
    if(!confirm(`ต้องการล้างคำตอบและผล ${test.title} ของ ${currentProfile().name} แล้วเริ่มใหม่ใช่หรือไม่?`))return;
    clearTestData(activeId);answers={};current=0;renderQuestion();showView('testView');
  }

  $('prevBtn').addEventListener('click',()=>{if(current>0){current--;renderQuestion();}});
  $('nextBtn').addEventListener('click',next);
  $('homeBtn').addEventListener('click',goHome); $('otherBtn').addEventListener('click',goHome); $('restartBtn').addEventListener('click',restart);
  $('copyBtn').addEventListener('click',()=>copyText(lastResultText));
  $('changeNameBtn').addEventListener('click',()=>openNameDialog());
  $('cancelNameBtn').addEventListener('click',closeNameDialog);
  $('copyAllBtn').addEventListener('click',()=>copyText(composeAllResults(),'คัดลอกผลที่บันทึกแล้ว'));
  $('downloadBtn').addEventListener('click',downloadResults);
  $('existingProfile').addEventListener('change',e=>{if(e.target.value)$('nameInput').value='';});
  $('nameForm').addEventListener('submit',e=>{
    e.preventDefault();
    const existing=$('existingProfile').value,name=$('nameInput').value.trim();
    if(existing)selectProfile(existing);
    else{
      if(!name){$('nameInput').setCustomValidity('กรุณากรอกชื่อ');$('nameInput').reportValidity();return;}
      $('nameInput').setCustomValidity('');
      const same=Object.values(db.profiles).find(p=>p.name.localeCompare(name,'th',{sensitivity:'base'})===0);
      same?selectProfile(same.id):createProfile(name);
    }
    const nextId=pendingTestId; pendingTestId=null; $('nameDialog').close(); renderHome();
    if(nextId)startTest(nextId);
  });
  document.addEventListener('keydown',e=>{
    if(!$('testView').classList.contains('active'))return;
    if(e.key==='ArrowLeft'&&current>0){current--;renderQuestion();}
    if(e.key==='Enter'&&answers[current]!==undefined)next();
  });

  renderHome();
  const requested=new URLSearchParams(location.search).get('test');
  if(requested&&TEST_DATA[requested])startTest(requested);
})();

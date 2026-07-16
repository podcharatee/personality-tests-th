(() => {
  const $ = id => document.getElementById(id);
  const views = ['homeView','testView','resultView'];
  const meta = {
    disc:{symbol:'D',accent:'#f05a47',count:30,time:'5–7 นาที'},
    mbti:{symbol:'M',accent:'#1768e8',count:31,time:'5–8 นาที'},
    enneagram:{symbol:'9',accent:'#8e5bb7',count:81,time:'10–15 นาที'}
  };
  let activeId = null;
  let test = null;
  let flat = [];
  let answers = {};
  let current = 0;
  let lastResultText = '';

  function storageKey(id){ return `personality-lab:${id}:answers`; }
  function loadAnswers(id){
    try { return JSON.parse(localStorage.getItem(storageKey(id)) || '{}'); }
    catch { return {}; }
  }
  function saveAnswers(){ localStorage.setItem(storageKey(activeId), JSON.stringify(answers)); }
  function showView(id){
    views.forEach(v => $(v).classList.toggle('active', v === id));
    $('homeBtn').hidden = id === 'homeView';
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function setAccent(id){
    const accent = meta[id]?.accent || '#1768e8';
    $('appRoot').style.setProperty('--accent',accent);
  }

  function totalFor(id){ return id === 'enneagram' ? 81 : TEST_DATA[id].questions.length; }
  function answeredFor(id){ return Object.keys(loadAnswers(id)).filter(k => loadAnswers(id)[k] !== undefined).length; }

  function renderHome(){
    const cards = [
      ['disc','DISC Profile','พฤติกรรมการทำงานและการสื่อสาร','D · I · S · C'],
      ['mbti','MBTI','แนวโน้มการรับรู้และตัดสินใจ','E/I · S/N · T/F · J/P'],
      ['enneagram','Enneagram','แรงขับ ความกลัว และรูปแบบภายใน','บุคลิกภาพ 9 Type']
    ];
    $('testCards').innerHTML = cards.map(([id,title,desc,tag]) => {
      const answered = answeredFor(id), total = totalFor(id), pct = Math.round(answered/total*100);
      return `<button class="test-card" data-test="${id}" style="--card-color:${meta[id].accent}"><span class="card-icon">${meta[id].symbol}</span><h3>${title}</h3><p>${desc}</p><div class="card-meta"><span>${tag}</span><span>${total} ข้อ · ${meta[id].time}</span></div><div class="card-progress"><span style="width:${pct}%"></span></div>${answered ? `<div class="card-meta"><span>ทำแล้ว ${answered}/${total}</span><span>${pct}%</span></div>` : ''}<div class="card-cta"><span>${answered ? 'ทำแบบประเมินต่อ':'เริ่มทำแบบประเมิน'}</span><b>→</b></div></button>`;
    }).join('');
    document.querySelectorAll('[data-test]').forEach(btn => btn.addEventListener('click',()=>startTest(btn.dataset.test)));
  }

  function buildFlat(id){
    if(id === 'enneagram'){
      return TEST_DATA.enneagram.types.flatMap(type => type.items.map((text,itemIndex)=>({typeNo:type.no,type,itemIndex,text})));
    }
    return TEST_DATA[id].questions.map(q => ({...q}));
  }

  function startTest(id){
    activeId = id;
    test = TEST_DATA[id];
    flat = buildFlat(id);
    answers = loadAnswers(id);
    const firstUnanswered = flat.findIndex((_,i) => answers[i] === undefined);
    current = firstUnanswered >= 0 ? firstUnanswered : Math.max(0,flat.length-1);
    setAccent(id);
    $('testSymbol').textContent = meta[id].symbol;
    $('testTitle').textContent = test.title;
    $('testInstruction').textContent = test.instruction;
    history.replaceState(null,'',`${location.pathname}?test=${id}`);
    renderQuestion();
    showView('testView');
  }

  function answeredCount(){ return Object.keys(answers).filter(k => answers[k] !== undefined).length; }
  function optionHTML(key,text,selected){
    return `<button class="option ${selected ? 'selected':''}" data-value="${key}" aria-pressed="${selected}"><span class="option-key">${key}</span><span>${text}</span><span class="radio" aria-hidden="true"></span></button>`;
  }

  function renderQuestion(){
    const item = flat[current];
    let title = '', overline = '', options = '';
    if(activeId === 'enneagram'){
      title = item.text;
      overline = `Type ${item.typeNo} · ${item.type.th} · ข้อ ${item.itemIndex+1} จาก 9`;
      options = test.scale.map(s => optionHTML(s.value, s.label, Number(answers[current]) === s.value)).join('');
      $('pagePill').textContent = `${item.type.en}`;
    } else if(activeId === 'disc'){
      title = 'ข้อความใดเป็นตัวคุณมากที่สุด?';
      overline = `คำถามข้อ ${item.no}`;
      options = item.options.map((o,i)=>optionHTML(String.fromCharCode(65+i),o[0],Number(answers[current])===i)).join('');
      $('pagePill').textContent = item.no <= 20 ? 'หน้า 1 จาก 2' : 'หน้า 2 จาก 2';
    } else {
      title = item.q;
      overline = `คำถามข้อ ${item.no}`;
      options = ['a','b'].map(k=>optionHTML(k.toUpperCase(),item[k],answers[current]===k)).join('');
      $('pagePill').textContent = item.no <= 18 ? 'หน้า 1 จาก 2' : 'หน้า 2 จาก 2';
    }
    $('questionTitle').textContent = title;
    $('questionOverline').textContent = overline;
    $('options').innerHTML = options;
    document.querySelectorAll('.option').forEach(btn=>btn.addEventListener('click',()=>selectAnswer(btn.dataset.value)));
    $('prevBtn').disabled = current === 0;
    $('prevBtn').style.visibility = current === 0 ? 'hidden':'visible';
    $('nextBtn').disabled = answers[current] === undefined;
    $('nextBtn').textContent = current === flat.length-1 ? 'ดูผลลัพธ์ →':'ถัดไป →';
    const count = answeredCount(), pct = Math.round(count/flat.length*100);
    $('progressText').textContent = `ตอบแล้ว ${count} จาก ${flat.length} ข้อ`;
    $('progressPercent').textContent = `${pct}%`;
    $('progressFill').style.width = `${pct}%`;
    document.querySelector('.progress-track').setAttribute('aria-valuemax',flat.length);
    document.querySelector('.progress-track').setAttribute('aria-valuenow',count);
  }

  function selectAnswer(raw){
    if(activeId === 'enneagram') answers[current] = Number(raw);
    else if(activeId === 'disc') answers[current] = raw.charCodeAt(0)-65;
    else answers[current] = raw.toLowerCase();
    saveAnswers();
    renderQuestion();
    setTimeout(()=>{ if(current < flat.length-1) next(); },210);
  }
  function next(){
    if(answers[current] === undefined) return;
    if(current < flat.length-1){ current++; renderQuestion(); }
    else if(answeredCount() === flat.length) renderResult();
    else { current = flat.findIndex((_,i)=>answers[i]===undefined); renderQuestion(); }
  }

  function scoreCard(label,sub,value,max,color,foot=''){
    const pct = Math.max(0,Math.min(100,Math.round(value/max*100)));
    return `<div class="score-card"><div class="score-top"><span>${label}</span><small>${sub}</small></div><div class="score-track"><div class="score-fill" style="width:${pct}%;--score-color:${color}"></div></div><div class="score-foot"><span>${value} คะแนน</span><span>${foot || pct+'%'}</span></div></div>`;
  }

  function renderDisc(){
    const scores={D:0,I:0,S:0,C:0};
    test.questions.forEach((q,i)=>{ const selected=q.options[answers[i]]; if(selected) scores[selected[1]]++; });
    const sorted=Object.keys(scores).sort((a,b)=>scores[b]-scores[a]);
    const primary=sorted[0], secondary=sorted[1];
    const d=test.dimensions;
    $('resultHeading').textContent='รูปแบบ DISC ของคุณ';
    $('resultCode').textContent=`${primary} / ${secondary}`;
    $('resultSub').textContent=`เด่นด้าน ${d[primary].th} (${d[primary].name}) รองลงมาคือ ${d[secondary].th} (${d[secondary].name}) — ${d[primary].desc}`;
    $('resultGrid').innerHTML=['D','I','S','C'].map(k=>scoreCard(`${k} — ${d[k].name}`,d[k].th,scores[k],30,d[k].color,`${Math.round(scores[k]/30*100)}%`)).join('');
    $('resultNote').innerHTML='<strong>การอ่านผล:</strong> คะแนนสูงสะท้อนรูปแบบพฤติกรรมที่คุณมักเลือกใช้ ไม่ได้หมายความว่ารูปแบบอื่นไม่มีอยู่ในตัวคุณ ผลอาจเปลี่ยนตามบทบาทและบริบทการทำงาน';
    lastResultText=`ผล DISC: ${primary}/${secondary}\nD ${scores.D} · I ${scores.I} · S ${scores.S} · C ${scores.C}`;
  }

  function renderMbti(){
    const scores={E:0,I:0,S:0,N:0,T:0,F:0,J:0,P:0};
    test.questions.forEach((q,i)=>{ if(answers[i]) scores[q.map[answers[i]]]++; });
    const pairs=[['E','I',11],['S','N',16],['T','F',24],['J','P',23]];
    const adjusted={...scores}, tieNotes=[];
    pairs.forEach(([l,r,tieNo])=>{
      if(adjusted[l]!==adjusted[r]) return;
      const idx=test.questions.findIndex(q=>q.no===tieNo);
      const selected=idx>=0&&answers[idx] ? test.questions[idx].map[answers[idx]] : null;
      if(selected){ adjusted[selected]--; tieNotes.push(`ไม่นับข้อ ${tieNo} เมื่อ ${l}/${r} เสมอกัน`); }
    });
    const type=pairs.map(([l,r])=>adjusted[l]>adjusted[r]?l:r).join('');
    const names=test.dimensions;
    $('resultHeading').textContent='แนวโน้ม MBTI ของคุณ';
    $('resultCode').textContent=type;
    $('resultSub').textContent=`คุณมีแนวโน้มไปทาง ${type.split('').map(k=>names[k].th).join(' · ')}`;
    $('resultGrid').innerHTML=pairs.map(([l,r])=>{
      const total=adjusted[l]+adjusted[r]||1, lp=Math.round(adjusted[l]/total*100), rp=100-lp;
      return `<div class="score-card"><div class="score-top"><span>${l} — ${names[l].th}</span><small>${names[r].th} — ${r}</small></div><div class="score-track" style="display:flex"><div class="score-fill" style="width:${lp}%;--score-color:#071f4c"></div><div class="score-fill" style="width:${rp}%;--score-color:#67b9ff"></div></div><div class="score-foot"><span>${adjusted[l]} คะแนน · ${lp}%</span><span>${rp}% · ${adjusted[r]} คะแนน</span></div></div>`;
    }).join('');
    $('resultNote').innerHTML=`<strong>หมายเหตุ:</strong> คำนวณตามตารางให้คะแนนจากต้นฉบับ${tieNotes.length?` (${tieNotes.join(' และ ')})`:''} เอกสารที่ได้รับไม่แสดงคำถามข้อ 25 แม้ตารางคะแนนจะอ้างถึง จึงไม่นับข้อนี้`;
    lastResultText=`ผล MBTI: ${type}\n${pairs.map(([l,r])=>`${l} ${adjusted[l]} / ${r} ${adjusted[r]}`).join(' · ')}`;
  }

  function renderEnneagram(){
    const scores={};
    test.types.forEach(t=>scores[t.no]=0);
    flat.forEach((q,i)=>{ scores[q.typeNo]+=Number(answers[i]||0); });
    const sorted=test.types.slice().sort((a,b)=>scores[b.no]-scores[a.no]);
    const first=sorted[0], second=sorted[1];
    $('resultHeading').textContent='รูปแบบ Enneagram ของคุณ';
    $('resultCode').textContent=`Type ${first.no}`;
    $('resultSub').textContent=`อันดับหนึ่งคือ ${first.th} (${first.en}) — ${first.desc} รองลงมาคือ Type ${second.no} ${second.th}`;
    $('resultGrid').innerHTML=sorted.map(t=>scoreCard(`Type ${t.no} — ${t.th}`,t.en,scores[t.no],45,t.color,`${Math.round(scores[t.no]/45*100)}%`)).join('');
    $('resultNote').innerHTML='<strong>การอ่านผล:</strong> คะแนนสูงสุด 1–2 อันดับแรกสะท้อนรูปแบบหลักที่ควรสำรวจต่อ Enneagram เน้นแรงขับภายในมากกว่าพฤติกรรมภายนอก จึงควรอ่านคำอธิบายและพิจารณาด้วยตนเองร่วมด้วย';
    lastResultText=`ผล Enneagram: Type ${first.no} ${first.th}\nรองลงมา Type ${second.no} ${second.th}\n${sorted.map(t=>`Type ${t.no}: ${scores[t.no]}`).join(' · ')}`;
  }

  function renderResult(){
    if(activeId==='disc') renderDisc();
    else if(activeId==='mbti') renderMbti();
    else renderEnneagram();
    showView('resultView');
  }

  function goHome(){
    history.replaceState(null,'',location.pathname);
    renderHome(); showView('homeView');
  }
  function restart(){
    if(!confirm(`ต้องการล้างคำตอบ ${test.title} และเริ่มใหม่ใช่หรือไม่?`)) return;
    localStorage.removeItem(storageKey(activeId)); answers={}; current=0; renderQuestion(); showView('testView');
  }
  async function copyResult(){
    try{ await navigator.clipboard.writeText(lastResultText); }
    catch{ const t=document.createElement('textarea');t.value=lastResultText;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove(); }
    $('toast').classList.add('show'); setTimeout(()=>$('toast').classList.remove('show'),1700);
  }

  $('prevBtn').addEventListener('click',()=>{ if(current>0){current--;renderQuestion();} });
  $('nextBtn').addEventListener('click',next);
  $('homeBtn').addEventListener('click',goHome);
  $('otherBtn').addEventListener('click',goHome);
  $('restartBtn').addEventListener('click',restart);
  $('copyBtn').addEventListener('click',copyResult);
  document.addEventListener('keydown',e=>{
    if(!$('testView').classList.contains('active')) return;
    if(e.key==='ArrowLeft'&&current>0){current--;renderQuestion();}
    if(e.key==='Enter'&&answers[current]!==undefined)next();
  });

  renderHome();
  const requested=new URLSearchParams(location.search).get('test');
  if(requested&&TEST_DATA[requested]) startTest(requested);
})();

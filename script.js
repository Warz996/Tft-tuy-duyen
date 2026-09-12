/* Giải tùy duyên — plain JavaScript, no build step, no remote dependencies.
 * Completed rounds and point adjustments form an ordered event log.
 * Checkmate eligibility is always evaluated BEFORE a completed round.
 */
(() => {
  'use strict';
  const STORAGE_KEY = 'tft-tuy-duyen:v2';
  const DEFAULT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
  const $ = id => document.getElementById(id);
  const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone = value => JSON.parse(JSON.stringify(value));
  const namesFrom = value => value.split(/\r?\n/).map(n => n.trim().normalize('NFC')).filter(Boolean);
  const isInt = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
  const hasDuplicates = names => new Set(names.map(n => n.toLocaleLowerCase('vi'))).size !== names.length;
  const initialState = () => ({version:2,tournament:null,draft:[],teams:{mode:'names',names:'',count:16,number:2,captains:true,result:null}});
  let state = initialState();
  let undoStack = [];
  let editingEvent = null;
  let adjustingPlayer = null;
  let toastTimer;
  let storageError = '';
  let lastStorageValue = null;
  let loadFailed = false;
  let dirtyTeamTimer;

  function fail(message) { throw new Error(message); }
  function validateNames(names, min, max) {
    if (!Array.isArray(names) || names.length < min || names.length > max) fail(`Cần từ ${min} đến ${max} người chơi.`);
    if (names.some(n => typeof n !== 'string' || !n.trim() || n.length > 60 || /[\u0000-\u001f\u007f]/.test(n))) fail('Tên phải có 1–60 ký tự, không chứa ký tự điều khiển.');
    if (hasDuplicates(names.map(n => n.trim().normalize('NFC')))) fail('Có tên bị trùng. Hãy thêm biệt danh hoặc số để phân biệt.');
  }

  const replay = window.TFTScore.replay;
  // Strictly normalize backups before installing any data into the application.
  function validateState(raw) {
    if (!raw || raw.version !== 2) fail('File không đúng định dạng Giải tùy duyên v2.');
    const result = initialState();
    if (raw.tournament !== null) {
      const t = raw.tournament;
      if (!t || typeof t.title !== 'string' || !t.title.trim() || t.title.length > 80) fail('Tên giải không hợp lệ.');
      validateNames(t.players, 2, 8);
      if (!isInt(t.threshold,1,1000) || !['checkmate','points'].includes(t.mode)) fail('Luật Checkmate không hợp lệ.');
      if (!Array.isArray(t.points) || t.points.length !== 8 || t.points.some((p,i) => !isInt(p,0,1000) || (i > 0 && p > t.points[i-1]))) fail('Điểm Top 1–8 phải là số nguyên 0–1000 và không tăng dần.');
      if (!Array.isArray(t.events) || t.events.length > 2000) fail('Tối đa 2.000 ván và điều chỉnh mỗi giải.');
      const events = t.events.map(e => {
        if (!e || !['round','adjust'].includes(e.type)) fail('Mục lịch sử không hợp lệ.');
        if (e.type === 'round') {
          if (!Array.isArray(e.placements) || e.placements.length !== t.players.length || e.placements.some(p => !isInt(p,1,8)) || new Set(e.placements).size !== t.players.length) fail('Ván đấu thiếu thứ hạng hoặc có thứ hạng trùng.');
          return {type:'round',placements:[...e.placements]};
        }
        if (!isInt(e.player,0,t.players.length-1) || !isInt(e.delta,-2000000,2000000) || typeof e.reason !== 'string' || !e.reason.trim() || e.reason.length > 120) fail('Điều chỉnh điểm không hợp lệ.');
        return {type:'adjust',player:e.player,delta:e.delta,reason:e.reason.trim()};
      });
      result.tournament = {title:t.title.trim(),players:t.players.map(n=>n.trim().normalize('NFC')),threshold:t.threshold,mode:t.mode,points:[...t.points],events};
      replay(result.tournament);
    }
    const draft = raw.draft;
    const count = result.tournament?.players.length || 0;
    if (!Array.isArray(draft) || draft.length !== count || draft.some(p=>p!==null && !isInt(p,1,8))) fail('Ván đang nhập không hợp lệ.');
    const occupied = draft.filter(p=>p!==null);
    if (new Set(occupied).size !== occupied.length) fail('Thứ hạng trong bản nháp bị trùng.');
    result.draft = [...draft];
    const teams = raw.teams;
    if (!teams || !['names','count'].includes(teams.mode) || typeof teams.names !== 'string' || teams.names.length > 12200 || !isInt(teams.count,2,200) || !isInt(teams.number,2,5) || typeof teams.captains !== 'boolean') fail('Cấu hình chia team không hợp lệ.');
    result.teams = {mode:teams.mode,names:teams.names,count:teams.count,number:teams.number,captains:teams.captains,result:null};
    if (teams.result !== null) {
      const r = teams.result;
      if (!r || !Array.isArray(r.groups) || !isInt(r.groups.length,2,5) || r.groups.some(g=>!Array.isArray(g) || !g.length) || typeof r.captains !== 'boolean') fail('Kết quả chia team không hợp lệ.');
      validateNames(r.groups.flat(),2,200);
      const sizes = r.groups.map(g=>g.length);
      if (Math.max(...sizes)-Math.min(...sizes)>1) fail('Số thành viên các team không cân bằng.');
      result.teams.result = {groups:r.groups.map(g=>g.map(n=>n.trim().normalize('NFC'))),captains:r.captains};
    }
    return result;
  }

  function save() {
    try {
      if(loadFailed) fail('Dữ liệu cũ không đọc được. Xuất JSON hiện tại nếu cần; tạo giải mới hoặc khôi phục JSON để tiếp tục lưu.');
      if(localStorage.getItem(STORAGE_KEY)!==lastStorageValue) fail('Tab khác đã thay đổi dữ liệu. Xuất JSON rồi tải lại trang; tự lưu đang tạm dừng.');
      const serialized=JSON.stringify(exportState());
      localStorage.setItem(STORAGE_KEY,serialized);lastStorageValue=serialized;storageError='';
    } catch(err) { storageError = /^(Tab khác|Dữ liệu cũ)/.test(err.message)?err.message:'Không thể lưu trên trình duyệt. Hãy xuất JSON để giữ dữ liệu.'; }
    $('saveStatus').textContent = storageError || 'Đã lưu trên trình duyệt';
    $('saveStatus').title = storageError || 'Tự lưu điểm, bản nháp và kết quả chia team trên thiết bị này.';
    $('saveStatus').classList.toggle('error',Boolean(storageError));
  }
  function toast(message, error=false) {
    clearTimeout(toastTimer); $('toast').textContent = message;
    $('toast').classList.toggle('error',error); $('toast').hidden = false;
    toastTimer = setTimeout(()=>{$('toast').hidden=true;},4500);
  }
  function checkpoint() {
    undoStack.push({tournament:clone(state.tournament),draft:exportState().draft});
    if (undoStack.length > 40) undoStack.shift();
  }
  function installTournament(t, draft=null) {
    const candidate = clone(state); candidate.tournament = t;
    candidate.draft = draft || Array(t.players.length).fill(null);
    const next = validateState(candidate);
    checkpoint(); state = next; editingEvent = null; draftBeforeEdit=null; loadFailed=false; save(); renderTournament();
  }
  function confirmAction(title,message) {
    return new Promise(resolve=>{
      $('confirmTitle').textContent=title; $('confirmText').textContent=message;
      const dialog=$('confirmDialog');
      const finish=value=>{dialog.close(); $('confirmYes').onclick=null; $('confirmNo').onclick=null; dialog.oncancel=null; resolve(value);};
      $('confirmYes').onclick=()=>finish(true); $('confirmNo').onclick=()=>finish(false);
      dialog.oncancel=e=>{e.preventDefault();finish(false);}; dialog.showModal(); $('confirmNo').focus();
    });
  }
  const ranking = window.TFTScore.ranking;
  const avatar = name => name.split(/\s+/).map(s=>Array.from(s)[0]).slice(0,2).join('').toLocaleUpperCase('vi');
  const avg = p => p.games ? (p.sum/p.games).toFixed(2) : '—';

  function renderTournament() {
    const t=state.tournament;
    window.TFTLive?.changed(t);
    const computed=t ? replay(t) : {rows:[],winner:null,roundNumber:0};
    const {rows,winner,roundNumber}=computed;
    $('emptyTournament').hidden=!!t; $('activeTournament').hidden=!t;
    $('tournamentTitle').textContent=t ? t.title : 'Sẵn sàng vào lobby?';
    $('demoBtn').hidden=!!t;
    const ready=t ? rows.filter(p=>p.score>=t.threshold).length : 0;
    const stats=[['Người chơi',rows.length,'trong lobby','♙'],['Ván đã chốt',roundNumber,'ván đấu','▦'],[t?.mode==='points'?'Đạt ngưỡng':'Sẵn sàng Checkmate',ready,'người chơi','ϟ'],['Điểm dẫn đầu',rows.length?Math.max(...rows.map(p=>p.score)):0,'điểm','♜']];
    $('stats').innerHTML=stats.map(([label,value,unit,icon],i)=>`<div class="stat ${i===2?'accent':''}"><span class="stat-icon" aria-hidden="true">${icon}</span><div class="stat-label">${label}</div><div class="stat-value">${value}<small>${unit}</small></div></div>`).join('');
    renderRules();
    if(!t)return;
    $('thresholdBadge').textContent=`${t.mode==='checkmate'?'CHECKMATE':'NGƯỠNG'} · ${t.threshold} ĐIỂM`;
    $('winnerBanner').hidden=!winner;
    if(winner) $('winnerBanner').innerHTML=`<span class="trophy" aria-hidden="true">🏆</span><div><p class="eyebrow">CHECKMATE · NHÀ VÔ ĐỊCH</p><h3>${escapeHTML(t.players[winner.player])}</h3><p>Đã đủ ngưỡng trước ván ${winner.round} và giành Top 1. Giải đấu hoàn tất!</p></div>`;
    $('leaderboard').innerHTML=ranking(rows).map(p=>{
      const eligible=p.score>=t.threshold;
      return `<div class="leader-row ${eligible?'eligible':''}"><span class="rank">${p.rank===1?'♛':String(p.rank).padStart(2,'0')}</span><span class="avatar" aria-hidden="true">${escapeHTML(avatar(p.name))}</span><div class="player-info"><strong>${escapeHTML(p.name)}</strong><div class="player-meta">${winner?.player===p.index?'<span class="pill gold">VÔ ĐỊCH</span>':eligible?`<span class="pill ${t.mode==='checkmate'?'gold':'mint'}">${t.mode==='checkmate'?'CHECKMATE':'ĐẠT NGƯỠNG'}</span>`:`<span>Còn ${t.threshold-p.score} điểm</span>`}<span>${p.wins} Top 1</span></div><div class="progress" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,p.score/t.threshold*100))}%"></i></div></div><button class="score-button" data-adjust="${p.index}" ${winner?'disabled':''} aria-label="Chỉnh điểm ${escapeHTML(p.name)}, hiện có ${p.score} điểm">${p.score}<small>chỉnh điểm</small></button></div>`;
    }).join('');
    renderRound(computed); renderHistory(computed);
    $('undoBtn').disabled=!undoStack.length;
  }
  function renderRound(computed = replay(state.tournament)) {
    const t=state.tournament;
    const editing=editingEvent!==null;
    const selected=state.draft.filter(p=>p!==null).length;
    const roundNo=editing ? t.events.slice(0,editingEvent+1).filter(e=>e.type==='round').length : computed.roundNumber+1;
    const prior=editing ? replay(t,t.events.slice(0,editingEvent)).rows : computed.rows;
    $('roundEyebrow').textContent=editing?'EDIT ROUND':'NEXT ROUND';
    $('roundTitle').textContent=editing?`Sửa kết quả ván ${roundNo}`:computed.winner?'Giải đấu đã hoàn tất':`Kết quả ván ${roundNo}`;
    $('draftStatus').textContent=`${selected}/${t.players.length} đã chọn`;
    $('cancelEditBtn').hidden=!editing;
    $('commitRoundBtn').textContent=editing?'Lưu kết quả sửa →':'Chốt ván đấu →';
    $('commitRoundBtn').disabled=selected!==t.players.length || (!!computed.winner&&!editing);
    $('clearDraftBtn').disabled=selected===0 || (!!computed.winner&&!editing);
    $('roundHint').textContent=editing?'Sửa ván sẽ tính lại toàn bộ điểm và trạng thái Checkmate.':computed.winner?'Có thể sửa ván trong lịch sử hoặc hoàn tác thao tác gần nhất.':`${t.players.length-selected} người chưa có thứ hạng · ✦ đủ ngưỡng trước ván`;
    $('roundHelp').textContent=t.players.length<8?'Mỗi người chọn một thứ hạng từ 1–8, không trùng nhau. Vẫn dùng điểm của lobby 8 người.':'Chọn thứ hạng cho từng người. Điểm chỉ được tính khi chốt ván.';
    const blocked=!!computed.winner&&!editing;
    $('placementGrid').innerHTML=`<table class="placement-table"><thead><tr><th scope="col">NGƯỜI CHƠI</th>${DEFAULT_POINTS.map((_,i)=>`<th scope="col">Top ${i+1}<br>+${t.points[i]}</th>`).join('')}</tr></thead><tbody>${t.players.map((name,i)=>`<tr class="${prior[i].score>=t.threshold?'ready':''}"><td>${escapeHTML(name)}</td>${DEFAULT_POINTS.map((_,j)=>{const place=j+1,active=state.draft[i]===place,used=state.draft.includes(place)&&!active;return `<td><button type="button" data-player="${i}" data-place="${place}" aria-label="${escapeHTML(name)}: Top ${place}" aria-pressed="${active}" class="${active?'selected':''}" ${used||blocked?'disabled':''}>${place}</button></td>`;}).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function renderHistory({rows}) {
    const t=state.tournament;
    const rounds=t.events.map((event,index)=>({event,index})).filter(x=>x.event.type==='round');
    if(!rounds.length) $('history').innerHTML='<div class="history-empty">Ván đầu tiên đang chờ bạn. Chốt kết quả để bắt đầu ghi lịch sử.</div>';
    else $('history').innerHTML=`<table class="history-table"><thead><tr><th scope="col">NGƯỜI CHƠI</th>${rounds.map((x,i)=>`<th scope="col">VÁN ${i+1}<br><button class="edit-round editor" data-edit="${x.index}">Sửa</button></th>`).join('')}<th scope="col">TOP 1</th><th scope="col">TOP 4</th><th scope="col">TB</th><th scope="col">TỔNG</th></tr></thead><tbody>${ranking(rows).map(p=>`<tr><th scope="row">${escapeHTML(p.name)}</th>${rounds.map(({event})=>{const place=event.placements[p.index];return `<td class="${place===1?'top1':place<=4?'top4':''}">#${place} <small class="muted">+${t.points[place-1]}</small></td>`;}).join('')}<td>${p.wins}</td><td>${p.top4}</td><td>${avg(p)}</td><td class="total">${p.score}</td></tr>`).join('')}</tbody></table>`;
    const logs=t.events.map((e,i)=>({e,i})).filter(x=>x.e.type==='adjust');
    $('adjustmentLog').innerHTML=(logs.length?'<p class="eyebrow" style="margin-top:22px">ĐIỀU CHỈNH ĐIỂM</p>':'')+logs.map(({e,i})=>`<div class="adjustment-item"><span>${escapeHTML(t.players[e.player])} <strong>${e.delta>=0?'+':''}${e.delta}</strong> · ${escapeHTML(e.reason)} <small>(sau ${t.events.slice(0,i).filter(x=>x.type==='round').length} ván)</small></span><button class="edit-round editor" data-remove="${i}" aria-label="Xóa điều chỉnh điểm của ${escapeHTML(t.players[e.player])}">Xóa</button></div>`).join('');
    if(t.events.length) $('adjustmentLog').innerHTML+='<div class="card-footer editor"><button class="quiet" id="deleteLastBtn">Xóa mục lịch sử cuối cùng</button></div>';
  }
  function renderRules() {
    const t=state.tournament,points=t?.points||DEFAULT_POINTS,threshold=t?.threshold||20;
    $('rulesText').innerHTML=`<div class="point-chips">${points.map((p,i)=>`<span>Top ${i+1} <b>+${p}</b></span>`).join('')}</div><ol><li>${t?.mode==='points'?'Chế độ theo điểm: tiếp tục ghi ván và xếp hạng theo tổng điểm, không tự chọn nhà vô địch.':`Đạt <strong>${threshold} điểm</strong> để sẵn sàng Checkmate. Phải đủ ngưỡng <strong>trước khi bắt đầu ván</strong>, rồi giành Top 1 trong ván đó để vô địch. Top 1 đưa bạn vừa chạm ngưỡng chưa phải là chiến thắng chung cuộc.`}</li><li>Chọn đủ thứ hạng cho toàn bộ người chơi rồi chốt ván. Nhấn lại ô đang chọn để bỏ; thứ hạng đã dùng sẽ khóa với người khác.</li><li>Nhấn vào điểm trong BXH để đặt tổng điểm và ghi lý do. Điều chỉnh có hiệu lực từ ván tiếp theo, không tạo nhà vô địch ngay lập tức.</li><li>Sửa ván trong lịch sử để tính lại kết quả. Nếu một thay đổi tạo nhà vô địch trước các ván đã ghi sau đó, hãy xóa các mục phía sau trước.</li><li>Hoàn tác tối đa 40 thao tác giải đấu trong phiên hiện tại. Sau khi tải lại trang, vẫn có thể sửa ván hoặc xóa mục lịch sử cuối cùng.</li><li>Lưu tự động trên trình duyệt hiện tại, không đồng bộ giữa máy. Sao lưu JSON chứa cả giải đấu, ván đang nhập và kết quả chia team. CSV dùng cho bảng tính.</li></ol>`;
  }

  function openSetup() { $('setupError').textContent=''; $('setupDialog').showModal(); }
  $('scoreInputs').innerHTML=DEFAULT_POINTS.map((p,i)=>`<label for="point${i}">Top ${i+1}<input id="point${i}" type="number" min="0" max="1000" value="${p}" required></label>`).join('');
  $('newBtn').onclick=openSetup; $('emptyStartBtn').onclick=openSetup;
  $('setupForm').onsubmit=async e=>{
    e.preventDefault();
    try {
      const t={title:$('setupTitle').value.trim(),players:namesFrom($('playersInput').value),threshold:Number($('threshold').value),mode:$('winMode').value,points:DEFAULT_POINTS.map((_,i)=>Number($(`point${i}`).value)),events:[]};
      validateState({...state,tournament:t,draft:Array(t.players.length).fill(null)});
      if(state.tournament && !await confirmAction('Tạo giải mới?','Giải hiện tại sẽ được thay thế. Nên xuất JSON nếu bạn muốn giữ giải cũ. Bạn có thể hoàn tác trong phiên này.'))return;
      window.TFTLive?.detach(); installTournament(t); $('setupDialog').close(); toast('Lobby đã sẵn sàng. Chúc cả hội may mắn!');
    } catch(err){$('setupError').textContent=err.message;}
  };
  $('demoBtn').onclick=()=>{
    const t={title:'Giải tùy duyên · Ván đấu mẫu',players:['Warz','Coldie','Smore','Hoàng Anh','Single','Ông già','Mochi','Cá voi'],threshold:20,mode:'checkmate',points:[...DEFAULT_POINTS],events:[{type:'round',placements:[1,2,3,4,5,6,7,8]},{type:'round',placements:[1,3,2,5,4,7,8,6]},{type:'round',placements:[4,1,5,2,3,6,7,8]}]};
    window.TFTLive?.detach(); installTournament(t); toast('Dữ liệu mẫu: Warz và Coldie đã sẵn sàng Checkmate.');
  };
  $('placementGrid').onclick=e=>{
    const btn=e.target.closest('button[data-player]'); if(!btn||btn.disabled)return;
    const player=Number(btn.dataset.player),place=Number(btn.dataset.place);
    state.draft[player]=state.draft[player]===place?null:place;
    if(editingEvent===null)save();
    renderRound();
    $('placementGrid').querySelector(`[data-player="${player}"][data-place="${place}"]`)?.focus({preventScroll:true});
  };
  $('clearDraftBtn').onclick=()=>{state.draft.fill(null);if(editingEvent===null)save();renderRound();};
  let draftBeforeEdit=null;
  function cancelEdit() {state.draft=draftBeforeEdit||Array(state.tournament.players.length).fill(null);draftBeforeEdit=null;editingEvent=null;save();renderTournament();}
  $('cancelEditBtn').onclick=cancelEdit;
  $('commitRoundBtn').onclick=async()=>{
    try {
      const t=clone(state.tournament); if(!t||state.draft.some(p=>p===null))return;
      if(editingEvent!==null && !await confirmAction('Lưu kết quả sửa?','Điểm, thống kê và trạng thái Checkmate sẽ được tính lại theo kết quả này.'))return;
      const event={type:'round',placements:[...state.draft]};
      if(editingEvent!==null)t.events[editingEvent]=event;else t.events.push(event);
      const restoredDraft=editingEvent!==null?draftBeforeEdit:null;
      // The undo snapshot must contain the original draft, not an edited past round.
      const next=validateState({...state,tournament:t,draft:restoredDraft||Array(t.players.length).fill(null)});
      if(editingEvent!==null)state.draft=draftBeforeEdit||Array(t.players.length).fill(null);
      checkpoint();state=next;editingEvent=null;draftBeforeEdit=null;save();renderTournament();
      toast(replay(t).winner?'Checkmate! Đã tìm ra nhà vô địch.':'Đã chốt kết quả và cập nhật bảng điểm.');
    }catch(err){toast(err.message,true);}
  };
  $('history').onclick=async e=>{
    const btn=e.target.closest('[data-edit]');if(!btn)return;
    if(editingEvent!==null && !await confirmAction('Chuyển ván đang sửa?','Các lựa chọn chưa lưu trong ván đang sửa sẽ bị bỏ.'))return;
    if(editingEvent===null)draftBeforeEdit=[...state.draft];
    editingEvent=Number(btn.dataset.edit);state.draft=[...state.tournament.events[editingEvent].placements];renderRound();
    $('roundTitle').scrollIntoView({behavior:'smooth',block:'center'});
  };
  $('leaderboard').onclick=e=>{
    const btn=e.target.closest('[data-adjust]');if(!btn||btn.disabled)return;
    if(editingEvent!==null){toast('Hãy lưu hoặc hủy sửa ván trước khi chỉnh điểm.',true);return;}
    adjustingPlayer=Number(btn.dataset.adjust);
    const row=replay(state.tournament).rows[adjustingPlayer];
    $('adjustPlayer').textContent=`${row.name} · hiện tại ${row.score} điểm`;
    $('adjustScore').value=row.score;$('adjustReason').value='';$('adjustError').textContent='';$('adjustDialog').showModal();
  };
  $('adjustForm').onsubmit=e=>{
    e.preventDefault();
    try{
      const score=Number($('adjustScore').value);
      if(!isInt(score,-1000000,1000000))fail('Điểm phải là số nguyên từ -1.000.000 đến 1.000.000.');
      const t=clone(state.tournament),delta=score-replay(t).rows[adjustingPlayer].score;
      if(!delta)fail('Tổng điểm chưa thay đổi.');
      t.events.push({type:'adjust',player:adjustingPlayer,delta,reason:$('adjustReason').value.trim()});
      installTournament(t,[...state.draft]);$('adjustDialog').close();toast('Đã ghi điều chỉnh điểm.');
    }catch(err){$('adjustError').textContent=err.message;}
  };
  $('undoBtn').onclick=async()=>{
    if(!undoStack.length)return;
    if(!await confirmAction('Hoàn tác thao tác gần nhất?','Khôi phục giải đấu và bản nháp trước thao tác gần nhất. Kết quả chia team không thay đổi.'))return;
    const snapshot=undoStack.pop();state.tournament=snapshot.tournament;state.draft=snapshot.draft;editingEvent=null;draftBeforeEdit=null;save();renderTournament();toast('Đã hoàn tác.');
  };
  $('adjustmentLog').onclick=async e=>{
    const btn=e.target.closest('[data-remove],#deleteLastBtn');if(!btn)return;
    if(editingEvent!==null){toast('Hãy lưu hoặc hủy sửa ván trước.',true);return;}
    const index=btn.id==='deleteLastBtn'?state.tournament.events.length-1:Number(btn.dataset.remove);
    if(!await confirmAction('Xóa mục lịch sử?','Mục này sẽ bị xóa và điểm được tính lại. Bạn có thể hoàn tác trong phiên hiện tại.'))return;
    try{const t=clone(state.tournament);t.events.splice(index,1);installTournament(t,[...state.draft]);toast('Đã xóa và tính lại điểm.');}catch(err){toast(err.message,true);}
  };

  // Rejection sampling avoids modulo bias; Fisher–Yates creates a uniform shuffle.
  function randomInt(max) {
    const limit=Math.floor(4294967296/max)*max,buf=new Uint32Array(1);
    do{crypto.getRandomValues(buf);}while(buf[0]>=limit);
    return buf[0]%max;
  }
  function shuffled(values){const a=[...values];for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
  function teamRoster() {
    if($('teamMode').value==='count'){
      const count=Number($('playerCount').value);if(!isInt(count,2,200))fail('Nhập số nguyên từ 2 đến 200 người.');
      return Array.from({length:count},(_,i)=>`Người chơi ${String(i+1).padStart(2,'0')}`);
    }
    const names=namesFrom($('teamNames').value);validateNames(names,2,200);return names;
  }
  function syncTeamInputs() {
    state.teams.mode=$('teamMode').value;state.teams.names=$('teamNames').value;
    const count=Number($('playerCount').value);if(isInt(count,2,200))state.teams.count=count;
    state.teams.number=Number($('teamNumber').value);state.teams.captains=$('captains').checked;
  }
  function validateTeamInputs() {
    $('namesMode').hidden=$('teamMode').value!=='names';$('countMode').hidden=$('teamMode').value!=='count';
    $('teamCountBadge').textContent=`${$('teamMode').value==='names'?namesFrom($('teamNames').value).length:Number($('playerCount').value)||0} người`;
    try{
      const roster=teamRoster(),number=Number($('teamNumber').value);
      if(roster.length<number)fail(`Cần ít nhất ${number} người để chia ${number} team.`);
      const size=Math.floor(roster.length/number),remainder=roster.length%number;
      $('teamValidation').textContent=`${roster.length} người → ${number} team · ${size}${remainder?`–${size+1}`:''} người/team`;
      $('teamValidation').classList.remove('error');$('shuffleBtn').disabled=false;
    }catch(err){$('teamValidation').textContent=err.message;$('teamValidation').classList.add('error');$('shuffleBtn').disabled=true;}
  }
  function populateTeams() {
    const t=state.teams;$('teamMode').value=t.mode;$('teamNames').value=t.names;$('playerCount').value=t.count;$('teamNumber').value=t.number;$('captains').checked=t.captains;
    validateTeamInputs();renderTeams();
  }
  function renderTeams() {
    const result=state.teams.result;$('copyTeamsBtn').disabled=!result;
    if(!result){$('teamResults').innerHTML='<div class="teams-empty"><div><div class="dice" aria-hidden="true">⚄</div><h3>Để duyên chọn đồng đội.</h3><p>Nhập danh sách hoặc số lượng người chơi, chọn số team rồi bắt đầu bốc thăm.</p><span class="pill">NGẪU NHIÊN · CÂN BẰNG SỐ LƯỢNG</span></div></div>';return;}
    $('teamResults').innerHTML=`<div class="team-grid">${result.groups.map((group,i)=>`<article class="card team-card"><div class="card-heading"><h3>TEAM ${String(i+1).padStart(2,'0')}</h3><span class="pill">${group.length} người</span></div><ol>${group.map((name,j)=>`<li><span class="member-index">${String(j+1).padStart(2,'0')}</span><span>${escapeHTML(name)}</span>${result.captains&&j===0?'<span class="captain-tag">♛ ĐỘI TRƯỞNG</span>':''}</li>`).join('')}</ol></article>`).join('')}</div><p class="result-note">Kết quả lần chia gần nhất · ${result.groups.flat().length} người / ${result.groups.length} team${result.captains?' · ♛ Đội trưởng được bốc ngẫu nhiên':''}. Thay đổi phần nhập rồi bấm chia để tạo kết quả mới.</p>`;
  }
  ['teamMode','teamNames','playerCount','teamNumber','captains'].forEach(id=>$(id).addEventListener('input',()=>{syncTeamInputs();validateTeamInputs();clearTimeout(dirtyTeamTimer);dirtyTeamTimer=setTimeout(save,250);}));
  $('shuffleBtn').onclick=()=>{
    try{
      const roster=teamRoster(),count=Number($('teamNumber').value);if(roster.length<count)fail('Số người phải bằng hoặc lớn hơn số team.');
      syncTeamInputs();const mixed=shuffled(roster),groups=Array.from({length:count},()=>[]);
      // Randomize which team receives an extra member, not always Team 1.
      const order=shuffled(Array.from({length:count},(_,i)=>i));
      mixed.forEach((name,i)=>groups[order[i%count]].push(name));
      state.teams.result={groups,captains:state.teams.captains};save();renderTeams();toast(`Đã chia ${roster.length} người vào ${count} team.`);
    }catch(err){toast(err.message,true);}
  };
  $('useRosterBtn').onclick=()=>{
    if(!state.tournament){toast('Tạo giải đấu trước để lấy danh sách.',true);return;}
    $('teamNames').value=state.tournament.players.join('\n');$('teamMode').value='names';syncTeamInputs();validateTeamInputs();save();toast('Đã lấy danh sách người chơi.');
  };

  async function copyText(text) {
    try{await navigator.clipboard.writeText(text);toast('Đã sao chép.');}
    catch{$('copyText').value=text;$('copyDialog').showModal();$('copyText').select();}
  }
  $('copyTeamsBtn').onclick=()=>{const r=state.teams.result;if(r)copyText('🐳 GIẢI TÙY DUYÊN · CHIA TEAM\n\n'+r.groups.map((g,i)=>`TEAM ${i+1}\n${g.map((n,j)=>`${j+1}. ${n}${r.captains&&j===0?' (Đội trưởng)':''}`).join('\n')}`).join('\n\n'));};
  $('copyBoardBtn').onclick=()=>{
    const t=state.tournament,{rows,winner,roundNumber}=replay(t);
    copyText(`🐳 ${t.title}\nSau ${roundNumber} ván · Ngưỡng ${t.threshold} điểm\n\n`+ranking(rows).map(p=>`${p.rank}. ${p.name}: ${p.score} điểm${winner?.player===p.index?' 🏆 VÔ ĐỊCH':t.mode==='checkmate'&&p.score>=t.threshold?' ⚡ CHECKMATE':''}`).join('\n'));
  };
  function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  function exportState(){const copy=clone(state);if(editingEvent!==null)copy.draft=draftBeforeEdit||Array(copy.tournament.players.length).fill(null);return copy;}
  $('exportBtn').onclick=()=>{syncTeamInputs();download(`giai-tuy-duyen-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(exportState(),null,2),'application/json');toast('Đã tạo bản sao lưu JSON.');};
  // Prefix potential formulas before quoting CSV cells; names are untrusted input.
  const csvCell = value => {const s=String(value);return '"'+(/^[\s]*[=+\-@\t\r]/.test(s)?"'"+s:s).replace(/"/g,'""')+'"';};
  $('csvBtn').onclick=()=>{
    const t=state.tournament,{rows}=replay(t),rounds=t.events.filter(e=>e.type==='round');
    const matrix=[['Hạng','Người chơi',...rounds.map((_,i)=>`Ván ${i+1} (thứ hạng)`),'Điều chỉnh','Top 1','Top 4','Thứ hạng TB','Tổng điểm'],...ranking(rows).map(p=>[p.rank,p.name,...rounds.map(e=>e.placements[p.index]),t.events.filter(e=>e.type==='adjust'&&e.player===p.index).reduce((sum,e)=>sum+e.delta,0),p.wins,p.top4,avg(p),p.score])];
    download('bang-diem-tft.csv','\ufeff'+matrix.map(row=>row.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
  };
  $('importBtn').onclick=()=>$('importFile').click();
  $('importFile').onchange=async()=>{
    const file=$('importFile').files[0];$('importFile').value='';if(!file)return;
    try{
      if(file.size>2*1024*1024)fail('File vượt 2 MB. Chọn đúng bản sao lưu JSON của ứng dụng.');
      let raw;try{raw=JSON.parse(await file.text());}catch{fail('Không đọc được JSON. File có thể bị hỏng hoặc sai định dạng.');}
      const next=validateState(raw);
      if(!await confirmAction('Khôi phục bản sao lưu?','Toàn bộ giải đấu, bản nháp và kết quả chia team hiện tại sẽ được thay thế. Hãy xuất JSON trước nếu muốn giữ dữ liệu hiện tại.'))return;
      window.TFTLive?.detach(); state=next;undoStack=[];editingEvent=null;draftBeforeEdit=null;loadFailed=false;save();renderTournament();populateTeams();toast('Đã khôi phục bản sao lưu.');
    }catch(err){toast(err.message,true);}
  };
  function route() {
    const teams=location.hash==='#teams';
    if(teams && document.body.classList.contains('presentation'))togglePresentation(false);
    $('teamsPage').hidden=!teams;$('tournamentPage').hidden=teams;
    $('tabTeams').classList.toggle('active',teams);$('tabTournament').classList.toggle('active',!teams);
    $('tabTeams').toggleAttribute('aria-current',teams);$('tabTournament').toggleAttribute('aria-current',!teams);
    (teams?$('tabTeams'):$('tabTournament')).setAttribute('aria-current','page');
    $('presentationBtn').hidden=teams;
  }
  function togglePresentation(enabled){document.body.classList.toggle('presentation',enabled);$('presentationBtn').innerHTML=enabled?'✕ <span>Thoát trình chiếu</span>':'▣ <span>Trình chiếu</span>';$('presentationBtn').setAttribute('aria-pressed',String(enabled));}
  $('presentationBtn').onclick=()=>togglePresentation(!document.body.classList.contains('presentation'));
  window.addEventListener('hashchange',route);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')togglePresentation(false);});
  document.addEventListener('click',e=>{const btn=e.target.closest('[data-close]');if(btn)$(btn.dataset.close).close();});
  // Save only the regular draft when editing an older round.
  window.addEventListener('pagehide',()=>{clearTimeout(dirtyTeamTimer);save();});
  window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY && e.newValue!==JSON.stringify(exportState()))toast('Dữ liệu vừa đổi ở tab khác. Xuất bản sao nếu cần, rồi tải lại trang để lấy bản mới.',true);});
  try{
    const saved=localStorage.getItem(STORAGE_KEY);lastStorageValue=saved;
    if(saved)state=validateState(JSON.parse(saved));
  }catch{loadFailed=true;storageError='Không đọc được dữ liệu đã lưu. Có thể khôi phục bằng file JSON.';}
  renderTournament();populateTeams();route();
  if(storageError){$('saveStatus').textContent=storageError;$('saveStatus').classList.add('error');toast(storageError,true);}
  window.TFTApp = {
    tournament: () => clone(state.tournament),
    replaceTournament(t) {
      const next=validateState({...state,tournament:t,draft:Array(t.players.length).fill(null)});
      state=next;undoStack=[];editingEvent=null;draftBeforeEdit=null;loadFailed=false;
      save();renderTournament();
    },
    confirm:confirmAction, toast, copyText
  };
  // Test hook exports pure domain functions only when explicitly requested by the test runner.
  if(window.__TFT_TEST__)window.TFT_TEST={replay,validateState,ranking,shuffled,initialState,csvCell};
})();

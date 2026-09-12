/* Spectator entrypoint: contains no login, edit handlers, local backups or write calls. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),client=new TFTCloud.CloudClient(window.TFT_CONFIG);
 const room=new URL(location.href).searchParams.get('room');
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const requestedInterval=Number(window.TFT_CONFIG?.pollIntervalMs);
 const interval=Number.isFinite(requestedInterval)?Math.min(60000,Math.max(3000,requestedInterval)):3000;
 let version=null,busy=false,timer,failures=0,hasData=false;
 function render(r){
   const t=r.payload;
   if(!t||!Array.isArray(t.players)||t.players.length<2||t.players.length>8||!Array.isArray(t.events)||t.events.length>2000||!Array.isArray(t.points)||t.points.length!==8||!Number.isInteger(t.threshold)||t.threshold<1)throw new Error('Dữ liệu giải không hợp lệ.');
   const {rows,winner,roundNumber}=TFTScore.replay(t),ranked=TFTScore.ranking(rows);
   $('watchTitle').textContent=t.title;document.title=t.title+' · Trực tiếp';
   $('watchRule').textContent=`${t.mode==='checkmate'?'CHECKMATE':'THEO ĐIỂM'} · ${t.threshold} ĐIỂM`;
   $('watchStats').innerHTML=[['Người chơi',rows.length],['Ván đã chốt',roundNumber],['Đạt ngưỡng',rows.filter(p=>p.score>=t.threshold).length],['Điểm dẫn đầu',Math.max(...rows.map(p=>p.score))]].map(([name,n])=>`<div class="stat"><div class="stat-label">${esc(name)}</div><div class="stat-value">${esc(n)}</div></div>`).join('');
   $('watchWinner').hidden=!winner;
   if(winner)$('watchWinner').innerHTML=`<span class="trophy">🏆</span><div><h3>${esc(t.players[winner.player])} — Nhà vô địch</h3><p>Checkmate ở ván ${winner.round}</p></div>`;
   $('watchLeaders').innerHTML=ranked.map(p=>`<div class="leader-row"><span class="rank">${p.rank===1?'♛':p.rank}</span><div class="player-info"><strong>${esc(p.name)}</strong><div class="player-meta"><span>${p.wins} Top 1 · ${p.top4} Top 4</span>${p.score>=t.threshold&&t.mode==='checkmate'?'<span class="pill gold">CHECKMATE</span>':''}</div></div><span class="score">${esc(p.score)}</span></div>`).join('');
   const rounds=t.events.filter(e=>e.type==='round');
   $('watchHistory').innerHTML=rounds.length?`<table class="history-table"><thead><tr><th>NGƯỜI CHƠI</th>${rounds.map((_,i)=>`<th>VÁN ${i+1}</th>`).join('')}<th>ĐIỀU CHỈNH</th><th>TỔNG</th></tr></thead><tbody>${ranked.map(p=>`<tr><th scope="row">${esc(p.name)}</th>${rounds.map(e=>`<td class="${e.placements[p.index]===1?'top1':''}">#${esc(e.placements[p.index])}</td>`).join('')}<td>${esc(t.events.filter(e=>e.type==='adjust'&&e.player===p.index).reduce((s,e)=>s+e.delta,0))}</td><td class="total">${esc(p.score)}</td></tr>`).join('')}</tbody></table>`:'<p class="history-empty">Đang chờ Admin chốt ván đầu tiên.</p>';
   $('watchUpdated').textContent='Cập nhật: '+new Date(r.updated_at).toLocaleTimeString('vi-VN');
   $('watchContent').hidden=false;hasData=true;
 }
 async function poll(){
   if(busy||document.hidden)return;
   clearTimeout(timer);busy=true;
   try{
     const r=await client.rpc('tft_watch',{p_id:room,p_version:version},true);
     if(!r.available){$('watchContent').hidden=true;hasData=false;version=null;$('connectionStatus').textContent='Chưa phát';$('watchNotice').textContent='Giải không tồn tại hoặc Admin đã tạm dừng chia sẻ. Trang sẽ tự kiểm tra lại.';}
     else{
       if(!r.unchanged){render(r);version=r.version;}
       $('connectionStatus').textContent='● Đang theo dõi';$('watchNotice').textContent=`Tự kiểm tra mỗi ${interval/1000} giây · Đây là trang chỉ xem.`;
     }
     failures=0;
   }catch(e){failures++;$('connectionStatus').textContent='Mất kết nối';$('watchNotice').textContent=hasData?'Đang hiển thị bản gần nhất; điểm có thể đã cũ. Sẽ tự thử kết nối lại.':'Chưa tải được bảng điểm. Kiểm tra mạng hoặc liên hệ Admin; trang sẽ tự thử lại.';}
   finally{busy=false;timer=setTimeout(poll,Math.min(30000,interval*2**Math.min(failures,3)));}
 }
 if(!client.configured()){$('connectionStatus').textContent='Chưa cấu hình';$('watchNotice').textContent='Admin chưa kết nối cơ sở dữ liệu cho website.';return;}
 if(!room||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(room)){$('connectionStatus').textContent='Link không hợp lệ';$('watchNotice').textContent='Hãy dùng đầy đủ link chỉ xem do Admin gửi.';return;}
 document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)poll();});
 window.addEventListener('online',()=>poll());poll();
})();

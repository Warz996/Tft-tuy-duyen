/* Admin publisher. The database, not these controls, authorizes every write. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),app=window.TFTApp;
 const client=new TFTCloud.CloudClient(window.TFT_CONFIG);
 let busy=false,issue='';
 const sync=new TFTCloud.RoomSync(client,(status,error)=>{
   issue=error?.message||'';
   $('liveError').textContent=issue;
   $('liveStatus').textContent=status==='saving'?'Đang gửi điểm…':status==='error'?'Chưa đồng bộ':sync.room?(sync.room.is_live?'Đang chia sẻ':'Đã tạm dừng'):'Chưa phát giải';
   $('retryLiveBtn').disabled=!sync.halted;
   $('pauseLiveBtn').disabled=!sync.room||status==='saving'||sync.halted;
   if(sync.room)$('pauseLiveBtn').textContent=sync.room.is_live?'Tạm dừng chia sẻ':'Mở lại chia sẻ';
 });
 const guard=async action=>{
   if(busy)return;busy=true;$('liveError').textContent='';
   for(const id of ['publishBtn','loadRoomBtn','loginBtn','pauseLiveBtn','logoutBtn'])$(id).disabled=true;
   try{await action();}catch(e){$('liveError').textContent=e.message;app.toast(e.message,true);}
   finally{busy=false;$('loginBtn').disabled=!client.configured();$('logoutBtn').disabled=false;$('loadRoomBtn').disabled=false;$('publishBtn').disabled=!!sync.room;$('pauseLiveBtn').disabled=!sync.room||sync.pending()||sync.halted;}
 };
 function detach(){sync.detach();$('shareBox').hidden=true;$('watchLink').value='';$('publishBtn').disabled=false;}
 window.TFTLive={changed:t=>{if(!t&&sync.room)detach();else sync.changed(t);},detach};
 async function rooms(){const list=await client.rpc('tft_list_rooms');$('ownedRooms').replaceChildren(new Option('Chọn giải của bạn…',''),...list.map(r=>new Option(`${r.title} · ${r.is_live?'Đang chia sẻ':'Tạm dừng'}`,r.id)));if(sync.room)$('ownedRooms').value=sync.room.id;}
 function bind(room){
   sync.bind(room);const url=new URL('watch.html',location.href);url.searchParams.set('room',room.id);url.hash='';
   $('watchLink').value=url.href;$('openWatchLink').href=url.href;$('shareBox').hidden=false;$('publishBtn').disabled=true;
 }
 $('loginForm').onsubmit=e=>{e.preventDefault();guard(async()=>{
   const password=$('adminPassword').value;
   try{
     const user=await client.login($('adminEmail').value.trim(),password);
     $('adminIdentity').textContent=`Admin: ${user.email} · Phiên chỉ lưu trong tab này.`;
     $('loginForm').hidden=true;$('liveControls').hidden=false;$('liveStatus').textContent='Admin đã đăng nhập';
     $('liveHelp').textContent='Phát giải hiện tại để tạo link mới, hoặc mở một giải đã lưu để tiếp tục. Chỉ kết quả đã chốt được gửi cho người xem.';
     await rooms();
   }finally{$('adminPassword').value='';}
 });};
 $('publishBtn').onclick=()=>guard(async()=>{
   if(sync.room)throw new Error('Giải hiện tại đã có link. Tạo giải mới nếu muốn một link khác.');
   const t=app.tournament();if(!t)throw new Error('Hãy tạo giải và nhập danh sách người chơi trước.');
   if(location.protocol==='file:')throw new Error('Hãy mở website GitHub Pages để tạo link mà người khác truy cập được.');
   const r=await client.rpc('tft_create_room',{p_payload:t});bind(r);sync.changed(app.tournament());await rooms();app.toast('Đã tạo link chỉ xem.');
 });
 $('loadRoomBtn').onclick=()=>guard(async()=>{
   const id=$('ownedRooms').value;if(!id)throw new Error('Chọn một giải đã lưu.');
   if(sync.pending())throw new Error('Còn dữ liệu chưa gửi. Xuất JSON để giữ bản đang sửa trước khi mở lại giải.');
   if(!await app.confirm('Mở giải từ máy chủ?','Giải và bản nháp trên màn hình sẽ được thay bằng bản đã lưu trên máy chủ. Xuất JSON trước nếu muốn giữ bản hiện tại.'))return;
   const room=await client.rpc('tft_load_room',{p_id:id});detach();app.replaceTournament(room.payload);bind(room);app.toast('Đã mở giải. Các lần chốt và chỉnh điểm tiếp theo sẽ tự đồng bộ.');
 });
 // Conflict recovery must remain possible even with unsent edits, after explicit confirmation.
 $('retryLiveBtn').onclick=()=>guard(async()=>{
   if(!sync.room)return;
   if(issue.includes('CONFLICT')){
     if(!await app.confirm('Tải bản máy chủ để giải quyết xung đột?','Bản đang sửa có thể khác bản máy chủ. Hãy xuất JSON trước nếu cần giữ. Tiếp tục sẽ thay bản đang sửa bằng bản máy chủ.'))return;
     const r=await client.rpc('tft_load_room',{p_id:sync.room.id});detach();app.replaceTournament(r.payload);bind(r);
   }else await sync.retry();
 });
 $('pauseLiveBtn').onclick=()=>guard(async()=>{
   if(!sync.room||sync.pending()||sync.halted)throw new Error('Chờ đồng bộ xong trước khi đổi trạng thái chia sẻ.');
   const old=sync.room;
   const r=await client.rpc('tft_set_live',{p_id:old.id,p_version:old.version,p_live:!old.is_live});
   // Keep any edits made while the request was in flight.
   bind(r);sync.changed(app.tournament());await rooms();
 });
 $('refreshRoomsBtn').onclick=()=>guard(rooms);
 $('copyWatchBtn').onclick=()=>app.copyText($('watchLink').value);
 $('logoutBtn').onclick=()=>guard(async()=>{
   if(sync.pending()&&!await app.confirm('Đăng xuất khi chưa đồng bộ?','Các chỉnh sửa chưa gửi vẫn nằm ở máy này. Xuất JSON trước nếu cần giữ để khôi phục.'))return;
   detach();let logoutError;
   try{await client.logout();}catch(e){logoutError=e;}
   $('loginForm').hidden=false;$('liveControls').hidden=true;$('liveStatus').textContent='Đã đăng xuất';
   if(logoutError)throw new Error('Đã xóa phiên trong tab; chưa xác nhận thu hồi phiên trên máy chủ do mất kết nối.');
 });
 window.addEventListener('beforeunload',e=>{if(sync.pending()){e.preventDefault();e.returnValue='';}});
 if(!client.configured()){
   $('loginBtn').disabled=true;$('liveStatus').textContent='Cần cấu hình một lần';
   $('liveHelp').textContent='Mở HUONG-DAN-LIVE.md để tạo cơ sở dữ liệu và tài khoản Admin, rồi điền config.js. Bạn vẫn dùng được bảng điểm cục bộ bên dưới.';
 }
})();

/* Shared scoring engine: admin and spectator use identical rules. */
(function(root){
'use strict';
function fail(message){throw new Error(message);}
  function replay(t, events = t.events) {
    const rows = t.players.map((name, index) => ({name,index,score:0,wins:0,top4:0,sum:0,games:0}));
    let winner = null;
    let roundNumber = 0;
    for (let i = 0; i < events.length; i++) {
      if (winner !== null) fail('Thay đổi này tạo nhà vô địch trước các dữ liệu phía sau. Hãy hoàn tác hoặc xóa các mục phía sau trước.');
      const event = events[i];
      if (event.type === 'adjust') rows[event.player].score += event.delta;
      else {
        roundNumber++;
        const eligible = rows.map(p => p.score >= t.threshold);
        event.placements.forEach((place, player) => {
          const row = rows[player];
          row.score += t.points[place - 1]; row.games++; row.sum += place;
          if (place === 1) row.wins++;
          if (place <= 4) row.top4++;
          if (t.mode === 'checkmate' && eligible[player] && place === 1) winner = {player,round:roundNumber};
        });
      }
    }
    return {rows,winner,roundNumber};
  }

  function ranking(rows) {
    const compare=(a,b)=>b.score-a.score || b.wins-a.wins || b.top4-a.top4 || a.sum/Math.max(1,a.games)-b.sum/Math.max(1,b.games);
    const sorted=[...rows].sort((a,b)=>compare(a,b) || a.index-b.index);
    let rank=1;
    return sorted.map((p,i)=>{if(i && compare(p,sorted[i-1])!==0) rank=i+1;return {...p,rank};});
  }
const api={replay,ranking};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TFTScore=api;
})(typeof window!=='undefined'?window:this);

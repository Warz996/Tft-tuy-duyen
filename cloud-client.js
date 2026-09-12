/* Supabase HTTP client; no third-party runtime scripts. Auth stays in memory. */
(function(root){
  'use strict';
  class CloudClient {
    constructor(config, fetcher=root.fetch.bind(root)){
      this.config=config||{};this.fetcher=fetcher;this.session=null;this.refreshing=null;
    }
    configured(){
      try {const u=new URL(this.config.supabaseUrl),key=this.config.publishableKey||'';const publicKey=key.startsWith('sb_publishable_')||(key.startsWith('eyJ')&&JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon');return u.protocol==='https:'&&publicKey;}catch{return false;}
    }
    async request(path,body,token){
      if(!this.configured())throw new Error('Chưa cấu hình kết nối. Xem HUONG-DAN-LIVE.md.');
      const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
      try {
        const headers={'apikey':this.config.publishableKey,'Content-Type':'application/json'};
        if(token)headers.Authorization=`Bearer ${token}`;
        else if(this.config.publishableKey.startsWith('eyJ'))headers.Authorization=`Bearer ${this.config.publishableKey}`;
        const response=await this.fetcher(this.config.supabaseUrl.replace(/\/$/,'')+path,{method:'POST',headers,body:JSON.stringify(body),signal:controller.signal,cache:'no-store'});
        const text=await response.text();let data;try{data=text?JSON.parse(text):null;}catch{throw new Error('Máy chủ trả về dữ liệu không hợp lệ.');}
        if(!response.ok){const error=new Error(data?.message||data?.msg||data?.error_description||`HTTP ${response.status}`);error.status=response.status;error.code=data?.code;throw error;}
        return data;
      }catch(e){if(e.name==='AbortError')throw new Error('Kết nối quá thời gian. Kiểm tra mạng rồi tải lại bản trên máy chủ trước khi ghi tiếp.');throw e;}finally{clearTimeout(timeout);}
    }
    setSession(s){if(!s?.access_token||!s?.refresh_token)throw new Error('Phiên đăng nhập không hợp lệ.');this.session={...s,expires_at:Date.now()+Number(s.expires_in||3600)*1000};}
    async login(email,password){const s=await this.request('/auth/v1/token?grant_type=password',{email,password});this.setSession(s);try{await this.rpc('tft_admin_check',{});}catch(e){this.session=null;throw e;}return s.user;}
    async token(){
      if(!this.session)throw new Error('Hãy đăng nhập Admin.');
      if(Date.now()>this.session.expires_at-60000){
        if(!this.refreshing){const old=this.session;this.refreshing=this.request('/auth/v1/token?grant_type=refresh_token',{refresh_token:old.refresh_token}).then(s=>{if(this.session!==old)throw new Error('Phiên đăng nhập đã thay đổi.');this.setSession(s);}).catch(e=>{if(this.session===old)this.session=null;throw e;}).finally(()=>{this.refreshing=null;});}
        await this.refreshing;
      }
      if(!this.session)throw new Error('Phiên đăng nhập đã kết thúc.');return this.session.access_token;
    }
    async rpc(name,args={},publicRead=false){return this.request('/rest/v1/rpc/'+name,args,publicRead?null:await this.token());}
    async logout(){const token=this.session?.access_token;this.session=null;if(token)await this.request('/auth/v1/logout?scope=local',{},token);}
  }
  // A single ordered writer. Version compare-and-swap is enforced by PostgreSQL.
  class RoomSync {
    constructor(client,onStatus=()=>{}){this.client=client;this.onStatus=onStatus;this.room=null;this.desired=null;this.sent=null;this.running=null;this.halted=false;this.generation=0;}
    bind(room){this.generation++;this.room=room;this.sent=JSON.stringify(room.payload);this.desired=this.sent;this.halted=false;this.onStatus('saved');}
    detach(){this.generation++;this.room=null;this.desired=null;this.sent=null;this.halted=false;this.onStatus('detached');}
    changed(t){if(!this.room||!t)return;this.desired=JSON.stringify(t);if(this.desired!==this.sent&&!this.halted)this.flush();}
    async flush(){
      if(this.running)return this.running;
      if(!this.room||this.halted||this.desired===this.sent)return;
      const generation=this.generation;
      this.running=(async()=>{
        while(this.room&&generation===this.generation&&this.desired!==this.sent&&!this.halted){
          const room=this.room,body=this.desired;this.onStatus('saving');
          try{
            const updated=await this.client.rpc('tft_save_room',{p_id:room.id,p_version:room.version,p_payload:JSON.parse(body)});
            if(generation!==this.generation)return;
            this.room=updated;this.sent=body;this.onStatus('saved');
          }catch(e){if(generation===this.generation){this.halted=true;this.onStatus('error',e);}return;}
        }
      })().finally(()=>{this.running=null;if(this.room&&!this.halted&&this.desired!==this.sent)this.flush();});
      return this.running;
    }
    retry(){this.halted=false;return this.flush();}
    pending(){return !!this.running||!!this.room&&this.desired!==this.sent;}
  }
  const api={CloudClient,RoomSync};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TFTCloud=api;
})(typeof window!=='undefined'?window:this);

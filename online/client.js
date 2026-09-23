/* Online saving is opt-in; opening a shared sheet never writes local character data. */
(async () => {
 'use strict';
 const app=window.RefleetSheet, cfg=window.REFLEET_ONLINE||{};
 if(!app)return;
 const panel=document.createElement('section');panel.className='online-panel';
 const title=document.createElement('h2');title.textContent=app.shared?'共有キャラクターシート':'オンライン保存';
 const status=document.createElement('p');status.className='online-status';status.setAttribute('role','status');
 panel.append(title,status);
 if(!cfg.url||!cfg.publishableKey){
  if(app.shared){document.querySelector('.head').after(panel);status.textContent='オンライン保存の接続設定がまだ完了していません。'}
  return;
 }
 document.querySelector('.head').after(panel);
 let client, user=null, current=null, busy=false, dirty=true;
 const message=t=>{status.textContent=t};
 const controls=document.createElement('div');panel.append(controls);
 function button(text,fn){const b=document.createElement('button');b.className='btn';b.textContent=text;b.onclick=()=>run(fn);return b}
 function field(text,type='text'){const l=document.createElement('label'),i=document.createElement('input');l.append(document.createTextNode(text),i);i.type=type;return {l,i}}
 function showError(e){message(e.message?.includes('revision_conflict')?'別の画面で更新されています。JSON出力で手元の編集を残し、オンラインのシートを開き直してください。':`処理できませんでした。${e.message||'接続を確認してください。'}`)}
 async function run(fn){if(busy)return;busy=true;panel.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn()}catch(e){showError(e)}finally{busy=false;panel.querySelectorAll('button').forEach(b=>b.disabled=false)}}
 const unwrap=r=>{if(r.error)throw r.error;return r.data};
 async function owner(){const result=unwrap(await client.auth.getUser());if(!result.user)throw Error('ログインしてください。');return result.user}
 function setCurrent(row){current={id:row.id,revision:row.revision,share_token:row.share_token};dirty=false}
 function shareURL(token){const u=new URL(location.href);u.search='';u.hash=new URLSearchParams({sheet:token}).toString();return u.href}
 async function save(asNew=false){
  const u=await owner();if(u.id!==user?.id)throw Error('ログイン状態が変わりました。再読み込みしてください。');
  const snapshot=app.snapshot();
  if(new Blob([JSON.stringify(snapshot)]).size>3000000)throw Error('立ち絵を含むデータが大きすぎます。小さい画像に変更してください。');
  const row=unwrap(await client.rpc('refleet_save',{p_data:snapshot,p_id:asNew?null:current?.id||null,p_revision:asNew?null:current?.revision||null}));
  setCurrent(row);dirty=JSON.stringify(snapshot)!==JSON.stringify(app.snapshot());
  message(dirty?'保存中に新しい編集がありました。もう一度保存してください。':'オンラインに保存しました。');await list();return row;
 }
 const login=document.createElement('div'),account=document.createElement('div');account.hidden=true;
 const email=field('メールアドレス','email');email.i.autocomplete='email';
 const code=field('メールに届いた確認コード');code.i.inputMode='numeric';code.i.autocomplete='one-time-code';
 const send=button('確認コードを送信',async()=>{
  if(!email.i.reportValidity()||!email.i.value.trim())return;
  unwrap(await client.auth.signInWithOtp({email:email.i.value.trim()}));message('確認コードを送信しました。メールをご確認ください。');
 });
 const verify=button('ログイン',async()=>{unwrap(await client.auth.verifyOtp({email:email.i.value.trim(),token:code.i.value.trim(),type:'email'}));code.i.value='';await refreshAuth()});
 login.append(email.l,send,code.l,verify);controls.append(login,account);
 const who=document.createElement('p'),pick=document.createElement('select');pick.setAttribute('aria-label','保存したキャラクター');
 const actions=document.createElement('div');actions.className='online-actions';
 const link=field('閲覧用の共有URL');link.i.readOnly=true;link.i.className='share-url';link.l.hidden=true;
 async function list(){
  const rows=unwrap(await client.from('refleet_sheets').select('id,data->>name,revision,updated_at,share_token').order('updated_at',{ascending:false}));
  pick.replaceChildren();
  const empty=document.createElement('option');empty.value='';empty.textContent='保存したシートを選択';pick.append(empty);
  rows.forEach(row=>{const o=document.createElement('option');o.value=row.id;o.textContent=(row.name||'名称未設定')+' / '+new Date(row.updated_at).toLocaleString('ja-JP');pick.append(o)});
  if(current)pick.value=current.id;
 }
 const load=button('選択したシートを開く',async()=>{
  if(!pick.value)throw Error('シートを選択してください。');
  if(!confirm('現在の入力を選択したシートに置き換えます。未保存の内容は先にJSON出力してください。'))return;
  const row=unwrap(await client.from('refleet_sheets').select('*').eq('id',pick.value).single());
  app.load(row.data);setCurrent(row);link.l.hidden=!row.share_token;link.i.value=row.share_token?shareURL(row.share_token):'';message('オンラインのシートを開きました。');
 });
 const saveBtn=button('オンライン保存',()=>save());saveBtn.classList.add('primary');
 const saveNew=button('別シートとして保存',async()=>{await save(true);link.l.hidden=true;link.i.value=''});
 const share=button('保存して共有URLを発行',async()=>{
  if(!confirm('立ち絵・人物像・担当艦・メモを含むシート全体を、URLを知っている人が閲覧できるようにします。よろしいですか？'))return;
  await save();if(dirty)throw Error('新しい編集を保存してから共有してください。');
  const token=unwrap(await client.rpc('refleet_share',{p_id:current.id,p_enabled:true}));current.share_token=token;
  link.i.value=shareURL(token);link.l.hidden=false;message('共有URLを発行しました。このURLから閲覧できます。');
 });
 const stop=button('共有を停止',async()=>{
  if(!current)throw Error('保存済みのシートを開いてください。');
  unwrap(await client.rpc('refleet_share',{p_id:current.id,p_enabled:false}));current.share_token=null;link.l.hidden=true;link.i.value='';message('共有を停止しました。以前のURLでは読み込めなくなります。すでに閲覧・保存された内容は回収できません。');
 });
 const remove=button('オンラインのシートを削除',async()=>{
  if(!current)throw Error('削除するシートを開いてください。');
  if(!confirm('オンラインのシートを削除します。この操作は元に戻せません。手元の入力は残ります。'))return;
  const rows=unwrap(await client.from('refleet_sheets').delete().eq('id',current.id).select('id'));
  if(!rows.length)throw Error('削除対象が見つかりませんでした。');current=null;link.l.hidden=true;link.i.value='';await list();message('オンラインのシートを削除しました。');
 });
 const logout=button('ログアウト',async()=>{unwrap(await client.auth.signOut());await refreshAuth()});
 actions.append(saveBtn,saveNew,share,stop,remove,logout);account.append(who,pick,load,actions,link.l);
 const note=document.createElement('p');note.className='micro';note.textContent='オンライン保存はボタンを押した時点の内容です。ブラウザ内の自動保存とは別に保存します。';account.append(note);
 window.addEventListener('refleet:change',()=>{dirty=true;if(user&&!busy)message('編集内容はブラウザ内に保存されます。オンラインに反映するには「オンライン保存」を押してください。')});
 window.addEventListener('refleet:replace',()=>{current=null;dirty=true;link.l.hidden=true;link.i.value=''});
 async function refreshAuth(){
  const session=unwrap(await client.auth.getSession()).session;const next=session?.user||null;
  if(next?.id!==user?.id){current=null;link.l.hidden=true;link.i.value=''}
  user=next;login.hidden=!!user;account.hidden=!user;
  if(user){who.textContent=`ログイン中：${user.email}`;await list();message('保存したシートを開くか、現在の入力をオンライン保存できます。')}
  else message('メールの確認コードでログインできます。');
 }
 try{
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.0/+esm');
  client=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:!app.shared,detectSessionInUrl:false,autoRefreshToken:!app.shared}});
  if(app.shared){
   controls.replaceChildren();message('共有シートを読み込んでいます…');
   const token=new URLSearchParams(location.hash.slice(1)).get('sheet');
   if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(token||''))throw Error('共有URLが正しくありません。');
   const rows=unwrap(await client.rpc('refleet_read_shared',{p_token:token}));
   if(!rows.length)throw Error('共有が停止されたか、シートが削除されています。');
   app.load(rows[0].data);document.querySelector('.preview').hidden=false;
   message('閲覧専用 / 更新：'+new Date(rows[0].updated_at).toLocaleString('ja-JP'));
   const home=document.createElement('a');home.href=location.pathname;home.textContent='自分のキャラクターシートに戻る';controls.append(home);
  }else{
   await refreshAuth();client.auth.onAuthStateChange((event,session)=>{
    if((session?.user?.id||null)!==(user?.id||null))setTimeout(()=>run(refreshAuth),0);
   });
  }
 }catch(e){showError(e)}
})();

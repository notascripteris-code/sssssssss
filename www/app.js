(() => {
'use strict';
const C = window.KABOOM || {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mmss = s => Math.floor((s||0)/60) + ':' + String((s||0)%60).padStart(2,'0');
function toast(t){ const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2200); }
const empty = (b, t) => `<div class="empty"><b>${b}</b>${t||''}</div>`;
function ago(d){ const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 60 ? `před ${Math.max(m,1)} min` : m < 1440 ? `před ${Math.round(m/60)} h` : `před ${Math.round(m/1440)} d`; }

if (!C.url || /VLOZ/.test(C.url) || !window.supabase){
  $('#auth').hidden = false;
  $('#auth .panel').innerHTML = '<h2>Chybí nastavení</h2><p class="muted">Otevři soubor www/config.js a vlož adresu a klíč ze Supabase. Postup je v NAVOD.md. (Kdyby to bylo už hotové, zkontroluj připojení k internetu.)</p>';
  return;
}
const clean = s => String(s).replace(/[^\x21-\x7E]/g, '');
const sb = supabase.createClient(new URL(clean(C.url)).origin, clean(C.key));
const S = {me:null, scope:'all', sound:true, videos:[], lc:{}, mine:new Set(), fr:{acc:new Set(), inc:[], out:new Set()}, t:0};
const vid = id => S.videos.find(v => v.id === id);
const lk = v => S.lc[v.id] || 0;

/* ---------- data ---------- */
async function loadVideos(){
  const {data} = await sb.from('videos').select('*, profiles(id,username,emoji)').order('created_at', {ascending:false}).limit(80);
  S.videos = data || []; S.lc = {}; S.mine = new Set(); S.t = Date.now();
  const ids = S.videos.map(v => v.id);
  if (ids.length){
    const {data:l} = await sb.from('likes').select('video_id,user_id').in('video_id', ids);
    (l||[]).forEach(x => { S.lc[x.video_id] = (S.lc[x.video_id]||0) + 1; if (x.user_id === S.me.id) S.mine.add(x.video_id); });
  }
}
async function loadFriends(){
  const id = S.me.id, f = {acc:new Set(), inc:[], out:new Set()};
  const {data} = await sb.from('friendships').select('*').or(`requester.eq.${id},addressee.eq.${id}`);
  (data||[]).forEach(r => {
    const o = r.requester === id ? r.addressee : r.requester;
    if (r.status === 'accepted') f.acc.add(o); else if (r.addressee === id) f.inc.push(r); else f.out.add(o);
  });
  S.fr = f;
}
const vis = kind => S.videos.filter(v => v.kind === kind && (S.scope === 'all' || v.owner === S.me.id || S.fr.acc.has(v.owner)));
const nameOf = v => `<span class="lnk" data-u="${v.owner}">${esc(v.profiles?.username)}</span>`;

/* ---------- auth ---------- */
let mode = 'in';
$('#authSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  mode = b.dataset.m;
  $$('#authSeg button').forEach(x => x.classList.toggle('on', x === b));
  $('#aUser').hidden = mode === 'in';
  $('#aGo').textContent = mode === 'in' ? 'Přihlásit se' : 'Vytvořit účet';
});
$('#aGo').addEventListener('click', async () => {
  const err = $('#aErr'); err.textContent = '';
  const email = $('#aMail').value.trim(), password = $('#aPass').value;
  const username = $('#aUser').value.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
  if (!email || password.length < 6) return err.textContent = 'Zadej e-mail a heslo (aspoň 6 znaků).';
  if (mode === 'up' && (username.length < 3 || username.length > 20)) return err.textContent = 'Jméno musí mít 3 až 20 znaků (písmena, čísla, _ a .).';
  $('#aGo').disabled = true;
  if (mode === 'in'){
    const {data, error} = await sb.auth.signInWithPassword({email, password});
    if (error) err.textContent = 'Nepodařilo se přihlásit: ' + error.message; else await boot(data.user);
  } else {
    const {data, error} = await sb.auth.signUp({email, password});
    if (error) err.textContent = error.message;
    else if (!data.session) err.textContent = 'Účet vznikl. Potvrď ho e-mailem (nebo vypni Confirm email v Supabase) a přihlas se.';
    else { await sb.from('profiles').insert({id:data.user.id, username}); await boot(data.user); }
  }
  $('#aGo').disabled = false;
});
async function boot(u){
  let {data:p} = await sb.from('profiles').select('*').eq('id', u.id).maybeSingle();
  if (!p){
    const n = (prompt('Zvol si uživatelské jméno (3 až 20 znaků)') || '').trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
    const {data, error} = await sb.from('profiles').insert({id:u.id, username:n}).select().single();
    if (error){ toast('Jméno je obsazené nebo neplatné'); return boot(u); }
    p = data;
  }
  S.me = p; $('#auth').hidden = true; $('#navMe').textContent = p.emoji;
  await Promise.all([loadVideos(), loadFriends()]);
  go('home');
}
$('#auth').hidden = false;
sb.auth.getSession().then(({data:{session}}) => session ? boot(session.user) : null);

/* ---------- pages ---------- */
function page(title, html, onClose){ const p = $('#page'); p.hidden = false; p._close = onClose; $('#pageTitle').textContent = title; $('#pageBody').innerHTML = html; return $('#pageBody'); }
function closePage(){ const p = $('#page'); p.hidden = true; $('#pageBody').innerHTML = ''; const c = p._close; p._close = null; if (c) c(); }
$('#pageBack').addEventListener('click', closePage);

/* ---------- home (long) ---------- */
function card(v){
  return `<div class="card" data-v="${v.id}"><div class="thumb"><video src="${v.url}#t=0.5" muted preload="metadata" playsinline></video><span class="dur">${mmss(v.duration)}</span></div>
  <div class="meta"><div class="avatar" data-u="${v.owner}">${v.profiles?.emoji||'🙂'}</div><div><h3>${esc(v.title)}</h3><p>${nameOf(v)} · ${ago(v.created_at)} · <span data-lc="${v.id}">${lk(v)}</span> 💥</p></div></div></div>`;
}
function renderHome(){
  const l = vis('long');
  $('#grid').innerHTML = l.length ? l.map(card).join('') : empty('Tady zatím nic není', S.scope === 'friends' ? 'Přidej si kamarády přes 🔍 nebo nahraj vlastní video.' : 'Nahraj první video přes ＋ (typ Long).');
}
$('#scope').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.scope = b.dataset.s; $$('#scope button').forEach(x => x.classList.toggle('on', x === b)); renderHome(); });
function player(id){
  const v = vid(id); if (!v) return;
  const b = page(v.title, `<video class="pl" src="${v.url}" controls autoplay playsinline></video><div class="pbody"><h2>${esc(v.title)}</h2>
    <div class="who"><span class="avatar" data-u="${v.owner}">${v.profiles?.emoji||'🙂'}</span>${nameOf(v)}</div>
    <div class="actions"><button class="chip ${S.mine.has(v.id)?'liked':''}" data-like="${v.id}">💥 <span data-lc="${v.id}">${lk(v)}</span></button>
    <button class="chip" data-comment="${v.id}">💬 Komentáře</button><button class="chip" data-share="${v.id}">↗️ Sdílet</button></div></div>`,
    () => { const p = $('video', $('#pageBody')); if (p) p.pause(); });
  const p = $('video', b); p.play().catch(() => {});
}

/* ---------- shorts ---------- */
let io;
function renderShorts(){
  const box = $('#view-shorts'), l = vis('short');
  if (!l.length){ box.innerHTML = empty('Žádné shorty', 'Nahraj první přes ＋ nebo přepni filtr na Domů.'); return; }
  box.innerHTML = l.map(v => `<article class="reel" data-id="${v.id}"><video src="${v.url}" loop playsinline preload="auto"></video><div class="shade"></div>
    <div class="info"><div class="who"><span class="avatar" data-u="${v.owner}">${v.profiles?.emoji||'🙂'}</span>${nameOf(v)}</div><p>${esc(v.title)}</p></div>
    <div class="side"><button class="act ${S.mine.has(v.id)?'liked':''}" data-like="${v.id}"><span class="ico">💥</span><span data-lc="${v.id}">${lk(v)}</span></button>
    <button class="act" data-comment="${v.id}"><span class="ico">💬</span><span>Chat</span></button>
    <button class="act" data-share="${v.id}"><span class="ico">↗️</span><span>Sdílet</span></button></div></article>`).join('');
  if (io) io.disconnect();
  io = new IntersectionObserver(es => es.forEach(e => {
    const r = e.target, v = $('video', r);
    if (e.isIntersecting && e.intersectionRatio > .6){
      r.classList.add('live'); v.muted = !S.sound;
      v.play().catch(() => { v.muted = true; S.sound = false; updSnd(); v.play().catch(() => {}); toast('Klepni na 🔇 pro zapnutí zvuku'); });
    } else { r.classList.remove('live'); v.pause(); }
  }), {root: box, threshold: [0, .6]});
  $$('.reel', box).forEach(r => io.observe(r));
}
function updSnd(){ $('#snd').textContent = S.sound ? '🔊' : '🔇'; $$('#view-shorts .reel.live video').forEach(v => v.muted = !S.sound); }
$('#snd').addEventListener('click', () => { S.sound = !S.sound; updSnd(); const v = $('#view-shorts .reel.live video'); if (v && S.sound) v.play().catch(() => {}); });
let lastTap = 0;
$('#view-shorts').addEventListener('click', e => {
  if (e.target.closest('button,.lnk,.avatar')) return;
  const r = e.target.closest('.reel'); if (!r) return;
  const now = Date.now();
  if (now - lastTap < 300){
    if (!S.mine.has(r.dataset.id)) toggleLike(r.dataset.id);
    const b = document.createElement('div'); b.className = 'burst'; b.textContent = '💥';
    b.style.left = (e.clientX - 48) + 'px'; b.style.top = (e.clientY - 120) + 'px';
    r.appendChild(b); setTimeout(() => b.remove(), 800);
  } else { const v = $('video', r); v.paused ? v.play().catch(() => {}) : v.pause(); }
  lastTap = now;
});

/* ---------- likes, comments ---------- */
async function toggleLike(id){
  const on = S.mine.has(id);
  if (on){ S.mine.delete(id); S.lc[id] = Math.max(0, (S.lc[id]||1) - 1); await sb.from('likes').delete().match({video_id:id, user_id:S.me.id}); }
  else { S.mine.add(id); S.lc[id] = (S.lc[id]||0) + 1; await sb.from('likes').insert({video_id:id, user_id:S.me.id}); }
  $$(`[data-like="${id}"]`).forEach(b => b.classList.toggle('liked', !on));
  $$(`[data-lc="${id}"]`).forEach(s => s.textContent = S.lc[id]);
}
let sheetId = null;
async function openSheet(id){
  sheetId = id; $('#sheet').hidden = false; $('#comments').innerHTML = '<p class="muted">Načítám…</p>';
  const {data} = await sb.from('comments').select('body,user_id,profiles(username,emoji)').eq('video_id', id).order('created_at');
  $('#sheetTitle').textContent = `Komentáře (${(data||[]).length})`;
  $('#comments').innerHTML = (data||[]).map(c => `<div class="cm"><span class="avatar" data-u="${c.user_id}">${c.profiles?.emoji||'🙂'}</span><div><b>${esc(c.profiles?.username)}</b><p>${esc(c.body)}</p></div></div>`).join('') || empty('Zatím nic', 'Napiš první komentář.');
  $('#comments').scrollTop = 1e6;
}
async function sendComment(){
  const i = $('#cInput'), body = i.value.trim(); if (!body || !sheetId) return;
  i.value = ''; const {error} = await sb.from('comments').insert({video_id:sheetId, user_id:S.me.id, body});
  if (error) toast('Komentář se nepodařilo odeslat'); else openSheet(sheetId);
}
$('#cSend').addEventListener('click', sendComment);
$('#cInput').addEventListener('keydown', e => e.key === 'Enter' && sendComment());
$('#sheetClose').addEventListener('click', () => $('#sheet').hidden = true);
$('#sheetBg').addEventListener('click', () => $('#sheet').hidden = true);

/* ---------- upload ---------- */
let kind = 'short', file = null;
$('#kindSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; kind = b.dataset.k;
  $$('#kindSeg button').forEach(x => x.classList.toggle('on', x === b));
  $('#kindHint').textContent = kind === 'short' ? 'Short je krátké video na celou obrazovku, nejvýš 90 sekund.' : 'Long je delší video, které se ukáže na hlavní stránce.';
});
$('#file').addEventListener('change', e => {
  file = e.target.files[0]; if (!file) return;
  const p = $('#preview'); p.src = URL.createObjectURL(file); p.hidden = false;
  $('#dropText').textContent = file.name;
  if (!$('#title').value) $('#title').value = file.name.replace(/\.[^.]+$/, '');
});
$('#publish').addEventListener('click', async () => {
  const title = $('#title').value.trim(), p = $('#preview'), btn = $('#publish');
  if (!file) return toast('Nejdřív vyber video');
  if (!title) return toast('Napiš název');
  const dur = Math.round(p.duration) || 0;
  if (kind === 'short' && dur > 90) return toast('Short může mít nejvýš 90 s. Zvol Long.');
  btn.disabled = true; btn.textContent = 'Nahrávám, chvíli počkej…';
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  const path = `${S.me.id}/${Date.now()}.${ext}`;
  const up = await sb.storage.from('videos').upload(path, file, {contentType: file.type || 'video/mp4'});
  if (up.error){ toast('Nahrání selhalo: ' + up.error.message); btn.disabled = false; btn.textContent = 'Publikovat'; return; }
  const url = sb.storage.from('videos').getPublicUrl(path).data.publicUrl;
  const ins = await sb.from('videos').insert({owner:S.me.id, title, kind, url, duration:dur});
  btn.disabled = false; btn.textContent = 'Publikovat';
  if (ins.error) return toast('Uložení selhalo: ' + ins.error.message);
  file = null; $('#file').value = ''; $('#title').value = ''; p.removeAttribute('src'); p.hidden = true; $('#dropText').textContent = 'Vybrat video z telefonu';
  toast('Publikováno 💥'); await loadVideos(); go(kind === 'short' ? 'shorts' : 'home');
});

/* ---------- profiles & friends ---------- */
const row = p => `<div class="row" data-u="${p.id}"><span class="avatar">${p.emoji||'🙂'}</span><b>${esc(p.username)}</b></div>`;
async function renderProfile(el, uid){
  el.innerHTML = '<p class="muted" style="padding:20px">Načítám…</p>';
  const own = uid === S.me.id;
  const {data:p} = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (!p){ el.innerHTML = empty('Profil nenalezen'); return; }
  const vids = S.videos.filter(v => v.owner === uid), inc = S.fr.inc.find(r => r.requester === uid);
  let act = '', extra = '';
  if (!own) act = S.fr.acc.has(uid) ? `<button class="btn ghost" data-unf="${uid}">Přátelé ✓ (zrušit)</button>`
    : inc ? `<button class="btn" data-acc="${inc.id}">Přijmout žádost</button>`
    : S.fr.out.has(uid) ? `<button class="btn ghost" disabled>Žádost odeslána</button>`
    : `<button class="btn" data-add="${uid}">Přidat do přátel</button>`;
  else {
    const ids = [...S.fr.inc.map(r => r.requester), ...S.fr.acc];
    const {data:ps} = ids.length ? await sb.from('profiles').select('id,username,emoji').in('id', ids) : {data:[]};
    const pm = Object.fromEntries((ps||[]).map(x => [x.id, x]));
    extra = (S.fr.inc.length ? '<h3 class="sec">Žádosti o přátelství</h3>' + S.fr.inc.map(r => `<div class="row"><span class="avatar" data-u="${r.requester}">${pm[r.requester]?.emoji||'🙂'}</span><b class="lnk" data-u="${r.requester}">${esc(pm[r.requester]?.username)}</b><button class="btn small" data-acc="${r.id}">Přijmout</button></div>`).join('') : '')
      + `<h3 class="sec">Přátelé (${S.fr.acc.size})</h3>` + ([...S.fr.acc].map(id => row(pm[id] || {id, username:'?'})).join('') || '<p class="muted" style="padding:0 16px">Najdeš je přes 🔍 nahoře.</p>');
    act = `<button class="btn ghost" id="editProf">Upravit profil</button><button class="btn ghost" id="logout">Odhlásit se</button>`;
  }
  const mini = (l, w) => l.map(v => `<div class="mini ${w?'wide':''}" data-v="${v.id}"><video src="${v.url}#t=0.5" muted preload="metadata" playsinline></video></div>`).join('');
  const sh = vids.filter(v => v.kind === 'short'), lg = vids.filter(v => v.kind === 'long');
  el.innerHTML = `<div class="prof"><div class="avatar">${p.emoji}</div><h2>@${esc(p.username)}</h2><p class="muted">${esc(p.bio) || (own ? 'Přidej si popis v Upravit profil' : '')}</p>
    <div class="stats"><div><b>${vids.length}</b>videí</div></div>${act}</div>${extra}
    ${sh.length ? `<h3 class="sec">Shorts</h3><div class="grid3">${mini(sh)}</div>` : ''}
    ${lg.length ? `<h3 class="sec">Videa</h3><div class="grid2">${mini(lg, 1)}</div>` : ''}
    ${!vids.length ? empty('Zatím žádná videa') : ''}`;
}
function showProfile(uid){
  if (uid === S.me.id && !$('#page').hidden) closePage();
  if (uid === S.me.id) return go('profile');
  renderProfile(page('Profil', ''), uid);
}
async function refreshProfileViews(){
  await loadFriends();
  if (!$('#page').hidden && $('.prof', $('#pageBody'))) { const h = $('#pageBody'); const id = h.dataset.uid; if (id) renderProfile(h, id); }
  if ($('#view-profile').classList.contains('active')) renderProfile($('#view-profile'), S.me.id);
}
async function search(q){
  const {data} = await sb.from('profiles').select('id,username,emoji').ilike('username', `%${q}%`).limit(25);
  const b = page('Hledání: ' + q, (data||[]).filter(p => p.id !== S.me.id).map(row).join('') || empty('Nikdo takový tu není'));
}
$('#btnSearch').addEventListener('click', () => { const s = $('#searchbar'); s.hidden = !s.hidden; if (!s.hidden) $('#q').focus(); });
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.value.trim()) search(e.target.value.trim().replace(/[%,]/g, '')); });

/* ---------- live ---------- */
const ICE = {iceServers:[{urls:'stun:stun.l.google.com:19302'}, {urls:'stun:stun1.l.google.com:19302'}]};
async function renderLive(){
  const box = $('#view-live');
  box.innerHTML = `<div class="panel"><h2>Live</h2><p class="muted">Vysílej s kamerou a pozvi kamarády. V jedné místnosti může být nejvýš 5 lidí.</p>
    <input id="lTitle" class="field" maxlength="60" placeholder="Název live (nepovinné)" style="margin-top:14px"><button class="btn" id="goLive">🔴 Spustit live</button>
    <div style="display:flex;gap:8px;margin-top:14px"><input id="lCode" class="field" maxlength="6" placeholder="Kód místnosti" autocapitalize="characters"><button class="btn small ghost" id="joinCode" style="flex:none">Připojit</button></div></div>
    <h3 class="sec">Právě živě u tebe a přátel</h3><div id="rooms"><p class="muted" style="padding:0 16px">Načítám…</p></div>`;
  const {data} = await sb.from('live_rooms').select('*, profiles(username,emoji)').eq('is_live', true).gt('created_at', new Date(Date.now() - 864e5).toISOString()).order('created_at', {ascending:false});
  const l = (data||[]).filter(r => r.host === S.me.id || S.fr.acc.has(r.host));
  $('#rooms').innerHTML = l.map(r => `<div class="live-card" data-room='${esc(JSON.stringify(r.id))}'><span class="avatar">${r.profiles?.emoji||'🙂'}</span><div style="flex:1"><b>${esc(r.title||'Live')}</b><div class="muted">@${esc(r.profiles?.username)}</div></div><span class="tag">LIVE</span></div>`).join('') || '<p class="muted" style="padding:0 16px">Nikdo teď nevysílá.</p>';
  S.rooms = Object.fromEntries(l.map(r => [r.id, r]));
}
async function startLive(){
  const title = ($('#lTitle').value.trim()) || ('Live od ' + S.me.username);
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const {data, error} = await sb.from('live_rooms').insert({host:S.me.id, title, code}).select().single();
  if (error) return toast('Live se nepodařilo spustit');
  joinRoom(data);
}
async function joinCode(){
  const code = $('#lCode').value.trim().toUpperCase(); if (!code) return;
  const {data} = await sb.from('live_rooms').select('*').eq('code', code).eq('is_live', true).maybeSingle();
  if (!data) return toast('Místnost s tímto kódem neexistuje'); joinRoom(data);
}
async function joinRoom(room){
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}, audio:true}); }
  catch { try { stream = await navigator.mediaDevices.getUserMedia({audio:true}); toast('Kamera není dostupná, jen zvuk'); }
    catch { toast('Povol v telefonu kameru a mikrofon'); if (room.host === S.me.id) sb.from('live_rooms').update({is_live:false}).eq('id', room.id); return; } }
  const me = S.me, peers = {}, streams = {}, tiles = {}; let state = {};
  const mine = {name:me.username, emoji:me.emoji, cam:stream.getVideoTracks().length > 0, mic:true};
  const ch = sb.channel('live:' + room.id, {config:{presence:{key:me.id}}});
  const body = page(room.title || 'Live', `<div id="tiles"></div><div class="livebar"><button id="bMic">🎤</button><button id="bCam">📷</button><button id="bInv">➕</button><button class="leave" id="bLeave">✕</button></div>`, () => {
    stream.getTracks().forEach(t => t.stop()); Object.values(peers).forEach(p => { try { p.close(); } catch {} });
    sb.removeChannel(ch); if (room.host === me.id) sb.from('live_rooms').update({is_live:false}).eq('id', room.id);
  });
  const draw = () => {
    const g = $('#tiles', body); if (!g) return;
    const ids = new Set([me.id, ...Object.keys(state)]);
    Object.keys(tiles).forEach(k => { if (!ids.has(k)){ tiles[k].remove(); delete tiles[k]; } });
    ids.forEach(id => {
      const st = id === me.id ? mine : (state[id] || {});
      let t = tiles[id];
      if (!t){ t = tiles[id] = document.createElement('div'); t.className = 'tile'; t.innerHTML = '<video autoplay playsinline></video><div class="off"></div><div class="nm"></div>'; g.appendChild(t); if (id === me.id) $('video', t).muted = true; }
      const v = $('video', t), src = id === me.id ? stream : streams[id];
      if (src && v.srcObject !== src){ v.srcObject = src; v.play().catch(() => {}); }
      t.classList.toggle('camoff', st.cam === false);
      $('.off', t).textContent = st.emoji || '🙂';
      $('.nm', t).textContent = (st.name || '…') + (st.mic === false ? ' 🔇' : '');
    });
    g.dataset.n = ids.size;
  };
  const send = (to, d) => ch.send({type:'broadcast', event:'sig', payload:{to, from:me.id, ...d}});
  const drop = uid => { const p = peers[uid]; if (p){ try { p.close(); } catch {} delete peers[uid]; } delete streams[uid]; draw(); };
  const pc = uid => {
    if (peers[uid]) return peers[uid];
    const p = peers[uid] = new RTCPeerConnection(ICE); p.q = [];
    stream.getTracks().forEach(t => p.addTrack(t, stream));
    p.onicecandidate = e => e.candidate && send(uid, {c:e.candidate});
    p.ontrack = e => { streams[uid] = e.streams[0]; draw(); };
    p.onconnectionstatechange = () => { if (p.connectionState === 'failed') drop(uid); };
    return p;
  };
  ch.on('presence', {event:'sync'}, () => { state = {}; for (const [k, a] of Object.entries(ch.presenceState())) if (k !== me.id) state[k] = a[a.length - 1]; draw(); });
  ch.on('presence', {event:'leave'}, ({key}) => drop(key));
  ch.on('broadcast', {event:'hello'}, async ({payload}) => {
    const u = payload.from; if (u === me.id) return;
    if (Object.keys(peers).length >= 4 && !peers[u]) return;
    drop(u); const p = pc(u); await p.setLocalDescription(await p.createOffer()); send(u, {d:p.localDescription});
  });
  ch.on('broadcast', {event:'sig'}, async ({payload}) => {
    if (payload.to !== me.id) return;
    const p = pc(payload.from);
    try {
      if (payload.d){
        await p.setRemoteDescription(payload.d); p.q.forEach(c => p.addIceCandidate(c)); p.q = [];
        if (payload.d.type === 'offer'){ await p.setLocalDescription(await p.createAnswer()); send(payload.from, {d:p.localDescription}); }
      } else if (payload.c){ p.remoteDescription ? p.addIceCandidate(payload.c) : p.q.push(payload.c); }
    } catch (e) { console.warn(e); }
  });
  ch.subscribe(async s => { if (s === 'SUBSCRIBED'){ await ch.track(mine); ch.send({type:'broadcast', event:'hello', payload:{from:me.id}}); draw(); } });
  $('#bMic', body).onclick = e => { mine.mic = !mine.mic; stream.getAudioTracks().forEach(t => t.enabled = mine.mic); e.currentTarget.classList.toggle('off', !mine.mic); ch.track(mine); draw(); };
  $('#bCam', body).onclick = e => { mine.cam = !mine.cam; stream.getVideoTracks().forEach(t => t.enabled = mine.cam); e.currentTarget.classList.toggle('off', !mine.cam); ch.track(mine); draw(); };
  $('#bInv', body).onclick = async () => {
    const text = `Připoj se k mému live na Kaboom! Kód místnosti: ${room.code}`;
    if (navigator.share) navigator.share({title:'Kaboom live', text}).catch(() => {});
    else { try { await navigator.clipboard.writeText(text); toast('Pozvánka zkopírována'); } catch { toast('Kód: ' + room.code); } }
  };
  $('#bLeave', body).onclick = closePage;
  draw();
}

/* ---------- navigation & events ---------- */
async function go(t){
  if (!S.me) return;
  if (Date.now() - S.t > 20000 && (t === 'home' || t === 'shorts')) await loadVideos();
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + t));
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $('#top').style.display = t === 'shorts' ? 'none' : '';
  $('#snd').hidden = t !== 'shorts';
  if (t !== 'shorts') $$('#view-shorts video').forEach(v => v.pause());
  if (t === 'home') renderHome();
  if (t === 'shorts'){ renderShorts(); updSnd(); }
  if (t === 'live') renderLive();
  if (t === 'profile') renderProfile($('#view-profile'), S.me.id);
}
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b){ if (!$('#page').hidden) closePage(); go(b.dataset.tab); } });
$('#logo').addEventListener('click', () => go('home'));

document.addEventListener('click', async e => {
  const t = e.target, g = sel => t.closest(sel);
  let el;
  if ((el = g('[data-u]'))){ if (g('.reel,#sheet,#page,.card,.mini,.row,.live-card,#view-profile,#view-home')) return showProfile(el.dataset.u); }
  if ((el = g('[data-like]'))) return toggleLike(el.dataset.like);
  if ((el = g('[data-comment]'))) return openSheet(el.dataset.comment);
  if ((el = g('[data-share]'))){ const v = vid(el.dataset.share); if (navigator.share) navigator.share({title:'Kaboom', text:v.title + ' (od @' + v.profiles?.username + ')'}).catch(() => {}); else toast('Sdílení tu není k dispozici'); return; }
  if ((el = g('[data-add]'))){ const {error} = await sb.from('friendships').insert({requester:S.me.id, addressee:el.dataset.add}); toast(error ? 'Nepodařilo se odeslat' : 'Žádost odeslána'); await loadFriends(); return rerender(el.dataset.add); }
  if ((el = g('[data-acc]'))){ await sb.from('friendships').update({status:'accepted'}).eq('id', el.dataset.acc); toast('Jste přátelé 🎉'); await loadFriends(); return rerender(); }
  if ((el = g('[data-unf]'))){ if (!confirm('Opravdu zrušit přátelství?')) return; const id = S.me.id, o = el.dataset.unf; await sb.from('friendships').delete().or(`and(requester.eq.${id},addressee.eq.${o}),and(requester.eq.${o},addressee.eq.${id})`); await loadFriends(); return rerender(o); }
  if ((el = g('.card,.mini'))){ if (el.dataset.v) return player(el.dataset.v); }
  if ((el = g('[data-room]'))){ const r = S.rooms[JSON.parse(el.dataset.room)]; if (r) return joinRoom(r); }
  if (t.id === 'goLive') return startLive();
  if (t.id === 'joinCode') return joinCode();
  if (t.id === 'logout'){ await sb.auth.signOut(); location.reload(); return; }
  if (t.id === 'editProf'){
    const emoji = prompt('Tvoje ikonka (jedno emoji)', S.me.emoji); const bio = prompt('Popis profilu', S.me.bio || '');
    const upd = {}; if (emoji && emoji.trim()) upd.emoji = [...emoji.trim()].slice(0, 2).join(''); if (bio !== null) upd.bio = bio.slice(0, 120);
    const {data} = await sb.from('profiles').update(upd).eq('id', S.me.id).select().single();
    if (data){ S.me = data; $('#navMe').textContent = data.emoji; await loadVideos(); renderProfile($('#view-profile'), S.me.id); }
  }
});
function rerender(uid){
  const pg = $('#pageBody');
  if (!$('#page').hidden && $('.prof', pg) && uid) return renderProfile(pg, uid);
  if ($('#view-profile').classList.contains('active')) return renderProfile($('#view-profile'), S.me.id);
  if (uid) showProfile(uid);
}
})();

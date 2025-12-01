// GitHub-ready app.js
// Loads posts.json (breaking/ latest / weather / jobs / alerts), merges, renders.
// Weather via Open-Meteo (no API key). Optional Inshorts live merge.

const POSTS_JSON = 'posts.json';
const POLL_MS = 30000; // 30s

// DOM
const featuredEl = document.getElementById('featured');
const feedEl = document.getElementById('feed');
const weatherEl = document.getElementById('weatherContent');
const jobsEl = document.getElementById('jobs');
const trendingEl = document.getElementById('trending');
const updatedEl = document.getElementById('updated');
const refreshBtn = document.getElementById('refresh');
const loadMoreBtn = document.getElementById('loadMore');
const shareX = document.getElementById('shareX');
const shareWA = document.getElementById('shareWA');
const yearEl = document.getElementById('year');

yearEl && (yearEl.textContent = new Date().getFullYear());

let POSTS = {};
let mergedFeed = [];
let shown = 0;
const PAGE_SIZE = 6;

function esc(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); }

async function loadPostsJson(){
  try{
    const res = await fetch(POSTS_JSON, {cache:'no-store'});
    if(!res.ok) throw new Error('posts.json not found');
    POSTS = await res.json();
  }catch(e){
    console.warn('Could not load posts.json:', e);
    POSTS = { breaking:[], latest:[], weather:[], jobs:[], alerts:[] };
  }
}

function buildMerged(){
  const order = ['breaking','latest','alerts','weather','jobs'];
  const combined = [];
  for(const k of order){
    if(Array.isArray(POSTS[k])){
      for(const p of POSTS[k]) combined.push(Object.assign({}, p, {category:k}));
    }
  }
  const seen = new Set(), out=[];
  for(const it of combined){
    const key = (it.title||'').slice(0,140);
    if(seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  mergedFeed = out;
}

function renderFeatured(){
  featuredEl.innerHTML = '';
  if(POSTS.breaking && POSTS.breaking.length){
    const main = POSTS.breaking[0];
    const left = document.createElement('div');
    left.className = 'card';
    left.innerHTML = `<h2>${esc(main.title)}</h2><p>${esc(main.desc)}</p><div class="meta">${esc(main.time)}</div>`;
    featuredEl.appendChild(left);
    // side quick list
    const side = document.createElement('div');
    side.style.marginTop = '12px';
    POSTS.breaking.slice(1,5).forEach(b=>{
      const c = document.createElement('div'); c.className='card'; c.style.padding='10px'; c.innerHTML = `<strong>${esc(b.title)}</strong><div class="meta">${esc(b.time)}</div>`;
      side.appendChild(c);
    });
    featuredEl.appendChild(side);
  }
}

function makeCard(item){
  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = `<h3>${esc(item.title)}</h3><p>${esc(item.desc||'')}</p><div class="meta">${esc((item.category||'').toUpperCase())} • ${esc(item.time||item.publishedAt||'')}</div><div style="margin-top:8px"><a href="${item.url||'#'}" target="_blank">Read more</a></div>`;
  return div;
}

function renderFeed(reset=false){
  if(!feedEl) return;
  if(reset){ feedEl.innerHTML=''; shown=0; }
  const end = Math.min(mergedFeed.length, shown + PAGE_SIZE);
  for(let i=shown;i<end;i++){
    feedEl.appendChild(makeCard(mergedFeed[i]));
    if((i+1)%4===0){
      const ad = document.createElement('div'); ad.className='ad'; ad.textContent='Ad placeholder — replace with AdSense'; feedEl.appendChild(ad);
    }
  }
  shown = end;
  if(loadMoreBtn) loadMoreBtn.style.display = shown >= mergedFeed.length ? 'none' : 'block';
}

function renderJobs(){
  if(!jobsEl) return;
  jobsEl.innerHTML = '';
  const list = POSTS.jobs || [];
  if(!list.length){ jobsEl.textContent='No jobs'; return; }
  for(const j of list.slice(0,6)){
    const d = document.createElement('div'); d.className='job'; d.innerHTML = `<strong>${esc(j.title)}</strong><div class="small">${esc(j.desc)}</div><div class="small">${esc(j.time)}</div><a href="${j.url||'#'}" target="_blank">View</a>`;
    jobsEl.appendChild(d);
  }
}

function computeTrending(){
  if(!trendingEl) return;
  const text = mergedFeed.slice(0,40).map(i=>i.title||'').join(' ').toLowerCase();
  const words = text.replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean);
  const stop = new Set(['the','and','in','of','to','for','a','is','on','with','by','from','jammu','kashmir','srinagar','jk']);
  const freq = {};
  for(const w of words){ if(w.length<3 || stop.has(w)) continue; freq[w] = (freq[w]||0)+1; }
  const tags = Object.keys(freq).sort((a,b)=>freq[b]-freq[a]).slice(0,12);
  trendingEl.innerHTML = ''; tags.forEach(t=>{ const n=document.createElement('div'); n.className='tag'; n.textContent=t; trendingEl.appendChild(n); });
}

async function loadWeather(){
  if(!weatherEl) return;
  weatherEl.textContent = 'Loading weather...';
  try{
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=34.0837&longitude=74.7973&current_weather=true');
    if(!res.ok) throw new Error('weather API failed');
    const j = await res.json();
    const w = j.current_weather;
    weatherEl.innerHTML = `<div style="font-size:22px;font-weight:700">${Math.round(w.temperature)}°C</div><div class="small muted">Wind ${w.windspeed} m/s • WMO ${w.weathercode}</div>`;
  }catch(e){ weatherEl.textContent='Weather not available'; console.warn(e); }
}

async function fetchLiveNews(){
  try{
    const res = await fetch('https://inshortsapi.vercel.app/news?category=national');
    if(!res.ok) throw new Error('live news failed');
    const j = await res.json();
    if(Array.isArray(j.data)){
      const live = j.data.slice(0,4).map(a=>({title:a.title,desc:a.content,publishedAt:new Date().toISOString(),url:a.readMoreUrl||'#',category:'latest'}));
      for(const it of live.reverse()){ if(!mergedFeed.find(x=>x.title && x.title===it.title)) mergedFeed.unshift(it); }
    }
  }catch(e){ /* ignore */ }
}

function updateShare(){
  const u = encodeURIComponent(location.href); const t = encodeURIComponent('Taaza Jammu & Kashmir news — check this out!');
  if(shareX) shareX.href = `https://twitter.com/intent/tweet?text=${t}&url=${u}`;
  if(shareWA) shareWA.href = `https://api.whatsapp.com/send?text=${t}%20${u}`;
}

async function refreshAll(first=false){
  if(updatedEl) updatedEl.textContent = 'Updating...';
  await loadPostsJson();
  buildMerged();
  renderFeatured();
  await fetchLiveNews();
  renderFeed(true);
  renderJobs();
  computeTrending();
  await loadWeather();
  updateShare();
  if(updatedEl) updatedEl.textContent = 'Updated ' + new Date().toLocaleTimeString();
  if(first) window.scrollTo({top:0,behavior:'smooth'});
}

// UI
refreshBtn && refreshBtn.addEventListener('click', ()=>refreshAll(true));
loadMoreBtn && loadMoreBtn.addEventListener('click', ()=>renderFeed(false));

// init
refreshAll(true);
setInterval(()=>refreshAll(false), POLL_MS);
window.addEventListener('scroll', ()=>{ if((window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 600)) renderFeed(false); });

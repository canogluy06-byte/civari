/* =====================================================
   CİVARİ — İstemci Mantığı (v3)
   ===================================================== */
/* API'ye ulaşılamazsa gösterilen yedek liste — 5 GERÇEK Ankara vitrin mekanı
   (veritabanındaki kayıtların birebir kopyası; uydurma mekan dönemi kapandı). */
const yedekMekanlar = [
    { id: 1, rating: null, lat: 39.909422, lng: 32.858773, image_url: '', name: 'Dharma Coffee', category: 'Kafe', city: 'Ankara', district: 'Çankaya', price_level: 2, review_count: 0, phone: '+90 05XX XXX XX XX', opening_hours: 'Mo-Fr 10:30-22:30; Sa-Su 11:00-23:00', address: 'Bestekar Sk. No:42/A, Kavaklıdere', verified: 1 },
    { id: 2, rating: null, lat: 39.914888, lng: 32.857980, image_url: '', name: 'Kakule Kahve', category: 'Kafe', city: 'Ankara', district: 'Çankaya', price_level: 2, review_count: 0, phone: '+90 05XX XXX XX XX', opening_hours: 'Mo-Su 09:00-23:00', address: 'Kızılırmak Cad. No:17/B, Kavaklıdere', verified: 1 },
    { id: 3, rating: null, lat: 39.921944, lng: 32.856944, image_url: '', name: 'Göksu Lokantası', category: 'Restoran', city: 'Ankara', district: 'Çankaya', price_level: 2, review_count: 0, phone: '+90 312 431 47 27', opening_hours: 'Mo-Sa 11:00-01:00; Su off', address: 'Bayındır-1 Sk. No:22, Kızılay', verified: 1 },
    { id: 4, rating: null, lat: 39.920251, lng: 32.856160, image_url: '', name: 'Flamingo Pastanesi', category: 'Tatlıcı', city: 'Ankara', district: 'Çankaya', price_level: 2, review_count: 0, phone: '+90 312 417 57 44', opening_hours: 'Mo-Fr 07:00-21:00; Sa-Su 07:00-20:00', address: 'Selanik Cad. No:30/A, Kızılay', verified: 1 },
    { id: 5, rating: null, lat: 39.902627, lng: 32.860076, image_url: '', name: 'Kıtır', category: 'Bar', city: 'Ankara', district: 'Çankaya', price_level: 1, review_count: 0, phone: '+90 312 426 01 37', opening_hours: 'Mo-Su 12:00-24:00', address: 'Tunalı Hilmi Cad. No:114/K, Kavaklıdere', verified: 1 }
];
const categories = [
    { id: 'all', label: 'Tümü', icon: 'layout-grid' },
    { id: 'Restoran', label: 'Restoran', icon: 'utensils' },
    { id: 'Kafe', label: 'Kafe', icon: 'coffee' },
    { id: 'Tatlıcı', label: 'Tatlıcı', icon: 'cake' },
    { id: 'Bar', label: 'Bar', icon: 'wine' }
];
/* Kategoriye göre harita pini rengi (OSM verisini görsel olarak ayırır) */
const CAT_COLORS = {
    'Restoran':'#e11d48', 'Kafe':'#c2761b', 'Bar':'#7c3aed', 'Tatlıcı':'#ec4899',
    'Eğlence':'#db2777', 'Doğa':'#15803d', 'Kamp':'#0f766e', 'Market':'#d97706',
    'Ders & Kitap':'#2563eb', 'Eczane':'#059669', 'Konaklama':'#4f46e5'
};
function catColor(c){ return CAT_COLORS[c] || '#ff9900'; }

/* Puan: gerçek puan yoksa (OSM mekanı) "Yeni" döndürür — asla sahte 0.0 gösterme */
function ratingInfo(v){
    const ra = (v.review_avg != null && +v.review_avg > 0) ? +v.review_avg : null;
    const rt = (v.rating    != null && +v.rating    > 0) ? +v.rating    : null;
    const val = ra != null ? ra : rt;
    return (val != null) ? { isNew:false, val: val.toFixed(1) } : { isNew:true, val:null };
}

/* Canlı durum: OSM opening_hours'tan "açık / az sonra kapanıyor / kapalı".
   Yalnızca güvenle çözülen yaygın biçimleri değerlendirir; belirsizse 'unknown' (yalan söylemez). */
function openStatus(v){
    const oh = String(v.opening_hours || '').trim();
    if (!oh) return { s:'unknown' };
    if (/24\s*\/\s*7/.test(oh)) return { s:'open', label:'24 saat açık' };
    const DAY = { Mo:1, Tu:2, We:3, Th:4, Fr:5, Sa:6, Su:0 };
    const now = new Date();
    const today = now.getDay();
    const mins = now.getHours()*60 + now.getMinutes();
    let sawRule = false;
    for (let raw of oh.split(';')) {
        let r = raw.trim();
        if (!r || /off|closed/i.test(r)) continue;
        r = r.replace(/PH|SH/g, '').trim();
        let dayPart = '', timePart = r;
        const m = r.match(/^([A-Za-z,\-\s]+?)\s+(\d.*)$/);
        if (m) { dayPart = m[1].trim(); timePart = m[2].trim(); }
        let dayOk = !dayPart;
        if (dayPart) {
            for (let seg of dayPart.split(',')) {
                seg = seg.trim();
                const rng = seg.split('-');
                if (rng.length === 2 && DAY[rng[0]] != null && DAY[rng[1]] != null) {
                    let d = DAY[rng[0]]; const end = DAY[rng[1]];
                    for (let k=0;k<7;k++){ if (d===today) dayOk=true; if (d===end) break; d=(d+1)%7; }
                } else if (DAY[seg] === today) dayOk = true;
            }
        }
        if (!dayOk) continue;
        const ranges = timePart.match(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/g);
        if (!ranges) continue;
        sawRule = true;
        for (const t of ranges) {
            const p = t.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
            let a = +p[1]*60 + +p[2], b = +p[3]*60 + +p[4];
            if (b === 0) b = 1440;
            if (b <= a) b += 1440; // gece yarısını aşan
            if (mins >= a && mins < b) return (b - mins <= 30) ? { s:'soon', label:'Az sonra kapanıyor' } : { s:'open', label:'Şu an açık' };
        }
    }
    return sawRule ? { s:'closed', label:'Şu an kapalı' } : { s:'unknown' };
}

/* ===== MOOD (moda göre) PILL'LER ===== */
const MOODS = [
    { icon:'☕', label:'Çalışmalık kafe',  q:'kafe' },
    { icon:'🍽️', label:'Akşam yemeği',     q:'restoran' },
    { icon:'🍰', label:'Tatlı molası',     q:'tatlı' },
    { icon:'🎒', label:'Öğrenci bütçesi',  q:'ucuz öğrenci' },
    { icon:'🌙', label:'Gece çıkışı',      q:'bar gece' },
];
function renderMoods(){
    const el=document.getElementById('moodBar'); if(!el) return;
    el.innerHTML=MOODS.map((m,i)=>`<button class="mood-pill" onclick="applyMood(${i})"><span class="mp-emoji">${m.icon}</span>${m.label}</button>`).join('');
}
function applyMood(i){
    const m=MOODS[i]; if(!m) return;
    const si=document.getElementById('searchInput'); if(si) si.value=m.q;
    searchQuery=m.q; currentCat='all'; favFilter=false; distanceMode=false; areaBbox=null;
    document.querySelectorAll('.mood-pill').forEach((p,idx)=>p.classList.toggle('active',idx===i));
    updateActiveCat();
    loadVenues(true);
    scrollToGrid();
}

/* ===== VİTRİN — Ankara'da Öne Çıkanlar (5 gerçek mekan) =====
   Ana sayfanın tepesindeki vitrin şeridi. Doğrulanmış (verified=1) mekanları
   çeker; her kart mekanın kendi sayfasına (mekan.php) gider — Google da bu
   bağlantılar üzerinden mekan sayfalarını indeksler. */
async function renderVitrin(){
    const el=document.getElementById('vitrin'); if(!el) return;
    let list=[];
    try{
        const res=await fetch('get_venues.php?limit=8&sort=rating');
        const data=await res.json();
        const all=(data&&Array.isArray(data.venues))?data.venues:[];
        list=all.filter(v=>+v.verified===1);
        if(!list.length) list=all;
    }catch(e){ list=yedekMekanlar.slice(); }
    list.sort((a,b)=>(+a.id)-(+b.id)); // vitrin sırası sabit kalsın (eklenme sırası)
    list=list.slice(0,6);
    const wrap=document.getElementById('vitrinWrap');
    if(!list.length){ if(wrap) wrap.classList.add('hidden'); return; }
    if(wrap) wrap.classList.remove('hidden');
    const SHORT={open:'Şu an açık',soon:'Kapanıyor',closed:'Kapalı'};
    el.innerHTML=list.map(v=>{
        const st=openStatus(v);
        return `<a class="vitrin-card" href="mekan.php?id=${encodeURIComponent(v.id)}" style="--cc:${catColor(v.category)}">
            ${v.image_url
                ? `<div class="vc-img" style="background-image:url('${escapeAttr(v.image_url)}')"></div>`
                : `<div class="vc-img vc-cover"><span>${escapeHtml((v.name||'?').charAt(0))}</span></div>`}
            <div class="vc-body">
                <div class="vc-name">${escapeHtml(v.name)}</div>
                <div class="vc-meta">${escapeHtml(v.category)}${v.district?' · '+escapeHtml(v.district):''}</div>
                ${st.s!=='unknown'?`<span class="status-pill ${st.s}"><span class="dot"></span>${SHORT[st.s]}</span>`:''}
            </div>
        </a>`;
    }).join('');
}

/* Seviye / Unvan Sistemi */
const LEVELS = [
    { lvl:1, title:'Çaylak Gezgin',       min:0,   perk:'Profilde temel rozet, mekanlara puan verebilme.' },
    { lvl:2, title:'Mahalle Sakini',      min:5,   perk:'Yorumlara fotoğraf ekleme özelliği açılır.' },
    { lvl:3, title:'Cadde Kurdu',         min:15,  perk:'Yorumların "Faydalı" olarak oylanabilir.' },
    { lvl:4, title:'Mekan Gurusu',        min:30,  perk:'Profil kartı renklenir, popüler yorumlarda öncelik.' },
    { lvl:5, title:'Muhtar',              min:60,  perk:'Rozet parlar, hatalı bilgi bildirimlerin doğrudan onaylanır.' },
    { lvl:6, title:'Fahri Hemşehri',      min:100, perk:'Yeni mekan önerme (ekleme) hakkı.' },
    { lvl:7, title:'Ayan Meclisi Üyesi',  min:150, perk:'Profiline "Bölge Uzmanı" başlığı.' },
    { lvl:8, title:'Kâşif-i Azam',        min:220, perk:'Moderatör / şikayet önceliği yetkisi.' },
    { lvl:9, title:'Şehrin Anahtarı',     min:300, perk:'Özel profil teması (Gold / Dark Elite).' },
    { lvl:10,title:'Evliya Çelebi',       min:500, perk:'Efsane statüsü, "Yazar Kadrosu"na dahil olma.' }
];
function getLevel(count){
    let cur = LEVELS[0];
    for (const l of LEVELS) if (count >= l.min) cur = l;
    const next = LEVELS.find(l => l.min > count) || null;
    return { cur, next };
}
let myProfile = null;

let rawVenues = [], venues = [];
let currentCat = 'all', searchQuery = '', sortMode = 'recommended';
let favFilter = false, favIds = new Set();
let userPos = null, userMarker = null;
let centerPos = { lat: 39.9208, lng: 32.8541 }; // varsayılan tarama merkezi (Ankara/Kızılay)
let browseRadius = 30;   // km — merkez etrafında tarama yarıçapı
let areaBbox = null;     // "Bu alanda ara" için harita sınırları (S,W,N,E)
let cityName = 'Ankara';
let mapReady = false;
let mapVenues = null;    // harita kendi (yoğun) veri setini tutar — grid sayfalamasından bağımsız
let map = null, markersLayer = null, searchTimer = null, markerById = {};
let page = 1, pageLimit = 20, hasMore = true, loadingMore = false, distanceMode = false;
let totalVenues = 0, allVenuesCount = 0, currentVenue = null, pinsDropped = false;
let currentUser = null, currentVenueId = null, selectedRating = 5;
let reviewPhotoFile = null;

/* ===== KEŞİF (sis kalkması) ===== */
let discovered = new Set();
try { const s = JSON.parse(localStorage.getItem('civari_discovered') || '[]'); discovered = new Set(s.map(Number)); } catch(e){}
function saveDiscovered(){ try { localStorage.setItem('civari_discovered', JSON.stringify([...discovered])); } catch(e){} }
function markDiscovered(id){
    id = Number(id);
    if (discovered.has(id)) return false;
    discovered.add(id); saveDiscovered(); updateDiscoveryUI();
    return true;
}
function updateDiscoveryUI(){
    const el = document.getElementById('discoveryCount');
    if (el) el.innerText = discovered.size + '/' + (allVenuesCount || totalVenues || rawVenues.length || 0);
}

/* ===== ANİMASYON YARDIMCILARI ===== */
function fireConfetti(opts){
    if (typeof confetti !== 'function') return;
    const prefersReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduce) return;
    confetti(Object.assign({ particleCount: 70, spread: 65, origin: { y: 0.7 }, colors: ['#ff9900','#ea580c','#fbbf24','#f43f5e'] }, opts || {}));
}
function heartBurst(x, y){
    const prefersReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduce) return;
    for (let i=0;i<6;i++){
        const h=document.createElement('div'); h.className='heart-particle'; h.textContent='❤';
        h.style.left=x+'px'; h.style.top=y+'px';
        h.style.setProperty('--dx',(Math.random()*60-30)+'px');
        h.style.setProperty('--dy',(-40-Math.random()*40)+'px');
        document.body.appendChild(h);
        setTimeout(()=>h.remove(),900);
    }
}

/* ===== VERİ & GÖRÜNÜM ===== */
async function loadVenues(reset=true){
    if(reset){ page=1; rawVenues=[]; hasMore=true; mapVenues=null; } // filtre değişti -> harita da tazelensin
    const loader=document.getElementById('gridLoader');
    if(reset) renderSkeleton(); else if(loader) loader.classList.remove('hidden');
    try{
        const params=new URLSearchParams();
        if(searchQuery) params.append('q',searchQuery);
        if(currentCat&&currentCat!=='all') params.append('category',currentCat);
        params.append('sort', sortMode);
        params.append('page', page);
        params.append('limit', pageLimit);
        // Konum: "Bu alanda ara" öncelikli; yoksa merkez (GPS varsa hassas konum) + yarıçap
        if(areaBbox){ params.append('bbox', areaBbox); }
        else {
            const c = (distanceMode && userPos) ? userPos : centerPos;
            if(c){ params.append('lat', c.lat); params.append('lng', c.lng); params.append('radius', distanceMode?80:browseRadius); }
        }
        const res=await fetch('get_venues.php?'+params.toString());
        const data=await res.json();
        const arr=(data&&Array.isArray(data.venues))?data.venues:[];
        if(reset) rawVenues=arr; else rawVenues=rawVenues.concat(arr);
        hasMore = !!(data&&data.hasMore);
        totalVenues = (data&&data.total!=null)?data.total:rawVenues.length;
        if(!searchQuery && currentCat==='all' && !favFilter && !areaBbox) allVenuesCount=totalVenues;
    }catch(e){
        if(reset && !searchQuery && currentCat==='all'){ rawVenues=yedekMekanlar.slice(); totalVenues=rawVenues.length; allVenuesCount=totalVenues; hasMore=false; }
    }
    if(loader) loader.classList.add('hidden');
    applyView();
    const sv=document.getElementById('statVenues'); if(sv) sv.innerText=allVenuesCount||totalVenues||rawVenues.length;
}
async function loadMoreVenues(){
    if(!hasMore||loadingMore||favFilter) return;
    loadingMore=true; page++;
    await loadVenues(false);
    loadingMore=false;
}

function applyView(){
    if(favFilter){
        const favs=(myProfile&&myProfile.favorites)?myProfile.favorites:[];
        let list=favs.slice();
        if(userPos) list.forEach(v=>{ v._dist=haversine(userPos.lat,userPos.lng,parseFloat(v.lat),parseFloat(v.lng)); });
        venues=list; renderVenues(); syncMap(); return;
    }
    let list=rawVenues.slice();
    if(userPos) list.forEach(v=>{ v._dist=haversine(userPos.lat,userPos.lng,parseFloat(v.lat),parseFloat(v.lng)); });
    if(distanceMode && userPos) list.sort((a,b)=>(a._dist||1e9)-(b._dist||1e9));
    venues=list;
    renderVenues();
    syncMap();
}
/* Harita açıksa yoğun veri setini tazele; değilse mevcut pinleri güncelle */
function syncMap(){
    if(!map) return;
    const mapVisible = !document.getElementById('view-map').classList.contains('hidden');
    if(mapVisible && mapVenues===null) loadMapVenues(true);
    else updateMapMarkers();
}

function renderSkeleton(){
    document.getElementById('venueGrid').innerHTML=Array(6).fill('<div class="skeleton"><div class="sk-img"></div><div class="sk-line"></div><div class="sk-line short"></div></div>').join('');
}
function priceStr(l){ l=parseInt(l)||0; return l?'₺'.repeat(l):''; }
function formatDist(km){ if(km==null) return ''; return km<1?Math.round(km*1000)+' m':km.toFixed(1)+' km'; }

function renderVenues(){
    const grid=document.getElementById('venueGrid');
    document.getElementById('gridTitle').innerText = favFilter ? 'Favorilerim' : (currentCat==='all'?'Yakınlarda Popüler':(categories.find(c=>c.id===currentCat)?.label||'Sonuçlar'));
    document.getElementById('gridCount').innerText = (favFilter ? venues.length : (totalVenues||venues.length)) + ' mekan';

    if(venues.length===0){
        grid.innerHTML=`<div class="empty-state"><i data-lucide="map-pin-off"></i><p>${favFilter?'Henüz favori mekanın yok.':'Aradığın kriterlere uygun mekan bulunamadı.'}</p></div>`;
        if(window.lucide) lucide.createIcons(); return;
    }
    const SHORT={open:'Açık',soon:'Kapanıyor',closed:'Kapalı'};
    grid.innerHTML=venues.map((v,i)=>{
        const rc=parseInt(v.review_count||0);
        const faved=favIds.has(Number(v.id));
        const disc=discovered.has(Number(v.id));
        const ri=ratingInfo(v);
        const st=openStatus(v);
        const distKm = (v._dist!=null)?v._dist : (v.dist!=null?parseFloat(v.dist):null);
        const dist=distKm!=null?`<div class="dist-badge"><i data-lucide="navigation"></i> ${formatDist(distKm)}</div>`:'';
        const ratingBadge = ri.isNew ? `<div class="card-rating new">Yeni</div>` : `<div class="card-rating"><span class="star">★</span> ${ri.val}</div>`;
        const statusPill = st.s!=='unknown' ? `<span class="status-pill ${st.s}"><span class="dot"></span>${SHORT[st.s]}</span>` : '';
        return `
        <div class="card" style="transition-delay:${Math.min(i,12)*55}ms" onclick="openDetail(${v.id})" onmouseenter="highlightPin(${v.id})" onmouseleave="unhighlightPin(${v.id})" ontouchstart="highlightPin(${v.id})">
            <div class="card-img-wrap">
                ${v.image_url
                    ? `<img src="${escapeAttr(v.image_url)}" class="card-img" alt="${escapeAttr(v.name)}, ${escapeAttr(v.category)}" loading="lazy" onload="this.classList.add('loaded')" onerror="this.remove()">`
                    : `<div class="card-cover" style="--cc:${catColor(v.category)}"><span class="cover-initial">${escapeHtml((v.name||'?').charAt(0))}</span><span class="cover-cat">${escapeHtml(v.category)}</span></div>`}
                <button class="fav-btn card-fav ${faved?'faved':''}" aria-label="Favorilere ekle veya çıkar" onclick="toggleFav(${v.id}, event)"><i data-lucide="heart"></i></button>
                ${ratingBadge}
                ${dist}
            </div>
            <div class="card-body">
                <div class="card-title">${escapeHtml(v.name)}</div>
                <div class="card-foot">
                    <span class="foot-left"><span class="tag" style="--cc:${catColor(v.category)}">${escapeHtml(v.category)}</span>${statusPill}</span>
                    <span class="card-reviews">${rc>0?rc+' yorum':(priceStr(v.price_level)||'')}</span>
                </div>
            </div>
        </div>`;
    }).join('');
    if(window.lucide) lucide.createIcons();
    grid.querySelectorAll('img.card-img').forEach(img=>{ if(img.complete) img.classList.add('loaded'); });
    updateDiscoveryUI();
    requestAnimationFrame(()=>document.querySelectorAll('.card').forEach(c=>c.classList.add('reveal')));
}

/* ===== DETAY + YORUM ===== */
async function openDetail(id){
    const v=venues.find(x=>x.id==id)||rawVenues.find(x=>x.id==id)||(mapVenues&&mapVenues.find(x=>x.id==id)); if(!v) return;
    currentVenueId=v.id; currentVenue=v;
    // Keşif: ilk kez açılıyorsa sis kalksın
    const newlyFound=markDiscovered(v.id);
    if(newlyFound){ if(map&&markersLayer) updateMapMarkers(); }
    // Buradayım: 100 m içindeyse aktif
    const ci=document.getElementById('checkinBtn');
    if(ci){
        let near=false;
        if(currentUser && userPos){ const d=haversine(userPos.lat,userPos.lng,parseFloat(v.lat),parseFloat(v.lng)); near=(d<=0.1); }
        ci.classList.toggle('hidden', !near);
    }
    /* Görsel alanı: galeri varsa kaydırmalı şerit, tek foto varsa büyük görsel,
       hiç yoksa kategori renginde kapak */
    const di=document.getElementById('detailImg');
    const fotolar=(v.gallery ? String(v.gallery).split('|').filter(Boolean) : (v.image_url ? [v.image_url] : []));
    di.classList.toggle('no-photo', fotolar.length===0);
    di.classList.toggle('has-gallery', fotolar.length>1);
    di.style.backgroundImage='';
    if(fotolar.length>1){
        di.style.removeProperty('--cc');
        di.innerHTML=`<div class="dg-strip">${fotolar.map((u,i)=>
            `<img src="${escapeAttr(u)}" alt="${escapeAttr(v.name)} — fotoğraf ${i+1}" loading="${i<2?'eager':'lazy'}" onerror="this.remove()">`
        ).join('')}</div><span class="dg-say">1/${fotolar.length}</span>`;
        const serit=di.querySelector('.dg-strip'), sayac=di.querySelector('.dg-say');
        serit.addEventListener('scroll',()=>{
            const gen=serit.clientWidth||1;
            const n=Math.min(fotolar.length, Math.round(serit.scrollLeft/gen)+1);
            sayac.textContent=n+'/'+fotolar.length;
        },{passive:true});
    } else if(fotolar.length===1){
        di.style.removeProperty('--cc'); di.innerHTML='';
        di.style.backgroundImage=`url('${fotolar[0]}')`;
    } else {
        di.style.setProperty('--cc',catColor(v.category));
        di.innerHTML=`<span class="cover-initial">${escapeHtml((v.name||'?').charAt(0))}</span>`;
    }
    document.getElementById('detailCat').innerText=v.category;
    document.getElementById('detailPrice').innerText=priceStr(v.price_level);
    document.getElementById('detailName').innerText=v.name;
    const ri=ratingInfo(v);
    const st=openStatus(v);
    const stPill = st.s!=='unknown' ? ` <span class="status-pill ${st.s}"><span class="dot"></span>${st.label}</span>` : '';
    document.getElementById('detailRating').innerHTML=(ri.isNew?'<span class="rating-new">Yeni</span>':('★ '+ri.val+' / 5.0'))+stPill;
    document.getElementById('detailLoc').innerHTML=`<i data-lucide="map-pin"></i> ${escapeHtml(v.address||v.city||cityName)}`;
    document.getElementById('detailDesc').innerText=v.description||'Bu mekan hakkında detaylı bilgi yakında eklenecek.';

    document.getElementById('detailMapBtn').onclick=()=>{ closeModal('detailModal'); switchView('map'); setTimeout(()=>{ if(map) map.setView([v.lat,v.lng],16); },400); };
    document.getElementById('detailDirBtn').onclick=()=>window.open(`https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}`,'_blank');
    document.getElementById('detailCallBtn').onclick=()=>{ if(v.phone){ location.href='tel:'+String(v.phone).replace(/\s/g,''); } else Swal.fire('Bilgi','Bu mekan için telefon numarası eklenmemiş.','info'); };
    document.getElementById('detailShareBtn').onclick=()=>shareVenue(v);
    const pageBtn=document.getElementById('detailPageBtn'); if(pageBtn) pageBtn.href='mekan.php?id='+encodeURIComponent(v.id);

    // Favori kalbi
    const fav=document.getElementById('detailFav');
    fav.classList.toggle('faved', favIds.has(Number(v.id)));

    // Yorumlar (giriş gerekli)
    const locked=document.getElementById('reviewLocked'), area=document.getElementById('reviewsArea'), badge=document.getElementById('reviewCount');
    if(currentUser){
        locked.classList.add('hidden'); area.classList.remove('hidden');
        const age = myProfile ? myProfile.age : null;
        const underage = (age !== null && age !== undefined && age < 18);
        const ageLock=document.getElementById('reviewAgeLock');
        const form=document.getElementById('reviewForm');
        if(underage){ ageLock.classList.remove('hidden'); form.classList.add('hidden'); }
        else {
            ageLock.classList.add('hidden'); form.classList.remove('hidden');
            buildStarPicker(); document.getElementById('reviewText').value=''; resetReviewPhoto();
            const rc = myProfile ? myProfile.review_count : 0;
            const row=document.getElementById('reviewPhotoRow');
            const pick=row.querySelector('.photo-pick'); const note=document.getElementById('photoLockNote');
            row.classList.remove('hidden');
            if(rc>=5){ pick.style.display='inline-flex'; note.style.display='none'; }
            else { pick.style.display='none'; note.style.display='inline'; }
        }
        loadReviews(v.id);
    } else { area.classList.add('hidden'); locked.classList.remove('hidden'); badge.innerText=''; }
    openModal('detailModal');
    if(window.lucide) lucide.createIcons();
}

async function shareVenue(v){
    const text=`${v.name} — Civari'de keşfet!`;
    /* Mekanın kendi sayfası paylaşılır (ana sayfa değil) — link açan kişi doğrudan mekanı görür */
    const url=location.origin+location.pathname.replace(/[^/]*$/,'')+'mekan.php?id='+encodeURIComponent(v.id);
    if(navigator.share){ try{ await navigator.share({title:v.name,text,url}); }catch(e){} }
    else { try{ await navigator.clipboard.writeText(text+' '+url); Swal.fire({icon:'success',title:'Kopyalandı',text:'Bağlantı panoya kopyalandı.',timer:1400,showConfirmButton:false}); }catch(e){ Swal.fire('Paylaş',text,'info'); } }
}

async function loadReviews(venueId){
    const list=document.getElementById('reviewsList'), badge=document.getElementById('reviewCount');
    list.innerHTML='<p style="color:#94a3b8;padding:10px 0;">Yorumlar yükleniyor...</p>';
    try{
        const res=await fetch('reviews.php?venue_id='+venueId);
        const data=await res.json(); const reviews=data.reviews||[];
        badge.innerText=data.count||0;
        if(reviews.length===0){ list.innerHTML='<p style="color:#94a3b8;padding:10px 0;">Henüz yorum yok. İlk yorumu sen yap!</p>'; return; }
        list.innerHTML=reviews.map(r=>`
            <div class="review-item">
                <div class="review-avatar">${escapeHtml((r.user_name||'?').charAt(0).toUpperCase())}</div>
                <div class="review-content">
                    <div class="review-head"><span class="review-name">${escapeHtml(r.user_name)}</span><span class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span></div>
                    <div class="review-text">${escapeHtml(r.comment)}</div>
                    ${r.image_url?`<img class="rv-photo" src="${escapeAttr(r.image_url)}" onerror="this.style.display='none'" alt="yorum görseli">`:''}
                    <div class="review-date">${formatDate(r.created_at)}</div>
                    ${Number(r.mine)?`<button class="rv-del" onclick="deleteReview(${r.id})">Yorumu Sil</button>`:''}
                </div>
            </div>`).join('');
    }catch(e){ list.innerHTML='<p style="color:#ef4444;padding:10px 0;">Yorumlar yüklenemedi.</p>'; }
}
function buildStarPicker(){ selectedRating=5; document.getElementById('starPick').innerHTML=[1,2,3,4,5].map(n=>`<span data-n="${n}" onclick="setStar(${n})">★</span>`).join(''); paintStars(); }
function setStar(n){ selectedRating=n; paintStars(); }
function paintStars(){ document.querySelectorAll('#starPick span').forEach(s=>s.classList.toggle('on',parseInt(s.dataset.n)<=selectedRating)); }
async function submitReview(e){
    e.preventDefault();
    const text=document.getElementById('reviewText').value.trim(); if(!text) return;
    const btn=e.target.querySelector('button[type=submit]'); if(btn) btn.innerText='Gönderiliyor...';
    const beforeLvl = getLevel(myProfile?myProfile.review_count:0).cur.lvl;
    let imageUrl='';
    if(reviewPhotoFile && myProfile && myProfile.review_count>=5){
        const up=await uploadImage(reviewPhotoFile,'review');
        if(up && up.status==='success' && up.url) imageUrl=up.url;
    }
    const fd=new FormData(); fd.append('action','add'); fd.append('venue_id',currentVenueId); fd.append('rating',selectedRating); fd.append('comment',text); if(imageUrl) fd.append('image_url',imageUrl);
    try{
        const res=await fetch('reviews.php',{method:'POST',body:fd}); const r=await res.json();
        if(r.status==='success'){ document.getElementById('reviewText').value=''; buildStarPicker(); resetReviewPhoto(); loadReviews(currentVenueId); await loadProfile(); updateLevelBadge();
            const rc=myProfile?myProfile.review_count:0; const pick=document.querySelector('#reviewPhotoRow .photo-pick'); const note=document.getElementById('photoLockNote');
            if(pick&&note){ if(rc>=5){pick.style.display='inline-flex';note.style.display='none';}else{pick.style.display='none';note.style.display='inline';} }
            const afterLvl=getLevel(rc).cur.lvl;
            if(afterLvl>beforeLvl){
                if(navigator.vibrate) navigator.vibrate([60,40,120]);
                fireConfetti({ particleCount: 160, spread: 100, origin:{y:0.6} });
                setTimeout(()=>fireConfetti({ particleCount: 80, angle: 60, spread: 70, origin:{x:0} }), 200);
                setTimeout(()=>fireConfetti({ particleCount: 80, angle: 120, spread: 70, origin:{x:1} }), 200);
                const lv=getLevel(rc).cur;
                Swal.fire({ title:'🎉 Seviye Atladın!', html:`Artık <b>${lv.title}</b> (Seviye ${lv.lvl}) oldun!<br><span style="color:#64748b;font-size:.9rem">${escapeHtml(lv.perk)}</span>`, confirmButtonColor:'#ff9900', confirmButtonText:'Harika!' });
            } else {
                fireConfetti({ particleCount: 60 });
                Swal.fire({icon:'success',title:'Teşekkürler!',text:r.message,timer:1500,showConfirmButton:false});
            }
        }
        else Swal.fire('Uyarı',r.message||'Yorum eklenemedi.','warning');
    }catch(err){ Swal.fire('Bağlantı Hatası','Sunucuya ulaşılamadı.','error'); }
    if(btn) btn.innerText='Yorum Gönder';
}
function previewReviewPhoto(input){
    const f=input.files[0]; reviewPhotoFile=f||null;
    const prev=document.getElementById('reviewPhotoPreview');
    if(f){ prev.src=URL.createObjectURL(f); prev.classList.remove('hidden'); }
    else { prev.classList.add('hidden'); prev.src=''; }
}
function resetReviewPhoto(){
    reviewPhotoFile=null;
    const inp=document.getElementById('reviewPhoto'); if(inp) inp.value='';
    const prev=document.getElementById('reviewPhotoPreview'); if(prev){ prev.classList.add('hidden'); prev.src=''; }
}
async function uploadImage(file, type){
    const fd=new FormData(); fd.append('file',file); fd.append('type',type);
    try{ const res=await fetch('upload.php',{method:'POST',body:fd}); return await res.json(); }catch(e){ return null; }
}
async function deleteReview(id){
    const ok=await Swal.fire({title:'Yorum silinsin mi?',icon:'warning',showCancelButton:true,confirmButtonText:'Sil',cancelButtonText:'Vazgeç',confirmButtonColor:'#ef4444'});
    if(!ok.isConfirmed) return;
    const fd=new FormData(); fd.append('action','delete'); fd.append('id',id);
    try{ const res=await fetch('reviews.php',{method:'POST',body:fd}); const r=await res.json();
        if(r.status==='success'){
            if(currentVenueId && document.getElementById('detailModal').classList.contains('open')) loadReviews(currentVenueId);
            await loadProfile(); updateLevelBadge();
            if(document.getElementById('profileModal').classList.contains('open')) renderProfile();
            Swal.fire({icon:'success',title:'Silindi',timer:1200,showConfirmButton:false});
        } else Swal.fire('Uyarı',r.message||'Silinemedi','warning');
    }catch(e){ Swal.fire('Bağlantı Hatası','Sunucuya ulaşılamadı.','error'); }
}
async function uploadAvatar(input){
    const file=input.files[0]; if(!file) return;
    Swal.fire({title:'Yükleniyor...',didOpen:()=>Swal.showLoading(),allowOutsideClick:false});
    const up=await uploadImage(file,'avatar');
    if(up && up.status==='success'){
        /* Sunucudan taze profil çek — böylece fotoğrafın gerçekten kaydedildiğini
           doğrulamış oluruz (yalnızca ekranda güncellemek yanıltıcıydı). */
        await loadProfile();
        if(myProfile && !myProfile.avatar) myProfile.avatar=up.url;
        renderProfile();
        Swal.close();
        Swal.fire({icon:'success',title:'Profil fotoğrafı güncellendi',timer:1300,showConfirmButton:false});
    } else {
        Swal.close();
        Swal.fire('Hata',(up&&up.message)||'Yüklenemedi','error');
    }
    input.value='';
}

/* ===== FAVORİLER ===== */
async function loadFavorites(){
    if(!currentUser){ favIds=new Set(); return; }
    try{ const res=await fetch('favorites.php'); const r=await res.json(); favIds=new Set((r.ids||[]).map(Number)); }catch(e){ favIds=new Set(); }
}
async function toggleFav(id, event){
    if(event){ event.stopPropagation(); }
    if(!currentUser){ Swal.fire({icon:'info',title:'Giriş gerekli',text:'Favorilere eklemek için giriş yap.',confirmButtonText:'Giriş Yap'}).then(()=>openAuthModal()); return; }
    const fd=new FormData(); fd.append('action','toggle'); fd.append('venue_id',id);
    try{
        const res=await fetch('favorites.php',{method:'POST',body:fd}); const r=await res.json();
        if(r.status==='success'){
            if(r.favorited) favIds.add(Number(id)); else favIds.delete(Number(id));
            const df=document.getElementById('detailFav'); if(currentVenueId==id&&df) df.classList.toggle('faved',r.favorited);
            // Tatmin edici animasyon (sadece eklerken)
            if(r.favorited && event){
                const btn=event.currentTarget;
                if(btn){ btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); const rect=btn.getBoundingClientRect(); heartBurst(rect.left+rect.width/2, rect.top+rect.height/2); }
            }
            applyView();
            renderChips();
        }
    }catch(e){}
}
async function toggleFavFilter(){
    if(!currentUser){ Swal.fire({icon:'info',title:'Giriş gerekli',text:'Favorilerini görmek için giriş yap.',confirmButtonText:'Giriş Yap'}).then(()=>openAuthModal()); return; }
    favFilter=!favFilter; areaBbox=null; mapVenues=null;
    if(favFilter) await loadProfile(); // güncel favori listesi
    renderChips(); applyView();
}

/* ===== PROFİL & SEVİYE ===== */
async function loadProfile(){
    if(!currentUser){ myProfile=null; return; }
    try{ const res=await fetch('profile.php'); const r=await res.json(); if(r.status==='success') myProfile=r; }catch(e){ myProfile=null; }
}
function updateLevelBadge(){
    const b=document.getElementById('userLevelBadge'); if(!b) return;
    const c=myProfile?myProfile.review_count:0;
    b.innerText='Lv '+getLevel(c).cur.lvl;
}
async function openProfile(){
    if(!currentUser){ openAuthModal(); return; }
    openModal('profileModal');
    await loadProfile();
    renderProfile();
}
function renderProfile(){
    const p=myProfile||{fullname:currentUser,email:'',phone:'',avatar:'',age:null,birth_year:null,review_count:0,points:0,reviews:[],favorites:[]};
    const li=getLevel(p.review_count);
    const av=document.getElementById('profileAvatar');
    if(p.avatar){ av.style.backgroundImage=`url('${p.avatar}')`; av.innerText=''; }
    else { av.style.backgroundImage=''; av.innerText=(p.fullname||'?').charAt(0).toUpperCase(); }
    document.getElementById('profileName').innerText=p.fullname||currentUser;
    document.getElementById('profileTitle').innerText=li.cur.title;
    document.getElementById('profileLevelText').innerText='Seviye '+li.cur.lvl;
    const badge=document.getElementById('userLevelBadge'); if(badge) badge.innerText='Lv '+li.cur.lvl;

    const cur=document.getElementById('lvCurrent'), nx=document.getElementById('lvNextInfo'), fill=document.getElementById('lvFill');
    cur.innerText='Lv '+li.cur.lvl+' · '+p.review_count+' yorum';
    if(li.next){ const span=li.next.min-li.cur.min; const prog=(p.review_count-li.cur.min)/span*100; fill.style.width=Math.min(100,Math.max(5,prog))+'%'; nx.innerText='Sonraki: '+li.next.title+' ('+(li.next.min-p.review_count)+' yorum kaldı)'; }
    else { fill.style.width='100%'; nx.innerText='En yüksek seviye! 🏆'; }

    document.getElementById('pane-seviye').innerHTML=LEVELS.map(l=>{
        const cls=p.review_count>=l.min?(l.lvl===li.cur.lvl?'cur':'done'):'';
        return `<div class="lvl-row ${cls}"><div class="lvl-ico">${l.lvl}</div><div class="lvl-meta"><div class="lvl-name">${l.title}</div><div class="lvl-sub">${l.perk}</div></div><div class="lvl-req">${l.min}+</div></div>`;
    }).join('');

    document.getElementById('pane-iletisim').innerHTML=`
        <div class="pf-field"><label>Ad Soyad</label><input value="${escapeAttr(p.fullname)}" disabled></div>
        <div class="pf-field"><label>E-posta</label><input value="${escapeAttr(p.email)}" disabled></div>
        <div class="pf-field"><label>Doğum Yılı ${p.age!=null?'· '+p.age+' yaşında':''}</label><input value="${escapeAttr(p.birth_year||'—')}" disabled></div>
        <div class="pf-field"><label>Telefon</label><input id="pfPhone" value="${escapeAttr(p.phone||'')}" placeholder="05xx xxx xx xx"></div>
        <button class="btn-primary" onclick="saveContact()">Bilgileri Kaydet</button>`;

    document.getElementById('pane-cuzdan').innerHTML=`
        <div class="wallet-card"><div class="w-label">Civari Puan Bakiyen</div><div class="w-amount">${p.points} <span style="font-size:1rem;">puan</span></div></div>
        <p class="wallet-note">Her yorumun için <strong>10 puan</strong> kazanırsın. Puanların seviyeni yükseltir ve ileride mekanlarda indirim/kampanyalarda kullanılabilecek.</p>`;

    const fav=p.favorites||[];
    document.getElementById('pane-favoriler').innerHTML=fav.length?fav.map(v=>`<div class="pf-item" onclick="openFromProfile(${v.id})"><img src="${escapeAttr(v.image_url)}" onerror="this.style.display='none'"><div class="pf-info"><div class="pf-name">${escapeHtml(v.name)}</div><div class="pf-cat">${escapeHtml(v.category)} · ★ ${parseFloat(v.rating).toFixed(1)}</div></div></div>`).join(''):'<div class="pf-empty">Henüz favori mekanın yok.</div>';

    const rv=p.reviews||[];
    document.getElementById('pane-yorumlar').innerHTML=rv.length?rv.map(r=>`<div class="pf-review"><div class="pf-rv-top"><span class="pf-rv-venue">${escapeHtml(r.venue||'Mekan')}</span><span class="pf-rv-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span></div><div class="pf-rv-text">${escapeHtml(r.comment)}</div>${r.image_url?`<img class="rv-photo" src="${escapeAttr(r.image_url)}" onerror="this.style.display='none'">`:''}<div class="review-date">${formatDate(r.created_at)}</div><button class="rv-del" onclick="deleteReview(${r.id})">Sil</button></div>`).join(''):'<div class="pf-empty">Henüz yorum yapmadın. Bir mekana yorum bırak!</div>';

    if(window.lucide) lucide.createIcons();
}
function profileTab(name, btn){
    ['seviye','iletisim','cuzdan','favoriler','yorumlar'].forEach(n=>document.getElementById('pane-'+n).classList.toggle('hidden', n!==name));
    document.querySelectorAll('.ptab').forEach(t=>t.classList.remove('active')); btn.classList.add('active');
}
async function saveContact(){
    const phone=document.getElementById('pfPhone').value.trim();
    const fd=new FormData(); fd.append('action','update_contact'); fd.append('phone',phone);
    try{ const res=await fetch('profile.php',{method:'POST',body:fd}); const r=await res.json();
        if(r.status==='success'){ if(myProfile) myProfile.phone=phone; Swal.fire({icon:'success',title:'Kaydedildi',timer:1200,showConfirmButton:false}); }
        else Swal.fire('Hata',r.message||'Kaydedilemedi','error');
    }catch(e){ Swal.fire('Bağlantı Hatası','Sunucuya ulaşılamadı.','error'); }
}
function openFromProfile(id){ closeModal('profileModal'); setTimeout(()=>openDetail(id),250); }

/* ===== KONUM / MESAFE ===== */
function haversine(lat1,lon1,lat2,lon2){
    const R=6371,toRad=x=>x*Math.PI/180;
    const dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
    const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function findNearMe(){
    if(!navigator.geolocation){ Swal.fire('Desteklenmiyor','Tarayıcın konum özelliğini desteklemiyor.','warning'); return; }
    Swal.fire({title:'Konum alınıyor...',didOpen:()=>Swal.showLoading(),allowOutsideClick:false});
    navigator.geolocation.getCurrentPosition(pos=>{
        userPos={lat:pos.coords.latitude,lng:pos.coords.longitude};
        centerPos={lat:userPos.lat,lng:userPos.lng}; areaBbox=null;
        const lb=document.getElementById('locBtn'); if(lb) lb.classList.add('on');
        document.getElementById('sortSelect').value='distance'; sortMode='distance'; distanceMode=true;
        loadVenues(true); // backend mesafeye göre sıralar + sayfalar
        if(map){ if(userMarker) userMarker.remove(); userMarker=L.circleMarker([userPos.lat,userPos.lng],{radius:9,color:'#fff',fillColor:'#ff9900',fillOpacity:1,weight:3}).addTo(map).bindTooltip('Buradasın'); map.setView([userPos.lat,userPos.lng],14); }
        Swal.fire({icon:'success',title:'Konumun alındı!',text:'Mekanlar mesafeye göre sıralandı.',timer:1500,showConfirmButton:false});
    },err=>{ Swal.fire('Konum alınamadı','İzin verilmedi ya da konum kapalı. Sana yaklaşık konumuna göre mekanları gösteriyoruz.','info'); });
}

/* ===== HARİTA ===== */
function initMap(){
    if(map) return;
    // Temiz, minimal, premium harita (CartoDB Positron) — marka paletiyle uyumlu
    map=L.map('leaflet-map',{zoomControl:false}).setView([centerPos.lat,centerPos.lng],13);
    L.control.zoom({position:'topleft'}).addTo(map);
    /* Harita altlığı: OpenStreetMap (ücretsiz, anahtar gerektirmez).
       Not: CARTO döşemeleri artık API anahtarı istiyor ve harita üzerine
       "API KEY REQUIRED" filigranı basıyordu — bu yüzden OSM'ye geçildi. */
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {attribution:'&copy; OpenStreetMap katkıcıları', maxZoom:19}).addTo(map);
    // Kümeleme (binlerce pin için şart) + örümcek ağı (spiderfy) yakınlaşınca
    markersLayer = (typeof L.markerClusterGroup === 'function')
        ? L.markerClusterGroup({
            showCoverageOnHover:false,
            zoomToBoundsOnClick:true,      // kümeye tıkla -> yumuşakça yakınlaş (çirkin spiderfy YOK)
            spiderfyOnMaxZoom:false,
            disableClusteringAtZoom:16,    // yakınlaşınca pinler tek tek görünür
            maxClusterRadius:60,
            animate:true, animateAddingMarkers:false,
            iconCreateFunction:function(cluster){
                const n=cluster.getChildCount();
                const size = n<10?38:(n<100?48:60);
                return L.divIcon({html:`<div class="civari-cluster" style="width:${size}px;height:${size}px">${n}</div>`,className:'',iconSize:[size,size]});
            }
          })
        : L.featureGroup();
    map.addLayer(markersLayer);
    if(userPos){ userMarker=L.circleMarker([userPos.lat,userPos.lng],{radius:9,color:'#fff',fillColor:'#ff9900',fillOpacity:1,weight:3}).addTo(map).bindTooltip('Buradasın'); }
    updateMapMarkers();
    // "Bu alanda ara" — kullanıcı haritayı gezdirince beliren yüzen buton
    map.on('movestart', ()=>{ if(mapReady) window._civariUserMoved=true; });
    map.on('moveend', ()=>{ if(mapReady && window._civariUserMoved){ const b=document.getElementById('areaSearchBtn'); if(b) b.classList.add('show'); } });
    setTimeout(()=>{ mapReady=true; }, 900);
}
function updateMapMarkers(fit=true){
    if(!map||!markersLayer) return;
    markersLayer.clearLayers();
    markerById = {};
    const all = (mapVenues && mapVenues.length) ? mapVenues : ((rawVenues && rawVenues.length) ? rawVenues : venues);
    all.forEach((v)=>{
        const fav = favIds.has(Number(v.id));
        const color = fav ? '#ec4899' : catColor(v.category);
        const icon=L.divIcon({html:`<div class="custom-pin" style="--pc:${color}"></div>`,className:'',iconSize:[30,30],iconAnchor:[15,30]});
        const m=L.marker([v.lat,v.lng],{icon});
        m.on('click',()=>openDetail(v.id));
        m.bindTooltip(v.name+(fav?' ❤':''),{direction:'top',offset:[0,-30]});
        markersLayer.addLayer(m);
        markerById[Number(v.id)] = m;
    });
    if(fit && all.length>0){ try{ map.fitBounds(markersLayer.getBounds(),{padding:[50,50],maxZoom:15}); }catch(e){} }
    renderMapList();
}
/* Split-canvas sol liste (mobilde bottom sheet) — harita verisiyle senkron */
function renderMapList(){
    const wrap=document.getElementById('mapListScroll'); if(!wrap) return;
    const list=(mapVenues && mapVenues.length) ? mapVenues : ((rawVenues&&rawVenues.length)?rawVenues:venues);
    const cnt=document.getElementById('mapListCount'); if(cnt) cnt.innerText=(list?list.length:0)+' mekan';
    if(!list || !list.length){ wrap.innerHTML='<div class="ml-empty">Bu alanda mekan yok. Haritayı gezip <b>"Bu alanda ara"</b> de.</div>'; return; }
    const SHORT={open:'Açık',soon:'Kapanıyor',closed:'Kapalı'};
    wrap.innerHTML=list.slice(0,80).map(v=>{
        const ri=ratingInfo(v); const st=openStatus(v);
        const d=(v._dist!=null)?v._dist:(v.dist!=null?+v.dist:null);
        return `<div class="ml-item" onclick="openDetail(${v.id})" onmouseenter="highlightPin(${v.id})" onmouseleave="unhighlightPin(${v.id})">
            ${v.image_url
                ? `<div class="ml-thumb" style="background-image:url('${escapeAttr(v.image_url)}')"></div>`
                : `<div class="ml-thumb ml-cover" style="--cc:${catColor(v.category)}">${escapeHtml((v.name||'?').charAt(0))}</div>`}
            <div class="ml-body">
                <div class="ml-name">${escapeHtml(v.name)}</div>
                <div class="ml-meta"><span class="ml-cat" style="--cc:${catColor(v.category)}">${escapeHtml(v.category)}</span>${st.s!=='unknown'?`<span class="status-pill ${st.s}"><span class="dot"></span>${SHORT[st.s]}</span>`:''}</div>
            </div>
            <div class="ml-right"><span class="ml-rate">${ri.isNew?'<span class="ml-new">Yeni</span>':'★ '+ri.val}</span>${d!=null?`<span class="ml-dist">${formatDist(d)}</span>`:''}</div>
        </div>`;
    }).join('');
    if(window.lucide) lucide.createIcons();
}
/* Mobil bottom sheet — tutamaçla aç/kapat + sürükle */
function initMapSheet(){
    const sheet=document.getElementById('mapList'); const handle=document.getElementById('mapListHandle'); if(!sheet||!handle) return;
    const isMobile=()=>window.matchMedia('(max-width:860px)').matches;
    handle.addEventListener('click',()=>{ if(isMobile()) sheet.classList.toggle('expanded'); });
    let dragging=false, startY=0;
    handle.addEventListener('touchstart',e=>{ dragging=true; startY=e.touches[0].clientY; },{passive:true});
    handle.addEventListener('touchmove',e=>{ if(!dragging) return; const dy=e.touches[0].clientY-startY; if(dy<-36) sheet.classList.add('expanded'); else if(dy>36) sheet.classList.remove('expanded'); },{passive:true});
    handle.addEventListener('touchend',()=>{ dragging=false; });
}
/* Harita için yoğun veri seti — grid sayfalamasından bağımsız (mevcut filtre + merkez/bbox) */
async function loadMapVenues(fit=true){
    if(!map) return;
    if(favFilter){
        const favs=(myProfile&&myProfile.favorites)?myProfile.favorites:[];
        mapVenues=favs.slice(); updateMapMarkers(fit); return;
    }
    try{
        const p=new URLSearchParams();
        if(searchQuery) p.append('q',searchQuery);
        if(currentCat&&currentCat!=='all') p.append('category',currentCat);
        p.append('sort', sortMode); p.append('limit', 800);
        if(areaBbox){ p.append('bbox', areaBbox); }
        else { const c=(distanceMode&&userPos)?userPos:centerPos; p.append('lat',c.lat); p.append('lng',c.lng); p.append('radius', distanceMode?80:browseRadius); }
        const res=await fetch('get_venues.php?'+p.toString()); const data=await res.json();
        mapVenues=(data&&Array.isArray(data.venues))?data.venues:[];
    }catch(e){ mapVenues=(rawVenues||[]).slice(); }
    updateMapMarkers(fit);
}
/* "Bu alanda ara" — haritanın görünür sınırlarındaki mekanları hem listeye hem haritaya getirir */
function searchThisArea(){
    if(!map) return;
    const b=map.getBounds();
    areaBbox=[b.getSouth(),b.getWest(),b.getNorth(),b.getEast()].map(x=>x.toFixed(5)).join(',');
    favFilter=false; distanceMode=false;
    const btn=document.getElementById('areaSearchBtn'); if(btn) btn.classList.remove('show');
    window._civariUserMoved=false;
    loadVenues(true);       // liste: bbox, sayfalı  (applyView haritayı da bbox ile tazeler)
}
/* Konumuma dön (haritadaki buton) */
function goToMyLocation(){
    if(!navigator.geolocation){ Swal.fire('Desteklenmiyor','Tarayıcın konum özelliğini desteklemiyor.','warning'); return; }
    Swal.fire({title:'Konum alınıyor...',didOpen:()=>Swal.showLoading(),allowOutsideClick:false});
    navigator.geolocation.getCurrentPosition(pos=>{
        userPos={lat:pos.coords.latitude,lng:pos.coords.longitude};
        if(map){ if(userMarker) userMarker.remove(); userMarker=L.circleMarker([userPos.lat,userPos.lng],{radius:9,color:'#fff',fillColor:'#ff9900',fillOpacity:1,weight:3}).addTo(map).bindTooltip('Buradasın'); map.setView([userPos.lat,userPos.lng],15); }
        Swal.close();
    },err=>{ Swal.fire('Konum alınamadı','İzin verilmedi ya da konum kapalı.','info'); });
}

function highlightPin(id){
    const m = markerById[Number(id)]; if(!m||!m._icon) return;
    const pin = m._icon.querySelector('.custom-pin'); if(pin) pin.classList.add('bounce');
    try{ m.openTooltip(); }catch(e){}
}
function unhighlightPin(id){
    const m = markerById[Number(id)]; if(!m||!m._icon) return;
    const pin = m._icon.querySelector('.custom-pin'); if(pin) pin.classList.remove('bounce');
    try{ m.closeTooltip(); }catch(e){}
}

/* ===== KİMLİK ===== */
/* ===== HESAP TÜRÜ: Bireysel / İşletme ===== */
let secilenHesapTuru = 'bireysel';
function hesapTuruSec(tur){
    secilenHesapTuru = (tur === 'isletme') ? 'isletme' : 'bireysel';
    const isletmeMi = secilenHesapTuru === 'isletme';

    const bBtn=document.getElementById('htBireysel'), iBtn=document.getElementById('htIsletme');
    if(bBtn){ bBtn.classList.toggle('active', !isletmeMi); bBtn.setAttribute('aria-checked', String(!isletmeMi)); }
    if(iBtn){ iBtn.classList.toggle('active', isletmeMi);  iBtn.setAttribute('aria-checked', String(isletmeMi)); }

    document.querySelectorAll('.isletme-alan').forEach(el=>{ el.style.display = isletmeMi ? '' : 'none'; });
    document.querySelectorAll('.bireysel-alan').forEach(el=>{ el.style.display = isletmeMi ? 'none' : ''; });

    /* Alan zorunlulukları türe göre değişir (gizli alan "required" kalırsa form gönderilemez) */
    const dy=document.getElementById('regBirthYear'); if(dy){ dy.required = !isletmeMi; if(isletmeMi) dy.value=''; }
    const ia=document.getElementById('regIsletmeAdi'); if(ia) ia.required = isletmeMi;

    const btn=document.getElementById('regBtn');
    if(btn) btn.innerText = isletmeMi ? 'İşletme Hesabı Oluştur' : 'Kayıt Ol';
    if(window.lucide) lucide.createIcons();
}

async function handleRegister(e){
    e.preventDefault();
    const onay=document.getElementById('regOnay');
    if(onay && !onay.checked){ Swal.fire('Onay gerekli','Kayıt olabilmek için Kullanım Koşulları ve Gizlilik Politikası\'nı kabul etmelisin.','warning'); return; }

    const isletmeMi = secilenHesapTuru === 'isletme';
    const isletmeAdi = (document.getElementById('regIsletmeAdi')?.value || '').trim();
    if(isletmeMi && !isletmeAdi){ Swal.fire('Eksik bilgi','İşletmenin adını yazmalısın.','warning'); return; }

    const btn=document.getElementById('regBtn'); const eskiMetin=btn.innerText; btn.innerText='Bekleniyor...';
    const fd=new FormData();
    fd.append('action','register');
    fd.append('hesap_turu', secilenHesapTuru);
    fd.append('fullname',regName.value);
    fd.append('email',regEmail.value);
    fd.append('password',regPass.value);
    fd.append('birth_year',document.getElementById('regBirthYear').value);
    fd.append('province',document.getElementById('regProvince').value);
    fd.append('district',document.getElementById('regDistrict').value);
    fd.append('onay','1');
    if(isletmeMi){
        fd.append('isletme_adi', isletmeAdi);
        fd.append('yetkili_unvan', (document.getElementById('regUnvan')?.value || '').trim());
    }
    try{
        const res=await fetch('auth.php',{method:'POST',body:fd}); const r=await res.json();
        if(r.status==='success'){
            document.getElementById('registerForm').reset();
            if(isletmeMi){
                /* İşletme: hesap açıldı, hemen giriş yapıp panele götür */
                const gfd=new FormData(); gfd.append('action','login'); gfd.append('email',regEmail.value); gfd.append('password',regPass.value);
                try{ await fetch('auth.php',{method:'POST',body:gfd}); }catch(err){}
                await Swal.fire({
                    icon:'success', title:'İşletme hesabın hazır!',
                    html:'Şimdi mekanının bilgilerini gireceğin <b>İşletme Paneli</b>\'ne yönlendiriliyorsun.',
                    confirmButtonText:'Panele Git', confirmButtonColor:'#ff9900'
                });
                location.href='isletme.php';
                return;
            }
            Swal.fire('Kayıt Başarılı!',r.message,'success');
            toggleAuth(false);
        }
        else Swal.fire('Uyarı',r.message||'Hata.','warning');
    }catch(err){ Swal.fire('Bağlantı Hatası','Sunucuya ulaşılamadı.','error'); }
    btn.innerText=eskiMetin;
}
async function handleLogin(e){
    e.preventDefault(); const btn=document.getElementById('logBtn'); btn.innerText='Bekleniyor...';
    const fd=new FormData(); fd.append('action','login'); fd.append('email',logEmail.value); fd.append('password',logPass.value);
    try{ const res=await fetch('auth.php',{method:'POST',body:fd}); const r=await res.json();
        if(r.status==='success'){
            await girisYap(r.fullname, r.hesap_turu);
            if(r.hesap_turu==='isletme'){ location.href='isletme.php'; return; }
            Swal.fire('Hoşgeldin!',r.message,'success');
        }
        else Swal.fire('Hata',r.message||'Giriş yapılamadı.','error');
    }catch(err){ Swal.fire('Bağlantı Hatası','Sunucuya ulaşılamadı.','error'); }
    btn.innerText='Giriş Yap';
}
/* Kayıtlı il merkez koordinatları — vitrin dönemi: yalnız Ankara */
const PROVINCE_COORDS = {
    'Ankara':{lat:39.9208,lng:32.8541}
};
function centerOnProfile(){
    const p = myProfile && myProfile.province;
    if(p && PROVINCE_COORDS[p] && !distanceMode && !areaBbox){
        centerPos = { ...PROVINCE_COORDS[p] };
        cityName = p;
        loadVenues(true);
        if(map) map.setView([centerPos.lat, centerPos.lng], 13);
    }
}
/* Gerçek GPS konumunu otomatik al (izin verilirse); reddedilirse profildeki ile düş */
let _locTried = false;
function requestRealLocation(){
    if(_locTried) return; _locTried = true;
    if(!navigator.geolocation){ centerOnProfile(); return; }
    navigator.geolocation.getCurrentPosition(pos=>{
        const la=pos.coords.latitude, ln=pos.coords.longitude;
        /* Ankara dışındaysa merkezi kaydırma — vitrin Ankara'da, harita boş kalmasın */
        const inAnkara = la>=39.70 && la<=40.10 && ln>=32.45 && ln<=33.15;
        if(!inAnkara){ centerOnProfile(); return; }
        userPos = { lat:la, lng:ln };
        centerPos = { lat:userPos.lat, lng:userPos.lng }; areaBbox=null;
        loadVenues(true);
        if(map){ if(userMarker) userMarker.remove(); userMarker=L.circleMarker([userPos.lat,userPos.lng],{radius:9,color:'#fff',fillColor:'#ff9900',fillOpacity:1,weight:3}).addTo(map).bindTooltip('Buradasın'); map.setView([userPos.lat,userPos.lng],14); }
    }, err=>{ centerOnProfile(); }, { timeout:8000, maximumAge:600000, enableHighAccuracy:false });
}
async function girisYap(isim, hesapTuru){
    currentUser=isim||'Kullanıcı';
    /* İşletme hesabıysa başlıkta panel bağlantısı görünür */
    const pl=document.getElementById('panelLink');
    if(pl) pl.style.display = (hesapTuru==='isletme') ? 'inline-flex' : 'none';
    releaseAuthGate();
    closeModal('authModal');
    document.getElementById('btnAuth').style.display='none';
    document.getElementById('userWelcome').style.display='flex';
    document.getElementById('userNameText').innerText=currentUser;
    await loadFavorites(); await loadProfile(); updateLevelBadge(); renderChips();
    requestRealLocation(); // önce gerçek GPS, olmazsa profildeki il
    applyView();
}
async function cikisYap(){
    try{ const fd=new FormData(); fd.append('action','logout'); await fetch('auth.php',{method:'POST',body:fd}); }catch(e){}
    currentUser=null; favIds=new Set(); favFilter=false; myProfile=null;
    rawVenues=[]; venues=[]; mapVenues=null; // veriyi temizle
    const pl=document.getElementById('panelLink'); if(pl) pl.style.display='none';
    document.getElementById('btnAuth').style.display='inline-block';
    document.getElementById('userWelcome').style.display='none';
    renderChips();
    loadVenues(true); // içerik herkese açık — misafir olarak yeniden yükle
    if(map){ mapVenues=null; loadMapVenues(false); }
}
async function oturumKontrol(){
    try{ const fd=new FormData(); fd.append('action','session'); const res=await fetch('auth.php',{method:'POST',body:fd}); const r=await res.json();
        if(r.status==='success'&&r.fullname) await girisYap(r.fullname, r.hesap_turu);
    }catch(e){}
}
/* ===== GİRİŞ DUVARI KALDIRILDI =====
   Mekan içerikleri artık herkese açık (SEO + paylaşılabilirlik kararı, 2026-08).
   Giriş yalnızca yorum, favori, check-in ve profil için istenir. */
function updateAuthWall(){
    const gated = document.getElementById('gatedContent');
    if(gated) gated.style.display = '';
}
function openAuthLogin(){ const c=document.getElementById('authContainer'); if(c) c.classList.remove('right-active'); openModal('authModal'); }
function openAuthRegister(){ const c=document.getElementById('authContainer'); if(c) c.classList.add('right-active'); openModal('authModal'); }
/* Geriye dönük uyumluluk (eski çağrılar duvarı günceller) */
function requireAuthGate(){ updateAuthWall(); }
function releaseAuthGate(){ updateAuthWall(); }
/* 30 dk hareketsizlik -> otomatik çıkış (sunucu tarafı da auth.php'de aynı süreyle düşürür) */
let _idleTimer=null;
function resetIdleTimer(){
    clearTimeout(_idleTimer);
    _idleTimer=setTimeout(async()=>{
        if(currentUser){ await cikisYap(); }
    }, 30*60*1000);
}
function initIdleLogout(){
    ['click','keydown','mousemove','touchstart','scroll'].forEach(ev=>window.addEventListener(ev,resetIdleTimer,{passive:true}));
    resetIdleTimer();
}

/* ===== ARAYÜZ ===== */
function openModal(id){ document.getElementById(id).classList.add('open'); document.body.classList.add('modal-open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); document.body.classList.remove('modal-open'); }
function openAuthModal(){ openModal('authModal'); }
function socialLogin(provider){
    const ad = provider==='google' ? 'Google' : 'Apple';
    Swal.fire({
        icon:'info',
        title:ad + ' ile Devam Et',
        html:'Bu giriş yöntemi çok yakında aktif olacak.<br><span style="color:#64748b;font-size:.9rem">Şimdilik e-posta ile saniyeler içinde kayıt olabilirsin.</span>',
        confirmButtonColor:'#ff9900', confirmButtonText:'Tamam'
    });
}
function toggleAuth(s){ document.getElementById('authContainer').classList.toggle('right-active',!!s); }
function toggleCombo(e){ e.stopPropagation(); document.getElementById('comboMenu').classList.toggle('open'); document.getElementById('comboTrigger').classList.toggle('open'); }
function updateActiveCat(){
    document.querySelectorAll('.cat-item').forEach(el=>el.classList.toggle('active',el.dataset.id===currentCat));
    document.getElementById('comboLabel').innerText = (categories.find(c=>c.id===currentCat)?.label)||'Tüm Kategoriler';
    if(currentCat==='all') document.getElementById('comboLabel').innerText='Tüm Kategoriler';
    renderChips();
}
function selectCat(id){
    currentCat=id; favFilter=false; areaBbox=null;
    document.getElementById('comboMenu').classList.remove('open');
    document.getElementById('comboTrigger').classList.remove('open');
    updateActiveCat();
    loadVenues(true);
}
function quickCat(cat){ selectCat(cat); scrollToGrid(); }
function scrollToGrid(){ document.querySelector('.venue-grid').scrollIntoView({behavior:'smooth',block:'start'}); }
function setSort(mode){
    sortMode=mode;
    if(mode==='distance'){
        distanceMode=true;
        if(!userPos){ findNearMe(); return; }
        loadVenues(true);
    } else {
        distanceMode=false;
        loadVenues(true);
    }
}
function scrollTop(){ window.scrollTo({top:0,behavior:'smooth'}); }
function switchView(mode){
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    document.getElementById('btn-'+mode).classList.add('active');
    if(mode==='grid'){ document.getElementById('view-grid').classList.remove('hidden'); document.getElementById('view-map').classList.add('hidden'); }
    else { document.getElementById('view-grid').classList.add('hidden'); document.getElementById('view-map').classList.remove('hidden'); if(!map) initMap(); setTimeout(()=>{ map.invalidateSize(); if(mapVenues===null) loadMapVenues(true); else updateMapMarkers(); },300); }
}

/* çipler */
function renderChips(){
    const el=document.getElementById('chips'); if(!el) return;
    let html=categories.map(c=>`<div class="chip ${(!favFilter&&currentCat===c.id)?'active':''}" onclick="selectCat('${c.id}')"><i data-lucide="${c.icon}"></i> ${c.label}</div>`).join('');
    html+=`<div class="chip fav-chip ${favFilter?'active':''}" onclick="toggleFavFilter()"><i data-lucide="heart"></i> Favorilerim</div>`;
    el.innerHTML=html;
    if(window.lucide) lucide.createIcons();
}

/* yardımcı */
function escapeHtml(s){ const d=document.createElement('div'); d.innerText=s??''; return d.innerHTML; }
function escapeAttr(s){ return String(s??'').replace(/"/g,'&quot;'); }
function formatDate(s){ if(!s) return ''; const d=new Date(s.replace(' ','T')); if(isNaN(d)) return s; return d.toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'}); }

/* ===== İL / İLÇE ===== */
const TR_DISTRICTS = {
 'Ankara':['Akyurt','Altındağ','Ayaş','Bala','Beypazarı','Çamlıdere','Çankaya','Çubuk','Elmadağ','Etimesgut','Evren','Gölbaşı','Güdül','Haymana','Kahramankazan','Kalecik','Keçiören','Kızılcahamam','Mamak','Nallıhan','Polatlı','Pursaklar','Sincan','Şereflikoçhisar','Yenimahalle']
};
function initProvinces(){
    const sel=document.getElementById('regProvince'); if(!sel) return;
    sel.innerHTML='<option value="">İl seç</option>'+Object.keys(TR_DISTRICTS).map(p=>`<option value="${p}">${p}</option>`).join('');
}
function onProvinceChange(){
    const p=document.getElementById('regProvince').value;
    const d=document.getElementById('regDistrict'); if(!d) return;
    const list=TR_DISTRICTS[p]||[];
    d.innerHTML='<option value="">İlçe seç</option>'+list.map(x=>`<option value="${x}">${x}</option>`).join('');
}

/* ===== MOBİL ALT NAVİGASYON ===== */
function setActiveNav(which){ document.querySelectorAll('.mnav-btn').forEach(b=>b.classList.toggle('active', b.dataset.nav===which)); }
function mobileNav(which){
    if(which==='kesfet'){ favFilter=false; renderChips(); switchView('grid'); applyView(); scrollToGrid(); setActiveNav('kesfet'); }
    else if(which==='harita'){ switchView('map'); setActiveNav('harita'); }
    else if(which==='favoriler'){ if(!currentUser){ openAuthModal(); return; } switchView('grid'); if(!favFilter) toggleFavFilter(); else applyView(); setActiveNav('favoriler'); scrollToGrid(); }
    else if(which==='profil'){ openProfile(); setActiveNav('profil'); }
}

/* ===== LİDERLİK TABLOSU ===== */
let lbScope = 'country';
async function loadLeaderboard(scope){
    lbScope = scope || lbScope || 'country';
    const list=document.getElementById('lbModalList'); if(!list) return;
    document.querySelectorAll('.lb-scope-btn').forEach(b=>b.classList.toggle('active', b.dataset.scope===lbScope));
    list.innerHTML='<div class="lb-empty">Yükleniyor...</div>';
    try{
        const res=await fetch('leaderboard.php?scope='+encodeURIComponent(lbScope)); const r=await res.json();
        const lbl=document.getElementById('lbScopeLabel'); if(lbl) lbl.innerText=r.scopeLabel||'Türkiye';
        if(r.needLocation){
            list.innerHTML='<div class="lb-empty">Bu sıralama için profilinde il/ilçe bilgisi gerekiyor.<br>'+(currentUser?'Kayıt olurken il/ilçe seçersen burada yer alırsın.':'Giriş yapıp kayıt olurken il/ilçeni seç.')+'</div>';
            return;
        }
        const users=(r&&r.users)?r.users:[];
        if(!users.length){ list.innerHTML='<div class="lb-empty">Bu bölgede henüz sıralama yok. İlk sen ol! 🚀</div>'; return; }
        const medals=['🥇','🥈','🥉'];
        list.innerHTML=users.map((u,i)=>{
            const lvl=getLevel(u.reviews).cur;
            const rankBadge = i<3 ? medals[i] : (i+1);
            const av = u.avatar ? `<img src="${escapeAttr(u.avatar)}" alt="">` : escapeHtml((u.fullname||'?').charAt(0).toUpperCase());
            const loc = u.district || u.province || '';
            return `<div class="lb-row ${u.mine?'mine':''}"><span class="lb-rank">${rankBadge}</span><span class="lb-av">${av}</span><span class="lb-name">${escapeHtml(u.fullname||'Kâşif')}<small>${escapeHtml(lvl.title)}${loc?' · '+escapeHtml(loc):''}</small></span><span class="lb-pts">${u.points}<small>puan</small></span></div>`;
        }).join('');
    }catch(e){ list.innerHTML='<div class="lb-empty">Sıralama yüklenemedi.</div>'; }
}
function switchLbScope(scope){ loadLeaderboard(scope); }
function openLeaderboard(){
    openModal('leaderboardModal');
    const def = (currentUser && myProfile && myProfile.district) ? 'district' : 'country';
    loadLeaderboard(def);
}
/* ===== BURADAYIM (CHECK-IN) ===== */
async function doCheckin(){
    if(!currentUser){ openAuthModal(); return; }
    if(!currentVenueId) return;
    const fd=new FormData(); fd.append('venue_id',currentVenueId);
    try{
        const res=await fetch('checkin.php',{method:'POST',body:fd}); const r=await res.json();
        if(r.status==='success'){
            const btn=document.getElementById('checkinBtn');
            spawnFloatPts(btn, '+2 Puan');
            if(navigator.vibrate) navigator.vibrate(50);
            fireConfetti({particleCount:90});
            if(btn) btn.classList.add('hidden');
            await loadProfile(); updateLevelBadge();
            Swal.fire({icon:'success',title:'Buradasın!',text:r.message,timer:1600,showConfirmButton:false});
        } else Swal.fire('Bilgi',r.message||'Check-in yapılamadı.','info');
    }catch(e){ Swal.fire('Bağlantı Hatası','Sunucuya ulaşılamadı.','error'); }
}

/* ===== DAKTİLO EFEKTLİ PLACEHOLDER ===== */
const TYPE_SAMPLES = ["Öğrenciyim, ucuz bir kafe...","Sessiz çalışma yeri...","Kızılay'da akşam yemeği...","Tunalı'da tatlı molası...","Alkolsüz, aile dostu mekan...","Şık bir bar arıyorum...","Bugün keşfedilecek yeni bir yer..."];
let twTimer=null, twI=0, twC=0, twDel=false;
function reducedMotion(){ return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
function typewriterTick(){
    const si=document.getElementById('searchInput'); if(!si) return;
    if(document.activeElement===si || si.value){ twTimer=setTimeout(typewriterTick,1000); return; }
    const full=TYPE_SAMPLES[twI];
    if(!twDel){ twC++; if(twC>full.length){ twDel=true; si.setAttribute('placeholder',full); twTimer=setTimeout(typewriterTick,1500); return; } }
    else { twC--; if(twC<0){ twDel=false; twI=(twI+1)%TYPE_SAMPLES.length; twC=0; } }
    si.setAttribute('placeholder', full.substring(0,Math.max(0,twC)) + (twDel?'':'▏'));
    twTimer=setTimeout(typewriterTick, twDel?40:75);
}
function startTypewriter(){
    const si=document.getElementById('searchInput'); if(!si) return;
    if(reducedMotion()){ si.setAttribute('placeholder',"Akıllı arama: 'öğrenciyim, ucuz kafe' yazabilirsin..."); return; }
    clearTimeout(twTimer); twI=0; twC=0; twDel=false; typewriterTick();
}
function stopTypewriter(){ clearTimeout(twTimer); }

/* ===== ARAMA FOCUS MODU (sayfayı karart) ===== */
function initSearchFocus(){
    const si=document.getElementById('searchInput'); if(!si) return;
    // Ekran karartma/blur odak modu kaldırıldı (kullanıcı isteği). Sadece daktilo efektini durdur/başlat.
    si.addEventListener('focus',()=>{ stopTypewriter(); });
    si.addEventListener('blur',()=>{ setTimeout(startTypewriter,300); });
}

/* ===== KAYAN PUAN YAZISI ===== */
function spawnFloatPts(anchor, text){
    if(!anchor) return;
    const r=anchor.getBoundingClientRect();
    const el=document.createElement('div'); el.className='float-pts'; el.textContent=text;
    el.style.left=(r.left + r.width/2)+'px';
    el.style.top=(r.top)+'px';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),1200);
}

/* ===== MANYETİK BUTONLAR (sadece masaüstü) ===== */
function initMagnetic(){
    if(!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches)) return;
    if(reducedMotion()) return;
    document.querySelectorAll('.magnetic').forEach(el=>{
        el.addEventListener('mousemove',e=>{ const r=el.getBoundingClientRect(); const mx=e.clientX-(r.left+r.width/2); const my=e.clientY-(r.top+r.height/2); el.style.transform=`translate(${mx*0.22}px, ${my*0.3}px)`; });
        el.addEventListener('mouseleave',()=>{ el.style.transform=''; });
    });
}

/* ===== PWA SERVICE WORKER ===== */
function registerSW(){ if('serviceWorker' in navigator){ window.addEventListener('load',()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); }); } }

/* ===== BAŞLAT ===== */
document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('comboMenu').innerHTML=categories.map(c=>`<div class="cat-item ${c.id==='all'?'active':''}" data-id="${c.id}" onclick="selectCat('${c.id}')"><i data-lucide="${c.icon}"></i> ${c.label==='Tümü'?'Tüm Kategoriler':c.label}</div>`).join('');
    renderChips();
    renderMoods();
    renderVitrin();
    initProvinces();
    loadVenues(true);
    oturumKontrol();
    startTypewriter();
    initSearchFocus();
    initMagnetic();
    initMapSheet();
    initIdleLogout();
    registerSW();

    document.getElementById('searchInput').addEventListener('input',e=>{ searchQuery=e.target.value; favFilter=false; distanceMode=false; areaBbox=null; clearTimeout(searchTimer); searchTimer=setTimeout(()=>loadVenues(true),400); });
    /* INTRO: yalnızca siteye ilk girişte gösterilir.
       Mekan sayfasından geri dönmek gibi site içi gezinmelerde tekrar açılmaz.
       (Sekme kapatılıp yeniden açıldığında yeniden gösterilir.) */
    const introEl = document.getElementById('intro');
    const introGorulduMu = (function(){ try { return sessionStorage.getItem('civari_intro') === '1'; } catch(e){ return false; } })();
    function introKapat(animasyonlu){
        if(!introEl) return;
        try { sessionStorage.setItem('civari_intro','1'); } catch(e){}
        introEl.classList.add('closed');
        document.getElementById('header').classList.add('show');
        if(animasyonlu) setTimeout(()=>{ introEl.style.display='none'; }, 800);
        else { introEl.style.display='none'; }
    }
    if(introGorulduMu) introKapat(false);          // daha önce görüldü → doğrudan siteye
    document.getElementById('enterBtn').addEventListener('click',()=>introKapat(true));
    document.addEventListener('click',()=>{ document.getElementById('comboMenu').classList.remove('open'); document.getElementById('comboTrigger').classList.remove('open'); });

    // Sonsuz kaydırma
    const sentinel=document.getElementById('scrollSentinel');
    if(sentinel && 'IntersectionObserver' in window){
        const io=new IntersectionObserver(entries=>{ entries.forEach(en=>{ if(en.isIntersecting) loadMoreVenues(); }); }, {rootMargin:'400px'});
        io.observe(sentinel);
    }

    const drawIcons=()=>{ if(window.lucide) lucide.createIcons(); else setTimeout(drawIcons,100); };
    drawIcons();
});

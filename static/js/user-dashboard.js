// ═══════════════════════════════
//  DUTY STATION NAMING (single source of truth)
// ═══════════════════════════════
const OFFICE_NAME  = 'Office of Academics · Head Office';
const OFFICE_SHORT = 'Head Office';

// ═══════════════════════════════
//  THE DAY ARC — hours drawn as a 180° sweep
// ═══════════════════════════════
const ARC_LEN = 251.3;   // path length of the semicircle in the SVG

function drawArc(worked, target){
  const pct  = target > 0 ? Math.min(1, worked / target) : 0;
  const fill = document.getElementById('arcFill');
  const mark = document.getElementById('arcMark');
  if(fill) fill.style.strokeDashoffset = String(ARC_LEN * (1 - pct));
  if(mark){
    // sweep from 180° (left) to 360° (right) across a radius-80 arc centred at 100,100
    const ang = Math.PI * (1 + pct);
    mark.setAttribute('cx', (100 + 80 * Math.cos(ang)).toFixed(2));
    mark.setAttribute('cy', (100 + 80 * Math.sin(ang)).toFixed(2));
  }
  const v = document.getElementById('arcVal');
  if(v) v.innerHTML = worked.toFixed(1) + '<small>h</small>';
  const c = document.getElementById('arcCap');
  if(c) c.textContent = 'of ' + Number(target).toFixed(0) + 'h logged today';
}

// ═══════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════
let DD = null;
let faceReg          = false;
let faceRequired     = false;   // set by admin
let faceRegEnabled   = false;   // set by admin
let faceMode         = 'verify';
let faceStream       = null;
let faceCb           = null;

// 5-photo registration
let regPhotos     = [];
let regPhotoCount = 5;
let regPhotoIndex = 0;

// Location
let locState = {
  checked:  false,
  atOffice: false,
  lat:      null,
  lng:      null,
  address:  '',
  distance: null,
};

let attMap = {}, holMap = {}, lvMap = {};
let calDt  = new Date();

// ═══════════════════════════════════════════════
//  CLOCK
// ═══════════════════════════════════════════════
(function tick(){
  document.getElementById('liveTime').textContent =
    new Date().toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
  setTimeout(tick, 1000);
})();

const h0 = new Date().getHours();
document.getElementById('wgreet').textContent = h0<12?'Good morning,':h0<17?'Good afternoon,':'Good evening,';

// ═══════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════
function toast(msg, type='ok'){
  const icons={ok:'check-circle',err:'exclamation-circle',warn:'exclamation-triangle',info:'info-circle'};
  const el = document.getElementById('toast');
  el.querySelector('i').className = `fas fa-${icons[type]||'info-circle'}`;
  document.getElementById('toastTxt').textContent = msg;
  el.className = `oa-toast show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(()=>el.classList.remove('show'), 4500);
}

// ═══════════════════════════════════════════════
//  TABS + DRAWER
// ═══════════════════════════════════════════════
function goTab(t){
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('.oa-bnav').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('.oa-navitem').forEach(x=>x.classList.remove('on'));
  const panel = document.getElementById('tab-'+t);
  if(panel) panel.classList.add('on');
  document.querySelectorAll('[data-tab="'+t+'"]').forEach(x=>x.classList.add('on'));
  window.scrollTo({top:0, behavior:'smooth'});
  const di = document.getElementById('di-'+t);
  if(di) di.classList.add('on');
  if(t==='calendar') renderCal();
}
function toggleDrawer(){ document.getElementById('drawer').classList.contains('show')?closeDrawer():openDrawer(); }
function openDrawer(){
  document.getElementById('drawer').classList.add('show');
  document.getElementById('overlay').classList.add('show');
  document.getElementById('hbtn').classList.add('on');
}
function closeDrawer(){
  document.getElementById('drawer').classList.remove('show');
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('hbtn').classList.remove('on');
}

// ═══════════════════════════════════════════════
//  FACE STATUS UI  (admin-driven)
// ═══════════════════════════════════════════════
/**
 * Updates all face-related UI across both tabs.
 * @param {boolean} reg      - face photos registered
 * @param {boolean} regEn    - admin allowed registration
 * @param {boolean} required - admin requires face on login
 * @param {number}  count    - photo count
 */
function updateFaceBadge(reg, regEn, required, count){
  faceReg        = reg;
  faceRegEnabled = regEn;
  faceRequired   = required;

  // ── Determine display state ──
  let cardClass, icon, title, sub, chipClass, chipText, pillClass, pillHtml, badgeClass, badgeHtml;

  if(required && reg){
    // Admin requires + user has registered → active & ready
    cardClass = 'oa-strip is-ok';
    icon='🔒'; title='Face ID Active'; sub=`${count||0} photos registered · Verification enabled`;
    chipClass='chip'; chipText='Active';
    pillClass='oa-pill ok';
    pillHtml=`<i class="fas fa-lock"></i> <span>Face ID On${count?' ('+count+')':''}</span>`;
    document.getElementById('dfacepill').className='oa-pill ok';
    document.getElementById('dfacepill').innerHTML=`<i class="fas fa-check-circle"></i> Face ID active (${count||'?'} photos)`;

  } else if(required && !reg){
    // Admin requires but NOT registered yet
    cardClass = 'oa-strip is-bad';
    icon='⚠️'; title='Face ID Required'; sub=regEn?'Tap to register your face now':'Contact admin — face registration not yet enabled';
    chipClass='chip'; chipText='Setup Needed';
    pillClass='oa-pill warn';
    pillHtml=`<i class="fas fa-exclamation-triangle"></i> <span>Face ID Required</span>`;
    document.getElementById('dfacepill').className='oa-pill warn';
    document.getElementById('dfacepill').innerHTML=`<i class="fas fa-exclamation-triangle"></i> Face ID required — ${regEn?'tap to register':'contact admin'}`;

  } else if(!required && regEn && !reg){
    // Admin allowed registration (optional — not required)
    cardClass = 'oa-strip is-warn';
    icon='📸'; title='Face Registration Available'; sub='Admin enabled — tap to register (optional)';
    chipClass='chip'; chipText='Optional';
    pillClass='oa-pill warn';
    pillHtml=`<i class="fas fa-camera"></i> <span>Register Face</span>`;
    document.getElementById('dfacepill').className='oa-pill warn';
    document.getElementById('dfacepill').innerHTML=`<i class="fas fa-camera"></i> Tap to register your face`;

  } else if(!required && reg){
    // Registered but not required
    cardClass = 'oa-strip';
    icon='✅'; title='Face Registered'; sub='Not required for login · Stored securely';
    chipClass='chip'; chipText='Not Required';
    pillClass='oa-pill ok';
    pillHtml=`<i class="fas fa-check-circle"></i> <span>Face Stored</span>`;
    document.getElementById('dfacepill').className='oa-pill ok';
    document.getElementById('dfacepill').innerHTML=`<i class="fas fa-check-circle"></i> Face registered (not required)`;

  } else {
    // No face requirement, no registration
    cardClass = 'oa-strip';
    icon='🔓'; title='Face ID not required'; sub='Login directly — no face scan needed';
    chipClass='chip'; chipText='Off';
    pillClass='oa-pill';
    pillHtml=`<i class="fas fa-camera-slash"></i> <span>No Face ID</span>`;
    document.getElementById('dfacepill').className='oa-pill';
    document.getElementById('dfacepill').innerHTML=`<i class="fas fa-info-circle"></i> Face ID not required`;
  }

  // Apply to Normal tab card
  const card = document.getElementById('faceStatusCard');
  card.className = cardClass;
  document.getElementById('fscIcon').textContent  = icon;
  document.getElementById('fscTitle').textContent = title;
  document.getElementById('fscSub').textContent   = sub;
  const chip = document.getElementById('fscChip');
  chip.className = chipClass; chip.textContent = chipText;

  // Apply to Shift tab card
  const cardS = document.getElementById('faceStatusCardS');
  cardS.className = cardClass;
  document.getElementById('fscIconS').textContent  = icon;
  document.getElementById('fscTitleS').textContent = title;
  document.getElementById('fscSubS').textContent   = sub;
  const chipS = document.getElementById('fscChipS');
  chipS.className = chipClass; chipS.textContent = chipText;

  // Welcome badge
  const badge = document.getElementById('wfacebadge');
  badge.className = pillClass;
  badge.innerHTML = pillHtml;
  badge.onclick = (required && !reg && regEn) || (!required && regEn && !reg) ? ()=>openFace('register') : null;
  badge.style.cursor = badge.onclick ? 'pointer' : 'default';

  // Show/hide "Register Face" drawer item
  document.getElementById('di-face-reg').style.display = regEn ? '' : 'none';
}

/** Tap on the face status card in normal tab */
function handleFaceCardTap(){
  if(faceRequired && !faceReg && faceRegEnabled){
    openFace('register');
  } else if(!faceRequired && faceRegEnabled && !faceReg){
    openFace('register');
  }
}

/** Drawer menu register button — checks admin permission first */
function openFaceRegIfAllowed(){
  if(faceRegEnabled){
    openFace('register');
  } else {
    toast('Face registration has not been enabled by your administrator.','warn');
  }
}

// ═══════════════════════════════════════════════
//  LOCATION
// ═══════════════════════════════════════════════
function updateLocBanners(state, addr, dist){
  const configs = [
    { banner:'locBanner', icon:'locIcon', title:'locTitle', sub:'locSub', chip:'locChip' },
    { banner:'locBannerS', icon:'locIconS', title:'locTitleS', sub:'locSubS', chip:'locChipS' },
  ];
  for(const ids of configs){
    const b = document.getElementById(ids.banner); if(!b) continue;
    b.className = `oa-strip ${state==='at'?'is-ok':state==='out'?'is-warn':'is-busy'}`;
    const ic = document.getElementById(ids.icon);
    if(ic) ic.textContent = state==='at'?'🏛️':state==='out'?'📡':'📡';
    const tt = document.getElementById(ids.title);
    const distStr = dist!=null?(dist<1?(dist*1000).toFixed(0)+'m':dist.toFixed(2)+'km'):'';
    if(tt) tt.textContent = state==='at'?OFFICE_NAME:state==='out'?`${distStr} from ${OFFICE_SHORT}`:'Checking your location…';
    const ss = document.getElementById(ids.sub);
    if(ss) ss.textContent = addr?addr:'Tap to refresh your location';
    const cc = document.getElementById(ids.chip);
    if(cc){ cc.textContent = state==='at'?'At HQ':state==='out'?'Away':'Checking'; cc.className='chip'; }
  }

  const railText = document.getElementById('railLocText');
  if(railText){
    const addrDisp = addr || (locState.lat ? `${locState.lat.toFixed(4)}, ${locState.lng.toFixed(4)}` : 'Locating…');
    railText.textContent = addrDisp.length > 28 ? addrDisp.substring(0, 26) + '…' : addrDisp;
  }

  // Update Map widget if coordinates exist
  if(locState.lat && locState.lng){
    renderUserMap(locState.lat, locState.lng, locState.officeLat, locState.officeLng);
    const coordsText = document.getElementById('userCoordsText');
    if(coordsText){
      const addrStr = (locState.address && !locState.address.startsWith("Location:") && !locState.address.startsWith("Lat:")) ? locState.address : '';
      if(addrStr) {
        coordsText.innerHTML = `<i class="fas fa-location-dot" style="color:var(--accent,#0071e3)"></i> <strong>${addrStr}</strong> <span style="opacity:0.75;margin-left:6px;">(${locState.lat.toFixed(6)}, ${locState.lng.toFixed(6)})</span>`;
      } else {
        coordsText.textContent = `Location: ${locState.lat.toFixed(6)}, ${locState.lng.toFixed(6)}`;
      }
    }
  }
}

let userLeafletMap = null;
let userLeafletMarker = null;

function renderUserMap(lat, lng, officeLat, officeLng){
  const mapCard = document.getElementById('userMapCard');
  if(mapCard) mapCard.style.display = 'block';
  
  const gmapsLink = document.getElementById('userGmapsLink');
  if(gmapsLink) gmapsLink.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  const mapContainer = document.getElementById('userLeafletMap');
  const iframeContainer = document.getElementById('userMapIframe');

  if(window.L && mapContainer){
    if(iframeContainer) iframeContainer.style.display = 'none';
    mapContainer.style.display = 'block';
    
    if(!userLeafletMap){
      userLeafletMap = L.map('userLeafletMap').setView([lat, lng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(userLeafletMap);

      // Office HQ reference circle (500m radius)
      const targetOffLat = officeLat || 12.9248224;
      const targetOffLng = officeLng || 77.5702351;
      L.circle([targetOffLat, targetOffLng], {
        color: '#0071e3',
        fillColor: '#0071e3',
        fillOpacity: 0.1,
        radius: 500
      }).addTo(userLeafletMap).bindPopup('<strong>JAIN Head Office</strong><br>500m Campus Zone');
    } else {
      userLeafletMap.setView([lat, lng], 16);
    }

    if(userLeafletMarker){
      userLeafletMarker.setLatLng([lat, lng]);
    } else {
      userLeafletMarker = L.marker([lat, lng], { draggable: true }).addTo(userLeafletMap);
      
      userLeafletMarker.on('dragend', async function(e) {
        const newPos = e.target.getLatLng();
        locState.lat = newPos.lat;
        locState.lng = newPos.lng;
        toast('Updating pin location…', 'info');
        
        try {
          const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newPos.lat}&lon=${newPos.lng}`);
          if(nomRes.ok){
            const nomData = await nomRes.json();
            if(nomData && nomData.display_name){
              locState.address = nomData.display_name;
            }
          }
        } catch(err) {
          console.warn('Drag geocode error:', err);
        }
        
        const r = await fetch('/api/location/check', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ lat: newPos.lat, lng: newPos.lng })
        });
        const d = await r.json();
        locState.atOffice = d.at_office;
        locState.distance = d.distance_km;
        locState.checked = true;

        updateLocBanners(d.at_office ? 'at' : 'out', locState.address, d.distance_km);
        toast('Pin position updated!', 'ok');
      });
    }
    
    userLeafletMarker.bindPopup(`<strong>Your Current Location</strong><br>Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}<br><span style="font-size:0.7rem;color:#666;">(Drag to fine-tune)</span>`);
    
    setTimeout(()=>{
      if(userLeafletMap) userLeafletMap.invalidateSize();
    }, 250);
  } else if(iframeContainer) {
    if(mapContainer) mapContainer.style.display = 'none';
    iframeContainer.style.display = 'block';
    const bbox = `${lng-0.005},${lat-0.005},${lng+0.005},${lat+0.005}`;
    iframeContainer.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  }
}

async function searchAddressOnMap(){
  const input = document.getElementById('mapSearchInput');
  if(!input || !input.value.trim()) return;
  const query = input.value.trim();
  toast('Searching location…', 'info');
  try{
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    if(res.ok){
      const results = await res.json();
      if(results && results.length > 0){
        const first = results[0];
        const newLat = parseFloat(first.lat);
        const newLng = parseFloat(first.lon);
        
        locState.lat = newLat;
        locState.lng = newLng;
        locState.address = first.display_name;

        if(userLeafletMap){
          userLeafletMap.setView([newLat, newLng], 16);
          if(userLeafletMarker) userLeafletMarker.setLatLng([newLat, newLng]);
        }

        const r = await fetch('/api/location/check', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ lat: newLat, lng: newLng })
        });
        const d = await r.json();
        locState.atOffice = d.at_office;
        locState.distance = d.distance_km;
        locState.checked = true;

        updateLocBanners(d.at_office ? 'at' : 'out', locState.address, d.distance_km);
        toast('Location found & map updated!', 'ok');
      } else {
        toast('Location not found. Try dragging the blue pin on the map.', 'warn');
      }
    }
  } catch(e){
    console.error('Search error:', e);
    toast('Search error', 'err');
  }
}

async function refreshLocation(){
  updateLocBanners('checking','',null);
  try{
    const geo = await getGeo();
    locState.lat = geo.lat; locState.lng = geo.lng;
    const r = await fetch('/api/location/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat:geo.lat,lng:geo.lng})});
    const d = await r.json();
    locState.atOffice = d.at_office;
    locState.address  = d.address;
    locState.distance = d.distance_km;
    locState.officeLat = d.office_lat;
    locState.officeLng = d.office_lng;
    locState.checked  = true;

    // Client-side fallback if server address is raw coordinates
    if(!locState.address || locState.address.startsWith('Location:') || locState.address.startsWith('Lat:')){
      try {
        const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${geo.lat}&lon=${geo.lng}`);
        if(nomRes.ok){
          const nomData = await nomRes.json();
          if(nomData && nomData.display_name){
            locState.address = nomData.display_name;
          }
        }
      } catch(nomErr){
        console.warn('Client-side geocode fallback error:', nomErr);
      }
    }

    updateLocBanners(d.at_office?'at':'out', locState.address, d.distance_km);
  }catch(e){
    updateLocBanners('checking','Could not get GPS — check permissions',null);
    console.error('Location error:',e);
  }
}

// ═══════════════════════════════════════════════
//  SMART LOGIN GATE  (admin-driven)
// ═══════════════════════════════════════════════
/**
 * Calls cb(snapshotId, deviceInfo) if allowed.
 * If admin has set face_required=true, opens verify sheet first.
 * If admin has NOT set face_required, proceeds directly (location still captured).
 */
function needFace(cb){
  if(!faceRequired){
    // Admin does NOT require face — proceed directly
    cb(null, devInfo());
    return;
  }
  // Admin requires face
  if(!faceReg){
    if(faceRegEnabled){
      toast('Face ID is required. Please register your face first.','warn');
      setTimeout(()=>openFace('register'), 600);
    } else {
      toast('Face ID is required for your account but registration is not yet set up. Please contact your administrator.','warn');
    }
    return;
  }
  // Required + registered → open verify sheet
  openFace('verify', cb);
}

// ═══════════════════════════════════════════════
//  FACE MODAL
// ═══════════════════════════════════════════════
function openFace(mode, cb){
  faceMode = mode; faceCb = cb||null;
  regPhotos=[]; regPhotoIndex=0;

  document.getElementById('faceTit').textContent = mode==='register'?'📸 Register Your Face (5 Photos)':'🔒 Face Verification';
  document.getElementById('faceSub').textContent = mode==='register'?'Capture 5 clear photos for reliable recognition':'Align face in frame and tap Scan';
  document.getElementById('fresult').style.display = 'none';
  document.getElementById('faceReadyBanner').classList.remove('show');

  const ppw = document.getElementById('photoProgressWrap');
  if(mode==='register'){
    ppw.style.display='block';
    updatePhotoDots(0);
    document.getElementById('scanBtn').innerHTML='<i class="fas fa-camera"></i> Starting camera…';
  } else {
    ppw.style.display='none';
    document.getElementById('scanBtn').innerHTML='<i class="fas fa-camera"></i> <span id="scanTxt">Starting camera…</span>';
  }
  document.getElementById('scanBtn').disabled=true;
  document.getElementById('cancelFaceBtn').style.display='';
  document.getElementById('faceBD').classList.add('show');
  startCam();
}

function closeFace(){
  stopCam();
  document.getElementById('faceBD').classList.remove('show');
  document.getElementById('faceReadyBanner').classList.remove('show');
  faceCb=null; regPhotos=[]; regPhotoIndex=0;
}

function startCam(){
  stopCam();
  navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:640,height:480}})
    .then(s=>{
      faceStream=s;
      const v=document.getElementById('fv');
      v.srcObject=s;
      v.onloadedmetadata=()=>{
        v.play();
        document.getElementById('scanBtn').disabled=false;
        if(faceMode==='register'){
          document.getElementById('scanBtn').innerHTML='<i class="fas fa-camera"></i> Capture Photo 1';
          document.getElementById('camTxt').textContent='Camera ready · Look straight at camera';
        } else {
          document.getElementById('scanBtn').innerHTML='<i class="fas fa-camera"></i> Scan My Face';
          document.getElementById('camTxt').textContent='✅ Camera ready — align face in oval';
        }
      };
    })
    .catch(e=>{toast('Camera error: '+e.message,'err');closeFace();});
}
function stopCam(){
  if(faceStream){faceStream.getTracks().forEach(t=>t.stop());faceStream=null;}
}
function grabFrame(){
  const v=document.getElementById('fv'),c=document.getElementById('fc');
  const w=v.videoWidth||v.clientWidth||640, h=v.videoHeight||v.clientHeight||480;
  c.width=w; c.height=h;
  c.getContext('2d').drawImage(v,0,0,w,h);
  return c.toDataURL('image/jpeg',0.90);
}

function updatePhotoDots(captured){
  for(let i=1;i<=5;i++){
    const dot=document.getElementById('pp'+i);
    if(i<=captured) dot.className='oa-dot done';
    else if(i===captured+1) dot.className='oa-dot active';
    else dot.className='oa-dot';
  }
  const msgs=[
    'Photo 1 of 5 — look straight at camera',
    'Photo 2 of 5 — slight left tilt',
    'Photo 3 of 5 — slight right tilt',
    'Photo 4 of 5 — chin slightly down',
    'Photo 5 of 5 — normal position again',
    '✅ All 5 photos captured — registering…'
  ];
  document.getElementById('ppLabel').textContent=msgs[Math.min(captured,5)];
}

async function captureAndProcess(){
  const btn=document.getElementById('scanBtn');
  btn.disabled=true;
  document.getElementById('fresult').style.display='none';
  document.getElementById('faceReadyBanner').classList.remove('show');
  const img=grabFrame();

  if(faceMode==='register'){
    regPhotos.push(img);
    regPhotoIndex++;
    updatePhotoDots(regPhotoIndex);
    document.getElementById('camTxt').textContent=`✅ Photo ${regPhotoIndex} captured`;

    if(regPhotoIndex < regPhotoCount){
      const hints=['','Tilt slightly LEFT','Tilt slightly RIGHT','Chin slightly DOWN','Normal position'];
      document.getElementById('scanBtn').innerHTML=`<i class="fas fa-camera"></i> Capture Photo ${regPhotoIndex+1}`;
      document.getElementById('camTxt').textContent=`📸 Photo ${regPhotoIndex}/${regPhotoCount} done · Next: ${hints[regPhotoIndex]||'look at camera'}`;
      btn.disabled=false;
      return;
    }

    // All 5 — send to server
    btn.innerHTML='<i class="fas fa-spinner spin"></i> Registering…';
    document.getElementById('camTxt').textContent='🔄 Processing all 5 photos…';
    let rawText='';
    try{
      const r=await fetch('/api/face/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({images:regPhotos})});
      rawText=await r.text();
      let d;
      try{d=JSON.parse(rawText);}catch(pe){throw new Error('Server returned non-JSON: '+rawText.substring(0,200));}
      if(d.ok){
        showFR(true,'Face Registered! ✅',d.message||`${d.photo_count} photos stored.`);
        // Refresh face status
        await loadFaceStatus();
        stopCam();
        document.getElementById('photoProgressWrap').style.display='none';
        setTimeout(closeFace, 2500);
      } else {
        if(d.admin_required){
          showFR(false,'Not Permitted ❌','Face registration has not been enabled by admin.');
          setTimeout(closeFace,2500);
        } else if(d.bad_pairs){
          showFR(false,'Photos Don\'t Match ❌',d.error);
          regPhotos=[]; regPhotoIndex=0;
          updatePhotoDots(0);
          document.getElementById('scanBtn').innerHTML='<i class="fas fa-camera"></i> Retry — Capture Photo 1';
          btn.disabled=false;
        } else if(d.photo_index!==undefined){
          showFR(false,`Photo ${d.photo_index+1} Failed ❌`,d.error);
          regPhotos.pop(); regPhotoIndex--;
          updatePhotoDots(regPhotoIndex);
          document.getElementById('scanBtn').innerHTML=`<i class="fas fa-camera"></i> Retry Photo ${regPhotoIndex+1}`;
          btn.disabled=false;
        } else {
          showFR(false,'Registration Failed ❌',d.error||'Unknown error');
          btn.disabled=false;
          btn.innerHTML='<i class="fas fa-camera"></i> Retry';
        }
      }
    }catch(e){
      showFR(false,'Error: '+e.message,'Check connection and try again.');
      btn.disabled=false;
      btn.innerHTML='<i class="fas fa-camera"></i> Retry';
    }

  } else {
    // ── Verify ──
    btn.innerHTML='<i class="fas fa-spinner spin"></i> Verifying…';
    document.getElementById('camTxt').textContent='Checking identity…';
    try{
      const r=await fetch('/api/face/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:img,device_info:devInfo(),at_office:locState.atOffice})});
      const d=await r.json();
      if(d.ok){
        document.getElementById('faceReadyBanner').classList.add('show');
        document.getElementById('camTxt').textContent='✅ Identity confirmed!';
        stopCam();
        const cb=faceCb; faceCb=null;
        setTimeout(()=>{closeFace(); if(cb) cb(d.snapshot_id, devInfo());}, 1800);
      } else {
        const dist=d.distance?` (score: ${d.distance.toFixed(3)})`:'';
        showFR(false,'Face Mismatch ❌',(d.error||'Face did not match.')+dist+'\nEnsure good lighting and face the camera directly.');
        document.getElementById('camTxt').textContent='❌ Mismatch — try again';
        btn.innerHTML='<i class="fas fa-camera"></i> Try Again';
        btn.disabled=false;
      }
    }catch(e){
      showFR(false,'Network Error',e.message);
      btn.innerHTML='<i class="fas fa-camera"></i> Try Again';
      btn.disabled=false;
    }
  }
}

function showFR(ok, msg, sub){
  const el=document.getElementById('fresult');
  el.style.display='block';
  el.className='oa-result show '+(ok?'ok':'err');
  document.getElementById('fricon').textContent=ok?'✅':'❌';
  document.getElementById('frmsg').textContent=msg;
  document.getElementById('frsub').textContent=sub||'';
}

// ═══════════════════════════════════════════════
//  FACE STATUS POLL  (lightweight)
// ═══════════════════════════════════════════════
async function loadFaceStatus(){
  try{
    const r=await fetch('/api/face/status');
    const d=await r.json();
    updateFaceBadge(
      d.face_registered        || false,
      d.face_registration_enabled || false,
      d.face_required          || false,
      d.photo_count            || 0
    );
  }catch(e){ console.error('Face status error:',e); }
}

// ═══════════════════════════════════════════════
//  ATTENDANCE ACTIONS
// ═══════════════════════════════════════════════
function doNLogin(){
  needFace(async(snapId, di)=>{
    const btn=document.getElementById('btnNLogin');
    btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner spin"></i>';
    try{
      const geo=await getGeo();
      const r=await fetch('/attendance/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat:geo.lat,lng:geo.lng,login_type:'normal',snapshot_id:snapId,device_info:di||devInfo(),at_office:locState.atOffice})});
      const d=await r.json();
      if(d.ok){
        toast(`✅ Logged in! ${d.at_office?'🏢 Office':'📡 Remote'}`,'ok');
        document.getElementById('nLoginTime').textContent=d.login_time;
        document.getElementById('nLoginAddr').textContent=d.address||'—';
        loadDD();
      } else toast(d.error||'Login failed','err');
    }catch(e){toast(e.message||'Error','err');}
    finally{btn.disabled=false;btn.innerHTML='<i class="fas fa-sign-in-alt"></i> Login';}
  });
}

function doNLogout(){
  const btn=document.getElementById('btnNLogout');
  btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner spin"></i>';
  getGeo().catch(()=>({lat:null,lng:null})).then(geo=>doLogout(geo.lat,geo.lng,'normal'))
    .finally(()=>{btn.disabled=false;btn.innerHTML='<i class="fas fa-sign-out-alt"></i> Logout';});
}

function doShiftLogin(type){
  needFace(async(snapId,di)=>{
    const name=type==='shift1'?'Shift 1':'Shift 2';
    const btn=document.getElementById(type==='shift1'?'btnS1L':'btnS2L');
    btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner spin"></i>';
    try{
      const geo=await getGeo();
      const r=await fetch('/attendance/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat:geo.lat,lng:geo.lng,login_type:'shift',shift_type:type,shift_name:name,snapshot_id:snapId,device_info:di||devInfo(),at_office:locState.atOffice})});
      const d=await r.json();
      if(d.ok){
        toast(`✅ ${name} started! ${d.at_office?'🏢':'📡'}`,'ok');
        document.getElementById(type==='shift1'?'s1lt':'s2lt').textContent=d.login_time;
        document.getElementById(type==='shift1'?'s1la':'s2la').textContent=d.address||'—';
        loadDD();
      } else toast(d.error||'Failed','err');
    }catch(e){toast(e.message,'err');}
    finally{btn.disabled=false;btn.innerHTML=`<i class="fas fa-play"></i> Start ${type==='shift1'?'S1':'S2'}`;}
  });
}

function doShiftLogout(type){
  const btn=document.getElementById(type==='shift1'?'btnS1O':'btnS2O');
  btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner spin"></i>';
  getGeo().catch(()=>({lat:null,lng:null})).then(geo=>doLogout(geo.lat,geo.lng,type))
    .finally(()=>{btn.disabled=false;btn.innerHTML=`<i class="fas fa-stop"></i> End ${type==='shift1'?'S1':'S2'}`});
}

async function doLogout(lat,lng,type,force=false){
  const r=await fetch('/attendance/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat,lng,shift_type:type,force_logout:force})});
  const d=await r.json();
  if(d.warning){
    openConf(d.message,()=>doLogout(lat,lng,type,true));
  } else if(d.ok){
    toast(`✅ Logged out · ${d.hours}h worked`,d.target_achieved?'ok':'warn');
    if(type==='normal'){document.getElementById('nLogoutTime').textContent=d.logout_time;document.getElementById('nLogoutAddr').textContent=d.address||'—';}
    else if(type==='shift1'){document.getElementById('s1ot').textContent=d.logout_time;document.getElementById('s1oa').textContent=d.address||'—';}
    else{document.getElementById('s2ot').textContent=d.logout_time;document.getElementById('s2oa').textContent=d.address||'—';}
    loadDD();
  } else toast(d.error||'Logout failed','err');
}

// ═══════════════════════════════════════════════
//  DASHBOARD DATA
// ═══════════════════════════════════════════════
async function loadDD(){
  try{
    const r=await fetch('/api/dashboard-data');
    const d=await r.json();
    if(d.error) throw new Error(d.error);
    DD=d;

    if (d.active_session) {
      const target = d.active_session.login_type === 'normal' ? d.work_hours_target : (d.shift_target || 4);
      if (d.active_session.hours >= target && !window.shiftTargetNotified) {
        toast("🎉 Working hours target completed! You may log out or continue working.", "ok");
        window.shiftTargetNotified = true;
      }
    } else {
      window.shiftTargetNotified = false;
    }


    // Face status (admin-driven)
    updateFaceBadge(
      d.face_registered          || false,
      d.face_registration_enabled || false,
      d.face_required            || false,
      d.face_photo_count         || 0
    );

    document.getElementById('wname').textContent  =d.username;
    document.getElementById('dname').textContent  =d.username;
    document.getElementById('davatar').textContent=d.username[0].toUpperCase();

    // Shift attendance is OFF unless an administrator turns it on for this user.
    const shiftOn = d.shift_login_enabled === true;
    document.querySelectorAll('[data-tab="shift"]').forEach(el=>{
        el.style.display = shiftOn ? '' : 'none';
    });
    const shiftTile = document.getElementById('tileShift');
    if(shiftTile) shiftTile.style.display = shiftOn ? '' : 'none';
    if(!shiftOn){
        const sp = document.getElementById('tab-shift');
        if(sp && sp.classList.contains('on')) goTab('normal');
    }

    // Normal tab
    document.getElementById('nHoursToday').textContent=d.total_hours_today.toFixed(1);
    document.getElementById('nTarget').textContent=`/ ${d.work_hours_target}h`;
    const pct=Math.min(100,(d.total_hours_today/d.work_hours_target)*100);
    document.getElementById('nProgBar').style.width=pct+'%';

    // Signature meter
    drawArc(d.total_hours_today, d.work_hours_target);
    const rem = Math.max(0, d.work_hours_target - d.total_hours_today);
    const remEl = document.getElementById('arcRemain');
    if(remEl) remEl.textContent = rem <= 0 ? 'target met' : rem.toFixed(1) + 'h';
    const tgtEl = document.getElementById('arcTarget');
    if(tgtEl) tgtEl.textContent = Number(d.work_hours_target).toFixed(1) + 'h';

    if(d.active_session && d.active_session.login_type==='normal'){
      document.getElementById('nHoursSess').textContent =d.active_session.hours;
      document.getElementById('nSessStatus').textContent='On duty since '+d.active_session.login_time;
      document.getElementById('nLoginTime').textContent =d.active_session.login_time;
      document.getElementById('nLoginAddr').textContent =d.active_session.login_address||'—';
      document.getElementById('btnNLogin').disabled =true;
      document.getElementById('btnNLogout').disabled=false;
    } else {
      document.getElementById('nHoursSess').textContent ='0.0';
      document.getElementById('nSessStatus').textContent='Not signed in yet';
      document.getElementById('btnNLogin').disabled =false;
      document.getElementById('btnNLogout').disabled=true;
    }

    // Shift tab
    document.getElementById('sTotalDisp').textContent =d.total_hours_today.toFixed(1);
    document.getElementById('sTargetDisp').textContent=d.work_hours_target;
    const st=d.shift_target||4;
    document.getElementById('s1hl').textContent=d.shift1_hours.toFixed(1)+'h worked';
    document.getElementById('s1tl').textContent='/ '+st.toFixed(1)+'h';
    document.getElementById('s2hl').textContent=d.shift2_hours.toFixed(1)+'h worked';
    document.getElementById('s2tl').textContent='/ '+st.toFixed(1)+'h';
    document.getElementById('s1bar').style.width=Math.min(100,(d.shift1_hours/st)*100)+'%';
    document.getElementById('s2bar').style.width=Math.min(100,(d.shift2_hours/st)*100)+'%';

    const pill=(id,done,active)=>{
      const el=document.getElementById(id);
      if(done){el.className='oa-tag ok';el.textContent='Complete';}
      else if(active){el.className='oa-tag info';el.textContent='Running';}
      else{el.className='oa-tag';el.textContent='Not started';}
    };
    const s1a=d.active_session?.shift_type==='shift1', s2a=d.active_session?.shift_type==='shift2';
    pill('s1pill',d.shift1_completed,s1a);
    pill('s2pill',d.shift2_completed,s2a);
    document.getElementById('btnS1L').disabled=d.shift1_completed||s1a;
    document.getElementById('btnS1O').disabled=!s1a;
    document.getElementById('btnS2L').disabled=d.shift2_completed||s2a;
    document.getElementById('btnS2O').disabled=!s2a;
    if(s1a){document.getElementById('s1lt').textContent=d.active_session.login_time;document.getElementById('s1la').textContent=d.active_session.login_address||'—';}
    if(s2a){document.getElementById('s2lt').textContent=d.active_session.login_time;document.getElementById('s2la').textContent=d.active_session.login_address||'—';}

    // History
    attMap={};
    d.history.forEach(h=>{if(!attMap[h.date])attMap[h.date]=[];attMap[h.date].push(h);});
    renderHist(d.history.filter(h=>h.login_type==='normal').slice(0,10),'nHistory');

    await loadLeaves();
    await loadHols();
  }catch(e){toast('Load error: '+e.message,'err');}
}

function renderHist(list,id){
  const el=document.getElementById(id);
  if(!el) return;
  if(!list.length){
    el.innerHTML='<div class="oa-empty"><i class="fas fa-book-open"></i><p>Nothing recorded yet</p></div>';
    return;
  }
  const MON=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  el.innerHTML=list.map(h=>{
    const p=(h.date||'').split('-');
    const dd=p[2]||'--', mm=MON[(parseInt(p[1],10)||1)-1]||'';
    const open=!h.logout_time||h.logout_time==='N/A';
    const locStr = (h.login_address && !h.login_address.startsWith('Location:') && !h.login_address.startsWith('Lat:'))
      ? h.login_address
      : (h.login_lat && h.login_lng ? `${h.login_lat.toFixed(6)}, ${h.login_lng.toFixed(6)}` : '');

    return `<div class="oa-entry">
      <div class="day"><div class="d">${dd}</div><div class="m">${mm}</div></div>
      <div class="bd">
        <div class="kind">${h.shift_name||'Normal duty'}
          <span class="oa-tag ${h.at_office?'ok':''}" style="margin-left:6px">${h.at_office?'Head Office':'Off site'}</span>
        </div>
        <div class="times">${h.login_time} \u2192 ${open?'still on duty':h.logout_time}</div>
        ${locStr ? `<div style="font-size:0.75rem;color:var(--t2);margin-top:3px;"><i class="fas fa-location-dot" style="color:var(--accent,#0071e3)"></i> <strong>Logged in Location:</strong> ${locStr}</div>` : ''}
      </div>
      <div class="hrs">${h.hours}h</div>
    </div>`;
  }).join('');
}

function scrollToLocationCard(){
  goTab('normal');
  const card = document.getElementById('userMapCard') || document.getElementById('locBanner');
  if(card){
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.style.transition = 'box-shadow 0.4s ease';
    card.style.boxShadow = '0 0 0 3px rgba(0, 113, 227, 0.4)';
    setTimeout(() => { card.style.boxShadow = ''; }, 2000);
  }
}

// ─ Stats & Preset Periods (Weekly & Monthly without manual date pickers) ─
let currentStatsPeriod = 'week';

function switchStatsPeriod(period){
  currentStatsPeriod = period;
  const btnW = document.getElementById('btnStatsWeek');
  const btnM = document.getElementById('btnStatsMonth');
  if(period === 'week'){
    btnW.style.background = 'var(--blue)'; btnW.style.color = 'white'; btnW.style.fontWeight = '800';
    btnM.style.background = 'transparent'; btnM.style.color = 'var(--t2)'; btnM.style.fontWeight = '700';
  } else {
    btnM.style.background = 'var(--blue)'; btnM.style.color = 'white'; btnM.style.fontWeight = '800';
    btnW.style.background = 'transparent'; btnW.style.color = 'var(--t2)'; btnW.style.fontWeight = '700';
  }
  loadStats();
}

async function loadStats(){
  const today = new Date();
  let fromDate = new Date();
  if(currentStatsPeriod === 'week'){
    const day = today.getDay() || 7;
    fromDate.setDate(today.getDate() - day + 1);
  } else {
    fromDate.setDate(1);
  }
  const from = fromDate.toISOString().split('T')[0];
  const to = today.toISOString().split('T')[0];
  try{
    const r=await fetch('/api/statistics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start_date:from,end_date:to})});
    const d=await r.json();
    if(!d.ok){toast(d.error||'Error','err');return;}
    document.getElementById('statsOut').style.display='block';
    document.getElementById('svDays').textContent  =d.total_days;
    document.getElementById('svHours').textContent =d.total_hours.toFixed(1);
    document.getElementById('svAvg').textContent   =d.avg_hours_per_day.toFixed(1);
    document.getElementById('svLeaves').textContent=d.leaves_taken;
    document.getElementById('svEarly').textContent =d.early_logouts;
    document.getElementById('svSess').textContent  =(d.shift1_sessions||0)+(d.shift2_sessions||0)+(d.normal_sessions||0);
    document.getElementById('svS1').textContent    =d.shift1_hours.toFixed(1);
    document.getElementById('svS2').textContent    =d.shift2_hours.toFixed(1);
    document.getElementById('svNorm').textContent  =d.normal_hours.toFixed(1);
    if(DD){const f=DD.history.filter(h=>h.date>=from&&h.date<=to);renderHist(f,'stHistory');}
  }catch{toast('Stats error','err');}
}

// PWA Mobile Installation Prompt Logic
let deferredPwaPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  const pwaBanner = document.getElementById('pwaBanner');
  if(pwaBanner) pwaBanner.style.display = 'flex';
});

async function installPWA(){
  if(deferredPwaPrompt){
    deferredPwaPrompt.prompt();
    const { outcome } = await deferredPwaPrompt.userChoice;
    if(outcome === 'accepted'){
      toast('✅ JAIN Portal App Installed!','ok');
      document.getElementById('pwaBanner').style.display = 'none';
    }
    deferredPwaPrompt = null;
  } else {
    toast('📱 To install on mobile: Tap browser menu (⋮ or Share) and select "Add to Home Screen"','info');
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/static/sw.js').catch(err => console.log('SW reg failed: ', err));
  });
}

// ─ Calendar ─
function renderCal(){
  const y=calDt.getFullYear(),m=calDt.getMonth();
  document.getElementById('calMon').textContent=calDt.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const g=document.getElementById('calGrid'); g.innerHTML='';
  ['S','M','T','W','T','F','S'].forEach(d=>{const x=document.createElement('div');x.className='oa-cal-dh';x.textContent=d;g.appendChild(x);});
  const first=new Date(y,m,1),last=new Date(y,m+1,0),today=new Date();
  for(let i=0;i<first.getDay();i++){const x=document.createElement('div');x.className='oa-cal-day other';x.textContent=new Date(y,m,0).getDate()-first.getDay()+1+i;g.appendChild(x);}
  for(let d=1;d<=last.getDate();d++){
    const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const el=document.createElement('div');el.className='oa-cal-day';el.textContent=d;
    if(d===today.getDate()&&m===today.getMonth()&&y===today.getFullYear())el.classList.add('today');
    if(holMap[ds])el.classList.add('holiday');
    else if(lvMap[ds]?.status==='approved')el.classList.add('leave');
    else if(attMap[ds]?.length){el.classList.add('present');if(attMap[ds].length>1){const dot=document.createElement('div');dot.className='oa-cal-dot';el.appendChild(dot);}}
    el.onclick=()=>calTap(ds);
    g.appendChild(el);
  }
}
function moveCal(d){calDt.setMonth(calDt.getMonth()+d);renderCal();loadMonHols();}
function calTap(ds){
  if(holMap[ds])return toast('🎉 '+holMap[ds].name,'info');
  if(lvMap[ds]?.status==='approved')return toast('📅 '+lvMap[ds].type+' – Approved','info');
  const s=attMap[ds]||[];
  if(s.length)toast(`✅ ${s.length} session · ${s[0].login_time}→${s[0].logout_time||'Active'} · ${s[0].hours}h`,'ok');
  else openConf(`No attendance on ${ds}. Apply for leave?`,()=>openLeave(ds));
}

async function loadHols(){
  try{
    const r=await fetch('/api/holidays');const d=await r.json();
    const today=new Date(), ws=new Date(today); ws.setDate(today.getDate()-today.getDay());
    const we=new Date(ws); we.setDate(ws.getDate()+6);
    const wh=[],mh=[];
    Object.entries(d.holidays).forEach(([dt,info])=>{
      const hd=new Date(dt);
      if(hd>=ws&&hd<=we)wh.push({date:dt,...info});
      if(hd.getMonth()===today.getMonth()&&hd.getFullYear()===today.getFullYear())mh.push({date:dt,...info});
    });
    holMap=d.holidays||{};
    const rh=(list,id)=>{const el=document.getElementById(id);if(!el)return;el.innerHTML=list.length?list.map(h=>`<div class="oa-holiday"><div class="nm">${h.name}</div><div class="mt"><span>${h.date}</span><span class="oa-tag gold">${h.type}</span></div></div>`).join(''):'<div class="oa-empty"><i class="fas fa-mug-hot"></i><p>No holidays in this period</p></div>';};
    rh(wh,'weekHols'); rh(mh,'monHols');
    renderCal();
  }catch{}
}
async function loadMonHols(){
  try{const r=await fetch(`/api/holidays?year=${calDt.getFullYear()}&month=${calDt.getMonth()+1}`);const d=await r.json();holMap={...holMap,...(d.holidays||{})};renderCal();}catch{}
}
async function loadLeaves(){
  try{
    const r=await fetch('/api/leaves');lvMap=await r.json();
    const app=Object.entries(lvMap).filter(([,v])=>v.status==='approved').map(([date,v])=>({date,...v})).sort((a,b)=>a.date.localeCompare(b.date));
    const el=document.getElementById('myLeaves');
    el.innerHTML=app.length?app.map(l=>`<div class="oa-holiday" style="border-left-color:var(--ok)"><div class="nm">${l.type}</div><div class="mt"><span>${l.date}</span><span class="oa-tag ok">Approved</span></div></div>`).join(''):'<div class="oa-empty"><i class="fas fa-calendar-check"></i><p>No approved leave yet</p></div>';
    renderCal();
  }catch{}
}

// ─ Leave modal ─
function openLeave(ds=null){
  const inp=document.getElementById('lvDate');
  if(ds)inp.value=ds;
  else{const t=new Date();t.setDate(t.getDate()+1);inp.value=t.toISOString().split('T')[0];}
  inp.min=new Date().toISOString().split('T')[0];
  document.getElementById('leaveBD').classList.add('show');
}
function closeLeaveBD(){document.getElementById('leaveBD').classList.remove('show');}
async function submitLeave(){
  const date=document.getElementById('lvDate').value;
  const type=document.getElementById('lvType').value;
  const comments=document.getElementById('lvReason').value;
  if(!date||!type){toast('Fill required fields','warn');return;}
  try{
    const r=await fetch('/api/leave/apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date,type,comments})});
    const d=await r.json();
    if(d.ok){toast('✅ Leave submitted','ok');closeLeaveBD();await loadLeaves();}
    else toast(d.error||'Failed','err');
  }catch{toast('Submit error','err');}
}

// ─ Confirm modal ─
function openConf(msg,cb){
  document.getElementById('confMsg').textContent=msg;
  document.getElementById('confYes').onclick=()=>{closeConf();cb();};
  document.getElementById('confBD').classList.add('show');
}
function closeConf(){document.getElementById('confBD').classList.remove('show');}

// ─ Backdrop tap ─
['faceBD','leaveBD','confBD'].forEach(id=>{
  document.getElementById(id).addEventListener('click',e=>{
    if(e.target.id===id){
      if(id==='faceBD')closeFace();
      else if(id==='leaveBD')closeLeaveBD();
      else closeConf();
    }
  });
});

// ─ Logout ─
function handleLogout(){ window.location.href='/logout'; }

// ─ Helpers ─
function getGeo(){
  return new Promise((res,rej)=>{
    if(!navigator.geolocation) return rej(new Error('Geolocation not supported'));
    const optsHigh = { enableHighAccuracy: true, timeout: 3500, maximumAge: 60000 };
    const optsLow  = { enableHighAccuracy: false, timeout: 3500, maximumAge: 60000 };

    navigator.geolocation.getCurrentPosition(
      p => res({lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy}),
      (err) => {
        navigator.geolocation.getCurrentPosition(
          p => res({lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy}),
          (err2) => rej(new Error('Location permission required or GPS unavailable')),
          optsLow
        );
      },
      optsHigh
    );
  });
}
function devInfo(){
  return{userAgent:navigator.userAgent,platform:navigator.platform,screen:`${screen.width}x${screen.height}`,deviceMemory:navigator.deviceMemory||'N/A',cores:navigator.hardwareConcurrency||'N/A',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,imei:'Not available (browser)'};
}

async function loadTeamToday(){
  try{
    const res  = await fetch('/api/user/team-today');
    const data = await res.json();
    if(!data.ok) return;

    document.querySelectorAll('[data-team-count]').forEach(b=>{
      b.textContent = data.count + (data.count === 1 ? ' on duty' : ' on duty');
    });

    const html = (!data.team || !data.team.length)
      ? '<div class="oa-empty"><i class="fas fa-user-clock"></i><p>Nobody has signed in yet today</p></div>'
      : data.team.map(m => {
          const badge = m.location_badge === 'on-campus' ? 'badge-hq'
                      : m.location_badge === 'near-campus' ? 'badge-near'
                      : 'badge-remote';
          const initial = (m.username || '?').charAt(0).toUpperCase();
          const where = m.login_address
            ? `<div class="loc"><i class="fas fa-location-dot"></i><span>${m.login_address}</span></div>`
            : '';
          return `
            <div class="oa-mate ${m.is_current_user ? 'self' : ''}">
              <div class="av">${initial}</div>
              <div class="bd">
                <div class="nm">${m.username}${m.is_current_user ? '<span class="you">you</span>' : ''}</div>
                <div class="mt">${m.shift_name} \u00b7 in at ${m.login_time}</div>
                ${where}
              </div>
              <span class="badge ${badge}">${m.location_status}</span>
            </div>`;
        }).join('');

    document.querySelectorAll('[data-team-list]').forEach(el => { el.innerHTML = html; });
  }catch(e){
    console.error('Team roster failed:', e);
  }
}

// ─ Init ─
Promise.all([loadDD(), loadTeamToday()]).then(() => {
  setTimeout(refreshLocation, 200);
}).catch(() => {
  setTimeout(refreshLocation, 200);
});
setInterval(loadDD, 60000);
setInterval(loadTeamToday, 60000);


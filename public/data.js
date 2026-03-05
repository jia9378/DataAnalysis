/* ============================================================
   Spirit Slices — data.js
   Hub: particle cloud from pieCT.png
   Layer nav for other data views
   ============================================================ */

/* ── STATE ────────────────────────────────────────────────── */
var currentView = 'hub'; // 'hub' or 'layer'

/* ══════════════════════════════════════════════════════════════
   THREE.JS — Hub particle cloud
   ══════════════════════════════════════════════════════════════ */
var cvs = document.getElementById('hub-canvas');
var scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);
var camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 4000);
camera.position.set(100, 20, 600);
var renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

/* Sprite texture */
function makeSprite(sharpness) {
  var sz = 64, tc = document.createElement('canvas');
  tc.width = tc.height = sz;
  var tx = tc.getContext('2d');
  var f = 0.15 + sharpness * 0.35, s2 = Math.min(f * 2, 0.95);
  var g = tx.createRadialGradient(sz/2, sz/2, 0, sz/2, sz/2, sz/2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(f, 'rgba(255,255,255,0.85)');
  g.addColorStop(s2, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  tx.fillStyle = g; tx.fillRect(0, 0, sz, sz);
  return new THREE.CanvasTexture(tc);
}
var TEX_BONE = makeSprite(1.0);
var TEX_GRAY = makeSprite(0.5);
var TEX_SOFT = makeSprite(0.05);

/* Off-screen canvas */
var oc = document.createElement('canvas');
var octx = oc.getContext('2d', { willReadFrequently: true });

function extractPixels(img) {
  oc.width = img.naturalWidth;
  oc.height = img.naturalHeight;
  octx.drawImage(img, 0, 0);
  return octx.getImageData(0, 0, oc.width, oc.height);
}

/* PRNG */
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Build particle cloud from image data */
var SAMPLE = 3;
var THRESH = 45;
var cloudMesh = null;

function buildCloud(imgData) {
  var d = imgData.data, w = imgData.width, h = imgData.height;
  var pos = [], col = [];
  var cx = w / 2, cy = h / 2;
  var rng = mulberry32(42);
  var scale = 160 / cx; // normalize to ~160 units

  for (var y = 0; y < h; y += SAMPLE) {
    for (var x = 0; x < w; x += SAMPLE) {
      var i = (y * w + x) * 4;
      var lum = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
      if (lum < THRESH) continue;

      var t = lum / 255;
      var nx = (x - cx) * scale;
      var ny = -(y - cy) * scale;

      if (t > 0.65) {
        // Bone — tight, bright
        var js = (1.0 - t) * 0.5;
        pos.push(nx + (rng()-0.5)*6*js, ny + (rng()-0.5)*6*js, (rng()-0.5)*8);
        var wb = (t - 0.65) / 0.35;
        col.push(0.9+wb*0.3, 0.9+wb*0.3, 0.9+wb*0.3);
      } else if (t > 0.30) {
        if (rng() > 0.3) {
          var js2 = 0.5 + ((0.65 - t) / 0.35) * 0.6;
          pos.push(nx + (rng()-0.5)*10*js2, ny + (rng()-0.5)*10*js2, (rng()-0.5)*11);
          var gt = (t - 0.30) / 0.35;
          col.push(0.12+gt*0.35, 0.13+gt*0.36, 0.15+gt*0.38);
        }
      } else {
        if (rng() > 0.55) {
          pos.push(nx + (rng()-0.5)*12, ny + (rng()-0.5)*12, (rng()-0.5)*10);
          var st = t / 0.30;
          col.push(0.05+st*0.10, 0.06+st*0.11, 0.07+st*0.13);
        }
      }
    }
  }

  // Build mesh
  if (cloudMesh) { scene.remove(cloudMesh); cloudMesh.geometry.dispose(); cloudMesh.material.dispose(); }

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  var mat = new THREE.PointsMaterial({
    size: 2,
    vertexColors: true,
    map: TEX_GRAY,
    alphaTest: 0.005,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  cloudMesh = new THREE.Points(geo, mat);
  scene.add(cloudMesh);
}

/* Load pieCT.png */
function loadPieImage() {
  var img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function() {
    var data = extractPixels(img);
    buildCloud(data);
  };
  img.onerror = function() {
    console.warn('pieCT.png not found');
  };
  img.src = 'pieCT.png';
}

/* Slow rotation */
var rotY = 0;
function animate() {
  requestAnimationFrame(animate);
  if (currentView === 'hub' && cloudMesh) {
    // rotY += 0.001;
    cloudMesh.rotation.y = rotY;
  }
  renderer.render(scene, camera);
}

/* Resize */
window.addEventListener('resize', function() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ══════════════════════════════════════════════════════════════
   NAVIGATION
   ══════════════════════════════════════════════════════════════ */
var hub = document.getElementById('hub');
var layerWrap = document.getElementById('layer-wrap');
var layers = document.querySelectorAll('.layer');
var lnTabs = document.querySelectorAll('.ln-tab');

function showHub() {
  currentView = 'hub';
  hub.classList.remove('off');
  layerWrap.classList.add('off');
  window.scrollTo(0, 0);
}

function showLayer(idx) {
  currentView = 'layer';
  hub.classList.add('off');
  layerWrap.classList.remove('off');

  // Show correct layer
  layers.forEach(function(l) { l.style.display = 'none'; });
  var target = document.getElementById('layer-' + idx);
  if (target) target.style.display = 'block';

  // Update tabs
  lnTabs.forEach(function(t) {
    t.classList.toggle('active', parseInt(t.dataset.idx) === idx);
  });

  window.scrollTo(0, 0);
}

// Hub nav buttons
document.querySelectorAll('.hub-btn[data-layer]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    showLayer(parseInt(btn.dataset.layer));
  });
});

// Back to hub
document.getElementById('btn-hub').addEventListener('click', showHub);

// Layer tabs
lnTabs.forEach(function(tab) {
  tab.addEventListener('click', function() {
    showLayer(parseInt(tab.dataset.idx));
  });
});

// Submit button — handled by form logic below

/* ══════════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════════ */
loadPieImage();
animate();
/* ══════════════════════════════════════════════════════════════
   SUBMIT YOUR DATA — Form + Analysis + Results
   ══════════════════════════════════════════════════════════════ */

var DRINK_CATS = [
  { label: 'NON-DRINKER', range: '0 DAYS', min: 0, max: 0,
    mood: 'MOOD DISTRESS', k6: 'K6 SCORE', sleep: 'SLEEP TROUBLE', gm: 'GREY MATTER',
    moodImg: 'assets/distress/distressCT0.png',
    k6Img:   'assets/k6/Layer 10.jpg',
    sleepImg:'assets/sleep/sleepCT0.png',
    gmImg:   'assets/grey/greyCT0.png',
    quote: 'Zero drinks, zero withdrawal. But the question remains — what are you numbing with something else?' },
  { label: 'LIGHT DRINKER', range: '1-4 DAYS', min: 1, max: 4,
    mood: 'MOOD DISTRESS', k6: 'K6 SCORE', sleep: 'SLEEP TROUBLE', gm: 'GREY MATTER',
    moodImg: 'assets/distress/distressCT1.png',
    k6Img:   'assets/k6/k6CT1.png',
    sleepImg:'assets/sleep/sleepCT1.jpg',
    gmImg:   'assets/grey/greyCT1.png',
    quote: 'Light drinking. Socially invisible. But your brain already registers the pattern. The reward circuit is listening.' },
  { label: 'MODERATE DRINKER', range: '5-11 DAYS', min: 5, max: 11,
    mood: 'MOOD DISTRESS', k6: 'K6 SCORE', sleep: 'SLEEP TROUBLE', gm: 'GREY MATTER',
    moodImg: 'assets/distress/distressCT2.png',
    k6Img:   'assets/k6/k6CT2.png',
    sleepImg:'assets/sleep/sleepCT2.png',
    gmImg:   'assets/grey/greyCT2.png',
    quote: 'The glass you had yesterday is already reinforcing your craving today. Your neural system has been nudged in that direction. If you quit today, tomorrow you\'ll be less vulnerable.' },
  { label: 'HEAVY DRINKER', range: '12-19 DAYS', min: 12, max: 19,
    mood: 'MOOD DISTRESS', k6: 'K6 SCORE', sleep: 'SLEEP TROUBLE', gm: 'GREY MATTER',
    moodImg: 'assets/distress/distressCT3.png',
    k6Img:   'assets/k6/k6CT3.png',
    sleepImg:'assets/sleep/sleepCT3.png',
    gmImg:   'assets/grey/greyCT3.png',
    quote: 'More days drinking than not. Withdrawal symptoms are measurable. Your sleep architecture is disrupted. The frontal cortex is losing volume.' },
  { label: 'VERY HEAVY DRINKER', range: '20-30 DAYS', min: 20, max: 30,
    mood: 'MOOD DISTRESS', k6: 'K6 SCORE', sleep: 'SLEEP TROUBLE', gm: 'GREY MATTER',
    moodImg: 'assets/distress/distressCT4.png',
    k6Img:   'assets/k6/k6CT4.png',
    sleepImg:'assets/sleep/sleepCT4.png',
    gmImg:   'assets/grey/greyCT4.png',
    quote: 'One in five report withdrawal-related sleep trouble. Grey matter volume loss equivalent to 5.5 years of aging. This is not a habit. This is a neurological trajectory.' },
];

function classifyDays(days) {
  days = parseInt(days) || 0;
  if (days <= 0) return 0;
  if (days <= 4) return 1;
  if (days <= 11) return 2;
  if (days <= 19) return 3;
  return 4;
}

/* Show form */
document.getElementById('btn-submit').addEventListener('click', function() {
  document.getElementById('submit-overlay').classList.remove('off');
});

document.getElementById('form-close').addEventListener('click', function() {
  document.getElementById('submit-overlay').classList.add('off');
});

/* Submit form */
document.getElementById('form-submit').addEventListener('click', function() {
  var name = document.getElementById('input-name').value.trim() || 'Anonymous';
  var days = parseInt(document.getElementById('input-days').value);

  if (isNaN(days) || days < 0 || days > 30) {
    document.getElementById('input-days').style.borderColor = '#a44';
    return;
  }

  var catIdx = classifyDays(days);
  var cat = DRINK_CATS[catIdx];

  // Save to server
  fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, days: days, category: cat.label })
  }).catch(function() { /* silently fail if server unavailable */ });

  // Hide form, show scan animation
  document.getElementById('submit-overlay').classList.add('off');
  document.getElementById('scan-overlay').classList.remove('off');
  hub.classList.add('off');

  // After animation, show results
  setTimeout(function() {
    document.getElementById('scan-overlay').classList.add('off');
    showResults(name, days, catIdx);
  }, 1800);
});

function showResults(name, days, catIdx) {
  var cat = DRINK_CATS[catIdx];

  document.getElementById('res-title').textContent = cat.label;
  document.getElementById('res-freq').textContent = 'FREQUENCY: ' + days + ' DAYS / 30 DAYS';

  // Images
  document.getElementById('res-img-mood').src = cat.moodImg;
  document.getElementById('res-img-k6').src = cat.k6Img;
  document.getElementById('res-img-sleep').src = cat.sleepImg;
  // Grey matter: use placeholder if no image
  var gmImg = document.getElementById('res-img-gm');
  if (cat.gmImg) { gmImg.src = cat.gmImg; gmImg.style.display = 'block'; }
  else { gmImg.style.display = 'none'; }

  // Values
  document.getElementById('res-val-mood').textContent = cat.mood;
  document.getElementById('res-val-k6').textContent = cat.k6;
  document.getElementById('res-val-sleep').textContent = cat.sleep;
  document.getElementById('res-val-gm').textContent = cat.gm;

  // Table
  var tbl = cat.label.toUpperCase() + '             POSSIBILITY\n';
  tbl +=    '---------------------------------------------\n';
  tbl +=    'MOOD DISORDER                ' + cat.mood + '\n';
  tbl +=    'K6 SCORE                     ' + cat.k6 + '\n';
  tbl +=    'SLEEP TROUBLE                ' + cat.sleep + '\n';
  tbl +=    'GREY MATTER                  ' + cat.gm;
  document.getElementById('res-table').textContent = tbl;

  // Quote
  document.getElementById('res-quote').textContent = cat.quote;

  // Show
  document.getElementById('results-view').classList.remove('off');
}

document.getElementById('res-hub-btn').addEventListener('click', function() {
  document.getElementById('results-view').classList.add('off');
  hub.classList.remove('off');
  currentView = 'hub';
});
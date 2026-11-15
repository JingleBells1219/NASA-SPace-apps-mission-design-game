// ==========================================
// AUDIO SYSTEM & DIALOGUE STATE
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playBeep(freq = 440, type = 'sine', duration = 0.08) {
  if (audioCtx.state === 'suspended') { audioCtx.resume(); }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type; 
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  osc.connect(gain); 
  gain.connect(audioCtx.destination);
  osc.start(); 
  osc.stop(audioCtx.currentTime + duration);
}

let currentDialogueIndex = 0;
const dialogueScript = [
  { text: "Welcome, Intern! I'm Astra, your mentor for today...", showMonitorHighlight: false },
  { text: "Click your monitor to see your missions...", showMonitorHighlight: true }
];

function switchView(viewId) {
  const views = [
    'viewTitleScreen', 'viewDialogueIntro', 'viewMonWelcome', 
    'viewAnomalyTerminal', 'viewMissionAlert', 'viewVehicleSelection', 
    'viewApprovalLoading', 'viewBossApproved', 'viewBossDenied', 
    'viewDesignIntro', 'viewBuildIntro', 'viewRocketIntro', 
    'viewRocketWrapUp', 'viewRocketSimIntro', 'viewWorkbench'
  ];
  
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const target = document.getElementById(viewId);
  if (target) target.classList.remove('hidden');

  if (viewId === 'viewDialogueIntro') {
    currentDialogueIndex = 0;
    updateDialogueUI();
  } else if (viewId === 'viewAnomalyTerminal') {
    initAnomalyChecklistTargets();
    setTimeout(() => {
      resizeCanvas();
      drawWaveform();
      startRandomEvents();
    }, 100);
  } else if (viewId === 'viewWorkbench') {
    setupWorkbenchForSelectedVehicle();
  }
}

function updateDialogueUI() {
  const step = dialogueScript[currentDialogueIndex];
  const dialogueText = document.getElementById('astraDialogueText');
  const monitorHighlight = document.getElementById('monitorClickArea');
  const btnBack = document.getElementById('btnDialogueBack');
  const btnNext = document.getElementById('btnDialogueNext');

  if (dialogueText) dialogueText.innerText = step.text;
  if (monitorHighlight) {
    if (step.showMonitorHighlight) monitorHighlight.classList.remove('hidden');
    else monitorHighlight.classList.add('hidden');
  }

  if (btnBack) {
    if (currentDialogueIndex > 0) btnBack.classList.remove('hidden');
    else btnBack.classList.add('hidden');
  }

  if (btnNext) {
    if (currentDialogueIndex === dialogueScript.length - 1) btnNext.innerText = "Click Monitor";
    else btnNext.innerText = "Continue";
  }
}

function nextDialogueStep() {
  if (currentDialogueIndex < dialogueScript.length - 1) {
    currentDialogueIndex++;
    updateDialogueUI();
  } else {
    bootUpTerminal();
  }
}

function prevDialogueStep() {
  if (currentDialogueIndex > 0) {
    currentDialogueIndex--;
    updateDialogueUI();
  }
}

function bootUpTerminal() {
  if (isMonitorDebugMode) return;
  switchView('viewMonWelcome');
}

// ==========================================
// MONITOR DRAG & DROP CALIBRATION TOOL (Press 'M')
// ==========================================
let isMonitorDebugMode = false;
let isDraggingMonitor = false;
let dragOffsetX = 0, dragOffsetY = 0;

function handleMonitorClick(e) {
  if (isMonitorDebugMode) {
    e.stopPropagation();
    return;
  }
  bootUpTerminal();
}

document.addEventListener('keydown', (e) => {
  const dialogueView = document.getElementById('viewDialogueIntro');
  if (!dialogueView || dialogueView.classList.contains('hidden')) return;

  const mon = document.getElementById('monitorClickArea');
  const hud = document.getElementById('monitorDebugHUD');
  if (!mon || !hud) return;

  if (e.key.toLowerCase() === 'm') {
    isMonitorDebugMode = !isMonitorDebugMode;
    mon.classList.remove('hidden');
    mon.classList.toggle('monitor-debug-box', isMonitorDebugMode);
    hud.classList.toggle('hidden', !isMonitorDebugMode);
    updateMonitorDebugOutput();
    return;
  }

  if (!isMonitorDebugMode) return;

  const step = e.shiftKey ? 2 : 0.5;
  const rect = mon.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let topPct = (rect.top / vh) * 100;
  let leftPct = (rect.left / vw) * 100;
  let wPct = (rect.width / vw) * 100;
  let hPct = (rect.height / vh) * 100;

  if (e.shiftKey) {
    if (e.key === 'ArrowRight') wPct += step;
    if (e.key === 'ArrowLeft') wPct = Math.max(5, wPct - step);
    if (e.key === 'ArrowDown') hPct += step;
    if (e.key === 'ArrowUp') hPct = Math.max(5, hPct - step);
  } else {
    if (e.key === 'ArrowRight') leftPct += step;
    if (e.key === 'ArrowLeft') leftPct -= step;
    if (e.key === 'ArrowDown') topPct += step;
    if (e.key === 'ArrowUp') topPct -= step;
  }

  mon.style.top = `${topPct.toFixed(1)}%`;
  mon.style.left = `${leftPct.toFixed(1)}%`;
  mon.style.width = `${wPct.toFixed(1)}%`;
  mon.style.height = `${hPct.toFixed(1)}%`;
  updateMonitorDebugOutput();
});

const monitorEl = document.getElementById('monitorClickArea');
if (monitorEl) {
  monitorEl.addEventListener('mousedown', (e) => {
    if (!isMonitorDebugMode) return;
    isDraggingMonitor = true;
    const rect = monitorEl.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
  });
}

window.addEventListener('mousemove', (e) => {
  if (!isDraggingMonitor || !isMonitorDebugMode || !monitorEl) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const leftPct = ((e.clientX - dragOffsetX) / vw) * 100;
  const topPct = ((e.clientY - dragOffsetY) / vh) * 100;
  monitorEl.style.left = `${leftPct.toFixed(1)}%`;
  monitorEl.style.top = `${topPct.toFixed(1)}%`;
  updateMonitorDebugOutput();
});

window.addEventListener('mouseup', () => {
  isDraggingMonitor = false;
});

function updateMonitorDebugOutput() {
  const mon = document.getElementById('monitorClickArea');
  const out = document.getElementById('monitorCoordsOutput');
  if (!mon || !out) return;
  const rect = mon.getBoundingClientRect();
  const topPct = ((rect.top / window.innerHeight) * 100).toFixed(1);
  const leftPct = ((rect.left / window.innerWidth) * 100).toFixed(1);
  const wPct = ((rect.width / window.innerWidth) * 100).toFixed(1);
  const hPct = ((rect.height / window.innerHeight) * 100).toFixed(1);
  out.innerText = `top-[${topPct}%] left-[${leftPct}%] w-[${wPct}%] h-[${hPct}%]`;
}

// ==========================================
// TELEMETRY & MULTI-CAPTURE ANOMALY LOGIC
// ==========================================
const waveCanvas = document.getElementById('waveform-canvas');
const waveCtx = waveCanvas ? waveCanvas.getContext('2d') : null;
const thermalCanvas = document.getElementById('thermal-canvas');
const thermalCtx = thermalCanvas ? thermalCanvas.getContext('2d') : null;

let waveStep = 0;
let isWaveSpikeActive = false;
let isThermalSpikeActive = false;
let isAirSpikeActive = false;

let waveCapturedThisCycle = false;
let thermalCapturedThisCycle = false;
let airCapturedThisCycle = false;

let freqCount = 0, freqTarget = 2;
let thermalCount = 0, thermalTarget = 2;
let spectralCount = 0, spectralTarget = 2;

let thermalHotspotX = 0.5, thermalHotspotY = 0.5;
let useAlternatePalette = false;
let eventsStarted = false;

function initAnomalyChecklistTargets() {
  freqTarget = Math.floor(Math.random() * 3) + 2;
  thermalTarget = Math.floor(Math.random() * 3) + 2;
  spectralTarget = Math.floor(Math.random() * 3) + 2;

  freqCount = 0;
  thermalCount = 0;
  spectralCount = 0;

  waveCapturedThisCycle = false;
  thermalCapturedThisCycle = false;
  airCapturedThisCycle = false;

  const c1 = document.getElementById('check-freq');
  const c2 = document.getElementById('check-thermal');
  const c3 = document.getElementById('check-spectral');
  if (c1) c1.checked = false;
  if (c2) c2.checked = false;
  if (c3) c3.checked = false;

  updateChecklistCountersUI();
  updateVerification();
}

function updateChecklistCountersUI() {
  const cf = document.getElementById('count-freq');
  const ct = document.getElementById('count-thermal');
  const cs = document.getElementById('count-spectral');
  if (cf) cf.innerText = `${freqCount}/${freqTarget}`;
  if (ct) ct.innerText = `${thermalCount}/${thermalTarget}`;
  if (cs) cs.innerText = `${spectralCount}/${spectralTarget}`;
}

function resizeCanvas() {
  if (waveCanvas && waveCanvas.parentElement) {
    waveCanvas.width = waveCanvas.parentElement.clientWidth;
    waveCanvas.height = waveCanvas.parentElement.clientHeight;
  }
  if (thermalCanvas && thermalCanvas.parentElement) {
    thermalCanvas.width = thermalCanvas.parentElement.clientWidth;
    thermalCanvas.height = thermalCanvas.parentElement.clientHeight;
  }
}

function startRandomEvents() {
  if (eventsStarted) return;
  eventsStarted = true;
  triggerWaveSpikeCycle();
  triggerThermalSpikeCycle();
  triggerAirSpikeCycle();
}

function triggerWaveSpikeCycle() {
  const randomWait = Math.random() * 2500 + 2000;
  setTimeout(() => {
    if (freqCount < freqTarget) {
      isWaveSpikeActive = true;
      waveCapturedThisCycle = false;
      const alertEl = document.getElementById('spike-alert');
      const statusEl = document.getElementById('spike-status-text');
      if (alertEl) alertEl.classList.remove('hidden');
      if (statusEl) {
        statusEl.innerText = "⚠️ SPIKE ACTIVE!";
        statusEl.className = "text-synth-pink font-bold animate-pulse";
      }
      playBeep(660, 'square', 0.08);

      setTimeout(() => {
        isWaveSpikeActive = false;
        if (alertEl) alertEl.classList.add('hidden');
        if (statusEl && freqCount < freqTarget) {
          statusEl.innerText = "WAITING FOR SPIKE...";
          statusEl.className = "text-synth-amber";
        }
        triggerWaveSpikeCycle();
      }, 2800);
    } else {
      triggerWaveSpikeCycle();
    }
  }, randomWait);
}

function triggerThermalSpikeCycle() {
  const randomWait = Math.random() * 2500 + 2000;
  setTimeout(() => {
    if (thermalCount < thermalTarget) {
      isThermalSpikeActive = true;
      thermalCapturedThisCycle = false;
      thermalHotspotX = Math.random() * 0.6 + 0.2;
      thermalHotspotY = Math.random() * 0.6 + 0.2;
      const tag = document.getElementById('thermal-alert-tag');
      const statusText = document.getElementById('thermal-status-text');
      const tempReadout = document.getElementById('thermal-temp-readout');
      if (tag) tag.classList.remove('hidden');
      if (statusText) statusText.innerText = "🔥 HOTSPOT ACTIVE!";
      if (tempReadout) tempReadout.innerText = "TEMP: 650°C [SPIKE]";
      playBeep(520, 'triangle', 0.08);

      setTimeout(() => {
        isThermalSpikeActive = false;
        if (tag) tag.classList.add('hidden');
        if (statusText && thermalCount < thermalTarget) statusText.innerText = "MONITORING...";
        if (tempReadout) tempReadout.innerText = "TEMP: 320°C";
        triggerThermalSpikeCycle();
      }, 2800);
    } else {
      triggerThermalSpikeCycle();
    }
  }, randomWait);
}

function triggerAirSpikeCycle() {
  const randomWait = Math.random() * 2500 + 2000;
  setTimeout(() => {
    if (spectralCount < spectralTarget) {
      isAirSpikeActive = true;
      airCapturedThisCycle = false;
      const badge = document.getElementById('air-status-badge');
      const xenonVal = document.getElementById('xenon-val');
      const xenonBar = document.getElementById('xenon-bar');
      if (badge) {
        badge.innerText = "⚡ SPIKE! CLICK";
        badge.className = "text-[10px] bg-synth-pink text-slate-950 px-2 py-0.5 rounded font-bold animate-bounce";
      }
      if (xenonVal) xenonVal.innerText = "18% [ANOMALOUS]";
      if (xenonBar) xenonBar.style.width = "90%";
      playBeep(780, 'sine', 0.1);

      setTimeout(() => {
        isAirSpikeActive = false;
        if (badge && spectralCount < spectralTarget) {
          badge.innerText = "CLICK TO CONFIRM";
          badge.className = "text-[10px] bg-slate-800 text-synth-amber px-2 py-0.5 rounded border border-synth-border font-bold";
        }
        if (xenonVal) xenonVal.innerText = "3% [NORMAL]";
        if (xenonBar) xenonBar.style.width = "30%";
        triggerAirSpikeCycle();
      }, 2800);
    } else {
      triggerAirSpikeCycle();
    }
  }, randomWait);
}

function drawWaveform() {
  const term = document.getElementById('viewAnomalyTerminal');
  if (!term || term.classList.contains('hidden') || !waveCtx) return;

  waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
  waveCtx.lineWidth = 2;
  const isDone = freqCount >= freqTarget;
  waveCtx.strokeStyle = isDone ? '#4ade80' : (isWaveSpikeActive ? '#f472b6' : '#38bdf8');
  waveCtx.beginPath();

  const width = waveCanvas.width;
  const height = waveCanvas.height;
  const centerY = height / 2;

  for (let x = 0; x < width; x++) {
    let angle = (x + waveStep) * 0.04;
    let y = Math.sin(angle) * 10;
    if (isWaveSpikeActive && x > width * 0.45 && x < width * 0.65) {
      y += Math.sin((x + waveStep) * 0.25) * 40;
    }
    if (x === 0) waveCtx.moveTo(x, centerY + y);
    else waveCtx.lineTo(x, centerY + y);
  }
  waveCtx.stroke();
  waveStep += 2;

  if (isWaveSpikeActive && !waveCapturedThisCycle) {
    waveCtx.fillStyle = 'rgba(244, 114, 182, 0.25)';
    waveCtx.fillRect(width * 0.45, 5, width * 0.2, height - 10);
  }
  requestAnimationFrame(drawWaveform);
}

function lockSignal() {
  if (isWaveSpikeActive && !waveCapturedThisCycle && freqCount < freqTarget) {
    playBeep(880, 'square', 0.15);
    waveCapturedThisCycle = true;
    freqCount++;
    updateChecklistCountersUI();

    const statusText = document.getElementById('spike-status-text');
    const lockBtn = document.getElementById('lock-signal-btn');
    const checkFreq = document.getElementById('check-freq');

    if (freqCount >= freqTarget) {
      if (statusText) {
        statusText.innerText = "🔒 ALL FREQ LOCKED!";
        statusText.className = "text-synth-green font-bold";
      }
      if (lockBtn) {
        lockBtn.innerText = '[ COMPLETE ]';
        lockBtn.className = 'bg-synth-green/20 text-synth-green border border-synth-green px-2.5 py-1 rounded text-xs font-bold';
      }
      if (checkFreq) checkFreq.checked = true;
    } else if (statusText) {
      statusText.innerText = `✓ CAPTURED (${freqCount}/${freqTarget})`;
      statusText.className = "text-synth-cyan font-bold";
    }
    updateVerification();
  } else {
    playBeep(250, 'sawtooth', 0.12);
    const statusText = document.getElementById('spike-status-text');
    if (statusText && freqCount < freqTarget) {
      statusText.innerText = "❌ WAIT FOR NEXT SPIKE!";
      statusText.className = "text-synth-red font-bold";
    }
  }
}

if (waveCanvas) {
  waveCanvas.addEventListener('click', () => { lockSignal(); });
}

let thermalFrame = 0;
function drawThermalFeed() {
  if (!thermalCtx) return;
  const w = thermalCanvas.width;
  const h = thermalCanvas.height;

  thermalCtx.clearRect(0, 0, w, h);
  thermalCtx.fillStyle = useAlternatePalette ? '#0284c7' : '#090d16';
  thermalCtx.fillRect(0, 0, w, h);

  const hX = isThermalSpikeActive ? thermalHotspotX * w : w / 2;
  const hY = isThermalSpikeActive ? thermalHotspotY * h : h / 2;
  const pulseRadius = (isThermalSpikeActive ? 42 : 16) + Math.sin(thermalFrame * 0.1) * 4;

  const gradient = thermalCtx.createRadialGradient(hX, hY, 3, hX, hY, pulseRadius);
  if (!useAlternatePalette) {
    gradient.addColorStop(0, '#fef08a');
    gradient.addColorStop(0.4, '#f472b6');
    gradient.addColorStop(0.7, '#38bdf8');
    gradient.addColorStop(1, 'transparent');
  } else {
    gradient.addColorStop(0, '#4ade80');
    gradient.addColorStop(0.5, '#f59e0b');
    gradient.addColorStop(1, 'transparent');
  }

  thermalCtx.fillStyle = gradient;
  thermalCtx.beginPath();
  thermalCtx.arc(hX, hY, pulseRadius, 0, Math.PI * 2);
  thermalCtx.fill();

  thermalCtx.strokeStyle = isThermalSpikeActive ? '#f472b6' : '#38bdf8';
  thermalCtx.lineWidth = 1.5;
  thermalCtx.strokeRect(hX - 18, hY - 15, 36, 30);
  thermalCtx.beginPath();
  thermalCtx.moveTo(hX - 25, hY); thermalCtx.lineTo(hX + 25, hY);
  thermalCtx.moveTo(hX, hY - 18); thermalCtx.lineTo(hX, hY + 18);
  thermalCtx.stroke();

  thermalFrame++;
}

setInterval(() => {
  const term = document.getElementById('viewAnomalyTerminal');
  if (term && !term.classList.contains('hidden')) {
    drawThermalFeed();
  }
}, 60);

if (thermalCanvas) {
  thermalCanvas.addEventListener('click', (e) => {
    const rect = thermalCanvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    const dist = Math.hypot(clickX - thermalHotspotX, clickY - thermalHotspotY);
    if (isThermalSpikeActive && !thermalCapturedThisCycle && thermalCount < thermalTarget && dist < 0.32) {
      playBeep(990, 'triangle', 0.15);
      thermalCapturedThisCycle = true;
      thermalCount++;
      updateChecklistCountersUI();

      const checkThermal = document.getElementById('check-thermal');
      const statusText = document.getElementById('thermal-status-text');

      if (thermalCount >= thermalTarget) {
        if (checkThermal) checkThermal.checked = true;
        if (statusText) {
          statusText.innerText = "🎯 ALL HOTSPOTS LOCKED!";
          statusText.className = "text-synth-green font-bold";
        }
      } else if (statusText) {
        statusText.innerText = `✓ CAPTURED (${thermalCount}/${thermalTarget})`;
        statusText.className = "text-synth-cyan font-bold";
      }
      updateVerification();
    } else {
      playBeep(300, 'sawtooth', 0.1);
    }
  });
}

function toggleThermalFilter() {
  playBeep(600, 'sine');
  useAlternatePalette = !useAlternatePalette;
}

function verifyGasSpike() {
  if (isAirSpikeActive && !airCapturedThisCycle && spectralCount < spectralTarget) {
    playBeep(880, 'sine', 0.15);
    airCapturedThisCycle = true;
    spectralCount++;
    updateChecklistCountersUI();

    const checkSpectral = document.getElementById('check-spectral');
    const badge = document.getElementById('air-status-badge');

    if (spectralCount >= spectralTarget) {
      if (checkSpectral) checkSpectral.checked = true;
      if (badge) {
        badge.innerText = "✓ COMPLETE";
        badge.className = "text-[10px] bg-synth-green text-slate-950 px-2 py-0.5 rounded font-bold";
      }
    } else if (badge) {
      badge.innerText = `✓ LOGGED (${spectralCount}/${spectralTarget})`;
      badge.className = "text-[10px] bg-synth-cyan text-slate-950 px-2 py-0.5 rounded font-bold";
    }
    updateVerification();
  } else {
    playBeep(300, 'sawtooth', 0.1);
  }
}

function updateVerification() {
  const c1 = freqCount >= freqTarget;
  const c2 = thermalCount >= thermalTarget;
  const c3 = spectralCount >= spectralTarget;
  const btn = document.getElementById('evaluate-btn');

  if (btn) {
    if (c1 && c2 && c3) {
      btn.disabled = false;
      btn.className = "w-full bg-synth-green text-slate-950 border border-synth-green py-2 rounded-lg font-bold text-xs tracking-wider transition hover:bg-emerald-400 cursor-pointer shadow-lg animate-bounce";
      btn.innerText = "🔓 ANALYZE & EVALUATE SIGNAL";
    } else {
      btn.disabled = true;
      btn.className = "w-full bg-slate-800 text-slate-500 border border-slate-700 py-2 rounded-lg font-bold text-xs tracking-wider transition cursor-not-allowed";
      btn.innerText = "🔒 COMPLETE CHECKLIST TO SUBMIT";
    }
  }
}

// ==========================================
// CRITICAL-THINKING MISSION POOL (2 PER PLANET)
// ==========================================
let activeMissionData = (() => {
  try { return JSON.parse(localStorage.getItem('spaceforce_mission_data') || 'null'); }
  catch (e) { return null; }
})();
let currentPlanetTarget = (activeMissionData && activeMissionData.planet) || localStorage.getItem('spaceforce_planet') || 'mars';
let pendingSignalResult = null;

const missionCatalog = [
  {
    id: 'mars_1',
    planet: 'mars',
    vehicle: 'rover',
    code: 'MARS-JEZERO-04',
    title: 'MISSION ALERT! (JEZERO BASIN)',
    desc: 'Seismic telemetry points to stratified clay deposits 40 cm beneath rust-colored regolith inside an ancient river delta. Dust storms routinely block sunlight for weeks, and we must physically extract core samples from multiple boulders across 3 km of rocky terrain.',
    recommendedParts: { power: 'rtg', tools: 'drill_spec' }
  },
  {
    id: 'mars_2',
    planet: 'mars',
    vehicle: 'rover',
    code: 'MARS-VALLES-09',
    title: 'MISSION ALERT! (VALLES CANYON RIM)',
    desc: 'An anomalous metallic glint was detected along a steep canyon rim. No subsurface drilling is authorized—we need a lightweight ground unit capable of navigating loose scree slopes and generating high-resolution 3D surface terrain maps under strict mass limits.',
    recommendedParts: { chassis: 'carbon', tools: 'camera_arm' }
  },
  {
    id: 'moon_1',
    planet: 'moon',
    vehicle: 'satellite',
    code: 'LUNA-SHACKLETON-02',
    title: 'MISSION ALERT! (LUNAR SOUTH POLE)',
    desc: 'Intermittent RF bursts are originating from permanently shadowed craters where ground landings risk total loss of line-of-sight. We need continuous high-altitude polar coverage to map crater topography and beam high-bandwidth telemetry back to Earth.',
    recommendedParts: { antenna: 'high_gain', wings: 'dual_wing' }
  },
  {
    id: 'moon_2',
    planet: 'moon',
    vehicle: 'satellite',
    code: 'LUNA-REINER-07',
    title: 'MISSION ALERT! (REINER GAMMA SWIRL)',
    desc: 'A localized crustal magnetic field is deflecting solar wind particles above a bright lunar swirl. We need a compact, agile orbital platform that can rapidly reorient its attitude without wasting propellant while keeping mass and budget minimal.',
    recommendedParts: { wings: 'compact_cell', thrusters: 'react_wheels' }
  },
  {
    id: 'titan_1',
    planet: 'titan',
    vehicle: 'probe',
    code: 'TITAN-KRAKEN-01',
    title: 'MISSION ALERT! (KRAKEN MARE BASIN)',
    desc: 'Deep radar echoes suggest a dense, non-ice structure submerged beneath liquid methane lakes under a thick nitrogen-hydrocarbon atmosphere. The craft must endure intense atmospheric entry heating and penetrate opaque haze to map liquid depths.',
    recommendedParts: { shield: 'ablative', sensors: 'mag_radar' }
  },
  {
    id: 'titan_2',
    planet: 'titan',
    vehicle: 'probe',
    code: 'TITAN-STRATO-05',
    title: 'MISSION ALERT! (UPPER STRATOSPHERE)',
    desc: 'Unexpected Xenon-7 plumes were detected 400 km above Titan’s cloud deck. Rather than landing, we need a high-speed flyby craft capable of executing a rapid trajectory boost and analyzing upper-atmospheric gas density and wind shear.',
    recommendedParts: { engine: 'chem_hyper', sensors: 'spectro_cam' }
  }
];

const decoyAnomalies = [
  {
    icon: '🛰️',
    title: 'COSMIC SCRAPS / DEBRIS',
    desc: 'Spectrometry matches weathered aluminum foil and a dead 1990s booster stage drifting in heliocentric junk orbit.',
    facepalm: 'Astra facepalms so hard her visor fogs up: "Intern... we just spent $40,000 analyzing a burnt-out fuel tank wrapper. Read the isotope decay next time!"'
  },
  {
    icon: '🎈',
    title: 'STRATOSPHERIC WEATHER BALLOON',
    desc: 'Doppler shift indicates the object is only 32 km up—it is a stray terrestrial weather balloon reflecting radar.',
    facepalm: 'Astra buries her face in her hands: "Bruhh... you just launched a deep-space investigation into a weather balloon from Batangas PAGASA. Back to the terminal!"'
  },
  {
    icon: '☀️',
    title: 'SOLAR CORONAL ECHO',
    desc: 'Harmonic interference pattern caused by a solar flare bouncing off a metallic asteroid.',
    facepalm: 'Astra sighs loudly: "It’s literally just solar static, intern! Not every blip is aliens. Re-scan the frequency!"'
  }
];

const vehicleDisplayNames = {
  rover: 'Rover',
  satellite: 'Satellite',
  probe: 'Space Probe'
};

function evaluateSignal() {
  playBeep(1000, 'triangle', 0.2);
  const rModal = document.getElementById('result-modal');
  const rIcon = document.getElementById('result-icon');
  const rTitle = document.getElementById('result-title');
  const rDesc = document.getElementById('result-desc');
  const rAction = document.getElementById('result-action-area');

  if (rModal) rModal.classList.remove('hidden');

  const campaignCleared = typeof getCompletedMissions === 'function' && getCompletedMissions().length >= 6;
  const isRealMission = campaignCleared || Math.random() < 0.70;

  if (isRealMission) {
    const completed = typeof getCompletedMissions === 'function' ? getCompletedMissions() : [];
    const available = missionCatalog.filter(m => !completed.includes(m.id));
    if (!available.length) {
      pendingSignalResult = { type: 'campaign-complete' };
      if (rIcon) rIcon.innerText = '🏆';
      if (rTitle) rTitle.innerText = 'CAMPAIGN COMPLETE!';
      if (rDesc) rDesc.innerText = 'All six missions are safely archived in your notebook. You are officially mission-ready, Intern!';
      if (rAction) rAction.innerHTML = '<button onclick="toggleNotebook()" class="w-full bg-synth-cyan text-slate-950 font-bold py-2.5 rounded-lg text-xs cursor-pointer">OPEN CAMPAIGN NOTEBOOK</button>';
      return;
    }
    const picked = available[Math.floor(Math.random() * available.length)];
    pendingSignalResult = { type: 'mission', data: picked };

    const planetIcons = { mars: '🪐', moon: '🌕', titan: '🌑' };
    if (rIcon) rIcon.innerText = planetIcons[picked.planet] || '🪐';
    if (rTitle) rTitle.innerText = `SIGNAL LOCKED: ${picked.planet.toUpperCase()} SECTOR`;
    if (rDesc) rDesc.innerText = `"Telemetry packet decoded! Looks like an anomaly in the ${picked.planet.toUpperCase()} sector—or could it be false interference? Your call, Intern."`;
  } else {
    const decoy = decoyAnomalies[Math.floor(Math.random() * decoyAnomalies.length)];
    pendingSignalResult = { type: 'decoy', data: decoy };

    if (rIcon) rIcon.innerText = decoy.icon;
    if (rTitle) rTitle.innerText = decoy.title;
    if (rDesc) rDesc.innerText = `"${decoy.desc}"`;
  }

  if (rAction) {
    rAction.innerHTML = `
      <div class="flex gap-2">
        <button onclick="handleSignalDecision('discard')" class="flex-1 bg-synth-red/20 text-synth-red border border-synth-red py-2.5 rounded-lg text-xs font-bold hover:bg-synth-red/40 transition cursor-pointer">
          🗑️ DISCARD AS TRASH
        </button>
        <button onclick="handleSignalDecision('search')" class="flex-1 bg-synth-green text-slate-950 border border-synth-green py-2.5 rounded-lg text-xs font-bold hover:bg-emerald-400 transition cursor-pointer">
          🔍 SEARCH ANYWAY
        </button>
      </div>
    `;
  }
}

function handleSignalDecision(choice) {
  const rModal = document.getElementById('result-modal');
  const rIcon = document.getElementById('result-icon');
  const rTitle = document.getElementById('result-title');
  const rDesc = document.getElementById('result-desc');
  const rAction = document.getElementById('result-action-area');

  if (!pendingSignalResult) return;

  if (choice === 'discard') {
    playBeep(320, 'sawtooth', 0.2);
    if (pendingSignalResult.type === 'mission') {
      if (rIcon) rIcon.innerText = '🤦‍♀️';
      if (rTitle) rTitle.innerText = 'ASTRA FACEPALMS!';
      if (rDesc) rDesc.innerText = `Astra groans: "WAIT—you just trashed a genuine ${pendingSignalResult.data.planet.toUpperCase()} anomaly! HQ is gonna have my head. Scan again!"`;
      if (rAction) rAction.innerHTML = `<button onclick="closeResultAndReset()" class="w-full bg-synth-amber text-slate-950 font-bold py-2.5 rounded-lg text-xs cursor-pointer">OOPS, RE-SCAN TERMINAL</button>`;
    } else {
      saveNotebookLog('TELEMETRY', `Filtered False Positive: ${pendingSignalResult.data.title}`, 'Saved agency funds by discarding non-mission debris.');
      closeResultAndReset();
    }
    return;
  }

  if (pendingSignalResult.type === 'decoy') {
    playBeep(220, 'sawtooth', 0.3);
    if (rIcon) rIcon.innerText = '🤦‍♀️';
    if (rTitle) rTitle.innerText = 'ASTRA FACEPALMS!';
    if (rDesc) rDesc.innerText = pendingSignalResult.data.facepalm;
    if (rAction) rAction.innerHTML = `<button onclick="closeResultAndReset()" class="w-full bg-synth-red text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer">MY BAD, BACK TO SCANNER</button>`;
  } else {
    playBeep(950, 'triangle', 0.25);
    activeMissionData = pendingSignalResult.data;
    currentPlanetTarget = activeMissionData.planet;
    saveNotebookLog('TELEMETRY', `Mission Logged: ${activeMissionData.code}`, `Target Sector: ${activeMissionData.planet.toUpperCase()}`);
    if (rModal) rModal.classList.add('hidden');
    proceedToMissionAlert();
  }
}

function closeResultAndReset() {
  const rModal = document.getElementById('result-modal');
  if (rModal) rModal.classList.add('hidden');
  initAnomalyChecklistTargets();
}

function proceedToMissionAlert() {
  if (activeMissionData) {
    try {
      const previousMission = JSON.parse(localStorage.getItem('spaceforce_mission_data') || 'null');
      if (previousMission && previousMission.id !== activeMissionData.id) {
        localStorage.removeItem('spaceforce_mission_report');
        localStorage.removeItem('spaceforce_assembly_errors');
        localStorage.removeItem('spaceforce_rocket_assembly_model');
        localStorage.removeItem('spaceforce_rocket_assembly_complete');
        localStorage.removeItem('spaceforce_vehicle_assembly_report');
        localStorage.removeItem('spaceforce_test_flights');
      }
    } catch (e) {}
    // SAVE ASSIGNED MISSION TO LOCALSTORAGE FOR ROCKET_SIM.JS
    localStorage.setItem('spaceforce_mission_data', JSON.stringify(activeMissionData));
    localStorage.setItem('spaceforce_planet', activeMissionData.planet);
    localStorage.setItem('spaceforce_vehicle', activeMissionData.vehicle);
    selectedVehicle = activeMissionData.vehicle;

    const titleEl = document.getElementById('mission-title');
    const descEl = document.getElementById('mission-desc');
    const codeEl = document.getElementById('mission-code-badge');
    if (titleEl) titleEl.innerText = activeMissionData.title;
    if (descEl) descEl.innerText = activeMissionData.desc;
    if (codeEl) codeEl.innerText = activeMissionData.code;
    updateMissionPreview(activeMissionData);
    switchView('viewMissionAlert');
  }
}

function updateMissionPreview(mission) {
  const preview = document.getElementById('mission-preview-img');
  if (!preview) return;
  const planet = String(mission && mission.planet || '').toLowerCase();
  const imageFiles = { mars: 'mars.webp', moon: 'moon.png', titan: 'titan.webp' };
  preview.src = imageFiles[planet] ? `Assets/${imageFiles[planet]}` : 'Assets/workspace.png';
  preview.alt = imageFiles[planet] ? `${planet[0].toUpperCase()}${planet.slice(1)} mission preview` : 'Mission preview';
}

// ==========================================
// VEHICLE SELECTION & NASA OFFICIAL INFO MODAL
// ==========================================
let selectedVehicle = (activeMissionData && activeMissionData.vehicle) || localStorage.getItem('spaceforce_vehicle') || 'rover';

function getAssignedVehicle() {
  if (activeMissionData && vehiclePartsDatabase[activeMissionData.vehicle]) return activeMissionData.vehicle;
  try {
    const savedMission = JSON.parse(localStorage.getItem('spaceforce_mission_data') || 'null');
    if (savedMission && vehiclePartsDatabase[savedMission.vehicle]) return savedMission.vehicle;
  } catch (e) {}
  const savedVehicle = localStorage.getItem('spaceforce_vehicle');
  return vehiclePartsDatabase[savedVehicle] ? savedVehicle : selectedVehicle || 'rover';
}

function selectVehicle(vehicleType) {
  if (!vehiclePartsDatabase[vehicleType]) return;
  playBeep(600, 'sine', 0.1);
  selectedVehicle = vehicleType;
  localStorage.setItem('spaceforce_vehicle', vehicleType);
  
  ['rover', 'satellite', 'probe'].forEach(v => {
    const card = document.getElementById(`card-${v}`);
    if (card) {
      card.style.borderColor = "#0f172a";
      card.style.boxShadow = "none";
    }
  });

  const activeCard = document.getElementById(`card-${vehicleType}`);
  if (activeCard) {
    activeCard.style.borderColor = "#38bdf8";
    activeCard.style.boxShadow = "0 0 20px rgba(56, 189, 248, 0.6)";
  }
}

const nasaVehicleSpecs = {
  rover: {
    tag: 'NASA JPL // SURFACE MOBILITY SYSTEM',
    title: 'PLANETARY ROVER',
    official: 'Per NASA Jet Propulsion Laboratory (JPL) classification, a planetary rover is an automated mobile surface laboratory engineered to traverse solid extraterrestrial terrain, deploy robotic arms, drill subsurface cores, and conduct in-situ geochemical spectroscopy.',
    domains: 'Rocky planetary surfaces (e.g., Mars), crater floors, canyon rims, and multi-site soil/rock sample analysis.',
    limits: 'Requires a solid surface to drive on; cannot operate in deep oceans, thick gas giants, or orbital altitudes.'
  },
  satellite: {
    tag: 'NASA GSFC // ORBITAL PLATFORM',
    title: 'ORBITAL SATELLITE',
    official: 'Per NASA Goddard Space Flight Center (GSFC) definition, a satellite is an artificial spacecraft placed into a sustained closed orbit around a planetary body or moon to perform remote sensing, gravitational/magnetic mapping, and continuous communications relay.',
    domains: 'High-altitude global mapping, polar crater telemetry relays, and orbital magnetosphere observation.',
    limits: 'Remains in orbit above the atmosphere; cannot touch down to physically drill or sample surface soil.'
  },
  probe: {
    tag: 'NASA DEEP SPACE // ENTRY & FLYBY CRAFT',
    title: 'SPACE PROBE',
    official: 'Per NASA Science Mission Directorate standards, a space probe is an uncrewed exploratory spacecraft designed to travel beyond Earth orbit for high-velocity planetary flybys, atmospheric entry descents, or extreme-environment liquid/gas sampling.',
    domains: 'Dense atmospheres (e.g., Titan), hydrocarbon lakes, extreme heat-shield entry, and high-speed deep-space flybys.',
    limits: 'Built for trajectory passes or stationary descent rather than wheeled cross-country driving.'
  }
};

function showVehicleInfo(vehicleType, event) {
  event.stopPropagation();
  playBeep(750, 'sine', 0.15);
  const spec = nasaVehicleSpecs[vehicleType];
  if (!spec) return;

  document.getElementById('vinfo-tag').innerText = spec.tag;
  document.getElementById('vinfo-title').innerText = spec.title;
  document.getElementById('vinfo-official').innerText = spec.official;
  document.getElementById('vinfo-domains').innerText = spec.domains;
  document.getElementById('vinfo-limits').innerText = spec.limits;

  document.getElementById('vehicle-info-modal').classList.remove('hidden');
}

function closeVehicleInfoModal() {
  playBeep(500, 'sine', 0.1);
  document.getElementById('vehicle-info-modal').classList.add('hidden');
}

let thumbToggleInterval = null;

function confirmVehicleSelection() {
  playBeep(900, 'square', 0.2);
  switchView('viewApprovalLoading');
  
  let isUp = true;
  const thumbImg = document.getElementById('approvalThumbImg');
  
  thumbToggleInterval = setInterval(() => {
    isUp = !isUp;
    if (thumbImg) thumbImg.src = isUp ? 'Assets/up.png' : 'Assets/down.png';
  }, 400);

  setTimeout(() => {
    clearInterval(thumbToggleInterval);
    const correctVehicle = activeMissionData ? activeMissionData.vehicle : 'rover';
    const approvedMsg = document.getElementById('approvedMsgText');
    const deniedMsg = document.getElementById('deniedMsgText');
    const chosenName = vehicleDisplayNames[selectedVehicle] || 'Vehicle';

    if (selectedVehicle === correctVehicle) {
      localStorage.setItem('spaceforce_vehicle', correctVehicle);
      playBeep(1000, 'triangle', 0.3);
      saveNotebookLog('MISSION', `Vehicle Approved: ${chosenName.toUpperCase()}`, `Cleared by Mission Boss for ${activeMissionData ? activeMissionData.code : currentPlanetTarget.toUpperCase()}.`);
      if (approvedMsg) approvedMsg.innerText = `The ${chosenName} is engineered for this exact mission profile!`;
      switchView('viewBossApproved');
    } else {
      playBeep(250, 'sawtooth', 0.3);
      saveNotebookLog('MISSION', `Vehicle Rejected: ${chosenName.toUpperCase()}`, `Boss denied ${chosenName} for ${currentPlanetTarget.toUpperCase()} mission.`);
      if (deniedMsg) deniedMsg.innerText = `Whoops! Re-read the mission physics—a ${chosenName} won't survive or complete those objectives!`;
      switchView('viewBossDenied');
    }
  }, 2400);
}

function startDesignTransitionDialogue() {
  playBeep(880, 'square', 0.2);
  switchView('viewDesignIntro');
}

function goToBuildPhaseDialogue() {
  playBeep(880, 'square', 0.2);
  const dialogueText = document.getElementById('astraDesignText');
  if (dialogueText) {
    dialogueText.innerText = "Nice design, intern! Come on, let's go see what you can do to help with the build.";
  }
  switchView('viewBuildIntro');
}

function launchAssemblySuite() {
  playBeep(900, 'square', 0.2);
  const vType = getAssignedVehicle();
  selectedVehicle = vType;
  localStorage.setItem('spaceforce_vehicle', vType);
  window.location.href = `assembly.html?vehicle=${vType}`;
}

// ==========================================
// VEHICLE PARTS DATA, GRANT QUIZ & WORKBENCH VALIDATION
// ==========================================
let isSidebarCollapsed = false;
let vehicleSelections = {};

// One shared mission budget (design + assembly + rocket + mission control)
const SHARED_BUDGET_KEY = 'spaceforce_budget';
const SHARED_ROCKET_BUDGET_KEY = 'spaceforce_rocket_budget';
const DEFAULT_SHARED_BUDGET = 1000000;

function getSharedBudget() {
  const raw = localStorage.getItem(SHARED_BUDGET_KEY) || localStorage.getItem(SHARED_ROCKET_BUDGET_KEY);
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : DEFAULT_SHARED_BUDGET;
}

function setSharedBudget(amount) {
  const value = Math.max(0, Math.round(amount));
  localStorage.setItem(SHARED_BUDGET_KEY, String(value));
  localStorage.setItem(SHARED_ROCKET_BUDGET_KEY, String(value));
  return value;
}

function addSharedBudget(delta) {
  return setSharedBudget(getSharedBudget() + delta);
}

const vehiclePartsDatabase = {
  rover: {
    badge: "ROVER",
    name: "Rover",
    parts: {
      chassis: {
        title: "1. CHASSIS MATERIAL",
        options: [
          { id: "titanium", name: "Titanium Alloy Mesh", cost: 45000, mass: 1200, spec: "High Strength", desc: "Heavyweight, ultra-durable against sharp Martian rocks." },
          { id: "carbon", name: "Carbon Fiber Hybrid", cost: 65000, mass: 650, spec: "Light & Nimble", desc: "Saves launch mass, high flexibility for canyon slopes." }
        ]
      },
      wheels: {
        title: "2. TRAVERSAL WHEELS",
        options: [
          { id: "rock_mesh", name: "Shape-Memory Alloy Tires", cost: 30000, mass: 250, spec: "High Traction", desc: "Adapts to rocky uneven dirt without puncture." },
          { id: "solid_ti", name: "Solid Titanium Cleats", cost: 20000, mass: 400, spec: "Heavy Duty", desc: "Unbreakable metal treads for harsh terrain." }
        ]
      },
      power: {
        title: "3. POWER GENERATION",
        options: [
          { id: "rtg", name: "Nuclear RTG Core", cost: 85000, power: 300, spec: "24/7 Power", desc: "Runs continuously during night & dust storms." },
          { id: "solar", name: "Triple Solar Array", cost: 25000, power: 220, spec: "Solar Dependent", desc: "Lightweight & budget-friendly, best in clear skies." }
        ]
      },
      tools: {
        title: "4. SCIENTIFIC PAYLOAD",
        options: [
          { id: "drill_spec", name: "Drill & Raman Spectrometer", cost: 40000, mass: 350, spec: "Sample Core", desc: "Drills into soil to analyze organic compounds." },
          { id: "camera_arm", name: "3D Laser Scanner Arm", cost: 25000, mass: 150, spec: "Surface Mapping", desc: "Generates high-res 3D canyon terrain models." },
          { id: "none", name: "Omit Heavy Payload (Recon Only)", cost: 0, mass: 0, spec: "Mass Saver", desc: "Leaves payload bay empty to save budget and mass." }
        ]
      }
    }
  },
  satellite: {
    badge: "SATELLITE",
    name: "Satellite",
    parts: {
      wings: {
        title: "1. SOLAR WINGSPAN",
        options: [
          { id: "dual_wing", name: "Dual UltraFlex Panels", cost: 45000, power: 450, spec: "High Output", desc: "Maximizes energy capture for continuous polar relays." },
          { id: "compact_cell", name: "Body-Mounted Solar Cells", cost: 15000, power: 220, spec: "Compact", desc: "Low mass & low budget, steady baseline power." }
        ]
      },
      antenna: {
        title: "2. COMM DISH ARRAY",
        options: [
          { id: "high_gain", name: "Deep Space Parabolic Dish", cost: 65000, mass: 300, spec: "Gigabit Link", desc: "Ultra-fast telemetry download from shadowed craters." },
          { id: "omni_array", name: "Omnidirectional Antenna", cost: 20000, mass: 100, spec: "Wide Beam", desc: "Steady link, lower data throughput." }
        ]
      },
      thrusters: {
        title: "3. ATTITUDE CONTROL",
        options: [
          { id: "cold_gas", name: "Nitrogen Cold Gas Thrusters", cost: 18000, mass: 180, spec: "Quick Turning", desc: "Uses propellant for rapid slewing." },
          { id: "react_wheels", name: "Gyroscopic Reaction Wheels", cost: 35000, mass: 220, spec: "Fuel-Free", desc: "Uses electricity to orient without wasting fuel." },
          { id: "none", name: "Gravity-Gradient Boom (No Thrusters)", cost: 5000, mass: 40, spec: "Passive", desc: "Passive stabilization for minimal-budget missions." }
        ]
      }
    }
  },
  probe: {
    badge: "SPACE PROBE",
    name: "Space Probe",
    parts: {
      shield: {
        title: "1. HEAT & PRESSURE SHIELD",
        options: [
          { id: "ablative", name: "Ablative Carbon Heatshield", cost: 65000, mass: 800, spec: "3000°C Limit", desc: "Survives intense atmospheric entry friction into Titan." },
          { id: "ceramic", name: "Thermal Protection Tiles", cost: 35000, mass: 500, spec: "Orbital Shield", desc: "Lighter heat barrier for upper-atmosphere passes." },
          { id: "none", name: "Omit Entry Shield (High-Alt Flyby)", cost: 0, mass: 0, spec: "No Entry", desc: "For non-entry flybys—saves massive weight & cost." }
        ]
      },
      engine: {
        title: "2. PROPULSION ENGINE",
        options: [
          { id: "ion_plasma", name: "Xenon Ion Plasma Engine", cost: 75000, power: 500, spec: "High Efficiency", desc: "Efficient long-duration deep space thrust." },
          { id: "chem_hyper", name: "Hypergolic Thruster", cost: 40000, power: 850, spec: "Burst Thrust", desc: "High-force boost for rapid upper-atmosphere flybys." }
        ]
      },
      sensors: {
        title: "3. SENSOR PACKAGE",
        options: [
          { id: "mag_radar", name: "Magnetometer & Surface Radar", cost: 55000, mass: 250, spec: "Sub-Surface Scan", desc: "Penetrates haze to map liquid methane lakes." },
          { id: "spectro_cam", name: "Multi-Spectral Imaging Cam", cost: 30000, mass: 120, spec: "Atmosphere Scan", desc: "Analyzes upper-atmosphere gas density and wind shear." }
        ]
      }
    }
  }
};

function toggleTinkercadSidebar() {
  playBeep(500, 'sine', 0.05);
  isSidebarCollapsed = !isSidebarCollapsed;
  const container = document.getElementById('tinkercadSidebarContainer');
  const tab = document.getElementById('sidebarToggleTab');
  const workbench = document.getElementById('viewWorkbench');
  const assemblyArea = document.getElementById('craft-assembly-area');

  if (container && tab && workbench && assemblyArea) {
    if (isSidebarCollapsed) {
      container.style.transform = 'translateX(100%)';
      tab.innerText = '◀';
      workbench.style.backgroundImage = "url('Assets/des_mid.png')";
      assemblyArea.style.paddingRight = '0px';
    } else {
      container.style.transform = 'translateX(0)';
      tab.innerText = '▶';
      workbench.style.backgroundImage = "url('Assets/design.png')";
      assemblyArea.style.paddingRight = '380px';
    }
  }
}

function setupWorkbenchForSelectedVehicle() {
  const vData = getActiveWorkbenchData();

  const assemblyArea = document.getElementById('craft-assembly-area');
  if (assemblyArea) {
    assemblyArea.style.paddingRight = isSidebarCollapsed ? '0px' : '380px';
  }

  const badgeElem = document.getElementById('sidebarVehicleBadge');
  const nameBadgeElem = document.getElementById('vehicleNameBadgeText');

  if (badgeElem) badgeElem.innerText = vData.badge;
  if (nameBadgeElem) nameBadgeElem.innerText = vData.name;

  let savedSelections = {};
  try {
    const storageKey = workbenchMode === 'rocket' ? 'spaceforce_rocket_design' : 'spaceforce_vehicle_design';
    const savedType = workbenchMode === 'rocket'
      ? getAssignedVehicle()
      : (localStorage.getItem('spaceforce_vehicle_design_type') || localStorage.getItem('spaceforce_vehicle'));
    if (workbenchMode === 'rocket' || savedType === selectedVehicle) {
      savedSelections = JSON.parse(localStorage.getItem(storageKey) || '{}');
    }
  } catch (e) {}

  vehicleSelections = {};
  Object.keys(vData.parts).forEach(cat => {
    const validSavedChoice = vData.parts[cat].options.find(option => option.id === savedSelections[cat]);
    vehicleSelections[cat] = validSavedChoice ? validSavedChoice.id : vData.parts[cat].options[0].id;
  });

  renderWorkbenchPartsUI();
  calculateWorkbenchStats();
  updateVehicleVisualAssembly();
}

function renderWorkbenchPartsUI() {
  const vData = getActiveWorkbenchData();
  const container = document.getElementById('workbenchDynamicPartsContainer');
  if (!container) return;
  container.innerHTML = '';

  Object.keys(vData.parts).forEach(categoryKey => {
    const cat = vData.parts[categoryKey];
    const categoryBox = document.createElement('div');
    categoryBox.className = 'flex flex-col gap-1 text-[11px]';

    let optionsHTML = '';
    cat.options.forEach(opt => {
      const isSelected = vehicleSelections[categoryKey] === opt.id;
      const cardBorder = isSelected 
        ? 'border-2 border-cyan-500 bg-cyan-950/80 shadow-[0_0_10px_rgba(56,189,248,0.3)]' 
        : 'border-2 border-slate-800 bg-slate-900/90 hover:bg-slate-800';

      optionsHTML += `
        <div onclick="selectPartOption('${categoryKey}', '${opt.id}')" class="p-2.5 rounded-xl ${cardBorder} cursor-pointer transition flex flex-col gap-1">
          <div class="flex justify-between items-center">
            <span class="font-bold text-slate-100">${opt.name}</span>
            <span class="font-bold text-synth-cyan">$${opt.cost.toLocaleString()}</span>
          </div>
          <div class="flex justify-between items-center text-[10px] text-slate-300">
            <span>${formatOptionStats(opt, vData) || 'Zero Load'}</span>
            <span class="bg-slate-800 text-synth-amber font-bold px-1.5 py-0.5 rounded text-[9px] border border-synth-border">${opt.spec}</span>
          </div>
          <p class="text-[9px] text-slate-400 italic mt-0.5">${opt.desc}</p>
        </div>
      `;
    });

    categoryBox.innerHTML = `
      <label class="font-pixel text-[10px] text-slate-900 font-bold mt-1">${cat.title}</label>
      ${optionsHTML}
    `;
    container.appendChild(categoryBox);
  });

  if (workbenchMode === 'rocket') {
    const level = getRocketEngineUpgradeLevel();
    const remaining = getSharedBudget();
    const atLimit = level >= ENGINE_UPGRADE_LIMIT;
    const canAfford = remaining >= ENGINE_UPGRADE_COST;
    const upgradeCard = document.createElement('section');
    upgradeCard.className = 'mt-2 rounded-xl border-2 border-fuchsia-500/70 bg-slate-950/95 p-3 text-[11px]';
    upgradeCard.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <strong class="font-pixel text-[10px] text-fuchsia-300">ENGINE UPGRADE</strong>
        <span class="font-bold text-cyan-300">LEVEL ${level}/${ENGINE_UPGRADE_LIMIT}</span>
      </div>
      <p class="mt-2 text-slate-300">Each upgrade adds 8% engine specific impulse, improving available delta-v. Cost: $${ENGINE_UPGRADE_COST.toLocaleString()} each.</p>
      <p class="mt-1 text-slate-400">Upgrade spend: $${(level * ENGINE_UPGRADE_COST).toLocaleString()}</p>
      <button type="button" onclick="upgradeRocketEngine()" ${atLimit || !canAfford ? 'disabled' : ''}
        class="mt-2 w-full rounded-lg border border-fuchsia-400 px-3 py-2 font-bold ${atLimit || !canAfford ? 'cursor-not-allowed bg-slate-800 text-slate-500' : 'cursor-pointer bg-fuchsia-700 text-white hover:bg-fuchsia-600'}">
        ${atLimit ? 'MAX LEVEL REACHED' : !canAfford ? 'NOT ENOUGH BUDGET' : `UPGRADE ENGINE · $${ENGINE_UPGRADE_COST.toLocaleString()}`}
      </button>
    `;
    container.appendChild(upgradeCard);
  }
}

function selectPartOption(categoryKey, optionId) {
  playBeep(600, 'sine', 0.05);
  const previousOption = vehicleSelections[categoryKey];
  vehicleSelections[categoryKey] = optionId;
  if (workbenchMode === 'rocket' && categoryKey === 'engine' && previousOption !== optionId) {
    localStorage.setItem('spaceforce_engine_upgrade_level', '0');
    localStorage.setItem('spaceforce_engine_upgrade_engine', optionId);
  }
  renderWorkbenchPartsUI();
  calculateWorkbenchStats();
  updateVehicleVisualAssembly();
}

const ENGINE_UPGRADE_COST = 10000;
const ENGINE_UPGRADE_BONUS = 0.08;
const ENGINE_UPGRADE_LIMIT = 10;

function getRocketEngineUpgradeLevel() {
  const currentEngine = vehicleSelections.engine || 'kerolox';
  if (localStorage.getItem('spaceforce_engine_upgrade_engine') !== currentEngine) {
    localStorage.setItem('spaceforce_engine_upgrade_engine', currentEngine);
    localStorage.setItem('spaceforce_engine_upgrade_level', '0');
  }
  const level = Number.parseInt(localStorage.getItem('spaceforce_engine_upgrade_level') || '0', 10);
  return Number.isFinite(level) ? Math.max(0, Math.min(ENGINE_UPGRADE_LIMIT, level)) : 0;
}

function upgradeRocketEngine() {
  if (workbenchMode !== 'rocket') return;
  const level = getRocketEngineUpgradeLevel();
  if (level >= ENGINE_UPGRADE_LIMIT || getSharedBudget() < ENGINE_UPGRADE_COST) return;

  const remaining = setSharedBudget(getSharedBudget() - ENGINE_UPGRADE_COST);
  const nextLevel = level + 1;
  localStorage.setItem('spaceforce_engine_upgrade_level', String(nextLevel));
  localStorage.setItem('spaceforce_engine_upgrade_engine', vehicleSelections.engine || 'kerolox');
  saveNotebookLog('DESIGN', 'Rocket Engine Upgrade', `Engine specific impulse increased by ${Math.round(ENGINE_UPGRADE_BONUS * 100)}%. Upgrade ${nextLevel}/${ENGINE_UPGRADE_LIMIT}; cost $${ENGINE_UPGRADE_COST.toLocaleString()}. Budget left: $${remaining.toLocaleString()}.`, remaining, {
    vehicle: getAssignedVehicle(), rocketUpgradeLevel: nextLevel, totalCost: ENGINE_UPGRADE_COST
  });
  playBeep(880, 'square', 0.15);
  renderWorkbenchPartsUI();
  calculateWorkbenchStats();
}

function getDesignReceiptKey(kind, vehicle, design) {
  const missionId = (activeMissionData && activeMissionData.id) || (() => {
    try { return JSON.parse(localStorage.getItem('spaceforce_mission_data') || 'null')?.id; }
    catch (e) { return null; }
  })() || currentPlanetTarget || 'campaign';
  const normalizedDesign = Object.entries(design || {}).sort(([a], [b]) => a.localeCompare(b));
  return `${missionId}:${kind}:${vehicle}:${JSON.stringify(normalizedDesign)}`;
}

function getDesignReceipts() {
  let receipts = {};
  try { receipts = JSON.parse(localStorage.getItem('spaceforce_design_receipts') || '{}'); }
  catch (e) { receipts = {}; }

  // Older saves charged locked designs but did not store receipts. Treat the
  // current in-progress mission's saved designs as already purchased once.
  let missionId = activeMissionData && activeMissionData.id;
  if (!missionId) {
    try { missionId = JSON.parse(localStorage.getItem('spaceforce_mission_data') || 'null')?.id; }
    catch (e) {}
  }
  if (missionId && localStorage.getItem('spaceforce_design_receipts_migrated') !== 'true') {
    const vehicle = (activeMissionData && activeMissionData.vehicle) || localStorage.getItem('spaceforce_vehicle') || 'rover';
    try {
      const design = JSON.parse(localStorage.getItem('spaceforce_vehicle_design') || '{}');
      const typeMatches = localStorage.getItem('spaceforce_vehicle_design_type') === vehicle ||
        Object.keys(design).length > 0 && Object.keys(design).every(cat => vehiclePartsDatabase[vehicle]?.parts[cat]);
      const cost = Number(localStorage.getItem('spaceforce_vehicle_cost')) || 0;
      if (typeMatches && cost > 0) receipts[getDesignReceiptKey('vehicle', vehicle, design)] = { cost, migrated: true };
    } catch (e) {}
    try {
      const design = JSON.parse(localStorage.getItem('spaceforce_rocket_design') || '{}');
      const cost = Number(localStorage.getItem('spaceforce_rocket_cost')) || 0;
      if (Object.keys(design).length > 0 && cost > 0) receipts[getDesignReceiptKey('rocket', vehicle, design)] = { cost, migrated: true };
    } catch (e) {}
    localStorage.setItem('spaceforce_design_receipts', JSON.stringify(receipts));
    localStorage.setItem('spaceforce_design_receipts_migrated', 'true');
  }
  return receipts;
}

function isDesignAlreadyPaid(kind, vehicle, design) {
  return Boolean(getDesignReceipts()[getDesignReceiptKey(kind, vehicle, design)]);
}

function chargeDesignOnce(kind, vehicle, design, cost) {
  const receipts = getDesignReceipts();
  const key = getDesignReceiptKey(kind, vehicle, design);
  if (receipts[key]) return { budget: getSharedBudget(), charged: false };
  const budget = setSharedBudget(getSharedBudget() - cost);
  receipts[key] = { cost, timestamp: Date.now() };
  localStorage.setItem('spaceforce_design_receipts', JSON.stringify(receipts));
  return { budget, charged: true };
}

function getCurrentTotals() {
  const vData = getActiveWorkbenchData();
  let totalCost = 0;
  let totalMass = 0;
  let totalPower = 0;
  let names = [];

  Object.keys(vData.parts).forEach(catKey => {
    const selectedId = vehicleSelections[catKey];
    const opt = vData.parts[catKey].options.find(o => o.id === selectedId);
    if (opt) {
      totalCost += opt.cost || 0;
      totalMass += opt.mass || 0;
      totalPower += opt.power || 0;
      if (opt.id !== 'none') names.push(opt.name);
    }
  });

  const caps = vData.caps || DEFAULT_CAPS;
  const effectiveBudget = getSharedBudget();
  const purchaseKind = workbenchMode === 'rocket' ? 'rocket' : 'vehicle';
  const purchaseVehicle = getAssignedVehicle();
  const alreadyPaid = isDesignAlreadyPaid(purchaseKind, purchaseVehicle, vehicleSelections);
  const billableCost = alreadyPaid ? 0 : totalCost;
  return { totalCost, billableCost, alreadyPaid, totalMass, totalPower, names, caps, effectiveBudget };
}

function calculateWorkbenchStats() {
  const vData = getActiveWorkbenchData();
  const { totalCost, billableCost, alreadyPaid, totalMass, totalPower, names, caps, effectiveBudget } = getCurrentTotals();

  const MASS_CAP = caps.mass;
  const MIN_POWER = caps.minPower;
  const PU = caps.powerUnit;

  const costElem = document.getElementById('hud-total-cost');
  const massElem = document.getElementById('hud-total-mass');
  const powerElem = document.getElementById('hud-power-output');
  const overlayElem = document.getElementById('vehiclePartsOverlay');

  if (costElem) costElem.innerText = alreadyPaid
    ? `SAVED DESIGN · $0 DUE (VALUE $${totalCost.toLocaleString()})`
    : `$${totalCost.toLocaleString()} / $${effectiveBudget.toLocaleString()}`;
  if (massElem) massElem.innerText = `${totalMass.toLocaleString()} / ${MASS_CAP.toLocaleString()} kg`;
  if (powerElem) powerElem.innerText = `${totalPower.toLocaleString()} ${PU} (MIN ${MIN_POWER.toLocaleString()} ${PU})`;
  if (overlayElem) overlayElem.innerText = names.length ? names.join(' + ') : 'Base Frame Only';

  const costStatus = document.getElementById('hud-cost-status');
  const massStatus = document.getElementById('hud-mass-status');
  const powerStatus = document.getElementById('hud-power-status');

  if (costStatus) {
    if (billableCost <= effectiveBudget) {
      costStatus.innerText = "OK";
      costStatus.className = "text-synth-green font-bold";
    } else {
      costStatus.innerText = "OVER";
      costStatus.className = "text-synth-red font-bold animate-pulse";
    }
  }

  if (massStatus) {
    if (totalMass <= MASS_CAP) {
      massStatus.innerText = "OK";
      massStatus.className = "text-synth-green font-bold";
    } else {
      massStatus.innerText = "HEAVY";
      massStatus.className = "text-synth-red font-bold animate-pulse";
    }
  }

  if (powerStatus) {
    if (totalPower >= MIN_POWER) {
      powerStatus.innerText = "GOOD";
      powerStatus.className = "text-synth-green font-bold";
    } else {
      powerStatus.innerText = "LOW";
      powerStatus.className = "text-synth-red font-bold animate-pulse";
    }
  }

  const barCost = document.getElementById('bar-cost');
  const barMass = document.getElementById('bar-mass');
  const barPower = document.getElementById('bar-power');

  if (barCost) barCost.style.width = `${Math.min((billableCost / Math.max(effectiveBudget, 1)) * 100, 100)}%`;
  if (barMass) barMass.style.width = `${Math.min((totalMass / MASS_CAP) * 100, 100)}%`;
  if (barPower) barPower.style.width = `${Math.min((totalPower / caps.powerBarMax) * 100, 100)}%`;

  const powerLabel = document.getElementById('hud-power-label');
  if (powerLabel) powerLabel.innerText = caps.powerHudLabel;

  if (vData.specFromCategory) {
    const specOpt = vData.parts[vData.specFromCategory].options.find(o => o.id === vehicleSelections[vData.specFromCategory]);
    const specElem = document.getElementById('hud-special-spec');
    if (specElem && specOpt) specElem.innerText = specOpt.spec;
  }
}

// ==========================================
// NASA GRANT QUIZ SYSTEM (EARN BUDGET)
// ==========================================
const aerospaceQuizPool = [
  {
    q: "Why do Mars rovers like Curiosity and Perseverance use a Multi-Mission Radioisotope Thermoelectric Generator (MMRTG) instead of solar panels?",
    options: [
      "Solar panels melt in Mars's extreme heat",
      "Global dust storms can block sunlight for months and reduce solar power",
      "Mars has no direct sunlight at all"
    ],
    answer: 1
  },
  {
    q: "Which principle explains why rockets can accelerate in the vacuum of space without air to push against?",
    options: [
      "Conservation of Momentum (Newton's Third Law)",
      "Bernoulli's Aerodynamic Lift Principle",
      "Magnetic Field Repulsion"
    ],
    answer: 0
  },
  {
    q: "What is the primary purpose of an ablative heatshield during atmospheric entry on Titan or Mars?",
    options: [
      "To generate electricity from friction",
      "To carry heat away by controlled charring and vaporization of the shield material",
      "To inflate like a parachute at Mach 10"
    ],
    answer: 1
  },
  {
    q: "Why do deep-space satellites use high-gain parabolic dish antennas?",
    options: [
      "To focus radio waves into a narrow beam for high-data-rate communication across millions of kilometers",
      "To collect solar wind particles for fuel",
      "To shield electronics from cosmic rays"
    ],
    answer: 0
  },
  {
    q: "In orbital mechanics, what happens when a spacecraft fires its thrusters prograde (in the direction of motion)?",
    options: [
      "Its orbital altitude on the opposite side of the orbit increases",
      "It immediately drops straight down to the surface",
      "Its orbital period becomes zero"
    ],
    answer: 0
  }
];

let currentQuizItem = null;
let quizAnswered = false;

function openBudgetQuizModal() {
  playBeep(700, 'sine', 0.1);
  quizAnswered = false;
  currentQuizItem = aerospaceQuizPool[Math.floor(Math.random() * aerospaceQuizPool.length)];

  const qBox = document.getElementById('quiz-question-box');
  const oBox = document.getElementById('quiz-options-box');
  const fText = document.getElementById('quiz-feedback-text');

  if (qBox) qBox.innerText = currentQuizItem.q;
  if (fText) fText.classList.add('hidden');
  if (oBox) {
    oBox.innerHTML = '';
    currentQuizItem.options.forEach((optText, idx) => {
      const btn = document.createElement('button');
      btn.className = "text-left p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs text-slate-100 transition cursor-pointer";
      btn.innerText = `${String.fromCharCode(65 + idx)}. ${optText}`;
      btn.onclick = () => submitQuizAnswer(idx, btn);
      oBox.appendChild(btn);
    });
  }

  document.getElementById('budget-quiz-modal').classList.remove('hidden');
}

function submitQuizAnswer(selectedIndex, btnEl) {
  if (quizAnswered || !currentQuizItem) return;
  quizAnswered = true;

  const fText = document.getElementById('quiz-feedback-text');
  if (selectedIndex === currentQuizItem.answer) {
    playBeep(1040, 'triangle', 0.25);
    const newTotal = addSharedBudget(25000);
    btnEl.className = "text-left p-3 rounded-xl bg-emerald-900/70 border-2 border-emerald-400 text-xs text-emerald-200 font-bold";
    if (fText) {
      fText.innerText = `🎉 GRANT APPROVED! +$25,000. Corporate budget now $${newTotal.toLocaleString()}.`;
      fText.className = "text-xs font-bold text-center text-emerald-400 block";
    }
    calculateWorkbenchStats();
  } else {
    playBeep(240, 'sawtooth', 0.25);
    btnEl.className = "text-left p-3 rounded-xl bg-red-900/70 border-2 border-red-400 text-xs text-red-200 font-bold";
    if (fText) {
      fText.innerText = "❌ Grant proposal denied! Close and try another review question.";
      fText.className = "text-xs font-bold text-center text-red-400 block";
    }
  }
}

function closeBudgetQuizModal() {
  document.getElementById('budget-quiz-modal').classList.add('hidden');
}

function closeDesignErrorModal() {
  document.getElementById('design-error-modal').classList.add('hidden');
}

// ==========================================
// DYNAMIC SIDE-PROFILE SVG ASSEMBLY RENDERER
// ==========================================
function updateVehicleVisualAssembly() {
  const container = document.getElementById('svg-rover-container');
  if (!container) return;

  if (workbenchMode === 'rocket') {
    const engineChoice = vehicleSelections['engine'] || 'kerolox';
    const bodyChoice = vehicleSelections['body'] || 'allithium';
    const fairingChoice = vehicleSelections['fairing'] || 'composite';

    const bodyColor = bodyChoice === 'allithium' ? '#f1f5f9' : '#94a3b8';
    const bodyStroke = bodyChoice === 'allithium' ? '#0f172a' : '#334155';
    const engineColor = engineChoice === 'kerolox' ? '#fb923c' : '#38bdf8';
    const fairingColor = fairingChoice === 'composite' ? '#ef4444' : '#cbd5e1';

    container.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" class="w-full h-full drop-shadow-xl">
        <line x1="200" y1="10" x2="200" y2="190" stroke="#334155" stroke-width="1.5" stroke-dasharray="6 4" />
        <g transform="translate(170, 5)">
          <path d="M 30 10 Q 30 25 15 40 L 45 40 Q 30 25 30 10 Z" fill="${fairingColor}" stroke="#0f172a" stroke-width="3" />
          <rect x="15" y="40" width="30" height="95" rx="3" fill="${bodyColor}" stroke="${bodyStroke}" stroke-width="3" />
          <line x1="15" y1="70" x2="45" y2="70" stroke="${bodyStroke}" stroke-width="2" />
          <line x1="15" y1="100" x2="45" y2="100" stroke="${bodyStroke}" stroke-width="2" />
          <text x="30" y="87" fill="#0f172a" font-family="monospace" font-size="7" font-weight="bold" text-anchor="middle" transform="rotate(90 30 87)">SPACE FORCE</text>
          <polygon points="18,135 42,135 50,155 10,155" fill="#475569" stroke="#0f172a" stroke-width="3" />
          <path d="M 20 155 L 30 185 L 40 155 Z" fill="${engineColor}" opacity="0.9" />
          <polygon points="15,115 0,145 15,135" fill="${fairingColor}" stroke="#0f172a" stroke-width="2" />
          <polygon points="45,115 60,145 45,135" fill="${fairingColor}" stroke="#0f172a" stroke-width="2" />
        </g>
      </svg>
    `;
    return;
  }

  const currentType = selectedVehicle || 'rover';

  if (currentType === 'rover') {
    const chassisChoice = vehicleSelections['chassis'] || 'titanium';
    const wheelsChoice = vehicleSelections['wheels'] || 'rock_mesh';
    const powerChoice = vehicleSelections['power'] || 'rtg';
    const toolsChoice = vehicleSelections['tools'] || 'drill_spec';

    const chassisColor = chassisChoice === 'titanium' ? '#38bdf8' : '#cbd5e1';
    const chassisStroke = chassisChoice === 'titanium' ? '#0284c7' : '#64748b';
    const wheelColor = wheelsChoice === 'rock_mesh' ? '#38bdf8' : '#f59e0b';
    const wheelHub = wheelsChoice === 'rock_mesh' ? '#0284c7' : '#b45309';
    const powerColor = powerChoice === 'rtg' ? '#fb923c' : '#fde047';
    const powerCoreColor = powerChoice === 'rtg' ? '#ef4444' : '#38bdf8';
    const toolColor = toolsChoice === 'drill_spec' ? '#38bdf8' : '#a855f7';

    container.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" class="w-full h-full drop-shadow-xl">
        <line x1="40" y1="150" x2="360" y2="150" stroke="#475569" stroke-width="2" stroke-dasharray="6 4" />
        <path d="M 120 120 L 90 145" stroke="#94a3b8" stroke-width="4" stroke-linecap="round" />
        <path d="M 150 120 L 130 145" stroke="#94a3b8" stroke-width="4" stroke-linecap="round" />
        <path d="M 250 120 L 270 145" stroke="#94a3b8" stroke-width="4" stroke-linecap="round" />
        <path d="M 280 120 L 310 145" stroke="#94a3b8" stroke-width="4" stroke-linecap="round" />
        <g>
          <circle cx="90" cy="145" r="18" fill="${wheelColor}" stroke="#0f172a" stroke-width="4" />
          <circle cx="90" cy="145" r="7" fill="${wheelHub}" />
          <circle cx="130" cy="145" r="18" fill="${wheelColor}" stroke="#0f172a" stroke-width="4" />
          <circle cx="130" cy="145" r="7" fill="${wheelHub}" />
          <circle cx="270" cy="145" r="18" fill="${wheelColor}" stroke="#0f172a" stroke-width="4" />
          <circle cx="270" cy="145" r="7" fill="${wheelHub}" />
          <circle cx="310" cy="145" r="18" fill="${wheelColor}" stroke="#0f172a" stroke-width="4" />
          <circle cx="310" cy="145" r="7" fill="${wheelHub}" />
        </g>
        <g>
          <polygon points="100,120 120,95 280,95 300,120 280,145 120,145" fill="${chassisColor}" stroke="${chassisStroke}" stroke-width="4" opacity="0.95" />
          <rect x="150" y="107" width="100" height="26" rx="4" fill="#0f172a" stroke="#334155" stroke-width="2" />
          <text x="200" y="124" fill="#38bdf8" font-family="monospace" font-size="10" font-weight="bold" text-anchor="middle">SPACE FORCE 1</text>
        </g>
        <g transform="translate(160, 55)">
          <rect x="0" y="0" width="40" height="25" rx="4" fill="${powerColor}" stroke="#0f172a" stroke-width="3" />
          <circle cx="20" cy="12" r="6" fill="${powerCoreColor}" stroke="#0f172a" stroke-width="2" />
          <line x1="8" y1="0" x2="8" y2="25" stroke="#0f172a" stroke-width="2" />
          <line x1="32" y1="0" x2="32" y2="25" stroke="#0f172a" stroke-width="2" />
        </g>
        ${toolsChoice !== 'none' ? `
        <g transform="translate(285, 95)">
          <path d="M 0 0 L 15 25 L 25 25" fill="none" stroke="#64748b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
          <rect x="15" y="20" width="18" height="22" rx="3" fill="${toolColor}" stroke="#0f172a" stroke-width="3" />
          ${toolsChoice === 'drill_spec' ? '<polygon points="24,42 20,55 28,55" fill="#f8fafc" stroke="#0f172a" stroke-width="2"/>' : '<circle cx="24" cy="45" r="4" fill="#f8fafc" stroke="#0f172a" stroke-width="2"/>'}
        </g>` : ''}
      </svg>
    `;
  } else if (currentType === 'satellite') {
    const wingsChoice = vehicleSelections['wings'] || 'dual_wing';
    const antennaChoice = vehicleSelections['antenna'] || 'high_gain';
    const thrustersChoice = vehicleSelections['thrusters'] || 'cold_gas';

    const wingFill = wingsChoice === 'dual_wing' ? '#38bdf8' : '#64748b';
    const dishColor = antennaChoice === 'high_gain' ? '#f8fafc' : '#cbd5e1';
    const thrusterColor = thrustersChoice === 'cold_gas' ? '#38bdf8' : '#c084fc';

    container.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" class="w-full h-full drop-shadow-xl">
        <line x1="60" y1="100" x2="340" y2="100" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 4" />
        ${wingsChoice === 'dual_wing' ? `
          <g>
            <rect x="50" y="80" width="90" height="40" rx="4" fill="${wingFill}" stroke="#0f172a" stroke-width="3" />
            <line x1="80" y1="80" x2="80" y2="120" stroke="#0f172a" stroke-width="2" />
            <line x1="110" y1="80" x2="110" y2="120" stroke="#0f172a" stroke-width="2" />
            <rect x="260" y="80" width="90" height="40" rx="4" fill="${wingFill}" stroke="#0f172a" stroke-width="3" />
            <line x1="290" y1="80" x2="290" y2="120" stroke="#0f172a" stroke-width="2" />
            <line x1="320" y1="80" x2="320" y2="120" stroke="#0f172a" stroke-width="2" />
          </g>
        ` : `
          <g>
            <rect x="110" y="90" width="40" height="20" rx="2" fill="${wingFill}" stroke="#0f172a" stroke-width="3" />
            <rect x="250" y="90" width="40" height="20" rx="2" fill="${wingFill}" stroke="#0f172a" stroke-width="3" />
          </g>
        `}
        <g>
          <rect x="145" y="75" width="110" height="50" rx="8" fill="#1e293b" stroke="#38bdf8" stroke-width="4" />
          <rect x="165" y="88" width="70" height="24" rx="4" fill="#0f172a" stroke="#475569" stroke-width="2" />
          <text x="200" y="104" fill="#38bdf8" font-family="monospace" font-size="9" font-weight="bold" text-anchor="middle">SAT-COM 1</text>
        </g>
        <g transform="translate(185, 45)">
          ${antennaChoice === 'high_gain' ? `
            <path d="M 0 30 Q 15 10 30 30 Z" fill="${dishColor}" stroke="#0f172a" stroke-width="3" />
            <line x1="15" y1="30" x2="15" y2="40" stroke="#64748b" stroke-width="3" />
            <circle cx="15" cy="18" r="2.5" fill="#ef4444" />
          ` : `
            <circle cx="15" cy="25" r="12" fill="${dishColor}" stroke="#0f172a" stroke-width="3" />
            <line x1="15" y1="37" x2="15" y2="45" stroke="#64748b" stroke-width="3" />
          `}
        </g>
        ${thrustersChoice !== 'none' ? `
        <g>
          <polygon points="150,125 140,140 160,140" fill="${thrusterColor}" stroke="#0f172a" stroke-width="2" />
          <polygon points="250,125 240,140 260,140" fill="${thrusterColor}" stroke="#0f172a" stroke-width="2" />
        </g>` : ''}
      </svg>
    `;
  } else if (currentType === 'probe') {
    const shieldChoice = vehicleSelections['shield'] || 'ablative';
    const engineChoice = vehicleSelections['engine'] || 'ion_plasma';
    const sensorsChoice = vehicleSelections['sensors'] || 'mag_radar';

    const shieldColor = shieldChoice === 'ablative' ? '#f97316' : '#94a3b8';
    const engineColor = engineChoice === 'ion_plasma' ? '#38bdf8' : '#ef4444';
    const sensorColor = sensorsChoice === 'mag_radar' ? '#c084fc' : '#38bdf8';

    container.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" class="w-full h-full drop-shadow-xl">
        <path d="M 50 140 Q 200 60 350 140" fill="none" stroke="#334155" stroke-width="1.5" stroke-dasharray="5 5" />
        <g>
          <polygon points="120,100 240,75 280,100 240,125 120,100" fill="#1e293b" stroke="#38bdf8" stroke-width="4" />
          <rect x="160" y="88" width="50" height="24" rx="4" fill="#0f172a" stroke="#475569" stroke-width="2" />
          <text x="185" y="104" fill="#38bdf8" font-family="monospace" font-size="9" font-weight="bold" text-anchor="middle">PROBE-X</text>
        </g>
        ${shieldChoice !== 'none' ? `
        <g>
          <path d="M 280 75 Q 315 100 280 125 Z" fill="${shieldColor}" stroke="#0f172a" stroke-width="3" />
        </g>` : ''}
        <g transform="translate(100, 85)">
          <rect x="0" y="5" width="20" height="20" rx="3" fill="#475569" stroke="#0f172a" stroke-width="3" />
          <path d="M -25 15 L 0 5 L 0 25 Z" fill="${engineColor}" opacity="0.8" />
        </g>
        <g transform="translate(190, 50)">
          <line x1="0" y1="25" x2="0" y2="10" stroke="#94a3b8" stroke-width="3" />
          <circle cx="0" cy="8" r="7" fill="${sensorColor}" stroke="#0f172a" stroke-width="2" />
        </g>
      </svg>
    `;
  }
}

function resetWorkbenchDesign() {
  playBeep(300, 'sawtooth', 0.15);
  setupWorkbenchForSelectedVehicle();
}

window.addEventListener('resize', () => { resizeCanvas(); });

// ==========================================
// ROCKET DESIGN WORKBENCH & VALIDATION
// ==========================================
let workbenchMode = 'vehicle';

const DEFAULT_CAPS = {
  budget: 150000, mass: 12000, minPower: 200, powerBarMax: 500,
  powerUnit: 'W', powerLabelShort: 'Power', powerHudLabel: 'POWER OUTPUT:'
};

const rocketPartsData = {
  badge: "ROCKET",
  name: "Rocket",
  specFromCategory: "engine",
  caps: {
    budget: 300000, mass: 450000, minPower: 5000, powerBarMax: 10000,
    powerUnit: 'kN', powerLabelShort: 'Thrust', powerHudLabel: 'THRUST OUTPUT:'
  },
  parts: {
    engine: {
      title: "1. MAIN ENGINE",
      options: [
        { id: "kerolox", name: "Kerolox Gas-Generator Engine", cost: 70000, mass: 2200, power: 7600, spec: "Proven & Reliable", desc: "Kerosene + liquid oxygen. 7,600 kN thrust class." },
        { id: "methalox", name: "Methalox Full-Flow Engine", cost: 120000, mass: 2600, power: 9200, spec: "High Thrust", desc: "Methane + liquid oxygen. 9,200 kN heavy thrust." }
      ]
    },
    fuel: {
      title: "2. PROPELLANT TANKS",
      options: [
        { id: "rp1", name: "RP-1 Kerosene Tanks", cost: 40000, mass: 25000, spec: "Dense & Cheap", desc: "400,000 kg propellant capacity." },
        { id: "lh2", name: "Liquid Hydrogen Tanks", cost: 80000, mass: 18000, spec: "Max Efficiency", desc: "350,000 kg high-isp propellant." }
      ]
    },
    body: {
      title: "3. BODY STRUCTURE",
      options: [
        { id: "allithium", name: "Aluminum-Lithium Alloy", cost: 50000, mass: 12000, spec: "Light Alloy", desc: "Strong and light aerospace hull." },
        { id: "steel", name: "Stainless Steel Hull", cost: 30000, mass: 16000, spec: "Heat Tolerant", desc: "Tough heavy-duty structural steel." }
      ]
    },
    fairing: {
      title: "4. PAYLOAD FAIRING",
      options: [
        { id: "composite", name: "Composite Nose Fairing", cost: 35000, mass: 1800, spec: "Aerodynamic", desc: "Smooth carbon shell." },
        { id: "aluminum", name: "Aluminum Payload Shell", cost: 20000, mass: 2500, spec: "Budget Shell", desc: "Sturdy standard payload housing." }
      ]
    },
    guidance: {
      title: "5. GUIDANCE SYSTEM",
      options: [
        { id: "inertial", name: "Inertial + GPS Navigator", cost: 25000, mass: 200, spec: "Steady Ascent", desc: "Standard atmospheric guidance suite." },
        { id: "startracker", name: "Star Tracker + Gyro Suite", cost: 45000, mass: 350, spec: "Deep-Space Precision", desc: "Advanced stellar navigation." }
      ]
    }
  }
};

function getActiveWorkbenchData() {
  if (workbenchMode === 'rocket') return rocketPartsData;
  return vehiclePartsDatabase[selectedVehicle || 'rover'];
}

function formatOptionStats(opt, vData) {
  const caps = vData.caps || DEFAULT_CAPS;
  const bits = [];
  if (opt.mass) bits.push(`Mass: ${opt.mass.toLocaleString()} kg`);
  if (opt.power) bits.push(`${caps.powerLabelShort}: ${opt.power.toLocaleString()} ${caps.powerUnit}`);
  return bits.join(' | ');
}

function openVehicleWorkbench() {
  selectedVehicle = getAssignedVehicle();
  workbenchMode = 'vehicle';
  switchView('viewWorkbench');
}

function openRocketWorkbench() {
  playBeep(900, 'square', 0.2);
  selectedVehicle = getAssignedVehicle();
  workbenchMode = 'rocket';
  switchView('viewWorkbench');
}

function validateWorkbenchDesign() {
  const { totalCost, billableCost, totalMass, totalPower, caps, effectiveBudget } = getCurrentTotals();
  const errors = [];

  if (billableCost > effectiveBudget) {
    errors.push(`Budget Exceeded ($${totalCost.toLocaleString()} > $${effectiveBudget.toLocaleString()}). Swap to cheaper modules!`);
  }
  if (totalMass > caps.mass) {
    errors.push(`Craft Mass Exceeded (${totalMass.toLocaleString()} kg > ${caps.mass.toLocaleString()} kg limit). Choose lighter components!`);
  }
  if (totalPower < caps.minPower) {
    errors.push(`Insufficient Power Output (${totalPower.toLocaleString()} < ${caps.minPower.toLocaleString()} required).`);
  }

  const planetCheck = (typeof activePlanet !== 'undefined' ? activePlanet : (typeof currentPlanetTarget !== 'undefined' ? currentPlanetTarget : 'mars')).toLowerCase();

  if (workbenchMode === 'rocket') {
    const engine = vehicleSelections['engine'];
    if (planetCheck === 'titan' && engine === 'kerolox') {
      errors.push('Titan Mission Error: Kerolox engines lack the specific impulse (Isp) required for Saturn/Titan transfer orbits. Upgrade to Methalox Full-Flow!');
    }
  }

  return errors;
}

function workbenchContinue() {
  const errors = validateWorkbenchDesign();
  if (errors.length > 0) {
    playBeep(220, 'sawtooth', 0.3);
    const listEl = document.getElementById('design-error-list');
    if (listEl) {
      listEl.innerHTML = errors.map(err => `<li>${err}</li>`).join('');
    }
    document.getElementById('design-error-modal').classList.remove('hidden');
    return;
  }

  const { totalCost, billableCost, totalMass } = getCurrentTotals();
  const partsSummary = Object.values(vehicleSelections).filter(v => v !== 'none').join(', ').toUpperCase();

  if (workbenchMode === 'rocket') {
    playBeep(880, 'square', 0.2);

    // Charge a configuration once per mission; reloading and submitting the same design is free.
    const rocketCharge = chargeDesignOnce('rocket', getAssignedVehicle(), vehicleSelections, billableCost);
    const after = rocketCharge.budget;
    const rocketCostNote = rocketCharge.charged ? `Cost -$${totalCost.toLocaleString()}.` : `Previously purchased; no repeat charge ($${totalCost.toLocaleString()}).`;
    saveNotebookLog('DESIGN', 'Rocket Configuration Locked', `Modules: ${partsSummary}. ${rocketCostNote} Budget left: $${after.toLocaleString()}`, after, {
      mission: currentPlanetTarget || localStorage.getItem('spaceforce_planet') || 'Deep Space Transfer',
      vehicle: getAssignedVehicle(),
      rocketCost: totalCost, totalCost
    });

    const planet = (currentPlanetTarget || (activeMissionData && activeMissionData.planet) || localStorage.getItem('spaceforce_planet') || 'mars').toLowerCase();
    const vehicle = getAssignedVehicle();
    selectedVehicle = vehicle;
    const currentVehicleParts = vehiclePartsDatabase[vehicle];
    let existingVehicleDesign = {};
    try { existingVehicleDesign = JSON.parse(localStorage.getItem('spaceforce_vehicle_design') || '{}'); } catch (e) {}
    const hasForeignPartTypes = currentVehicleParts && Object.keys(existingVehicleDesign).some(cat => !currentVehicleParts.parts[cat]);
    const existingDesignType = localStorage.getItem('spaceforce_vehicle_design_type') || (hasForeignPartTypes ? 'mismatched-design' : vehicle);
    if (existingDesignType !== vehicle) {
      localStorage.setItem('spaceforce_vehicle_design', '{}');
      localStorage.setItem('spaceforce_vehicle_design_type', vehicle);
    }

    localStorage.setItem('spaceforce_planet', planet);
    localStorage.setItem('spaceforce_vehicle', vehicle);
    localStorage.setItem('spaceforce_rocket_design', JSON.stringify(vehicleSelections));
    localStorage.setItem('spaceforce_rocket_cost', String(totalCost));
    // Never carry a payload mass across vehicle types.
    const savedPayloadVehicle = localStorage.getItem('spaceforce_payload_vehicle');
    const savedPayload = Number(localStorage.getItem('spaceforce_payload_mass'));
    if (savedPayloadVehicle !== vehicle || !Number.isFinite(savedPayload) || savedPayload <= 0) {
      const vData = vehiclePartsDatabase[vehicle];
      let payloadMass = { rover: 1000, satellite: 800, probe: 900 }[vehicle] || 0;
      if (vData) Object.keys(vData.parts).forEach(cat => {
        const option = vData.parts[cat].options.find(item => item.id === existingVehicleDesign[cat]) || vData.parts[cat].options[0];
        payloadMass += option.mass || 0;
      });
      localStorage.setItem('spaceforce_payload_mass', String(payloadMass || totalMass || 1500));
      localStorage.setItem('spaceforce_payload_vehicle', vehicle);
    }

    window.location.href = 'rocket_sim.html';
  } else {
    // Vehicle design locked: save type, mass, design, and deduct cost from shared budget
    playBeep(880, 'square', 0.15);
    const vehicle = getAssignedVehicle();
    selectedVehicle = vehicle;
    localStorage.setItem('spaceforce_vehicle', vehicle);
    localStorage.setItem('spaceforce_vehicle_design', JSON.stringify(vehicleSelections));
    localStorage.setItem('spaceforce_vehicle_design_type', vehicle);
    localStorage.setItem('spaceforce_vehicle_cost', String(totalCost));
    const vehicleBaseMass = { rover: 1000, satellite: 800, probe: 900 }[vehicle] || 0;
    localStorage.setItem('spaceforce_payload_mass', String(totalMass + vehicleBaseMass));
    localStorage.setItem('spaceforce_payload_vehicle', vehicle);

    const vehicleCharge = chargeDesignOnce('vehicle', vehicle, vehicleSelections, billableCost);
    const after = vehicleCharge.budget;
    const vehicleCostNote = vehicleCharge.charged ? `Cost -$${totalCost.toLocaleString()}.` : `Previously purchased; no repeat charge ($${totalCost.toLocaleString()}).`;
    saveNotebookLog('DESIGN', `${vehicle.toUpperCase()} Blueprint Saved`, `Modules: ${partsSummary}. Mass ${totalMass.toLocaleString()} kg. ${vehicleCostNote} Budget left: $${after.toLocaleString()}`, after, {
      mission: currentPlanetTarget || localStorage.getItem('spaceforce_planet') || 'Deep Space Transfer',
      vehicle, vehicleCost: totalCost, totalCost
    });

    goToBuildPhaseDialogue();
  }
}

(function handleReturnFromAssembly() {
  const view = new URLSearchParams(window.location.search).get('view');
  if (view === 'rocketIntro') {
    switchView('viewRocketIntro');
  } else if (view === 'rocketSimIntro') {
    switchView('viewRocketSimIntro');
  }
})();

function resetMissionBudget() {
  setSharedBudget(DEFAULT_SHARED_BUDGET);
}

function startNewCampaign() {
  if (!confirm('Start a new campaign? This clears campaign progress and notebook logs, then restores the budget to $1,000,000.')) return;

  [
    'spaceforce_completed_missions', 'spaceforce_campaign_complete', 'spaceforce_mission_data',
    'spaceforce_planet', 'spaceforce_vehicle', 'spaceforce_vehicle_design', 'spaceforce_vehicle_design_type',
    'spaceforce_vehicle_cost', 'spaceforce_payload_mass', 'spaceforce_payload_vehicle',
    'spaceforce_rocket_design', 'spaceforce_rocket_cost', 'spaceforce_test_flights',
    'spaceforce_astra_tutorial_complete', 'spaceforce_assembly_errors', 'spaceforce_notebook_logs',
    'spaceforce_design_receipts', 'spaceforce_design_receipts_migrated', 'spaceforce_mission_report',
    'spaceforce_engine_upgrade_level', 'spaceforce_engine_upgrade_engine',
    'spaceforce_rocket_assembly_model', 'spaceforce_rocket_assembly_complete', 'spaceforce_vehicle_assembly_report'
  ].forEach(key => localStorage.removeItem(key));
  setSharedBudget(DEFAULT_SHARED_BUDGET);

  activeMissionData = null;
  currentPlanetTarget = 'mars';
  selectedVehicle = 'rover';
  vehicleSelections = {};
  switchView('viewDialogueIntro');
}

function reviewGivenMission() {
  let mission = activeMissionData;
  if (!mission) {
    try { mission = JSON.parse(localStorage.getItem('spaceforce_mission_data') || 'null'); }
    catch (e) { mission = null; }
  }
  if (!mission) {
    alert('There is no assigned mission to review yet.');
    switchView('viewAnomalyTerminal');
    return;
  }

  activeMissionData = mission;
  currentPlanetTarget = mission.planet || currentPlanetTarget;
  selectedVehicle = mission.vehicle || selectedVehicle;
  const title = document.getElementById('mission-title');
  const description = document.getElementById('mission-desc');
  const code = document.getElementById('mission-code-badge');
  if (title) title.innerText = mission.title || 'MISSION ALERT';
  if (description) description.innerText = mission.desc || 'Mission briefing unavailable.';
  if (code) code.innerText = mission.code || 'MISSION';
  updateMissionPreview(mission);
  switchView('viewMissionAlert');
}

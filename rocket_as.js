// Rocket Assembly Game State
let currentRocket = 'orbital'; // 'orbital', 'interplanetary', 'plasma'
let currentStage = 1; // 1 to 5
let budget = 1000000;
let timerSeconds = 15;
let timerInterval = null;
let isStageActive = false;

let stage1Error = false;
let stage2Error = false;
let stage3Error = false;
let stage4Error = false;
let stage5Error = false;
let pendingPenalty = 0;
const MIN_BUDGET_THRESHOLD = 150000;

// Read query params for passed rocket state
const urlParams = new URLSearchParams(window.location.search);
const rocketParam = urlParams.get('rocket') || urlParams.get('vehicle');
if (rocketParam && ['orbital', 'interplanetary', 'plasma'].includes(rocketParam)) {
  currentRocket = rocketParam;
}

const savedRocketBudget = localStorage.getItem('spaceforce_rocket_budget') || localStorage.getItem('spaceforce_budget');
if (savedRocketBudget) {
  budget = parseInt(savedRocketBudget, 10);
}

// Rocket Specific Configurations
const rocketConfigs = {
  orbital: {
    title: "ORBITAL HEAVY: STAGE & NOZZLE INTEGRATION",
    stages: [
      { title: "STAGE 1: IGNITION SYSTEM WIRE SPLICING", desc: "Connect matching colored ignition leads before time runs out.", icon: "fa-bolt" },
      { title: "STAGE 2: FUEL TANK SEAM TRACE WELDING", desc: "Free-draw along the glowing seam to seal the cryogenic RP-1 fuel tank.", icon: "fa-fire-burner" },
      { title: "STAGE 3: TURBOPUMP MIXING VALVE PRESSURE", desc: "Turn mixing knobs so RP-1 Kerosene + LOX equals the target sum.", icon: "fa-gauge-high" },
      { title: "STAGE 4: ENGINE GIMBAL NOZZLE ALIGNMENT", desc: "Click when target gimbal nozzle reticle aligns in the sweet spot.", icon: "fa-crosshairs" },
      { title: "STAGE 5: STAGE SEPARATION RING TORQUEING", desc: "Rapidly click highlighted separation ring bolts to lock the interstage.", icon: "fa-screwdriver-wrench" }
    ]
  },
  interplanetary: {
    title: "MARS TRANSPORT: HEAVY STAGE SUITE",
    stages: [
      { title: "STAGE 1: STARSHIP HARNESS WIRE SPLICING", desc: "Route high-voltage stage ignition harnesses before time runs out.", icon: "fa-network-wired" },
      { title: "STAGE 2: HEAT SHIELD SEAM TRACE WELDING", desc: "Free-draw along the thermal heatshield seam for Mars entry.", icon: "fa-fire-burner" },
      { title: "STAGE 3: METHALOX TURBOPUMP PRESSURE", desc: "Turn mixing knobs so Methane + LOX valves equal target sum.", icon: "fa-gauge-high" },
      { title: "STAGE 4: VACUUM RAPTOR OPTICAL CALIBRATION", desc: "Precision timing calibration for outer space vacuum raptor engine.", icon: "fa-bullseye" },
      { title: "STAGE 5: FLAP ACTUATOR BOLT TORQUEING", desc: "Lock down aerodynamic body flap mounting bolts.", icon: "fa-screwdriver-wrench" }
    ]
  },
  plasma: {
    title: "XENON ION ROCKET: DEEP-SPACE BAY",
    stages: [
      { title: "STAGE 1: HIGH-VOLTAGE POWER BUS SPLICING", desc: "Splicing ion drive solar grid power leads before time runs out.", icon: "fa-bolt" },
      { title: "STAGE 2: ION THRUST CHAMBER TRACE WELDING", desc: "Free-draw along the magnetic containment chamber seam.", icon: "fa-fire-burner" },
      { title: "STAGE 3: XENON GAS FLOW VALVES", desc: "Turn mixing knobs so Valve A + Valve B equals target flow rate.", icon: "fa-gauge-high" },
      { title: "STAGE 4: MAGNETIC NOZZLE OPTICAL ALIGNMENT", desc: "Align electromagnetic plasma focal field optical sensor.", icon: "fa-crosshairs" },
      { title: "STAGE 5: THRUSTER GRID RIVET LOCKING", desc: "Rapidly bolt outer ion acceleration grids in sequence.", icon: "fa-shield-halved" }
    ]
  }
};

// Canvas Elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;

let wires = [];
let selectedWire = null;
let dragPos = { x: 0, y: 0 };

let weldPath = [];
let playerWeldTrail = [];
let weldProgress = 0;
let isWelding = false;

let targetSum = 100;
let knobVal1 = 50;
let knobVal2 = 50;
let activeKnob = null;
let knobStartY = 0;
let knobStartVal = 0;

let calibAngle = 0;
let targetAngle = 180;
let calibSpeed = 3;

let bolts = [];
let boltsDone = 0;

function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}
window.addEventListener('resize', resizeCanvas);

window.addEventListener('DOMContentLoaded', () => {
  resizeCanvas();
  updateBudgetDisplay();
  updateStageUI();
  switchRocket(currentRocket);
});

function updateBudgetDisplay() {
  const display = document.getElementById('budget-display');
  if (display) display.innerText = `$${budget.toLocaleString()}`;
  localStorage.setItem('spaceforce_rocket_budget', budget);
  localStorage.setItem('spaceforce_budget', budget);
}

function switchRocket(rocketKey) {
  if (isStageActive) {
    if (!confirm("Switching rocket models will pause current assembly. Continue?")) return;
  }
  stopTimer();
  isStageActive = false;
  currentRocket = rocketKey;
  currentStage = 1;

  ['orbital', 'interplanetary', 'plasma'].forEach(r => {
    const tab = document.getElementById(`tab-${r}`);
    if (tab) {
      if (r === rocketKey) {
        tab.className = "flex-1 md:flex-none px-5 py-2 rounded-lg font-orbitron text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 bg-synthPink text-synthDark shadow-md";
      } else {
        tab.className = "flex-1 md:flex-none px-5 py-2 rounded-lg font-orbitron text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 text-gray-400 hover:text-synthPink";
      }
    }
  });

  document.getElementById('assembly-title').innerText = rocketConfigs[currentRocket].title;
  updateStageUI();
  showStartOverlay("READY TO ASSEMBLE ROCKET", `Initiate assembly for ${rocketKey.toUpperCase()} ROCKET. Each stage has a strict 15-second timer.`);
}

function updateStageUI() {
  const config = rocketConfigs[currentRocket];
  const stageInfo = config.stages[currentStage - 1];

  document.getElementById('stage-counter').innerText = `STAGE ${currentStage} / 5`;
  document.getElementById('stage-title').innerHTML = `<i class="fa-solid ${stageInfo.icon} text-synthPink"></i> ${stageInfo.title}`;
  document.getElementById('stage-desc').innerText = stageInfo.desc;

  const percent = (currentStage / 5) * 100;
  document.getElementById('progress-bar-fill').style.width = `${percent}%`;

  for (let i = 1; i <= 5; i++) {
    const node = document.getElementById(`node-${i}`);
    if (!node) continue;
    const iconDiv = node.querySelector('.node-icon');
    const label = node.querySelector('.node-label');

    if (i < currentStage) {
      iconDiv.className = "node-icon w-8 h-8 md:w-10 md:h-10 rounded-full bg-synthPurple text-white font-orbitron font-black text-xs md:text-sm flex items-center justify-center border-2 border-synthPink shadow-md";
      iconDiv.innerHTML = '<i class="fa-solid fa-check"></i>';
      if (label) label.className = "node-label text-[10px] md:text-xs font-bold text-synthPink text-center hidden sm:block";
    } else if (i === currentStage) {
      iconDiv.className = "node-icon w-8 h-8 md:w-10 md:h-10 rounded-full bg-synthPink text-synthDark font-orbitron font-black text-xs md:text-sm flex items-center justify-center border-2 border-synthPink shadow-lg glow-pink";
      iconDiv.innerText = i;
      if (label) label.className = "node-label text-[10px] md:text-xs font-bold text-synthPink text-center hidden sm:block";
    } else {
      iconDiv.className = "node-icon w-8 h-8 md:w-10 md:h-10 rounded-full bg-synthDark text-gray-500 font-orbitron font-black text-xs md:text-sm flex items-center justify-center border-2 border-gray-700";
      iconDiv.innerText = i;
      if (label) label.className = "node-label text-[10px] md:text-xs font-bold text-gray-500 text-center hidden sm:block";
    }
  }

  if (currentStage === 3) {
    document.getElementById('stage3-ui').classList.remove('hidden');
  } else {
    document.getElementById('stage3-ui').classList.add('hidden');
  }
}

function startTimer() {
  stopTimer();
  timerSeconds = 15;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimerDisplay();
    if (timerSeconds <= 0) {
      stopTimer();
      stage1Error = true;
      completeStage();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
}

function updateTimerDisplay() {
  const display = document.getElementById('timer-display');
  display.innerText = `00:${timerSeconds < 10 ? '0' : ''}${timerSeconds}`;
}

function startCurrentStage() {
  document.getElementById('start-overlay').classList.add('hidden');
  isStageActive = true;
  startTimer();
  initMinigameStage(currentStage);
}

function showStartOverlay(title, sub) {
  document.getElementById('overlay-title').innerText = title;
  document.getElementById('overlay-sub').innerText = sub;
  document.getElementById('start-overlay').classList.remove('hidden');
}

function initMinigameStage(stage) {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (stage === 1) {
    stage1Error = false;
    const colors = ['#ff007f', '#66fcf1', '#ffb703', '#9d00ff'];
    let rightIndices = [0, 1, 2, 3].sort(() => Math.random() - 0.5);

    wires = colors.map((col, idx) => ({
      id: idx,
      color: col,
      startX: 80,
      startY: 70 + idx * 75,
      endX: canvas.width - 80,
      endY: 70 + rightIndices[idx] * 75,
      connectedToColor: null,
      connected: false
    }));
  } else if (stage === 2) {
    stage2Error = false;
    weldProgress = 0;
    isWelding = false;
    playerWeldTrail = [];
    weldPath = [];
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = 80 + t * (canvas.width - 160);
      const y = canvas.height / 2 + Math.sin(t * Math.PI * 4) * 60;
      weldPath.push({ x, y });
    }
  } else if (stage === 3) {
    stage3Error = false;
    targetSum = Math.floor(Math.random() * 50) + 80;
    document.getElementById('valve-target-label').innerText = `TARGET FUEL MIX: ${targetSum} PSI`;
    knobVal1 = Math.floor(Math.random() * 40) + 10;
    knobVal2 = Math.floor(Math.random() * 40) + 10;
    updateTurntableKnobsUI();
  } else if (stage === 4) {
    stage4Error = false;
    calibAngle = 0;
    targetAngle = 130 + Math.random() * 100;
  } else if (stage === 5) {
    stage5Error = false;
    boltsDone = 0;
    bolts = [];
    const count = 6;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 105;
      bolts.push({
        x: canvas.width / 2 + Math.cos(angle) * radius,
        y: canvas.height / 2 + Math.sin(angle) * radius,
        torqued: false
      });
    }
  }

  requestAnimationFrame(gameLoop);
}

function gameLoop() {
  if (!isStageActive || !ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentStage === 1) renderStage1();
  else if (currentStage === 2) renderStage2();
  else if (currentStage === 3) renderStage3Canvas();
  else if (currentStage === 4) renderStage4();
  else if (currentStage === 5) renderStage5();

  requestAnimationFrame(gameLoop);
}

function renderStage1() {
  wires.forEach(w => {
    ctx.fillStyle = w.color;
    ctx.beginPath();
    ctx.arc(w.startX, w.startY, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(w.endX, w.endY, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (w.connected) {
      ctx.strokeStyle = w.connectedToColor || w.color;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(w.startX, w.startY);
      ctx.lineTo(w.endX, w.endY);
      ctx.stroke();
    }
  });

  if (selectedWire) {
    ctx.strokeStyle = selectedWire.color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(selectedWire.startX, selectedWire.startY);
    ctx.lineTo(dragPos.x, dragPos.y);
    ctx.stroke();
  }
}

function renderStage2() {
  ctx.strokeStyle = '#1f2833';
  ctx.lineWidth = 18;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  weldPath.forEach((pt, i) => {
    if (i === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });
  ctx.stroke();

  if (playerWeldTrail.length > 1) {
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    playerWeldTrail.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();
  }
}

function renderStage3Canvas() {}

function startKnobDrag(e, knobId) {
  if (!isStageActive) return;
  e.preventDefault();
  activeKnob = knobId;
  knobStartY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
  knobStartVal = (knobId === 1) ? knobVal1 : knobVal2;

  window.addEventListener('mousemove', onKnobDrag);
  window.addEventListener('mouseup', stopKnobDrag);
  window.addEventListener('touchmove', onKnobTouchDrag);
  window.addEventListener('touchend', stopKnobDrag);
}

function onKnobDrag(e) {
  if (!activeKnob) return;
  const clientY = e.clientY;
  const deltaY = knobStartY - clientY;
  let newVal = Math.round(knobStartVal + deltaY * 0.8);
  newVal = Math.max(0, Math.min(100, newVal));

  if (activeKnob === 1) knobVal1 = newVal;
  if (activeKnob === 2) knobVal2 = newVal;

  updateTurntableKnobsUI();
}

function onKnobTouchDrag(e) {
  if (!activeKnob) return;
  const clientY = e.touches[0].clientY;
  const deltaY = knobStartY - clientY;
  let newVal = Math.round(knobStartVal + deltaY * 0.8);
  newVal = Math.max(0, Math.min(100, newVal));

  if (activeKnob === 1) knobVal1 = newVal;
  if (activeKnob === 2) knobVal2 = newVal;

  updateTurntableKnobsUI();
}

function stopKnobDrag() {
  activeKnob = null;
  window.removeEventListener('mousemove', onKnobDrag);
  window.removeEventListener('mouseup', stopKnobDrag);
  window.removeEventListener('touchmove', onKnobTouchDrag);
  window.removeEventListener('touchend', stopKnobDrag);
}

function updateTurntableKnobsUI() {
  document.getElementById('knob1-val').innerText = `${knobVal1} PSI`;
  document.getElementById('knob2-val').innerText = `${knobVal2} PSI`;

  const deg1 = -135 + (knobVal1 / 100) * 270;
  const deg2 = -135 + (knobVal2 / 100) * 270;

  const ind1 = document.getElementById('knob-indicator-1');
  const ind2 = document.getElementById('knob-indicator-2');
  if (ind1) ind1.style.transform = `rotate(${deg1}deg)`;
  if (ind2) ind2.style.transform = `rotate(${deg2}deg)`;
}

function renderStage4() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = 110;

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  const startRad = (targetAngle - 15) * (Math.PI / 180);
  const endRad = (targetAngle + 15) * (Math.PI / 180);
  ctx.strokeStyle = '#ff007f';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startRad, endRad);
  ctx.stroke();

  calibAngle = (calibAngle + calibSpeed) % 360;
  const currentRad = calibAngle * (Math.PI / 180);
  const needleX = cx + Math.cos(currentRad) * radius;
  const needleY = cy + Math.sin(currentRad) * radius;

  ctx.strokeStyle = '#66fcf1';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(needleX, needleY);
  ctx.stroke();

  ctx.fillStyle = '#ff007f';
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '13px Orbitron';
  ctx.textAlign = 'center';
  ctx.fillText("CLICK ANYWHERE WHEN GIMBAL NOZZLE IS IN PINK ZONE", cx, cy + 150);
}

function renderStage5() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.arc(cx, cy, 105, 0, Math.PI * 2);
  ctx.stroke();

  bolts.forEach((b, idx) => {
    ctx.fillStyle = b.torqued ? '#ff007f' : '#66fcf1';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = b.torqued ? '#ffffff' : '#0b0c10';
    ctx.font = 'bold 12px Orbitron';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.torqued ? '✓' : idx + 1, b.x, b.y);
  });
}

if (canvas) {
  canvas.addEventListener('mousedown', handleInputStart);
  canvas.addEventListener('mousemove', handleInputMove);
  canvas.addEventListener('mouseup', handleInputEnd);

  canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    handleInputStart({ clientX: touch.clientX, clientY: touch.clientY });
  });
  canvas.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    handleInputMove({ clientX: touch.clientX, clientY: touch.clientY });
  });
  canvas.addEventListener('touchend', handleInputEnd);
}

function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function handleInputStart(e) {
  if (!isStageActive) return;
  const pos = getCanvasPos(e);

  if (currentStage === 1) {
    wires.forEach(w => {
      if (!w.connected) {
        const dist = Math.hypot(pos.x - w.startX, pos.y - w.startY);
        if (dist < 25) {
          selectedWire = w;
          dragPos = pos;
        }
      }
    });
  } else if (currentStage === 2) {
    isWelding = true;
    playerWeldTrail = [pos];
  } else if (currentStage === 4) {
    const diff = Math.abs(calibAngle - targetAngle);
    if (diff > 18 && diff < 342) {
      stage4Error = true;
    }
    completeStage();
  } else if (currentStage === 5) {
    bolts.forEach(b => {
      if (!b.torqued) {
        const dist = Math.hypot(pos.x - b.x, pos.y - b.y);
        if (dist < 22) {
          b.torqued = true;
          boltsDone++;
          if (boltsDone >= bolts.length) {
            completeStage();
          }
        }
      }
    });
  }
}

function handleInputMove(e) {
  if (!isStageActive) return;
  const pos = getCanvasPos(e);

  if (currentStage === 1 && selectedWire) {
    dragPos = pos;
  } else if (currentStage === 2 && isWelding) {
    playerWeldTrail.push(pos);
  }
}

function handleInputEnd() {
  if (currentStage === 1 && selectedWire) {
    let targetTerminal = null;
    wires.forEach(w => {
      const dist = Math.hypot(dragPos.x - w.endX, dragPos.y - w.endY);
      if (dist < 30) {
        targetTerminal = w;
      }
    });

    if (targetTerminal) {
      selectedWire.connected = true;
      selectedWire.connectedToColor = targetTerminal.color;
      if (selectedWire.color !== targetTerminal.color) {
        stage1Error = true;
      }
    }
    selectedWire = null;
  } else if (currentStage === 2) {
    isWelding = false;
    let matchedPoints = 0;
    weldPath.forEach(targetPt => {
      const close = playerWeldTrail.some(userPt => Math.hypot(userPt.x - targetPt.x, userPt.y - targetPt.y) < 35);
      if (close) matchedPoints++;
    });
    weldProgress = (matchedPoints / weldPath.length) * 100;
    if (weldProgress < 70) {
      stage2Error = true;
    }
    completeStage();
  }
}

function userClickedDone() {
  if (!isStageActive) return;
  stopTimer();

  if (currentStage === 1) {
    if (!wires.every(w => w.connected)) stage1Error = true;
  } else if (currentStage === 2) {
    if (weldProgress < 70) stage2Error = true;
  } else if (currentStage === 3) {
    if (Number(knobVal1) + Number(knobVal2) !== Number(targetSum)) {
      stage3Error = true;
    } else {
      stage3Error = false;
    }
  } else if (currentStage === 5) {
    if (boltsDone < bolts.length) stage5Error = true;
  }

  completeStage();
}

function completeStage() {
  stopTimer();
  isStageActive = false;

  saveNotebookLog('ASSEMBLY', `Rocket Stage ${currentStage} Submitted`, `Completed booster assembly step.`, budget);

  if (currentStage < 5) {
    currentStage++;
    updateStageUI();
    showStartOverlay("STAGE CLEARED!", `Proceed to Stage ${currentStage}.`);
  } else {
    // Save all assembly defect flags and budget to localStorage, then transition straight to Mission Control
    localStorage.setItem('spaceforce_assembly_errors', JSON.stringify({
      stage1Error,
      stage2Error,
      stage3Error,
      stage4Error,
      stage5Error
    }));
    localStorage.setItem('spaceforce_rocket_assembly_model', currentRocket);
    localStorage.setItem('spaceforce_rocket_assembly_complete', 'true');
    localStorage.setItem('spaceforce_rocket_budget', budget);
    localStorage.setItem('spaceforce_budget', budget);

    window.location.href = 'rocket_mission_control.html';
  }
}

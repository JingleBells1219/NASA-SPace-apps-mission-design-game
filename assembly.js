// System Game State
let currentVehicle = 'rover'; // 'rover', 'satellite', 'probe'
let currentStage = 1; // 1 to 5
let budget = 1000000;
let timerSeconds = 15;
let timerInterval = null;
let isStageActive = false;

// Stage QA Inspection Logs & Defect tracking
let stageDefects = [];
let pendingPenalty = 0;

// Below this, force NASA Grant recovery quiz
const MIN_BUDGET_THRESHOLD = 150000;

// Read query params for passed vehicle state
const urlParams = new URLSearchParams(window.location.search);
const vehicleParam = urlParams.get('vehicle');
if (vehicleParam && ['rover', 'satellite', 'probe'].includes(vehicleParam)) {
  currentVehicle = vehicleParam;
}

// Sync budget from localStorage if available
const savedBudget = localStorage.getItem('spaceforce_budget') || localStorage.getItem('spaceforce_rocket_budget');
if (savedBudget) {
  budget = parseInt(savedBudget, 10);
}

// Vehicle Specific Configurations
const vehicleConfigs = {
  rover: {
    title: "MARS ROVER: HARDWARE INTEGRATION",
    stages: [
      { title: "STAGE 1: POWER GRID WIRE SPLICING", desc: "Connect matching colored battery leads before time runs out.", icon: "fa-network-wired" },
      { title: "STAGE 2: CHASSIS DUST-SEAM TRACE WELDING", desc: "Free-draw along the glowing seam with the welding torch.", icon: "fa-fire-burner" },
      { title: "STAGE 3: DRILL HYDRAULIC VALVE TURNTABLES", desc: "Align mixing dials to meet the required pressure sum.", icon: "fa-gauge-high" },
      { title: "STAGE 4: MAST SPECTROMETER CALIBRATION", desc: "Click when target optic lens aligns in the sweet spot.", icon: "fa-crosshairs" },
      { title: "STAGE 5: ROCKER-BOGIE WHEEL TORQUEING", desc: "Rapidly click highlighted suspension bolts to lock axles.", icon: "fa-screwdriver-wrench" }
    ]
  },
  satellite: {
    title: "ORBITAL SATELLITE: INTEGRATION SUITE",
    stages: [
      { title: "STAGE 1: SOLAR WING BUS WIRING", desc: "Splicing core power buses before time runs out.", icon: "fa-solar-panel" },
      { title: "STAGE 2: THERMAL FOIL TRACE WELDING", desc: "Free-draw along blanket insulation seams to seal payload.", icon: "fa-fire-burner" },
      { title: "STAGE 3: THRUSTER MONOPROPELLANT TURNTABLES", desc: "Align mixing dials to meet the required pressure sum.", icon: "fa-gauge-high" },
      { title: "STAGE 4: HIGH-GAIN ANTENNA OPTICS ALIGNMENT", desc: "Precision timing calibration for deep space relay transmitter.", icon: "fa-satellite-dish" },
      { title: "STAGE 5: SENSOR ARRAY BOLT TORQUEING", desc: "Lock down high-orbit sensor mounts firmly.", icon: "fa-screwdriver-wrench" }
    ]
  },
  probe: {
    title: "SPACE PROBE: DEEP-SPACE SUITE",
    stages: [
      { title: "STAGE 1: IGNITION HARNESS WIRE SPLICING", desc: "Route high-voltage probe ignition wires before time runs out.", icon: "fa-bolt" },
      { title: "STAGE 2: ABLATIVE SHIELD TRACE WELDING", desc: "Free-draw along thermal shield seam for extreme entry friction.", icon: "fa-fire-burner" },
      { title: "STAGE 3: HYPERGOLIC PRESSURE TURNTABLES", desc: "Align mixing dials to meet the required pressure sum.", icon: "fa-gauge-high" },
      { title: "STAGE 4: GUIDANCE GYRO LASER CALIBRATION", desc: "Align flight computer optics before launch.", icon: "fa-bullseye" },
      { title: "STAGE 5: ENGINE NOZZLE HEAT SHIELD RIVETING", desc: "Rapidly bolt engine heat shield tiles in sequence.", icon: "fa-shield-halved" }
    ]
  }
};

// Canvas Elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;

// Minigame Specific Variables
let wires = [];
let selectedWire = null;
let dragPos = { x: 0, y: 0 };
let stage1Error = false;

let weldPath = [];
let playerWeldTrail = [];
let weldProgress = 0;
let isWelding = false;
let stage2Error = false;

// Turntable Knob State Variables
let targetSum = 100;
let knobVal1 = 50;
let knobVal2 = 50;
let activeKnob = null;
let knobStartY = 0;
let knobStartVal = 0;
let stage3Error = false;

let calibAngle = 0;
let targetAngle = 180;
let calibSpeed = 3;
let stage4Error = false;

let bolts = [];
let boltsDone = 0;
let stage5Error = false;

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
  showStartOverlay("READY TO ASSEMBLE", `Initiate assembly for ${currentVehicle.toUpperCase()}. Each stage has a strict 15-second timer.`);
});

function updateBudgetDisplay() {
  const display = document.getElementById('budget-display');
  if (display) display.innerText = `$${budget.toLocaleString()}`;
  localStorage.setItem('spaceforce_budget', budget);
  localStorage.setItem('spaceforce_rocket_budget', budget);
}

function updateStageUI() {
  const config = vehicleConfigs[currentVehicle];
  const stageInfo = config.stages[currentStage - 1];

  document.getElementById('assembly-title').innerText = config.title;
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
      iconDiv.className = "node-icon w-8 h-8 md:w-10 md:h-10 rounded-full bg-synthTeal text-synthDark font-orbitron font-black text-xs md:text-sm flex items-center justify-center border-2 border-synthCyan shadow-md";
      iconDiv.innerHTML = '<i class="fa-solid fa-check"></i>';
      if (label) label.className = "node-label text-[10px] md:text-xs font-bold text-synthTeal text-center hidden sm:block";
    } else if (i === currentStage) {
      iconDiv.className = "node-icon w-8 h-8 md:w-10 md:h-10 rounded-full bg-synthCyan text-synthDark font-orbitron font-black text-xs md:text-sm flex items-center justify-center border-2 border-synthCyan shadow-lg glow-cyan";
      iconDiv.innerText = i;
      if (label) label.className = "node-label text-[10px] md:text-xs font-bold text-synthCyan text-center hidden sm:block";
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
      markStageError("Timeout (exceeded 15s limit)");
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
      const y = canvas.height / 2 + Math.sin(t * Math.PI * 4) * 55;
      weldPath.push({ x, y });
    }
  } else if (stage === 3) {
    stage3Error = false;
    targetSum = Math.floor(Math.random() * 40) + 80;
    document.getElementById('valve-target-label').innerText = `TARGET VALVE SUM: ${targetSum} PSI`;
    knobVal1 = Math.floor(Math.random() * 40) + 10;
    knobVal2 = Math.floor(Math.random() * 40) + 10;
    updateTurntableKnobsUI();
  } else if (stage === 4) {
    stage4Error = false;
    calibAngle = 0;
    targetAngle = 140 + Math.random() * 80;
  } else if (stage === 5) {
    stage5Error = false;
    boltsDone = 0;
    bolts = [];
    const count = 6;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 100;
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
  ctx.strokeStyle = '#334155';
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
    ctx.strokeStyle = '#66fcf1';
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

  if (isWelding && playerWeldTrail.length > 0) {
    const lastPt = playerWeldTrail[playerWeldTrail.length - 1];
    ctx.fillStyle = '#ff007f';
    ctx.beginPath();
    ctx.arc(lastPt.x, lastPt.y, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffb703';
    for (let s = 0; s < 5; s++) {
      ctx.beginPath();
      ctx.arc(
        lastPt.x + (Math.random() - 0.5) * 25,
        lastPt.y + (Math.random() - 0.5) * 25,
        Math.random() * 3, 0, Math.PI * 2
      );
      ctx.fill();
    }
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
  ctx.strokeStyle = '#45a29e';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startRad, endRad);
  ctx.stroke();

  calibAngle = (calibAngle + calibSpeed) % 360;
  const currentRad = calibAngle * (Math.PI / 180);
  const needleX = cx + Math.cos(currentRad) * radius;
  const needleY = cy + Math.sin(currentRad) * radius;

  ctx.strokeStyle = '#ff007f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(needleX, needleY);
  ctx.stroke();

  ctx.fillStyle = '#66fcf1';
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '13px Orbitron';
  ctx.textAlign = 'center';
  ctx.fillText("CLICK ANYWHERE WHEN NEEDLE IS IN TARGET ZONE", cx, cy + 150);
}

function renderStage5() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.arc(cx, cy, 100, 0, Math.PI * 2);
  ctx.stroke();

  bolts.forEach((b, idx) => {
    ctx.fillStyle = b.torqued ? '#66fcf1' : '#ff007f';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = b.torqued ? '#0b0c10' : '#ffffff';
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

function markStageError(reason) {
  if (currentStage === 1) stage1Error = true;
  if (currentStage === 2) stage2Error = true;
  if (currentStage === 3) stage3Error = true;
  if (currentStage === 4) stage4Error = true;
  if (currentStage === 5) stage5Error = true;
}

function completeStage() {
  stopTimer();
  isStageActive = false;

  saveNotebookLog('ASSEMBLY', `${currentVehicle.toUpperCase()} - Stage ${currentStage} Submitted`, `Hardware integration step completed.`, budget);

  if (currentStage < 5) {
    currentStage++;
    updateStageUI();
    showStartOverlay("STAGE CLEARED!", `Proceed to Stage ${currentStage}.`);
  } else {
    runScreeningSimulation();
  }
}

// Comprehensive QA screening simulation with penalty deduction
function runScreeningSimulation() {
  let penalty = 0;
  let logsHtml = `<p class="text-cyan-400 font-bold">[SYS] Running automated pre-launch vehicle screening simulation...</p>`;

  if (stage1Error) {
    penalty += 50000;
    logsHtml += `<p class="text-red-400">[WIRE FAULT] Stage 1: Mismatched terminal bridge or incomplete circuit detected. (-$50,000)</p>`;
  } else {
    logsHtml += `<p class="text-emerald-400">[WIRE PASS] Stage 1: Power grid leads synchronized correctly.</p>`;
  }

  if (stage2Error) {
    penalty += 50000;
    logsHtml += `<p class="text-red-400">[WELD FAULT] Stage 2: Structural seam weld incomplete or misaligned. (-$50,000)</p>`;
  } else {
    logsHtml += `<p class="text-emerald-400">[WELD PASS] Stage 2: Dust-seal trace weld fusion optimal.</p>`;
  }

  if (stage3Error || (Number(knobVal1) + Number(knobVal2)) !== Number(targetSum)) {
    penalty += 50000;
    logsHtml += `<p class="text-red-400">[VALVE FAULT] Stage 3: Hydraulic valve pressure sum mismatch (${Number(knobVal1) + Number(knobVal2)} vs target ${targetSum}). (-$50,000)</p>`;
  } else {
    logsHtml += `<p class="text-emerald-400">[VALVE PASS] Stage 3: Hydraulic valve manifold calibrated.</p>`;
  }

  if (stage4Error) {
    penalty += 50000;
    logsHtml += `<p class="text-red-400">[OPTIC FAULT] Stage 4: Spectrometer laser optics calibrated off-spectrum. (-$50,000)</p>`;
  } else {
    logsHtml += `<p class="text-emerald-400">[OPTIC PASS] Stage 4: Spectrometer targeting locked.</p>`;
  }

  if (stage5Error || boltsDone < bolts.length) {
    penalty += 50000;
    logsHtml += `<p class="text-red-400">[TORQUE FAULT] Stage 5: Suspension bolts insufficiently torqued. (-$50,000)</p>`;
  } else {
    logsHtml += `<p class="text-emerald-400">[TORQUE PASS] Stage 5: All chassis bolts secured.</p>`;
  }

  pendingPenalty = penalty;
  budget = Math.max(0, budget - penalty);
  updateBudgetDisplay();
  localStorage.setItem('spaceforce_vehicle_assembly_report', JSON.stringify({
    vehicle: currentVehicle,
    errors: { stage1Error, stage2Error, stage3Error, stage4Error, stage5Error },
    penalty,
    passed: penalty === 0,
    recordedAt: new Date().toISOString()
  }));

  const modal = document.getElementById('screening-modal');
  const badge = document.getElementById('screening-badge');
  const logsContainer = document.getElementById('screening-logs');
  const penaltyAmount = document.getElementById('screening-penalty-amount');

  logsContainer.innerHTML = logsHtml;
  penaltyAmount.innerText = `-$${penalty.toLocaleString()}`;

  if (penalty > 0) {
    badge.innerText = "NEEDS REPAIR // QA DEFECTS";
    badge.className = "px-3 py-1 rounded-full text-[10px] font-orbitron font-bold bg-red-500/20 text-red-400 border border-red-400";
    saveNotebookLog('ASSEMBLY', `${currentVehicle.toUpperCase()} QA Screening Failed`, `Detected assembly defects. Total penalty: -$${penalty.toLocaleString()}`, budget);
  } else {
    badge.innerText = "S-CLASS PASSED";
    badge.className = "px-3 py-1 rounded-full text-[10px] font-orbitron font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-400";
    saveNotebookLog('ASSEMBLY', `${currentVehicle.toUpperCase()} QA Screening Passed`, `Pristine build verified. Zero QA penalties.`, budget);
  }

  modal.classList.remove('hidden');
}

function proceedAfterScreening() {
  document.getElementById('screening-modal').classList.add('hidden');

  if (pendingPenalty > 0) {
    // Keep restarting until budget is critically low, then force grant quiz
    if (budget < MIN_BUDGET_THRESHOLD) {
      openRecoveryTriviaModal();
    } else {
      resetWholeSuite();
    }
  } else {
    window.location.href = 'index.html?view=rocketIntro';
  }
}

// NASA Grant Recovery Quiz (3 questions, +$25k each) — only when budget is low
const triviaPool = [
  { q: "What isotope generator do Mars rovers use for 24/7 continuous electrical power during dust storms?", options: ["RTG (Radioisotope Thermoelectric Generator)", "Lithium-ion power banks", "Standard solar power only"], ans: 0 },
  { q: "What is the primary purpose of an ablative heatshield during atmospheric entry?", options: ["To generate electricity", "To carry heat away through controlled vaporization", "To bounce off the atmosphere"], ans: 1 },
  { q: "In orbital mechanics, what does firing thrusters prograde do?", options: ["Increases orbital altitude on the opposite side", "Stops the spacecraft instantly", "Pulls it straight down"], ans: 0 },
  { q: "Which engine cycle is typically more efficient (higher Isp) for methalox rockets?", options: ["Gas-generator", "Full-flow staged combustion", "Pressure-fed only"], ans: 1 },
  { q: "What does Max-Q refer to during ascent?", options: ["Maximum dynamic pressure on the vehicle", "Maximum thrust output", "Maximum fuel flow rate"], ans: 0 },
  { q: "Why do deep-space probes often use RTGs instead of solar panels?", options: ["They are cheaper to build", "Solar power becomes too weak far from the Sun", "RTGs produce no heat"], ans: 1 }
];

let recoveryQuizIndex = 0;
let recoveryQuizScore = 0;
let recoveryQuizSet = [];

function openRecoveryTriviaModal() {
  const modal = document.getElementById('recovery-modal');
  const innerBox = modal.querySelector('div > div');

  recoveryQuizSet = [...triviaPool].sort(() => Math.random() - 0.5).slice(0, 3);
  recoveryQuizIndex = 0;
  recoveryQuizScore = 0;

  innerBox.innerHTML = `
    <h3 class="text-xl font-orbitron font-black text-synthCyan mb-1">NASA GRANT RECOVERY QUIZ</h3>
    <p class="text-xs text-gray-300 mb-2">Budget is critically low (under $${MIN_BUDGET_THRESHOLD.toLocaleString()}). Answer up to 3 questions — each correct adds <strong class="text-synthGold">+$25,000</strong>.</p>
    <p class="text-[11px] text-synthPink font-bold mb-3">Current budget: $${budget.toLocaleString()} · Question <span id="quiz-progress">1</span>/3</p>
    <div class="bg-synthDark p-4 rounded-xl border border-synthTeal/30 flex flex-col gap-3 text-left mb-4">
      <p id="trivia-question" class="text-xs text-white font-bold"></p>
      <div id="trivia-options" class="flex flex-col gap-2"></div>
    </div>
    <div class="flex justify-between items-center">
      <span id="quiz-earned" class="text-[11px] text-synthGold font-bold">Earned so far: $0</span>
      <button onclick="closeRecoveryModal()" class="text-gray-400 hover:text-white text-xs font-orbitron font-bold cursor-pointer">SKIP & RESTART</button>
    </div>
  `;

  showNextRecoveryQuestion();
  modal.classList.remove('hidden');
}

function showNextRecoveryQuestion() {
  if (recoveryQuizIndex >= recoveryQuizSet.length) {
    const earned = recoveryQuizScore * 25000;
    alert(`Quiz complete! Recovered $${earned.toLocaleString()}.\\nNew budget: $${budget.toLocaleString()}.\\nRestarting assembly — if still short, redesign with cheaper parts.`);
    closeRecoveryModal();
    return;
  }

  const item = recoveryQuizSet[recoveryQuizIndex];
  const prog = document.getElementById('quiz-progress');
  if (prog) prog.innerText = recoveryQuizIndex + 1;
  document.getElementById('trivia-question').innerText = item.q;
  const earnedEl = document.getElementById('quiz-earned');
  if (earnedEl) earnedEl.innerText = `Earned so far: $${(recoveryQuizScore * 25000).toLocaleString()}`;

  const optContainer = document.getElementById('trivia-options');
  optContainer.innerHTML = '';

  item.options.forEach((optText, idx) => {
    const btn = document.createElement('button');
    btn.className = "p-2.5 rounded-lg bg-synthDark border border-synthTeal text-xs text-left text-gray-200 hover:bg-synthTeal/20 hover:border-synthCyan transition-all cursor-pointer";
    btn.innerText = `${String.fromCharCode(65 + idx)}. ${optText}`;
    btn.onclick = () => {
      Array.from(optContainer.children).forEach(b => b.onclick = null);
      if (idx === item.ans) {
        recoveryQuizScore++;
        budget += 25000;
        updateBudgetDisplay();
        btn.className = "p-2.5 rounded-lg bg-emerald-900/60 border border-emerald-400 text-xs text-left text-emerald-200 font-bold";
        if (earnedEl) earnedEl.innerText = `Earned so far: $${(recoveryQuizScore * 25000).toLocaleString()}`;
      } else {
        btn.className = "p-2.5 rounded-lg bg-red-900/60 border border-red-400 text-xs text-left text-red-200 font-bold";
      }
      setTimeout(() => {
        recoveryQuizIndex++;
        showNextRecoveryQuestion();
      }, 700);
    };
    optContainer.appendChild(btn);
  });
}

function closeRecoveryModal() {
  document.getElementById('recovery-modal').classList.add('hidden');
  resetWholeSuite();
}

function resetWholeSuite() {
  document.getElementById('screening-modal').classList.add('hidden');
  currentStage = 1;
  stage1Error = false;
  stage2Error = false;
  stage3Error = false;
  stage4Error = false;
  stage5Error = false;
  pendingPenalty = 0;
  updateStageUI();
  showStartOverlay("ASSEMBLY RESET // STAGE 1", "QA defects detected. Fix your build to clear screening.");
}

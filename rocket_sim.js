// ==========================================
// SPACE FORCE 1.0 - FINAL STABLE ROCKET SIMULATOR
// ==========================================

const canvas = document.getElementById('sim-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;

let timeWarp = 1;
let isSimulating = false;
let simPhase = 'PAD_READY'; 
let countdown = 3;
let countdownTimer = null;

let timeStep = 0;
let altitude = 0;
let velocity = 0;
let velX = 0;
let velY = 0;
let acceleration = 0;
let pitchAngle = 90;
let dynamicPressure = 0;
let fuelS1 = 100;
let fuelS2 = 100;
let stageSeparated = false;
let activeThrustRatio = 0;

let cruiseDistanceKm = 0;
let cruiseDaysElapsed = 0;
let cruiseTotalDays = 168;
let cruiseVInf = 0;
let cruiseC3 = 0;
let cruiseProgress = 0;

let activeDesign = { engine: 'kerolox', fuel: 'rp1', body: 'allithium', fairing: 'composite', guidance: 'inertial' };
let activeVehicleType = 'rover';
let activeVehicleDesign = {};
let activePlanet = 'mars';
let payloadKg = 1850;
let rocketDryMass = 41200;
let rocketThrust = 7600000;
let rocketIsp = 310;
let maxPropellant = 400000;

let maxAlt = 0;
let maxVel = 0;
let maxQ = 0;

let stars = [];
let particles = [];
let logMessages = [];
let cameraShake = 0;

// Comprehensive Vehicle Parts Mass Database matching script.js
const vehiclePartsMasses = {
  rover: {
    base: 1000,
    chassis: { titanium: 1200, carbon: 650 },
    wheels: { rock_mesh: 250, solid_ti: 400 },
    power: { rtg: 150, solar: 80 },
    tools: { drill_spec: 350, camera_arm: 150, none: 0 }
  },
  satellite: {
    base: 800,
    wings: { dual_wing: 300, compact_cell: 120 },
    antenna: { high_gain: 300, omni_array: 100 },
    thrusters: { cold_gas: 180, react_wheels: 220, none: 40 }
  },
  probe: {
    base: 900,
    shield: { ablative: 800, ceramic: 500, none: 0 },
    engine: { ion_plasma: 350, chem_hyper: 450 },
    sensors: { mag_radar: 250, spectro_cam: 120 }
  }
};

const solarSystemTargets = {
  moon: {
    name: "LUNAR TRANSFER ORBIT (TLI)",
    blurb: "Escape low-Earth parking orbit on a translunar trajectory toward the Moon.",
    distanceKm: 384400,
    targetAlt: 200000,
    targetSpeed: 10850,
    needDv: 12500,
    transferDays: 3.5,
    phaseAngleDeg: 42.0,
    planetColor: '#cbd5e1',
    planetRadius: 12
  },
  mars: {
    name: "MARS TRANSFER ORBIT (TMI)",
    blurb: "Escape Earth's gravity well on a Hohmann transfer ellipse toward Mars.",
    distanceKm: 225000000,
    targetAlt: 400000,
    targetSpeed: 11200,
    needDv: 12800,
    transferDays: 259,
    phaseAngleDeg: 44.3,
    planetColor: '#ff5400',
    planetRadius: 16
  },
  titan: {
    name: "TITAN / SATURN TRANSFER",
    blurb: "Execute high-energy deep-space injection toward Saturn's moon Titan.",
    distanceKm: 1427000000,
    targetAlt: 400000,
    targetSpeed: 14600,
    needDv: 16500,
    transferDays: 2220,
    phaseAngleDeg: 76.8,
    planetColor: '#ffb703',
    planetRadius: 20
  }
};

let currentMission = solarSystemTargets.mars;

window.addEventListener('DOMContentLoaded', () => {
  loadSavedDesign();
  resizeCanvas();
  generateStars();
  updatePlanner();
  resetSimState();
  requestAnimationFrame(simLoop);
});

window.addEventListener('resize', () => {
  resizeCanvas();
  generateStars();
});

function resizeCanvas() {
  if (!canvas || !canvas.parentElement) return;
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
}

function loadSavedDesign() {
  try {
    const savedRocket = localStorage.getItem('spaceforce_rocket_design');
    if (savedRocket) activeDesign = JSON.parse(savedRocket);
  } catch (e) {}

  const urlParams = new URLSearchParams(window.location.search);

  // Mission data is the source of truth for planet + intended vehicle class
  let assignedMission = null;
  try {
    const savedMission = localStorage.getItem('spaceforce_mission_data');
    if (savedMission) assignedMission = JSON.parse(savedMission);
  } catch (e) {}
  const savedVehicleType = localStorage.getItem('spaceforce_vehicle');

  // The assigned mission controls vehicle class; saved/URL values can be stale after a redesign.
  activeVehicleType = (
    (assignedMission && assignedMission.vehicle) ||
    urlParams.get('vehicle') ||
    localStorage.getItem('spaceforce_vehicle') ||
    'rover'
  ).toLowerCase();
  localStorage.setItem('spaceforce_vehicle', activeVehicleType);

  // Planet: prefer mission assignment, then stored planet, then URL
  activePlanet = (
    (assignedMission && assignedMission.planet) ||
    urlParams.get('planet') ||
    localStorage.getItem('spaceforce_planet') ||
    'mars'
  ).toLowerCase();

  // Normalize aliases
  if (activePlanet === 'luna' || activePlanet === 'lunar') activePlanet = 'moon';

  const baseTarget = solarSystemTargets[activePlanet] || solarSystemTargets.mars;
  currentMission = {
    ...baseTarget,
    name: assignedMission ? (assignedMission.title || baseTarget.name) : baseTarget.name,
    blurb: assignedMission ? (assignedMission.desc || baseTarget.blurb) : baseTarget.blurb,
    code: assignedMission ? (assignedMission.code || (activePlanet.toUpperCase() + '-MISSION')) : (activePlanet.toUpperCase() + '-MISSION'),
    // Physics always come from the destination table so Moon missions don't inherit Mars numbers
    needDv: baseTarget.needDv,
    targetSpeed: baseTarget.targetSpeed,
    targetAlt: baseTarget.targetAlt,
    transferDays: baseTarget.transferDays,
    distanceKm: baseTarget.distanceKm
  };

  if (document.getElementById('mission-name')) document.getElementById('mission-name').innerText = currentMission.name;
  if (document.getElementById('mission-blurb')) document.getElementById('mission-blurb').innerText = currentMission.blurb;
  if (document.getElementById('req-speed')) document.getElementById('req-speed').innerText = `${currentMission.targetSpeed.toLocaleString()} m/s`;
  if (document.getElementById('req-alt')) document.getElementById('req-alt').innerText = `${(currentMission.targetAlt / 1000).toFixed(1)} km`;

  let vehicleDesign = {};
  try {
    const savedVehicleDesign = localStorage.getItem('spaceforce_vehicle_design');
    if (savedVehicleDesign) vehicleDesign = JSON.parse(savedVehicleDesign);
  } catch (e) {}
  const activePartsDb = vehiclePartsMasses[activeVehicleType];
  if (activePartsDb && Object.keys(vehicleDesign).some(cat => !activePartsDb[cat])) vehicleDesign = {};
  const designMatchesVehicle = Boolean(activePartsDb && Object.keys(vehicleDesign).length > 0);
  activeVehicleDesign = vehicleDesign;

  // Payload mass from the actual designed vehicle (saved at design lock), with live recalc fallback
  let calculatedPayload = 1850;
  const partsDb = vehiclePartsMasses[activeVehicleType];
  if (partsDb) {
    calculatedPayload = partsDb.base;
    for (const [cat, partId] of Object.entries(vehicleDesign)) {
      if (partsDb[cat] && partsDb[cat][partId] !== undefined) {
        calculatedPayload += partsDb[cat][partId];
      }
    }
  } else {
    const vehicleWeights = { rover: 1850, satellite: 1200, probe: 1500 };
    calculatedPayload = vehicleWeights[activeVehicleType] || 1850;
  }

  const explicitPayloadVehicle = localStorage.getItem('spaceforce_payload_vehicle');
  const savedPayloadVehicle = explicitPayloadVehicle || (designMatchesVehicle ? savedVehicleType : null);
  const savedPayloadKg = savedPayloadVehicle === activeVehicleType ? localStorage.getItem('spaceforce_payload_mass') : null;
  payloadKg = savedPayloadKg ? parseInt(savedPayloadKg, 10) : calculatedPayload;
  if (!Number.isFinite(payloadKg) || payloadKg <= 0) payloadKg = calculatedPayload;
  localStorage.setItem('spaceforce_payload_mass', String(payloadKg));
  localStorage.setItem('spaceforce_payload_vehicle', activeVehicleType);

  const specs = {
    engine: {
      kerolox: { name: "Kerolox Gas-Generator", mass: 2200, thrust: 7600000, isp: 310 },
      methalox: { name: "Methalox Full-Flow", mass: 2600, thrust: 9800000, isp: 365 }
    },
    fuel: {
      rp1: { name: "RP-1 Kerosene Tanks", mass: 25000, propellant: 400000 },
      lh2: { name: "Liquid Hydrogen Tanks", mass: 18000, propellant: 380000 }
    },
    body: {
      allithium: { name: "Aluminum-Lithium Hull", mass: 12000 },
      steel: { name: "Stainless Steel Hull", mass: 16000 }
    },
    fairing: {
      composite: { name: "Composite Fairing", mass: 1800 },
      aluminum: { name: "Aluminum Shell", mass: 2500 }
    },
    guidance: {
      inertial: { name: "Inertial + GPS", mass: 200 },
      startracker: { name: "Star Tracker + Gyro", mass: 350 }
    }
  };

  const eng = specs.engine[activeDesign.engine] || specs.engine.kerolox;
  const ful = specs.fuel[activeDesign.fuel] || specs.fuel.rp1;
  const bod = specs.body[activeDesign.body] || specs.body.allithium;
  const fai = specs.fairing[activeDesign.fairing] || specs.fairing.composite;
  const gui = specs.guidance[activeDesign.guidance] || specs.guidance.inertial;

  rocketDryMass = eng.mass + ful.mass + bod.mass + fai.mass + gui.mass;
  rocketThrust = eng.thrust;
  const upgradeEngine = localStorage.getItem('spaceforce_engine_upgrade_engine');
  const rawUpgradeLevel = Number.parseInt(localStorage.getItem('spaceforce_engine_upgrade_level') || '0', 10);
  const upgradeLevel = upgradeEngine === activeDesign.engine && Number.isFinite(rawUpgradeLevel)
    ? Math.max(0, Math.min(10, rawUpgradeLevel))
    : 0;
  rocketIsp = eng.isp * (1 + upgradeLevel * 0.08);
  maxPropellant = ful.propellant;

  if (document.getElementById('rk-engine')) document.getElementById('rk-engine').innerText = upgradeLevel
    ? `${eng.name} (UPGRADED LVL ${upgradeLevel})`
    : eng.name;
  if (document.getElementById('rk-tanks')) document.getElementById('rk-tanks').innerText = ful.name;
  if (document.getElementById('rk-body')) document.getElementById('rk-body').innerText = bod.name;
  if (document.getElementById('mission-payload')) {
    document.getElementById('mission-payload').innerText = `${payloadKg.toLocaleString()} kg (${activeVehicleType.toUpperCase()})`;
  }
}

function generateStars() {
  stars = [];
  if (!canvas) return;
  for (let i = 0; i < 180; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.8 + 0.2,
      speed: Math.random() * 0.5 + 0.5
    });
  }
}

function goRedesign() {
  window.location.href = 'index.html?view=rocketIntro';
}

function getCurrentTWR() {
  const totalMass = rocketDryMass + payloadKg + maxPropellant;
  return rocketThrust / (totalMass * 9.81);
}

function computeInterplanetaryTrajectory(currentVel, currentAlt) {
  const muEarth = 3.986e14;
  const rEarth = 6371000;
  const rOrbit = rEarth + currentAlt;

  const vEscape = Math.sqrt((2 * muEarth) / rOrbit);
  const vInf = currentVel > vEscape ? Math.sqrt(currentVel * currentVel - vEscape * vEscape) : 0;
  const c3 = Math.pow(vInf / 1000, 2);

  const nominalVInf = activePlanet === 'titan' ? 10200 : (activePlanet === 'moon' ? 1400 : 2945);
  const speedFactor = vInf > 500 ? Math.max(0.65, Math.min(1.5, nominalVInf / vInf)) : 1.0;
  const estDays = currentMission.transferDays * speedFactor;

  return {
    vEscape: Math.round(vEscape),
    vInf: Math.round(vInf),
    c3: c3.toFixed(2),
    estDays: estDays < 10 ? parseFloat(estDays.toFixed(1)) : Math.round(estDays),
    targetDistKm: currentMission.distanceKm
  };
}

function updatePlanner() {
  const turnSlider = document.getElementById('slider-turn');
  const turnRate = turnSlider ? parseFloat(turnSlider.value) : 0.60;

  if (document.getElementById('val-turn')) {
    document.getElementById('val-turn').innerText = `${turnRate.toFixed(2)}°/s`;
  }

  const rocketOnly = rocketDryMass + maxPropellant;
  const totalMass = rocketOnly + payloadKg;
  const twr = getCurrentTWR();

  document.getElementById('rocket-only-mass').innerText = `${Math.round(rocketOnly).toLocaleString()} kg`;
  document.getElementById('spec-mass').innerText = `${Math.round(totalMass).toLocaleString()} kg`;
  document.getElementById('spec-thrust').innerText = `${Math.round(rocketThrust / 1000).toLocaleString()} kN`;
  document.getElementById('spec-twr').innerText = twr.toFixed(2);

  const g0 = 9.81;
  const s1Dry = rocketDryMass * 0.65;
  const s2Dry = (rocketDryMass * 0.35) + payloadKg;
  const s1Prop = maxPropellant * 0.75;
  const s2Prop = maxPropellant * 0.25;

  const m0_s1 = s1Dry + s1Prop + s2Dry + s2Prop;
  const mf_s1 = s1Dry + s2Dry + s2Prop;
  const dv1 = rocketIsp * g0 * Math.log(m0_s1 / mf_s1);

  const m0_s2 = s2Dry + s2Prop;
  const mf_s2 = s2Dry;
  const dv2 = (rocketIsp * 1.15) * g0 * Math.log(m0_s2 / mf_s2);

  const availDv = Math.round(dv1 + dv2);

  document.getElementById('dv-avail').innerText = `${availDv.toLocaleString()} m/s`;
  document.getElementById('dv-need').innerText = `${currentMission.needDv.toLocaleString()} m/s`;
  const needLbl = document.getElementById('dv-need-label');
  if (needLbl) needLbl.innerText = `${activePlanet.toUpperCase()} mission needs`;
  const needLabel = document.querySelector('#dv-need')?.previousElementSibling;
  // keep label generic via HTML; numbers already destination-correct

  const availBar = Math.min(100, (availDv / currentMission.needDv) * 100);
  document.getElementById('dv-bar-avail').style.width = `${availBar}%`;

  const verdict = document.getElementById('dv-verdict');
  if (availDv >= currentMission.needDv) {
    verdict.innerText = "✓ SUFFICIENT DELTA-V";
    verdict.className = "text-[10px] font-orbitron font-bold text-synthCyan";
  } else {
    verdict.innerText = "⚠ DELTA-V DEFICIT";
    verdict.className = "text-[10px] font-orbitron font-bold text-synthPink";
  }
}

function autoTune() {
  const twr = getCurrentTWR();
  let optimalPitchRate = 0.40 + (twr - 1.5) * 0.30;
  optimalPitchRate = Math.max(0.30, Math.min(1.00, optimalPitchRate));

  const slider = document.getElementById('slider-turn');
  if (slider) slider.value = optimalPitchRate.toFixed(2);
  
  const chkBucket = document.getElementById('chk-bucket');
  if (chkBucket) chkBucket.checked = (twr > 1.7);

  updatePlanner();

  const res = document.getElementById('autotune-result');
  res.classList.remove('hidden');
  res.innerHTML = `
    <div class="text-synthCyan font-bold mb-0.5"><i class="fa-solid fa-check-circle"></i> TRAJECTORY SOLVED</div>
    <div>• Phase Angle: <span class="text-synthGold font-bold">${currentMission.phaseAngleDeg}°</span> | Pitch: <span class="text-synthPink font-bold">${optimalPitchRate.toFixed(2)}°/s</span></div>
    <div>• Target Dist: <span class="text-white">${formatDistanceKm(currentMission.distanceKm)}</span></div>
  `;
  addLog(`AI Trajectory Solver locked ${activePlanet.toUpperCase()} target window.`);
}

function formatDistanceKm(km) {
  if (km >= 1e9) return `${(km / 1e9).toFixed(2)} Billion km`;
  if (km >= 1e6) return `${(km / 1e6).toFixed(2)} Million km`;
  return `${Math.round(km).toLocaleString()} km`;
}

function setTimeWarp(w) {
  timeWarp = w;
  ['1x', '5x', '20x'].forEach(val => {
    const btn = document.getElementById(`warp-${val}`);
    if (btn) {
      btn.className = (val === `${w}x`) 
        ? 'py-1.5 bg-synthPink text-synthDark rounded-lg font-orbitron font-extrabold text-xs cursor-pointer' 
        : 'py-1.5 bg-synthDark border border-synthPink/40 text-gray-300 rounded-lg font-orbitron font-extrabold text-xs cursor-pointer';
    }
  });
}

function resetSimState() {
  isSimulating = false;
  simPhase = 'PAD_READY';
  countdown = 3;
  if (countdownTimer) clearInterval(countdownTimer);

  timeStep = 0;
  altitude = 0;
  velocity = 0;
  velX = 0;
  velY = 0;
  acceleration = 0;
  pitchAngle = 90;
  dynamicPressure = 0;
  fuelS1 = 100;
  fuelS2 = 100;
  stageSeparated = false;
  activeThrustRatio = 0;
  cameraShake = 0;

  cruiseDistanceKm = 0;
  cruiseDaysElapsed = 0;
  cruiseTotalDays = currentMission.transferDays;
  cruiseVInf = 0;
  cruiseC3 = 0;
  cruiseProgress = 0;

  maxAlt = 0;
  maxVel = 0;
  maxQ = 0;
  particles = [];
  logMessages = [];

  document.getElementById('sim-status-badge').innerText = 'PAD READY';
  document.getElementById('sim-status-badge').className = 'text-[10px] font-orbitron font-bold bg-synthDark text-synthCyan border border-synthCyan/40 px-2.5 py-0.5 rounded-full';
  document.getElementById('tele-phase').innerText = 'PRE-LAUNCH';
  document.getElementById('stat-outcome').innerText = 'READY';
  document.getElementById('stat-outcome').className = 'font-orbitron font-extrabold text-xs text-synthCyan mt-1';
  document.getElementById('separation-alert').classList.add('hidden');
  document.getElementById('result-overlay').classList.add('hidden');
  updateTelemetryUI();
}

function launchSimulation() {
  if (isSimulating && simPhase !== 'PAD_READY') return;

  const availDvText = document.getElementById('dv-avail') ? document.getElementById('dv-avail').innerText : "0";
  const availDv = parseInt(availDvText.replace(/[^0-9]/g, '')) || 0;
  const needDv = currentMission.needDv;

  if (availDv < needDv) {
    alert(`⚠ LAUNCH BLOCKED: DELTA-V DEFICIT!\n\nYour rocket delivers ${availDv.toLocaleString()} m/s, but the mission requires ${needDv.toLocaleString()} m/s. Upgrade your components in the workbench!`);
    return;
  }

  resetSimState();
  simPhase = 'COUNTDOWN';
  document.getElementById('sim-status-badge').innerText = 'COUNTDOWN';
  document.getElementById('sim-status-badge').className = 'text-[10px] font-orbitron font-bold bg-synthDark text-synthPink border border-synthPink px-2.5 py-0.5 rounded-full animate-pulse';
  addLog("T-Minus 3s. Flight guidance locked.");

  countdownTimer = setInterval(() => {
    countdown--;
    if (countdown === 1) spawnIgnitionSmoke();
    if (countdown <= 0) {
      clearInterval(countdownTimer);
      simPhase = 'ASCENT';
      isSimulating = true;
      document.getElementById('sim-status-badge').innerText = 'LIFT-OFF';
      document.getElementById('sim-status-badge').className = 'text-[10px] font-orbitron font-bold bg-synthPink text-white px-2.5 py-0.5 rounded-full';
      document.getElementById('tele-phase').innerText = 'STAGE 1 ASCENT';
      addLog("LIFT-OFF! Climbing to parking orbit.");
    }
  }, 1000);
}

function abortSimulation() {
  resetSimState();
  addLog("Simulation aborted. Reset to launchpad.");
}

function addLog(msg) {
  logMessages.push(msg);
  if (logMessages.length > 5) logMessages.shift();
  const logDiv = document.getElementById('event-log');
  if (logDiv) {
    logDiv.innerHTML = logMessages.map(m => `<div>> ${m}</div>`).join('');
  }
}

function simLoop() {
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isSimulating && simPhase !== 'PAD_READY' && simPhase !== 'MISSION_COMPLETE') {
      if (simPhase === 'INTERPLANETARY_CRUISE') {
        updateInterplanetaryCruise();
      } else {
        updatePhysics();
      }
    }

    ctx.save();
    if (cameraShake > 0.1 && simPhase !== 'INTERPLANETARY_CRUISE') {
      const sx = (Math.random() - 0.5) * cameraShake;
      const sy = (Math.random() - 0.5) * cameraShake;
      ctx.translate(sx, sy);
    }

    if (simPhase === 'INTERPLANETARY_CRUISE') {
      renderInterplanetaryCruiseView();
    } else {
      renderSkyAndSpace();
      renderParticles();
      renderPadAndRocket();
      renderTrajectoryHUD();
    }

    ctx.restore();
  }
  requestAnimationFrame(simLoop);
}

function updatePhysics() {
  const dt = 0.5 * timeWarp; 
  const g0 = 9.81;

  const propS1Max = maxPropellant * 0.75;
  const propS2Max = maxPropellant * 0.25;

  let activeThrust = 0;
  activeThrustRatio = 0;

  const mDot = rocketThrust / (rocketIsp * g0);

  if (simPhase === 'ASCENT' && fuelS1 > 0) {
    const fuelBurnedThisStep = (mDot * dt) * 0.75;
    fuelS1 -= (fuelBurnedThisStep / propS1Max) * 100;
    activeThrust = rocketThrust;
    activeThrustRatio = 1.0;

    const chkBucket = document.getElementById('chk-bucket');
    if (chkBucket && chkBucket.checked && dynamicPressure > 35) {
      activeThrust *= 0.70;
      activeThrustRatio = 0.70;
    }

    if (fuelS1 <= 15 && !stageSeparated) {
      document.getElementById('separation-alert').classList.remove('hidden');
    }

    if (fuelS1 <= 0) {
      fuelS1 = 0;
      if (!stageSeparated) triggerStageSeparation();
    }
  } else if (simPhase === 'STAGE2_BURN' && fuelS2 > 0) {
    const fuelBurnedThisStep = (mDot * dt) * 0.25;
    fuelS2 -= (fuelBurnedThisStep / propS2Max) * 100;
    activeThrust = rocketThrust * 0.68;
    activeThrustRatio = 0.85;
    if (fuelS2 <= 0) {
      fuelS2 = 0;
      activeThrustRatio = 0;
      addLog("SECO: Stage 2 injection burn complete.");
    }
  }

  const currentRocketDry = stageSeparated ? (rocketDryMass * 0.35) : rocketDryMass;
  const currentPropMass = (propS1Max * (Math.max(0, fuelS1) / 100)) + (propS2Max * (Math.max(0, fuelS2) / 100));
  const currentMass = currentRocketDry + payloadKg + currentPropMass;

  const earthRadius = 6371000;
  const localGravity = g0 * Math.pow(earthRadius / (earthRadius + altitude), 2);
  const airDensity = altitude > 100000 ? 0 : 1.225 * Math.exp(-altitude / 8500);

  const turnRate = document.getElementById('slider-turn') ? parseFloat(document.getElementById('slider-turn').value) : 0.60;
  if (altitude > 1500 && pitchAngle > 5) {
    const targetPitch = Math.max(5, 90 - Math.pow(altitude / 140000, 0.75) * 85);
    pitchAngle = Math.max(targetPitch, pitchAngle - turnRate * dt * 0.15);
  }

  const pitchRad = pitchAngle * (Math.PI / 180);
  const currentVel = Math.hypot(velX, velY);
  
  dynamicPressure = 0.5 * airDensity * currentVel * currentVel * 0.001;

  const dragCoef = 0.40;
  const crossArea = 3.14 * 1.5 * 1.5;
  const dragForce = 0.5 * airDensity * currentVel * currentVel * dragCoef * crossArea;
  const dragX = currentVel > 0 ? (velX / currentVel) * dragForce : 0;
  const dragY = currentVel > 0 ? (velY / currentVel) * dragForce : 0;

  const thrustX = activeThrust * Math.cos(pitchRad);
  const thrustY = activeThrust * Math.sin(pitchRad);

  const ax = (thrustX - dragX) / currentMass;
  const ay = (thrustY - dragY) / currentMass - localGravity;

  velX += ax * dt;
  velY += ay * dt;
  altitude += velY * dt;

  if (activeThrustRatio > 0 && altitude < 40000) {
    cameraShake = activeThrustRatio * 3.5 * Math.max(0.2, 1 - altitude / 40000);
  } else {
    cameraShake = 0;
  }

  if (activeThrustRatio > 0) {
    spawnExhaustParticles(activeThrustRatio);
  }

  if (altitude <= 0) {
    altitude = 0;
    if (velY < -15 && timeStep > 3) {
      triggerOutcome('CRASHED', 'CRASH LANDED', 'Vehicle impacted terrain due to insufficient vertical thrust.', 'synthRed');
      return;
    }
    if (velY < 0) velY = 0;
  }

  velocity = Math.hypot(velX, velY);
  acceleration = Math.hypot(ax, ay + localGravity);

  maxAlt = Math.max(maxAlt, altitude);
  maxVel = Math.max(maxVel, velocity);
  maxQ = Math.max(maxQ, dynamicPressure);

  if (altitude >= currentMission.targetAlt && velocity >= currentMission.targetSpeed) {
    startInterplanetaryCruise();
    return;
  }

  if (fuelS1 <= 0 && fuelS2 <= 0 && velocity < currentMission.targetSpeed && velY <= 0 && altitude < 50000) {
    triggerOutcome('FAILED', 'INSUFFICIENT ESCAPE VELOCITY', `Propellant exhausted before reaching ${currentMission.targetSpeed.toLocaleString()} m/s injection speed.`, 'synthPink');
    return;
  }

  timeStep += dt;
  updateTelemetryUI();
}

function startInterplanetaryCruise() {
  simPhase = 'INTERPLANETARY_CRUISE';
  activeThrustRatio = 0;
  cameraShake = 0;
  particles = [];

  const traj = computeInterplanetaryTrajectory(velocity, altitude);
  cruiseTotalDays = traj.estDays;
  cruiseVInf = traj.vInf;
  cruiseC3 = traj.c3;
  cruiseDistanceKm = altitude / 1000;
  cruiseDaysElapsed = 0;
  cruiseProgress = 0;

  document.getElementById('sim-status-badge').innerText = 'DEEP SPACE CRUISE';
  document.getElementById('sim-status-badge').className = 'text-[10px] font-orbitron font-bold bg-synthCyan text-synthDark px-2.5 py-0.5 rounded-full animate-pulse';
  document.getElementById('tele-phase').innerText = `${activePlanet.toUpperCase()} TRANSFER CRUISE`;
  addLog(`Injection confirmed! Cruising ${formatDistanceKm(currentMission.distanceKm)} to ${activePlanet.toUpperCase()}...`);
}

let passedTwoMillionKm = false;

function updateInterplanetaryCruise() {
  const stepProgress = 0.0022 * Math.max(1, timeWarp * 0.6);
  cruiseProgress = Math.min(1, cruiseProgress + stepProgress);

  cruiseDistanceKm = cruiseProgress * currentMission.distanceKm;
  cruiseDaysElapsed = cruiseProgress * cruiseTotalDays;
  altitude = cruiseDistanceKm * 1000;
  acceleration = 0;

  if (!passedTwoMillionKm && cruiseDistanceKm >= 2000000) {
    passedTwoMillionKm = true;
    addLog(`Milestone: 2.00 Million km cleared! Telemetry nominal.`);
  }

  document.getElementById('tele-alt').innerText = formatDistanceKm(cruiseDistanceKm);
  document.getElementById('tele-vel').innerText = `${cruiseVInf.toLocaleString()} m/s (v∞)`;
  document.getElementById('tele-acc').innerText = `0.0 G (COAST)`;
  document.getElementById('tele-pitch').innerText = `DAY ${cruiseDaysElapsed < 10 ? cruiseDaysElapsed.toFixed(1) : Math.round(cruiseDaysElapsed)}`;
  document.getElementById('tele-q').innerText = `0.0 kPa (VACUUM)`;

  if (cruiseProgress >= 1) {
    const traj = {
      vInf: cruiseVInf,
      c3: cruiseC3,
      estDays: cruiseTotalDays,
      targetDistKm: currentMission.distanceKm
    };
    triggerOutcome(
      'SUCCESS',
      `${activePlanet.toUpperCase()} ARRIVAL ACHIEVED! 🚀`,
      `Completed ${formatDistanceKm(currentMission.distanceKm)} interplanetary transfer in ${cruiseTotalDays} days!`,
      'synthCyan',
      traj
    );
  }
}

function renderInterplanetaryCruiseView() {
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = '#030408';
  ctx.fillRect(0, 0, w, h);

  stars.forEach(s => {
    ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  });

  const earthX = w * 0.16;
  const earthY = h * 0.62;
  const targetX = w * 0.84;
  const targetY = h * 0.34;
  const ctrlX = w * 0.48;
  const ctrlY = h * 0.14;

  ctx.save();
  ctx.strokeStyle = 'rgba(102, 252, 241, 0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(earthX, earthY);
  ctx.quadraticCurveTo(ctrlX, ctrlY, targetX, targetY);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#ff007f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let t = 0; t <= cruiseProgress; t += 0.01) {
    const px = (1 - t) * (1 - t) * earthX + 2 * (1 - t) * t * ctrlX + t * t * targetX;
    const py = (1 - t) * (1 - t) * earthY + 2 * (1 - t) * t * ctrlY + t * t * targetY;
    if (t === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();

  if (currentMission.distanceKm > 2000000) {
    const t2M = Math.max(0.06, 2000000 / currentMission.distanceKm);
    const m2X = (1 - t2M) * (1 - t2M) * earthX + 2 * (1 - t2M) * t2M * ctrlX + t2M * t2M * targetX;
    const m2Y = (1 - t2M) * (1 - t2M) * earthY + 2 * (1 - t2M) * t2M * ctrlY + t2M * t2M * targetY;

    ctx.fillStyle = cruiseDistanceKm >= 2000000 ? '#4ade80' : '#ffb703';
    ctx.beginPath();
    ctx.arc(m2X, m2Y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('2.0M km', m2X, m2Y + 16);
  }

  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(earthX, earthY, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#66fcf1';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EARTH', earthX, earthY + 34);

  ctx.fillStyle = currentMission.planetColor;
  ctx.beginPath();
  ctx.arc(targetX, targetY, currentMission.planetRadius, 0, Math.PI * 2);
  ctx.fill();
  if (activePlanet === 'titan') {
    ctx.strokeStyle = 'rgba(255, 183, 3, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(targetX, targetY, 32, 8, -0.3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Orbitron, sans-serif';
  ctx.fillText(activePlanet.toUpperCase(), targetX, targetY + currentMission.planetRadius + 18);

  const t = cruiseProgress;
  const shipX = (1 - t) * (1 - t) * earthX + 2 * (1 - t) * t * ctrlX + t * t * targetX;
  const shipY = (1 - t) * (1 - t) * earthY + 2 * (1 - t) * t * ctrlY + t * t * targetY;

  ctx.save();
  ctx.translate(shipX, shipY);
  ctx.fillStyle = '#66fcf1';
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const boxW = Math.min(440, w - 32);
  const boxX = (w - boxW) / 2;
  const boxY = h - 78;

  ctx.fillStyle = 'rgba(11, 12, 16, 0.9)';
  ctx.strokeStyle = '#66fcf1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, 62, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#66fcf1';
  ctx.font = 'bold 11px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`INTERPLANETARY CRUISE: ${formatDistanceKm(cruiseDistanceKm)} / ${formatDistanceKm(currentMission.distanceKm)}`, w / 2, boxY + 22);

  ctx.fillStyle = '#ffb703';
  ctx.font = '11px monospace';
  const dayStr = cruiseDaysElapsed < 10 ? cruiseDaysElapsed.toFixed(1) : Math.round(cruiseDaysElapsed);
  ctx.fillText(`Mission Day: ${dayStr} / ${cruiseTotalDays} Days  |  v∞: ${cruiseVInf.toLocaleString()} m/s`, w / 2, boxY + 44);
}

function triggerStageSeparation() {
  if (stageSeparated) return;
  stageSeparated = true;
  simPhase = 'STAGE2_BURN';
  document.getElementById('separation-alert').classList.add('hidden');
  document.getElementById('tele-phase').innerText = 'STAGE 2 INJECTION BURN';
  addLog("Stage 1 jettisoned. Stage 2 vacuum engine ignited.");

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  for (let i = 0; i < 24; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 1;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed + 2,
      size: Math.random() * 3 + 2,
      color: '#66fcf1',
      life: 1.0,
      decay: 0.03
    });
  }
}

function updateTelemetryUI() {
  document.getElementById('tele-alt').innerText = `${(altitude / 1000).toFixed(1)} km`;
  document.getElementById('tele-vel').innerText = `${Math.round(velocity).toLocaleString()} m/s`;
  document.getElementById('tele-acc').innerText = `${(acceleration / 9.81).toFixed(1)} G`;
  document.getElementById('tele-pitch').innerText = `${pitchAngle.toFixed(1)}°`;
  document.getElementById('tele-q').innerText = `${dynamicPressure.toFixed(1)} kPa`;

  document.getElementById('tele-s1').innerText = `${Math.max(0, Math.round(fuelS1))}%`;
  document.getElementById('tele-s2').innerText = `${Math.max(0, Math.round(fuelS2))}%`;
  document.getElementById('bar-s1').style.width = `${Math.max(0, fuelS1)}%`;
  document.getElementById('bar-s2').style.width = `${Math.max(0, fuelS2)}%`;

  document.getElementById('stat-max-alt').innerText = `${(maxAlt / 1000).toFixed(1)} km`;
  document.getElementById('stat-max-vel').innerText = `${Math.round(maxVel).toLocaleString()} m/s`;
  document.getElementById('stat-max-q').innerText = `${maxQ.toFixed(1)} kPa`;
}

function triggerOutcome(status, title, detail, colorClass, traj = null) {
  let finalStatus = status;
  let finalTitle = title;
  let finalDetail = detail;
  let missionFinding = '';
  let missionData = null;
  let design = {};
  try { missionData = JSON.parse(localStorage.getItem('spaceforce_mission_data') || 'null'); } catch (e) {}
  design = activeVehicleDesign || {};
  if (status === 'SUCCESS' && missionData) {
    const missing = Object.entries(missionData.recommendedParts || {}).filter(([part, id]) => design[part] !== id);
    const powerChoice = design.power;
    if (activeVehicleType === 'rover' && powerChoice === 'solar' && ['mars_1', 'moon_1'].includes(missionData.id)) {
      finalStatus = 'FAILED';
      finalTitle = 'MISSION LOST: POWER SHORTAGE';
      missionFinding = 'The solar array could not recharge in the mission\'s dark or dust blocked environment. The rover lost power before completing the survey. A suitable battery source is required.';
    } else if (missing.length) {
      finalStatus = 'FAILED';
      finalTitle = 'MISSION INCOMPLETE: REQUIRED PARTS MISSING';
      missionFinding = `The craft arrived, but mission-critical equipment was missing: ${missing.map(([part]) => part).join(', ')}. The finding is incomplete; redesign and retry.`;
    } else {
      missionFinding = activeVehicleType === 'rover'
        ? `Power endurance: ${powerChoice === 'rtg' ? 'continuous 24/7 RTG power, including darkness and dust storms.' : 'solar generation available in sunlight; operations pause during darkness.'}`
        : `Mission equipment matched the required configuration (${Object.values(design).join(', ')}).`;
    }
    if (missionFinding) finalDetail += ` ${missionFinding}`;
  }
  isSimulating = false;
  simPhase = 'MISSION_COMPLETE'; // Locks sim loop from looping back
  activeThrustRatio = 0;
  cameraShake = 0;
  passedTwoMillionKm = false;

  document.getElementById('stat-outcome').innerText = finalTitle;
  const outcomeColor = finalStatus === 'SUCCESS' ? colorClass : 'synthRed';
  document.getElementById('stat-outcome').className = `font-orbitron font-extrabold text-xs text-${outcomeColor} mt-1`;
  document.getElementById('sim-status-badge').innerText = finalStatus;
  document.getElementById('sim-status-badge').className = `text-[10px] font-orbitron font-bold bg-synthDark text-${outcomeColor} border border-current px-2.5 py-0.5 rounded-full`;

  const overlay = document.getElementById('result-overlay');
  overlay.classList.remove('hidden');

  document.getElementById('result-title').innerText = finalTitle;
  document.getElementById('result-detail').innerText = finalDetail;

  let rocketDesign = {};
  try { rocketDesign = JSON.parse(localStorage.getItem('spaceforce_rocket_design') || '{}'); } catch (e) {}
  const reportUpgradeEngine = localStorage.getItem('spaceforce_engine_upgrade_engine');
  const reportUpgradeLevel = Number.parseInt(localStorage.getItem('spaceforce_engine_upgrade_level') || '0', 10);
  const simReport = {
    missionId: missionData && missionData.id || '',
    mission: missionData && (missionData.title || missionData.code) || currentMission.name,
    missionCode: missionData && missionData.code || currentMission.code,
    planet: activePlanet,
    vehicle: activeVehicleType,
    simulationStatus: finalStatus,
    simulationTitle: finalTitle,
    simulationDetail: finalDetail,
    vehicleDesign: { ...activeVehicleDesign },
    rocketDesign,
    engineUpgradeLevel: reportUpgradeEngine === rocketDesign.engine && Number.isFinite(reportUpgradeLevel)
      ? Math.max(0, Math.min(10, reportUpgradeLevel))
      : 0,
    maxAltitudeKm: Number((maxAlt / 1000).toFixed(1)),
    maxVelocity: Math.round(maxVel),
    maxDynamicPressureKpa: Number(maxQ.toFixed(1)),
    trajectory: traj ? { distanceKm: traj.targetDistKm, excessVelocity: traj.vInf, transferDays: traj.estDays } : null,
    recordedAt: new Date().toISOString()
  };
  localStorage.setItem('spaceforce_mission_report', JSON.stringify(simReport));
  if (typeof saveNotebookLog === 'function') {
    const remaining = typeof getCampaignBudget === 'function' ? getCampaignBudget() : 1000000;
    saveNotebookLog('FLIGHT SIMULATION', finalTitle, finalDetail, remaining, {
      mission: simReport.mission, vehicle: activeVehicleType, status: finalStatus,
      vehicleCost: Number(localStorage.getItem('spaceforce_vehicle_cost')) || 0,
      rocket: 'Custom launch vehicle', rocketCost: Number(localStorage.getItem('spaceforce_rocket_cost')) || 0
    });
  }

  let trajHTML = '';
  if (traj) {
    trajHTML = `
      <div class="border-t border-synthCyan/30 pt-1.5 mt-1.5 text-synthCyan font-bold">INTERPLANETARY TRAJECTORY SOLUTION:</div>
      <div>• Distance Covered (${activePlanet.toUpperCase()}): <span class="text-white">${formatDistanceKm(traj.targetDistKm)}</span></div>
      <div>• Excess Velocity (v∞): <span class="text-synthGold">${traj.vInf.toLocaleString()} m/s</span> (C3: ${traj.c3} km²/s²)</div>
      <div>• Transfer Duration: <span class="text-synthPink font-bold">${traj.estDays} Days</span></div>
    `;
  }

  document.getElementById('result-stats').innerHTML = `
    <div>• Parking Orbit Altitude: <span class="text-white">${(maxAlt / 1000).toFixed(1)} km</span></div>
    <div>• Injection Velocity: <span class="text-white">${Math.round(maxVel).toLocaleString()} m/s</span></div>
    <div>• Peak Dynamic Pressure (Max-Q): <span class="text-white">${maxQ.toFixed(1)} kPa</span></div>
    ${trajHTML}
  `;

  document.getElementById('result-actions').innerHTML = `<button onclick="resetSimState()" class="w-full py-2.5 bg-synthDark border border-synthCyan text-synthCyan font-orbitron font-bold rounded-xl text-xs cursor-pointer hover:bg-synthCyan hover:text-synthDark transition">RETRY SIMULATION</button><button onclick="goToRocketAssembly()" class="w-full py-2.5 bg-synthPink text-white font-orbitron font-bold rounded-xl text-xs cursor-pointer hover:opacity-90 transition">CONTINUE TO ROCKET ASSEMBLY &amp; MISSION CONTROL</button>`;
}

function renderTrajectoryHUD() {
  if (!ctx || !canvas) return;
  const traj = computeInterplanetaryTrajectory(velocity, altitude);
  const distStr = formatDistanceKm(currentMission.distanceKm);

  const boxW = 240;
  const boxH = 74;
  const x = canvas.width - boxW - 16;
  const y = canvas.height - boxH - 16;

  ctx.save();
  ctx.fillStyle = 'rgba(11, 12, 16, 0.85)';
  ctx.strokeStyle = 'rgba(102, 252, 241, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, boxW, boxH, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#66fcf1';
  ctx.font = 'bold 10px Orbitron, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`TRAJECTORY (${activePlanet.toUpperCase()}): ${distStr}`, x + 10, y + 18);

  ctx.fillStyle = '#c5c6c7';
  ctx.font = '10px monospace';
  ctx.fillText(`Escape Vel (v_esc): ${traj.vEscape.toLocaleString()} m/s`, x + 10, y + 35);
  ctx.fillText(`Excess Vel (v∞): ${traj.vInf.toLocaleString()} m/s`, x + 10, y + 50);
  ctx.fillStyle = '#ffb703';
  ctx.fillText(`Est. Cruise Time: ${traj.estDays} Days`, x + 10, y + 65);
  ctx.restore();
}

function spawnIgnitionSmoke() {
  if (!canvas) return;
  const cx = canvas.width / 2;
  const nozzleY = canvas.height / 2 + 35;

  for (let i = 0; i < 30; i++) {
    particles.push({
      x: cx + (Math.random() - 0.5) * 16,
      y: nozzleY,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.8) * 1.5,
      size: Math.random() * 8 + 6,
      color: 'rgba(203, 213, 225, 0.6)',
      life: 1.0,
      decay: 0.015
    });
  }
}

function spawnExhaustParticles(throttle) {
  if (!canvas) return;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  const nozzleOffset = stageSeparated ? 13 : 36;
  const rotRad = (90 - pitchAngle) * (Math.PI / 180);

  const nozzleX = cx - Math.sin(rotRad) * nozzleOffset;
  const nozzleY = cy + Math.cos(rotRad) * nozzleOffset;
  const exhaustAngle = rotRad + Math.PI / 2;
  const count = stageSeparated ? 3 : 6;

  const flameColors = stageSeparated
    ? ['#66fcf1', '#a5f3fc', '#ffffff']
    : ['#ff007f', '#ffb703', '#ff5400', '#ffffff'];

  for (let i = 0; i < count; i++) {
    const spread = (Math.random() - 0.5) * (stageSeparated ? 0.5 : 0.25);
    const speed = (Math.random() * 6 + 6) * throttle;
    particles.push({
      x: nozzleX + (Math.random() - 0.5) * 6,
      y: nozzleY + (Math.random() - 0.5) * 6,
      vx: Math.cos(exhaustAngle + spread) * speed,
      vy: Math.sin(exhaustAngle + spread) * speed,
      size: (Math.random() * 5 + 3) * throttle,
      color: flameColors[Math.floor(Math.random() * flameColors.length)],
      life: 1.0,
      decay: stageSeparated ? 0.06 : 0.045
    });
  }

  if (altitude < 120) {
    for (let i = 0; i < 3; i++) {
      particles.push({
        x: cx + (Math.random() - 0.5) * 30,
        y: cy + 36 + (altitude * 2),
        vx: (Math.random() - 0.5) * 8,
        vy: -Math.random() * 1.5,
        size: Math.random() * 10 + 8,
        color: '#94a3b8',
        life: 0.9,
        decay: 0.02
      });
    }
  }
}

function renderSkyAndSpace() {
  const altRatio = Math.min(1, altitude / 120000);
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);

  if (altRatio < 0.35) {
    grad.addColorStop(0, '#0b132b');
    grad.addColorStop(1, '#1c2541');
  } else if (altRatio < 0.75) {
    grad.addColorStop(0, '#02040a');
    grad.addColorStop(1, '#0b132b');
  } else {
    grad.addColorStop(0, '#000000');
    grad.addColorStop(1, '#050608');
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const scrollX = velX * timeStep * 0.001;
  const scrollY = altitude * 0.015;

  stars.forEach(s => {
    const sx = ((s.x - scrollX * s.speed) % canvas.width + canvas.width) % canvas.width;
    const sy = ((s.y + scrollY * s.speed) % canvas.height + canvas.height) % canvas.height;
    ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha * Math.max(0.25, altRatio)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, s.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function renderPadAndRocket() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  if (altitude < 250) {
    const padY = cy + 35 + (altitude * 2);

    ctx.strokeStyle = 'rgba(102, 252, 241, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 55, padY - 110, 18, 110);
    ctx.beginPath();
    for (let ty = padY - 110; ty < padY; ty += 22) {
      ctx.moveTo(cx - 55, ty);
      ctx.lineTo(cx - 37, ty + 22);
    }
    ctx.stroke();

    ctx.fillStyle = '#1f2833';
    ctx.fillRect(cx - 110, padY, 220, 16);
    ctx.strokeStyle = '#66fcf1';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 110, padY, 220, 16);
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((90 - pitchAngle) * (Math.PI / 180));

  if (activeThrustRatio > 0) {
    const nozzleY = stageSeparated ? 13 : 35;
    const flicker = 0.85 + Math.random() * 0.35;
    const flameLen = (stageSeparated ? 55 : 75) * activeThrustRatio * flicker;
    const flameWidth = (stageSeparated ? 14 : 11) * activeThrustRatio;

    const flameGrad = ctx.createLinearGradient(0, nozzleY, 0, nozzleY + flameLen);
    if (stageSeparated) {
      flameGrad.addColorStop(0, '#ffffff');
      flameGrad.addColorStop(0.3, '#66fcf1');
      flameGrad.addColorStop(1, 'rgba(102, 252, 241, 0)');
    } else {
      flameGrad.addColorStop(0, '#ffffff');
      flameGrad.addColorStop(0.25, '#ffb703');
      flameGrad.addColorStop(0.65, '#ff007f');
      flameGrad.addColorStop(1, 'rgba(255, 0, 127, 0)');
    }

    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(-flameWidth, nozzleY);
    ctx.lineTo(0, nozzleY + flameLen);
    ctx.lineTo(flameWidth, nozzleY);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(-10, -45, 20, 40);

  if (!stageSeparated) {
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(-10, -5, 20, 40);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-10, -7, 20, 4);

    ctx.fillStyle = '#45a29e';
    ctx.beginPath();
    ctx.moveTo(-10, 15);
    ctx.lineTo(-22, 35);
    ctx.lineTo(-10, 35);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(10, 15);
    ctx.lineTo(22, 35);
    ctx.lineTo(10, 35);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = '#ffb703';
    ctx.fillRect(-6, 5, 12, 8);
  }

  ctx.fillStyle = '#ff007f';
  ctx.beginPath();
  ctx.moveTo(-10, -45);
  ctx.lineTo(0, -72);
  ctx.lineTo(10, -45);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  if (simPhase === 'COUNTDOWN') {
    ctx.fillStyle = '#66fcf1';
    ctx.font = 'bold 34px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText(`T-${countdown}`, cx, cy - 95);
  }
}

function renderParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= (p.decay || 0.04);

    if (p.life <= 0) {
      particles.splice(i, 1);
    } else {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function goToRocketAssembly() {
  let report = null;
  try { report = JSON.parse(localStorage.getItem('spaceforce_mission_report') || 'null'); } catch (e) {}
  const destination = report && report.planet || activePlanet;
  const rocket = destination === 'titan' ? 'plasma' : ['moon', 'mars'].includes(destination) ? 'interplanetary' : 'orbital';
  window.location.href = `rocket_as.html?rocket=${rocket}`;
}

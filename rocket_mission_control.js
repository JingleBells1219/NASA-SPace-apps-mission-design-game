// Mission Control budget and test-flight controller.
// The canvas animation remains in rocket_mission_control.html; this file owns
// persistent test-flight accounting so loading/reloading the page never charges.
(function (global) {
  const FLIGHT_LIMIT = 3;
  const FLIGHT_COST = 25000;
  const FLIGHT_COUNT_KEY = 'spaceforce_test_flights';

  function getFlightCount() {
    const count = Number.parseInt(localStorage.getItem(FLIGHT_COUNT_KEY) || '0', 10);
    return Number.isFinite(count) ? Math.max(0, Math.min(FLIGHT_LIMIT, count)) : 0;
  }

  function getBudget() {
    if (typeof global.getCampaignBudget === 'function') return global.getCampaignBudget();
    const raw = localStorage.getItem('spaceforce_budget') ?? localStorage.getItem('spaceforce_rocket_budget');
    const amount = Number.parseInt(raw, 10);
    return Number.isFinite(amount) ? Math.max(0, amount) : 1000000;
  }

  function setBudget(amount) {
    if (typeof global.setCampaignBudget === 'function') return global.setCampaignBudget(amount);
    const value = Math.max(0, Math.round(Number(amount) || 0));
    localStorage.setItem('spaceforce_budget', String(value));
    localStorage.setItem('spaceforce_rocket_budget', String(value));
    return value;
  }

  function updateUI() {
    const count = getFlightCount();
    const countElement = document.getElementById('stat-flight-count');
    const bar = document.getElementById('bar-flight');
    if (countElement) countElement.innerText = `${count} / ${FLIGHT_LIMIT}`;
    if (bar) bar.style.width = `${(count / FLIGHT_LIMIT) * 100}%`;
  }

  function runTestLaunch() {
    const count = getFlightCount();
    if (count >= FLIGHT_LIMIT) {
      if (typeof global.addLog === 'function') global.addLog('All three test flights are complete.', 'text-synthGold');
      return;
    }

    if (getBudget() < FLIGHT_COST) {
      if (typeof global.addLog === 'function') global.addLog(`Insufficient budget for a test flight. Each flight costs $${FLIGHT_COST.toLocaleString()}.`, 'text-synthGold');
      return;
    }

    const remaining = setBudget(getBudget() - FLIGHT_COST);
    const nextCount = count + 1;
    localStorage.setItem(FLIGHT_COUNT_KEY, String(nextCount));
    const message = `Test flight ${nextCount}/${FLIGHT_LIMIT} diagnostics confirmed. Flight cost: $${FLIGHT_COST.toLocaleString()}. Remaining budget: $${remaining.toLocaleString()}.`;
    if (typeof global.addLog === 'function') global.addLog(message, 'text-synthPink');
    if (typeof global.saveNotebookLog === 'function') {
      global.saveNotebookLog('MISSION CONTROL', `Test Flight ${nextCount}/${FLIGHT_LIMIT}`, message, remaining, { totalCost: FLIGHT_COST });
    }
    updateUI();
  }

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
    catch (e) { return fallback; }
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }

  const PART_NAMES = {
    rtg: 'RTG power core', solar: 'solar array', drill_spec: 'drill and spectrometer', camera_arm: 'laser scanner',
    dual_wing: 'dual solar wings', compact_cell: 'compact solar cells', high_gain: 'high gain antenna',
    omni_array: 'omnidirectional antenna', cold_gas: 'cold gas thrusters', react_wheels: 'reaction wheels',
    ablative: 'ablative heat shield', ceramic: 'ceramic heat tiles', mag_radar: 'surface radar',
    spectro_cam: 'multispectral camera', ion_plasma: 'ion engine', chem_hyper: 'chemical engine',
    kerolox: 'kerolox engine', methalox: 'methalox engine', standard: 'standard tanks', stretched: 'stretched tanks',
    rp1: 'RP-1 tanks', lh2: 'liquid hydrogen tanks', allithium: 'aluminum lithium hull', steel: 'steel hull',
    composite: 'composite fairing', aluminum: 'aluminum fairing', inertial: 'inertial guidance', startracker: 'star tracker'
  };

  function getDebrief() {
    const report = readJson('spaceforce_mission_report', null);
    const mission = readJson('spaceforce_mission_data', {});
    const vehicleDesign = report && report.vehicleDesign || readJson('spaceforce_vehicle_design', {});
    const rocketDesign = report && report.rocketDesign || readJson('spaceforce_rocket_design', {});
    const vehicleAssembly = readJson('spaceforce_vehicle_assembly_report', null);
    const assemblyErrors = readJson('spaceforce_assembly_errors', {});
    const errorCount = Object.values(assemblyErrors).filter(Boolean).length;
    const assemblyDone = localStorage.getItem('spaceforce_rocket_assembly_complete') === 'true';
    const rocketType = localStorage.getItem('spaceforce_rocket_assembly_model') || 'unknown';
    const testFlights = getFlightCount();
    const finalSuccess = Boolean(report && report.simulationStatus === 'SUCCESS' && assemblyDone && errorCount === 0 && (!vehicleAssembly || vehicleAssembly.passed));
    const cards = [];

    if (!report) {
      cards.push('No completed flight-simulation report was found. Go through Rocket Simulator first to create the mission record.');
    } else {
      cards.push(`${escapeHTML(report.mission || mission.title || 'Assigned mission')}: flight simulator status was ${escapeHTML(report.simulationStatus)}. Peak speed ${Number(report.maxVelocity || 0).toLocaleString()} m/s; Max-Q ${Number(report.maxDynamicPressureKpa || 0).toFixed(1)} kPa.`);
      const recommendations = mission.recommendedParts || {};
      const missing = Object.entries(recommendations).filter(([category, required]) => vehicleDesign[category] !== required);
      if (missing.length) {
        cards.push(`Vehicle finding: mission needs ${missing.map(([, id]) => PART_NAMES[id] || id).join(' and ')}. Your installed configuration did not match every recommended mission part.`);
      } else if (Object.keys(recommendations).length) {
        cards.push(`Vehicle finding: mission-critical equipment is installed (${Object.values(recommendations).map(id => PART_NAMES[id] || id).join(', ')}).`);
      }

      if (report.vehicle === 'rover') {
        cards.push(vehicleDesign.power === 'rtg'
          ? 'Power endurance: RTG supports continuous operations through darkness and dust.'
          : 'Power endurance: solar generation depends on daylight; operations pause in darkness or heavy dust.');
      } else if (report.vehicle === 'satellite') {
        cards.push(`${vehicleDesign.wings === 'dual_wing' ? 'Dual wings provide a stronger solar margin' : 'Compact cells provide a smaller solar margin'}; ${vehicleDesign.antenna === 'high_gain' ? 'the high gain dish supports high bandwidth' : 'the omni antenna trades bandwidth for wider coverage'}.`);
      } else if (report.vehicle === 'probe') {
        cards.push(`${vehicleDesign.shield === 'ablative' ? 'Ablative shielding supports intense atmospheric entry' : vehicleDesign.shield === 'none' ? 'No entry shield limits the probe to a flyby' : 'Ceramic tiles provide limited thermal protection'}; ${PART_NAMES[vehicleDesign.sensors] || 'the selected sensor'} determines the available science reading.`);
      }
    }

    const rocketNames = Object.values(rocketDesign).map(id => PART_NAMES[id] || id);
    if (rocketNames.length) cards.push(`Rocket configuration: ${rocketNames.map(escapeHTML).join(', ')}.`);
    const engineUpgradeLevel = Math.max(0, Number(report && report.engineUpgradeLevel) || 0);
    if (engineUpgradeLevel) cards.push(`Engine tuning: ${engineUpgradeLevel} paid upgrade${engineUpgradeLevel === 1 ? '' : 's'} increased engine specific impulse by ${engineUpgradeLevel * 8}%, improving available delta-v.`);
    if (vehicleAssembly) cards.push(`Vehicle assembly QA: ${vehicleAssembly.passed ? 'all stages passed' : `${Object.values(vehicleAssembly.errors || {}).filter(Boolean).length} defect(s), with a $${Number(vehicleAssembly.penalty || 0).toLocaleString()} penalty`}.`);
    cards.push(`Rocket assembly: ${escapeHTML(rocketType)} stage set, ${errorCount} QA defect${errorCount === 1 ? '' : 's'} recorded${assemblyDone ? '' : '; assembly has not been completed'}.`);
    cards.push(testFlights
      ? `${testFlights}/3 test flights completed; $${(testFlights * FLIGHT_COST).toLocaleString()} spent on test-flight fees.`
      : 'No paid test flights were recorded for this attempt.');
    return { report, mission, cards, finalSuccess, errorCount, testFlights, rocketType, vehicleAssembly };
  }

  function finalizeMission(debrief) {
    const { report, mission, cards, finalSuccess } = debrief;
    // Mission Control can be revisited or reloaded after the result is saved.
    // Do not archive the same result twice or reset the campaign budget again.
    if (report && report.finalizedAt && report.finalStatus === 'SUCCESS') {
      return { finalSuccess: report.finalStatus === 'SUCCESS', details: report.finalDetail || '' };
    }
    const tutorialFarewell = finalSuccess && localStorage.getItem('spaceforce_astra_tutorial_complete') !== 'true'
      ? ' Astra: “That was your first completed mission. My tutorial is done—trust your notebook and your engineering judgment from here. Goodbye, Intern!”'
      : '';
    if (tutorialFarewell) localStorage.setItem('spaceforce_astra_tutorial_complete', 'true');
    if (!finalSuccess) cards.push(report && report.simulationStatus !== 'SUCCESS'
      ? 'Mission result: incomplete. Fix the vehicle or trajectory issue, then retry the mission.'
      : 'Mission result: incomplete. Repair the rocket assembly defects and launch again.');
    const details = `${cards.join(' ')}${tutorialFarewell}`;
    const missionId = (report && report.missionId) || mission.id;
    const currentBudget = getBudget();
    if (finalSuccess && missionId && typeof global.markMissionCompleted === 'function') global.markMissionCompleted(missionId);
    if (finalSuccess && missionId) {
      const completed = typeof global.getCompletedMissions === 'function' ? global.getCompletedMissions() : [];
      if (completed.length >= 6) localStorage.setItem('spaceforce_campaign_complete', 'true');
    }
    if (typeof global.saveNotebookLog === 'function') {
      global.saveNotebookLog('MISSION DEBRIEF', report && report.mission || mission.title || 'Mission Control', details, currentBudget, {
        mission: report && report.mission || mission.title || 'Mission',
        vehicle: report && report.vehicle || localStorage.getItem('spaceforce_vehicle') || 'unknown',
        rocket: debrief.rocketType,
        status: finalSuccess ? 'SUCCESS' : 'FAILED',
        vehicleCost: Number(localStorage.getItem('spaceforce_vehicle_cost')) || 0,
        rocketCost: Number(localStorage.getItem('spaceforce_rocket_cost')) || 0
      });
    }
    if (report) {
      report.finalStatus = finalSuccess ? 'SUCCESS' : 'FAILED';
      report.finalDetail = details;
      report.finalizedAt = new Date().toISOString();
      localStorage.setItem('spaceforce_mission_report', JSON.stringify(report));
    }
    if (finalSuccess) {
      setBudget(1000000);
      localStorage.setItem(FLIGHT_COUNT_KEY, '0');
    }
    return { finalSuccess, details };
  }

  function loadNasaChoiceContext() {
    const title = document.getElementById('nasa-context-title');
    const detail = document.getElementById('nasa-context-detail');
    const link = document.getElementById('nasa-context-link');
    if (!title || !detail || !link) return;
    const { report, mission } = getDebrief();
    const design = report && report.vehicleDesign || readJson('spaceforce_vehicle_design', {});
    const parts = Object.values(design).map(id => PART_NAMES[id] || id).slice(0, 3);
    const queryTerms = [mission.planet || (report && report.planet), report && report.vehicle, ...parts].filter(Boolean).join(' ');
    title.textContent = 'Searching NASA Image and Video Library…';
    const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(queryTerms || 'space exploration')}&media_type=image&page_size=1`;
    fetch(url).then(response => {
      if (!response.ok) throw new Error(`NASA API returned ${response.status}`);
      return response.json();
    }).then(data => {
      const item = data && data.collection && data.collection.items && data.collection.items[0];
      const metadata = item && item.data && item.data[0];
      if (!metadata) throw new Error('No matching NASA image was found.');
      title.textContent = metadata.title || 'NASA image result';
      detail.textContent = metadata.description || `NASA search matched: ${queryTerms}.`;
      const nasaId = metadata.nasa_id;
      const href = nasaId ? `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}` : item.href || 'https://images.nasa.gov/';
      link.href = href;
      link.classList.remove('hidden');
      link.textContent = 'OPEN NASA RESULT';
    }).catch(() => {
      title.textContent = 'NASA data unavailable right now';
      detail.textContent = `The choice-based debrief above is saved locally. NASA context query: ${queryTerms || 'space exploration'}.`;
      link.classList.add('hidden');
    });
  }

  global.RocketMissionControl = { getFlightCount, getBudget, updateUI, runTestLaunch, getDebrief, finalizeMission, loadNasaChoiceContext, escapeHTML };
  global.runTestLaunch = runTestLaunch;
  document.addEventListener('DOMContentLoaded', updateUI);
})(window);

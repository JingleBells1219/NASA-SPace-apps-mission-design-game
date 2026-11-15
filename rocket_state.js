// =====================================================================
// SPACE FORCE 1.0 - shared rocket state, part tables and flight maths
// Loaded by index.html, rocket_as.html, rocket_sim.html and
// rocket_mission_control.html so every page sees the same rocket.
// =====================================================================
(function (global) {
  const KEY = 'sf_state_v1';
  let cache = null;

  // ---- state (sessionStorage + ?s= URL param so it also survives file:// pages) ----
  function enc(o) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function dec(s) {
    try {
      s = s.replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      return JSON.parse(decodeURIComponent(escape(atob(s))));
    } catch (e) { return null; }
  }
  function load() {
    if (cache) return cache;
    let st = null;
    try { const p = new URLSearchParams(location.search).get('s'); if (p) st = dec(p); } catch (e) {}
    if (!st) { try { st = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) {} }
    cache = st || {};
    return cache;
  }
  function save(patch) {
    cache = Object.assign({}, load(), patch || {});
    try { sessionStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) {}
    return cache;
  }
  function clear() {
    cache = {};
    try { sessionStorage.removeItem(KEY); } catch (e) {}
  }
  function go(page, params) {
    const q = new URLSearchParams(params || {});
    q.set('s', enc(load()));
    window.location.href = page + '?' + q.toString();
  }

  // ---- rocket design parts (shared by the workbench UI and the physics) ----
  // mass  = dry hardware (kg)      power = stage-1 sea-level thrust (kN)
  // prop  = propellant capacity (kg)   qLimit = max dynamic pressure the hull survives (Pa)
  const ROCKET_DESIGN_PARTS = {
    engine: {
      title: "1. MAIN ENGINE CLUSTER",
      options: [
        { id: "kerolox", name: "Kerolox Gas-Generator Cluster", cost: 70000, mass: 4700, power: 7600, ispSL: 282, ispVac: 311, mixture: 2.56,
          spec: "Proven & Reliable", desc: "Kerosene + liquid oxygen. Simple, cheap, flight-tested. Isp 282-311 s." },
        { id: "methalox", name: "Methalox Full-Flow Cluster", cost: 120000, mass: 6600, power: 9500, ispSL: 327, ispVac: 350, mixture: 3.6,
          spec: "High Efficiency", desc: "Methane + liquid oxygen. More thrust and Isp (327-350 s)." }
      ]
    },
    tanks: {
      title: "2. PROPELLANT TANKS",
      options: [
        { id: "standard", name: "Standard Tank Set", cost: 40000, mass: 18000, prop: 380000,
          spec: "Balanced", desc: "380 t of propellant. Light enough for a strong liftoff." },
        { id: "stretched", name: "Stretched Tank Set", cost: 75000, mass: 24000, prop: 520000,
          spec: "Long Range", desc: "520 t of propellant. More delta-v, but heavier." }
      ]
    },
    body: {
      title: "3. BODY STRUCTURE",
      options: [
        { id: "allithium", name: "Aluminum-Lithium Alloy", cost: 50000, mass: 4000, qLimit: 42000,
          spec: "Light Alloy", desc: "Light, but limited to about 42 kPa of aerodynamic pressure." },
        { id: "steel", name: "Stainless Steel Hull", cost: 30000, mass: 6500, qLimit: 60000,
          spec: "Tough Hull", desc: "Heavier, but survives 60 kPa and is cheap." }
      ]
    },
    fairing: {
      title: "4. PAYLOAD FAIRING",
      options: [
        { id: "composite", name: "Composite Nose Fairing", cost: 35000, mass: 1700, cdMul: 1.0,
          spec: "Aerodynamic", desc: "Smooth carbon shell. Low drag, jettisoned in space." },
        { id: "aluminum", name: "Aluminum Payload Shell", cost: 20000, mass: 2400, cdMul: 1.25,
          spec: "Budget Shell", desc: "Cheaper and sturdier, but heavier with more drag." }
      ]
    },
    guidance: {
      title: "5. GUIDANCE SYSTEM",
      options: [
        { id: "inertial", name: "Inertial + GPS Navigator", cost: 25000, mass: 100, accuracy: "inertial",
          spec: "Steady Ascent", desc: "Fine for Earth orbit. Far from Earth, errors need more correction fuel." },
        { id: "startracker", name: "Star Tracker + Gyro Suite", cost: 45000, mass: 150, accuracy: "star",
          spec: "Deep-Space Precision", desc: "Pinpoint aim far from home. Needs far less correction fuel." }
      ]
    }
  };

  const DESTINATIONS = {
    leo:   { key: 'leo',   name: 'Low Earth Orbit', short: 'LEO',   c3: null, dvDep: 0,    burn: 'Orbit insertion', travel: 'Already there',
             penalty: { inertial: 20,  star: 10 },  blurb: 'Park in a 200 km circular orbit.' },
    moon:  { key: 'moon',  name: 'The Moon',        short: 'MOON',  c3: -2.0, dvDep: 2830, burn: 'Trans-Lunar Injection (TLI)', travel: 'about 3 days',
             penalty: { inertial: 90,  star: 40 },  blurb: 'Reach a transfer orbit that touches the Moon\'s orbit.' },
    mars:  { key: 'mars',  name: 'Mars',            short: 'MARS',  c3: 8.7,  dvDep: 3660, burn: 'Trans-Mars Injection (TMI)', travel: 'about 7 months',
             penalty: { inertial: 220, star: 80 },  blurb: 'Escape Earth fast enough to catch Mars.' },
    titan: { key: 'titan', name: 'Titan (Saturn)',  short: 'TITAN', c3: 16.6, dvDep: 3840, burn: 'Saturn Transfer Injection (Jupiter assist)', travel: 'about 7 years',
             penalty: { inertial: 700, star: 300 }, blurb: 'The hardest trip: a Jupiter gravity assist to Saturn.' }
  };
  const ASCENT_DV = 8950;           // m/s from the pad to a 200 km orbit, including gravity + drag losses
  const G0 = 9.80665;

  function findOpt(cat, id) {
    const list = ROCKET_DESIGN_PARTS[cat].options;
    return list.find(o => o.id === id) || list[0];
  }

  // Turn a design (ids per category) + payload into rocket performance numbers
  function derive(design, payloadKg, destKey, propFrac) {
    design = design || {};
    const eng = findOpt('engine', design.engine), tank = findOpt('tanks', design.tanks),
          body = findOpt('body', design.body), fair = findOpt('fairing', design.fairing),
          guid = findOpt('guidance', design.guidance);
    const dest = DESTINATIONS[destKey] || DESTINATIONS.moon;
    const frac = Math.max(0.3, Math.min(1, propFrac == null ? 1 : propFrac));
    const hull = tank.mass + body.mass;
    const s1Dry = eng.mass + 0.82 * hull;
    const s2Dry = 0.18 * hull + 0.1 * eng.mass + guid.mass;      // fairing counted separately
    const prop1 = 0.78 * tank.prop * frac, prop2 = 0.22 * tank.prop * frac;
    const payload = payloadKg || 1500;
    const f1 = eng.power * 1000;                                   // N, sea level
    const mdot1 = f1 / (eng.ispSL * G0);
    const f2 = 0.12 * f1;                                          // one vacuum engine
    const mdot2 = f2 / (eng.ispVac * G0);
    const m0 = s1Dry + s2Dry + fair.mass + prop1 + prop2 + payload;
    // Tsiolkovsky (ideal) delta-v for each stage
    const m1a = m0, m1b = m0 - prop1 - s1Dry;
    const m2a = m1b, m2b = m1b - prop2;
    const veAvg1 = 0.5 * (eng.ispSL + eng.ispVac) * G0;
    const dv1 = veAvg1 * Math.log(m1a / m1b);
    const dv2 = eng.ispVac * G0 * Math.log(m2a / m2b);
    const need = ASCENT_DV + dest.dvDep + dest.penalty[guid.accuracy];
    return {
      eng, tank, body, fair, guid, dest, payload, frac,
      s1Dry, s2Dry, prop1, prop2, f1, f2, mdot1, mdot2, m0,
      twr: f1 / (m0 * G0), dv1, dv2, dvTotal: dv1 + dv2, dvNeed: need,
      dryTotal: s1Dry + s2Dry + fair.mass, qLimit: body.qLimit, cdMul: fair.cdMul,
      penalty: dest.penalty[guid.accuracy]
    };
  }

  global.RocketState = { load, save, clear, go, enc, dec };
  global.ROCKET_DESIGN_PARTS = ROCKET_DESIGN_PARTS;
  global.ROCKET_DESTINATIONS = DESTINATIONS;
  global.RocketMath = { derive, findOpt, ASCENT_DV, G0 };
  if (typeof module !== 'undefined') module.exports = { derive, findOpt, ROCKET_DESIGN_PARTS, DESTINATIONS };
})(typeof window !== 'undefined' ? window : globalThis);

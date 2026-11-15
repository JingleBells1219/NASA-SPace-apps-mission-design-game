// ==========================================
// SPACE FORCE 1.0 - CENTRAL LOGBOOK SYSTEM
// ==========================================

function getNotebookLogs() {
  try {
    const logs = localStorage.getItem('spaceforce_notebook_logs');
    return logs ? JSON.parse(logs) : [];
  } catch (e) {
    return [];
  }
}

function saveNotebookLog(category, title, details, budgetRemaining = 'N/A', extraData = {}) {
  const logs = getNotebookLogs();
  logs.unshift({
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' • ' + new Date().toLocaleDateString(),
    category: category,
    title: title,
    details: details,
    budget: budgetRemaining,
    mission: extraData.mission || localStorage.getItem('spaceforce_planet')?.toUpperCase() || 'DEEP SPACE TRANSFER',
    vehicle: extraData.vehicle || localStorage.getItem('spaceforce_vehicle')?.toUpperCase() || 'ROVER',
    vehicleCost: extraData.vehicleCost ?? 0,
    rocket: extraData.rocket || 'ORBITAL HEAVY',
    rocketCost: extraData.rocketCost ?? 0,
    totalCost: extraData.totalCost ?? ((extraData.vehicleCost ?? 0) + (extraData.rocketCost ?? 0)),
    status: extraData.status || 'RECORDED'
  });
  if (logs.length > 150) logs.pop();
  localStorage.setItem('spaceforce_notebook_logs', JSON.stringify(logs));
}

function getCampaignBudget() {
  const raw = localStorage.getItem('spaceforce_budget') ?? localStorage.getItem('spaceforce_rocket_budget');
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? Math.max(0, value) : 1000000;
}

function setCampaignBudget(value) {
  const amount = Math.max(0, Math.round(Number(value) || 0));
  localStorage.setItem('spaceforce_budget', String(amount));
  localStorage.setItem('spaceforce_rocket_budget', String(amount));
  return amount;
}

function chargeCampaignBudget(amount) {
  return setCampaignBudget(getCampaignBudget() - Math.max(0, Number(amount) || 0));
}

function escapeNotebookHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

function getCompletedMissions() {
  try {
    return JSON.parse(localStorage.getItem('spaceforce_completed_missions') || '[]');
  } catch (e) {
    return [];
  }
}

function getCampaignProgress() {
  const completed = getCompletedMissions();
  return { completed, total: 6, complete: completed.length >= 6 };
}

function markMissionCompleted(missionCode) {
  if (!missionCode) return;
  const completed = getCompletedMissions();
  if (!completed.includes(missionCode)) {
    completed.push(missionCode);
    localStorage.setItem('spaceforce_completed_missions', JSON.stringify(completed));
  }
}

function toggleNotebook() {
  const modal = document.getElementById('notebook-modal');
  if (!modal) return;

  if (modal.classList.contains('hidden')) {
    renderNotebookEntries();
    modal.classList.remove('hidden');
  } else {
    modal.classList.add('hidden');
  }
}

function renderNotebookEntries() {
  const container = document.getElementById('notebook-entries');
  if (!container) return;

  const logs = getNotebookLogs();
  const completed = getCompletedMissions();

  const progressBanner = `
    <div class="bg-slate-950/90 border border-emerald-500/40 p-3 rounded-xl flex justify-between items-center text-xs font-mono mb-3">
      <span class="text-emerald-400 font-bold">📓 CAMPAIGN NOTEBOOK PROGRESS:</span>
      <span class="text-white font-bold">${completed.length} / 6 MISSIONS CLEARED</span>
    </div>
  `;

  if (logs.length === 0) {
    container.innerHTML = progressBanner + `<div class="text-center text-slate-400 py-8 font-mono text-xs">No mission logs recorded yet. Complete decisions, assemblies, or flights to populate your notebook!</div>`;
    return;
  }

  container.innerHTML = progressBanner + logs.map(log => `
    <div class="bg-slate-900/95 border-2 border-cyan-500/40 p-4 rounded-2xl shadow-xl space-y-2.5 text-left font-mono">
      <div class="flex justify-between items-center border-b border-slate-700 pb-2">
        <span class="text-cyan-400 font-bold text-xs uppercase tracking-wider">🚀 [${log.category}] ${log.title}</span>
        <span class="text-slate-500 text-[10px]">${log.timestamp}</span>
      </div>

      <!-- Card Breakdown Grid -->
      <div class="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/85 p-3 rounded-xl border border-slate-800">
        <div><span class="text-slate-500">Mission:</span> <strong class="text-white">${escapeNotebookHTML(log.mission)}</strong></div>
        <div><span class="text-slate-500">Vehicle:</span> <strong class="text-cyan-300">${escapeNotebookHTML(log.vehicle)}</strong></div>
        <div><span class="text-slate-500">Budget:</span> <strong class="text-emerald-400">${log.budget !== 'N/A' ? '$' + Number(log.budget).toLocaleString() : 'Not recorded'}</strong></div>
        <div><span class="text-slate-500">Vehicle Cost:</span> <strong class="text-amber-300">-$${Number(log.vehicleCost).toLocaleString()}</strong></div>
        <div><span class="text-slate-500">Rocket:</span> <strong class="text-pink-400">${escapeNotebookHTML(log.rocket)}</strong></div>
        <div><span class="text-slate-500">Rocket Cost:</span> <strong class="text-amber-300">-$${Number(log.rocketCost).toLocaleString()}</strong></div>
        <div class="col-span-2 border-t border-slate-800 pt-1.5 flex justify-between">
          <span class="text-slate-500">Total Cost:</span> <strong class="text-rose-400">$${Number(log.totalCost).toLocaleString()}</strong>
        </div>
        <div class="col-span-2 flex justify-between">
          <span class="text-slate-500">Mission Status:</span>
          <strong class="${log.status === 'SUCCESS' ? 'text-emerald-400' : log.status === 'FAILED' ? 'text-rose-400' : 'text-amber-400'} uppercase">${escapeNotebookHTML(log.status)}</strong>
        </div>
      </div>

      <div class="text-slate-300 text-xs leading-relaxed">${escapeNotebookHTML(log.details)}</div>
    </div>
  `).join('');
}

function clearNotebookLogs() {
  if (confirm("Are you sure you want to clear all archived mission logs?")) {
    localStorage.removeItem('spaceforce_notebook_logs');
    renderNotebookEntries();
  }
}

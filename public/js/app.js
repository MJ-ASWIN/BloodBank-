// ==========================================================
// LifeLine — Community Blood & Platelet Emergency Network
// Frontend logic: view switching + API calls + rendering
// ==========================================================

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// ---------- helpers ----------
function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $all(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

function timeAgo(dateStr) {
  // dateStr format: "YYYY-MM-DD HH:MM" (UTC from server)
  const then = new Date(dateStr.replace(" ", "T") + "Z");
  const diffMin = Math.max(1, Math.round((Date.now() - then.getTime()) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

// ---------- populate all blood-group selects ----------
function populateBloodGroupSelects() {
  $all(".bg-select").forEach((sel) => {
    BLOOD_GROUPS.forEach((bg) => {
      const opt = document.createElement("option");
      opt.value = bg;
      opt.textContent = bg;
      sel.appendChild(opt);
    });
  });
  ["#boardBloodFilter", "#findBloodFilter"].forEach((id) => {
    const sel = $(id);
    BLOOD_GROUPS.forEach((bg) => {
      const opt = document.createElement("option");
      opt.value = bg;
      opt.textContent = bg;
      sel.appendChild(opt);
    });
  });
}

// ---------- view switching (SPA tabs) ----------
function goToView(view) {
  $all(".navtabs__btn").forEach((b) => b.classList.toggle("is-active", b.dataset.view === view));
  $all(".view").forEach((v) => v.classList.toggle("is-active", v.dataset.view === view));
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (view === "board") loadBoard();
  if (view === "find") loadDonors();
  if (view === "home") loadStats();
}

function initNav() {
  $all(".navtabs__btn").forEach((btn) => {
    btn.addEventListener("click", () => goToView(btn.dataset.view));
  });
  $all("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => goToView(btn.dataset.goto));
  });
}

// ---------- urgency picker (request form) ----------
function initUrgencyPicker() {
  const picker = $("#urgencyPicker");
  const hidden = $('#requestForm input[name="urgency"]');
  $all(".urgency-opt", picker).forEach((btn) => {
    btn.addEventListener("click", () => {
      $all(".urgency-opt", picker).forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      hidden.value = btn.dataset.value;
    });
  });
}

// ---------- home: stats + ticker ----------
async function loadStats() {
  try {
    const stats = await api("/api/stats");
    $("#statDonors").textContent = stats.total_donors;
    $("#statActive").textContent = stats.active_requests;
    $("#statCritical").textContent = stats.critical_requests;
    $("#statCities").textContent = stats.cities_covered;
  } catch (e) { /* stats are non-critical, fail silently */ }

  try {
    const requests = await api("/api/requests?status=Active");
    const critical = requests.filter((r) => r.urgency === "Critical");
    const track = $("#tickerTrack");
    if (critical.length === 0) {
      track.innerHTML = '<span class="ticker__empty">No critical requests right now — network is stable.</span>';
    } else {
      track.innerHTML = critical
        .map((r) => `<span class="ticker__item"><b>${r.blood_group}</b> needed at ${escapeHtml(r.hospital)}, ${escapeHtml(r.city)}</span>`)
        .join("");
    }
  } catch (e) { /* ticker is non-critical */ }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------- active board ----------
async function loadBoard() {
  const container = $("#requestBoard");
  container.innerHTML = '<p class="empty">Loading requests&hellip;</p>';
  const bg = $("#boardBloodFilter").value;
  const city = $("#boardCityFilter").value.trim();

  try {
    const params = new URLSearchParams({ status: "Active" });
    if (bg) params.set("blood_group", bg);
    if (city) params.set("city", city);
    const requests = await api(`/api/requests?${params.toString()}`);

    if (requests.length === 0) {
      container.innerHTML = '<p class="empty">No active requests match this filter.</p>';
      return;
    }

    container.innerHTML = requests.map(requestCardHtml).join("");

    $all("[data-fulfill-id]", container).forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await api(`/api/requests/${btn.dataset.fulfillId}/fulfill`, { method: "PATCH" });
          showToast("Marked as fulfilled — thank you!");
          loadBoard();
          loadStats();
        } catch (e) {
          showToast(e.message);
          btn.disabled = false;
        }
      });
    });
  } catch (e) {
    container.innerHTML = `<p class="empty">Couldn't load requests: ${escapeHtml(e.message)}</p>`;
  }
}

function requestCardHtml(r) {
  const isCritical = r.urgency === "Critical";
  return `
    <div class="card ${isCritical ? "card--critical" : ""}">
      <div class="card__top">
        <span class="bg-badge">${r.blood_group} &middot; ${escapeHtml(r.component)}</span>
        <span class="urgency-badge urgency-badge--${r.urgency}">${r.urgency}</span>
      </div>
      <h3>${escapeHtml(r.patient_name)}</h3>
      <div class="card__meta">
        <span>${r.units_needed} unit${r.units_needed > 1 ? "s" : ""} &middot; <b>${escapeHtml(r.hospital)}</b></span>
        <span>${escapeHtml(r.city)}</span>
        ${r.notes ? `<span>${escapeHtml(r.notes)}</span>` : ""}
      </div>
      <div class="card__footer">
        <div>
          <div class="card__phone">${escapeHtml(r.contact_name)} &middot; ${escapeHtml(r.contact_phone)}</div>
          <div class="card__time">${timeAgo(r.created_at)}</div>
        </div>
        <div class="card__actions">
          <button class="link-btn" data-fulfill-id="${r.id}">Mark fulfilled</button>
        </div>
      </div>
    </div>
  `;
}

// ---------- find donors ----------
async function loadDonors() {
  const container = $("#donorResults");
  container.innerHTML = '<p class="empty">Loading donors&hellip;</p>';
  const bg = $("#findBloodFilter").value;
  const city = $("#findCityFilter").value.trim();
  const plateletsOnly = $("#findPlateletsFilter").checked;

  try {
    const params = new URLSearchParams();
    if (bg) params.set("blood_group", bg);
    if (city) params.set("city", city);
    if (plateletsOnly) params.set("platelets_only", "true");
    const donors = await api(`/api/donors?${params.toString()}`);

    if (donors.length === 0) {
      container.innerHTML = '<p class="empty">No donors match this filter yet.</p>';
      return;
    }
    container.innerHTML = donors.map(donorCardHtml).join("");
  } catch (e) {
    container.innerHTML = `<p class="empty">Couldn't load donors: ${escapeHtml(e.message)}</p>`;
  }
}

function donorCardHtml(d) {
  return `
    <div class="card">
      <div class="card__top">
        <span class="bg-badge">${d.blood_group}</span>
        <span class="status-pill status-pill--available">Available</span>
      </div>
      <h3>${escapeHtml(d.name)}</h3>
      <div class="card__meta">
        <span>${escapeHtml(d.city)}</span>
        ${d.can_donate_platelets ? "<span>Also donates platelets</span>" : ""}
        ${d.last_donated ? `<span>Last donated: ${escapeHtml(d.last_donated)}</span>` : ""}
      </div>
      <div class="card__footer">
        <div>
          <div class="card__phone">${escapeHtml(d.phone)}</div>
          <div class="card__time">Joined ${timeAgo(d.created_at)}</div>
        </div>
      </div>
    </div>
  `;
}

// ---------- forms ----------
function initRequestForm() {
  const form = $("#requestForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#requestMsg");
    msg.textContent = "";
    msg.className = "form__msg";

    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());

    try {
      await api("/api/requests", { method: "POST", body: JSON.stringify(payload) });
      msg.textContent = "Request posted — it's live on the Active Board now.";
      msg.classList.add("success");
      form.reset();
      $all(".urgency-opt", form).forEach((b) => b.classList.toggle("is-active", b.dataset.value === "Normal"));
      $('input[name="urgency"]', form).value = "Normal";
      loadStats();
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.add("error");
    }
  });
}

function initDonateForm() {
  const form = $("#donateForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#donateMsg");
    msg.textContent = "";
    msg.className = "form__msg";

    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    payload.can_donate_platelets = fd.get("can_donate_platelets") === "on";

    try {
      await api("/api/donors", { method: "POST", body: JSON.stringify(payload) });
      msg.textContent = "You're registered — thank you for being on the list.";
      msg.classList.add("success");
      form.reset();
      loadStats();
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.add("error");
    }
  });
}

// ---------- filter bars ----------
function initFilterBars() {
  $("#boardRefresh").addEventListener("click", loadBoard);
  $("#findRefresh").addEventListener("click", loadDonors);
  $("#boardCityFilter").addEventListener("keydown", (e) => { if (e.key === "Enter") loadBoard(); });
  $("#findCityFilter").addEventListener("keydown", (e) => { if (e.key === "Enter") loadDonors(); });
  $("#boardBloodFilter").addEventListener("change", loadBoard);
  $("#findBloodFilter").addEventListener("change", loadDonors);
  $("#findPlateletsFilter").addEventListener("change", loadDonors);
}

// ---------- init ----------
document.addEventListener("DOMContentLoaded", () => {
  populateBloodGroupSelects();
  initNav();
  initUrgencyPicker();
  initRequestForm();
  initDonateForm();
  initFilterBars();
  loadStats();

  // refresh the live ticker + stats periodically
  setInterval(loadStats, 30000);
});
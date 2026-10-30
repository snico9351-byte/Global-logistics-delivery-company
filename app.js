const trackForm = document.getElementById("track-form");
const result = document.getElementById("tracking-result");
document.getElementById("year").textContent = new Date().getFullYear();

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function prettyDate(value) {
  if (!value) return "Not provided";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? escapeHTML(value) : d.toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"});
}
trackForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = document.getElementById("tracking-code").value.trim();
  result.innerHTML = '<p class="muted">Looking up your shipment…</p>';
  try {
    const response = await fetch("/api/track/" + encodeURIComponent(code));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Tracking lookup failed.");
    const s = data.shipment;
    const history = (data.history || []).map(h => `<div class="history-row"><span class="history-dot"></span><div><b>${escapeHTML(h.status)}</b>${h.note ? `<div>${escapeHTML(h.note)}</div>` : ""}<small>${prettyDate(h.created_at)}</small></div></div>`).join("");
    result.innerHTML = `<div class="result-card">
      <div class="result-top"><div><div class="section-kicker">TRACKING NUMBER</div><b class="code">${escapeHTML(s.tracking_code)}</b></div><span class="status-pill">${escapeHTML(s.status)}</span></div>
      <div class="result-grid">
        <div><small>Parcel</small><b>${escapeHTML(s.item)}</b></div>
        <div><small>Recipient</small><b>${escapeHTML(s.recipient)}</b></div>
        <div><small>Destination</small><b>${escapeHTML(s.destination)}</b></div>
        <div><small>Expected delivery</small><b>${s.expected_delivery ? escapeHTML(s.expected_delivery) : "Not provided"}</b></div>
      </div>
      ${s.notes ? `<p class="muted">${escapeHTML(s.notes)}</p>` : ""}
      <div class="history"><div class="section-kicker">SHIPMENT UPDATES</div>${history || '<p class="muted">No updates have been added yet.</p>'}</div>
      <p class="muted small">Last updated: ${prettyDate(s.updated_at)}</p>
    </div>`;
  } catch (error) {
    result.innerHTML = `<div class="result-card"><b>Tracking information unavailable</b><p class="muted">${escapeHTML(error.message)}</p></div>`;
  }
});

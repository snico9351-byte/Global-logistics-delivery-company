const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const shipmentForm = document.getElementById("shipment-form");
const shipmentMessage = document.getElementById("shipment-message");
const shipmentList = document.getElementById("shipment-list");
const statusSelect = document.getElementById("status-select");
document.getElementById("year").textContent = new Date().getFullYear();

const esc = (v) => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function api(url, options={}) {
  const response = await fetch(url, { credentials:"same-origin", headers:{"Content-Type":"application/json",...(options.headers||{})}, ...options });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
function setMessage(el, message, success=false) {
  el.textContent = message;
  el.className = "form-message" + (success ? " success" : "");
}
async function loadStatuses() {
  const data = await api("/api/statuses");
  statusSelect.innerHTML = data.statuses.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join("");
}
async function checkSession() {
  try { await api("/api/admin/me"); showDashboard(); }
  catch { loginView.hidden=false; dashboardView.hidden=true; }
}
function showDashboard() { loginView.hidden=true; dashboardView.hidden=false; loadShipments(); }
loginForm.addEventListener("submit", async e=>{
  e.preventDefault(); setMessage(loginMessage,"Signing in…");
  const form = new FormData(loginForm);
  try {
    await api("/api/admin/login",{method:"POST",body:JSON.stringify({username:form.get("username"),password:form.get("password")})});
    loginForm.reset(); setMessage(loginMessage,""); showDashboard();
  } catch(err) { setMessage(loginMessage,err.message); }
});
document.getElementById("logout-button").addEventListener("click",async()=>{
  try{await api("/api/admin/logout",{method:"POST"});}catch{}
  dashboardView.hidden=true;loginView.hidden=false;
});
function resetForm() {
  shipmentForm.reset(); shipmentForm.elements.id.value="";
  document.getElementById("form-heading").textContent="Register a shipment";
  document.getElementById("save-button").textContent="Create shipment";
  document.getElementById("cancel-edit").hidden=true;
}
document.getElementById("cancel-edit").addEventListener("click",resetForm);
shipmentForm.addEventListener("submit",async e=>{
  e.preventDefault();setMessage(shipmentMessage,"Saving shipment…");
  const f=new FormData(shipmentForm), id=f.get("id");
  const payload=Object.fromEntries(["item","recipient","destination","tracking_code","status","expected_delivery","notes"].map(k=>[k,f.get(k)]));
  try{
    if(id){
      await api("/api/admin/shipments/"+id,{method:"PUT",body:JSON.stringify({status:payload.status,expected_delivery:payload.expected_delivery,notes:payload.notes})});
      setMessage(shipmentMessage,"Shipment update saved.",true);
    }else{
      const data=await api("/api/admin/shipments",{method:"POST",body:JSON.stringify(payload)});
      setMessage(shipmentMessage,"Shipment created. Tracking code: "+data.tracking_code,true);
    }
    resetForm();await loadShipments();
  }catch(err){setMessage(shipmentMessage,err.message);}
});
function editShipment(s){
  shipmentForm.elements.id.value=s.id;
  shipmentForm.elements.item.value=s.item;
  shipmentForm.elements.recipient.value=s.recipient;
  shipmentForm.elements.destination.value=s.destination;
  shipmentForm.elements.tracking_code.value=s.tracking_code;
  shipmentForm.elements.status.value=s.status;
  shipmentForm.elements.expected_delivery.value=s.expected_delivery||"";
  shipmentForm.elements.notes.value=s.notes||"";
  document.getElementById("form-heading").textContent="Update shipment";
  document.getElementById("save-button").textContent="Save update";
  document.getElementById("cancel-edit").hidden=false;
  window.scrollTo({top:0,behavior:"smooth"});
}
async function loadShipments(){
  shipmentList.innerHTML='<p class="muted">Loading shipments…</p>';
  try{
    const data=await api("/api/admin/shipments");
    if(!data.shipments.length){shipmentList.innerHTML='<p class="muted">No shipments yet. Register your first delivery using the form.</p>';return;}
    shipmentList.innerHTML=data.shipments.map(s=>`<article class="shipment-item">
      <h3>${esc(s.item)}</h3><div class="shipment-meta"><span class="code">${esc(s.tracking_code)}</span><br>Recipient: ${esc(s.recipient)}<br>Destination: ${esc(s.destination)}<br><span class="status-text">${esc(s.status)}</span></div>
      <div class="shipment-actions"><button class="button button-outline" data-edit="${s.id}">Edit / update</button><button class="button button-outline" data-copy="${esc(s.tracking_code)}">Copy code</button><button class="button button-outline" data-delete="${s.id}">Delete</button></div>
    </article>`).join("");
    shipmentList.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editShipment(data.shipments.find(s=>s.id===Number(b.dataset.edit)))));
    shipmentList.querySelectorAll("[data-copy]").forEach(b=>b.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);b.textContent="Copied!";}catch{b.textContent=b.dataset.copy;}}));
    shipmentList.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Delete this shipment and its update history?"))return;try{await api("/api/admin/shipments/"+b.dataset.delete,{method:"DELETE"});await loadShipments();}catch(err){alert(err.message);}}));
  }catch(err){shipmentList.innerHTML=`<p class="muted">${esc(err.message)}. Please sign in again.</p>`;}
}
document.getElementById("refresh-button").addEventListener("click",loadShipments);
(async()=>{try{await loadStatuses();await checkSession();}catch(e){setMessage(loginMessage,e.message);}})();

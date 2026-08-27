const $ = id => document.getElementById(id);
const PIN = "sopno2026"; // চাইলে এই পাসকোড বদলে দিন

let state = { org_name: "স্বপ্নযাত্রা", due_day: 10, members: [], contributions: [], investments: [] };
let currentAdminMonth = new Date().toISOString().slice(0, 7);

function checkPin() {
  if ($("pin").value === PIN) {
    $("lockWrap").classList.add("hidden");
    $("app").classList.remove("hidden");
    loadFromSite();
  } else {
    $("pinMsg").textContent = "পাসকোড ভুল হয়েছে।";
  }
}

async function loadFromSite() {
  try {
    const res = await fetch('data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('not found');
    state = await res.json();
    msg("loadMsg", "বর্তমান data.json লোড হয়েছে।", true);
  } catch (e) {
    msg("loadMsg", "সাইটে data.json পাওয়া যায়নি — খালি টেমপ্লেট থেকে শুরু হচ্ছে, অথবা \"ফাইল থেকে লোড করুন\" ব্যবহার করুন।", false);
  }
  normalizeState();
  populateForm();
}

function loadFromFile(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      state = JSON.parse(e.target.result);
      normalizeState();
      msg("loadMsg", "ফাইল থেকে লোড হয়েছে।", true);
      populateForm();
    } catch (err) {
      msg("loadMsg", "ফাইলটি সঠিক JSON না।", false);
    }
  };
  reader.readAsText(file);
}

function normalizeState() {
  state.members = state.members || [];
  state.contributions = state.contributions || [];
  state.investments = state.investments || [];
  state.due_day = state.due_day || 10;
  const months = [...new Set(state.contributions.map(c => c.month))].sort();
  currentAdminMonth = months.length ? months[months.length - 1] : currentAdminMonth;
}

function msg(id, text, ok) {
  const el = $(id);
  el.textContent = text;
  el.style.color = ok ? "var(--accent)" : "var(--danger)";
}

function populateForm() {
  $("orgName").value = state.org_name || "স্বপ্নযাত্রা";
  $("dueDay").value = state.due_day || 10;
  renderMembers();
  renderMonthPick();
  renderContribRows();
  renderInvestments();
}

/* ---------- MEMBERS ---------- */
function renderMembers() {
  $("memberRows").innerHTML = state.members.map((m, idx) => `
    <label>
      <input type="text" style="width:70px;flex:none" value="${m.serial_no}" onchange="updateMember(${idx},'serial_no',this.value)">
      <input type="text" style="flex:1" value="${escapeHtml(m.name)}" onchange="updateMember(${idx},'name',this.value)">
      <button class="secondary small-btn" style="flex:none" onclick="removeMember(${idx})">মুছুন</button>
    </label>
  `).join("") || "<p class='muted'>এখনো কোনো সদস্য নেই।</p>";
}
function updateMember(idx, field, val) {
  state.members[idx][field] = field === 'serial_no' ? Number(val) : val;
}
function addMember() {
  const nextSerial = state.members.length ? Math.max(...state.members.map(m => m.serial_no)) + 1 : 1;
  state.members.push({ serial_no: nextSerial, name: "" });
  renderMembers();
  renderContribRows();
}
function removeMember(idx) {
  state.members.splice(idx, 1);
  renderMembers();
  renderContribRows();
}

/* ---------- CONTRIBUTIONS / MONTHS ---------- */
function renderMonthPick() {
  const months = [...new Set(state.contributions.map(c => c.month))];
  if (!months.includes(currentAdminMonth)) months.push(currentAdminMonth);
  months.sort();
  $("monthPick").innerHTML = months.map(m => `<option value="${m}" ${m === currentAdminMonth ? 'selected' : ''}>${m}</option>`).join("");
}
function addMonth() {
  const val = $("newMonth").value;
  if (!val) { msg("loadMsg", "আগে একটা মাস বেছে নিন।", false); return; }
  currentAdminMonth = val;
  renderMonthPick();
  renderContribRows();
}

function copyFromPrevMonth() {
  const months = [...new Set(state.contributions.map(c => c.month))].filter(m => m < currentAdminMonth).sort();
  const prev = months[months.length - 1];
  if (!prev) { msg("loadMsg", "আগের কোনো মাসের ডেটা পাওয়া যায়নি।", false); return; }
  state.members.forEach(m => {
    const prevC = state.contributions.find(c => c.member_serial === m.serial_no && c.month === prev);
    if (!prevC) return;
    let cur = state.contributions.find(c => c.member_serial === m.serial_no && c.month === currentAdminMonth);
    if (!cur) {
      cur = { member_serial: m.serial_no, month: currentAdminMonth, expected_amount: prevC.expected_amount, amount: 0, paid_date: "", note: "" };
      state.contributions.push(cur);
    } else {
      cur.expected_amount = prevC.expected_amount;
    }
  });
  renderContribRows();
  msg("loadMsg", `"${prev}" মাসের নির্ধারিত চাঁদার পরিমাণ কপি হয়েছে। এখন কে দিয়েছে টিক/এন্ট্রি দিন।`, true);
}

function getOrCreateContrib(serial) {
  let c = state.contributions.find(x => x.member_serial === serial && x.month === currentAdminMonth);
  if (!c) {
    c = { member_serial: serial, month: currentAdminMonth, expected_amount: 1000, amount: 0, paid_date: "", note: "" };
    state.contributions.push(c);
  }
  return c;
}

function renderContribRows() {
  renderMonthPick();
  $("contribRows").innerHTML = state.members.map(m => {
    const c = getOrCreateContrib(m.serial_no);
    return `<tr>
      <td>${escapeHtml(m.name)}</td>
      <td><input type="number" value="${c.expected_amount}" style="width:90px" onchange="updateContrib(${m.serial_no},'expected_amount',this.value)"></td>
      <td><input type="number" value="${c.amount}" style="width:90px" onchange="updateContrib(${m.serial_no},'amount',this.value)"></td>
      <td><input type="date" value="${c.paid_date || ''}" onchange="updateContrib(${m.serial_no},'paid_date',this.value)"></td>
      <td><input type="text" value="${escapeHtml(c.note || '')}" placeholder="যেমন: অতিরিক্ত ৫০০" onchange="updateContrib(${m.serial_no},'note',this.value)"></td>
    </tr>`;
  }).join("") || "<tr><td colspan='5' class='muted'>আগে সদস্য যোগ করুন।</td></tr>";
}

function updateContrib(serial, field, val) {
  const c = getOrCreateContrib(serial);
  c[field] = (field === 'expected_amount' || field === 'amount') ? Number(val) : val;
}

document.addEventListener("change", e => {
  if (e.target.id === "monthPick") {
    currentAdminMonth = e.target.value;
    renderContribRows();
  }
});

/* ---------- INVESTMENTS ---------- */
function renderInvestments() {
  $("investRows").innerHTML = state.investments.map((inv, idx) => `
    <div class="panel" style="margin:12px 0;padding:16px">
      <div class="form-grid">
        <label>নাম<input value="${escapeHtml(inv.name)}" onchange="updateInvest(${idx},'name',this.value)"></label>
        <label>তারিখ<input type="date" value="${inv.date || ''}" onchange="updateInvest(${idx},'date',this.value)"></label>
        <label>বিনিয়োগের পরিমাণ<input type="number" value="${inv.amount || 0}" onchange="updateInvest(${idx},'amount',this.value)"></label>
        <label>বর্তমান মূল্য<input type="number" value="${inv.current_value || 0}" onchange="updateInvest(${idx},'current_value',this.value)"></label>
        <label>স্ট্যাটাস
          <select onchange="updateInvest(${idx},'status',this.value)">
            <option ${inv.status==='চলমান'?'selected':''}>চলমান</option>
            <option ${inv.status==='সমাপ্ত'?'selected':''}>সমাপ্ত</option>
            <option ${inv.status==='অপেক্ষমাণ'?'selected':''}>অপেক্ষমাণ</option>
          </select>
        </label>
        <label>নোট<input value="${escapeHtml(inv.note || '')}" onchange="updateInvest(${idx},'note',this.value)"></label>
      </div>
      <button class="secondary small-btn" onclick="removeInvestment(${idx})">মুছুন</button>
    </div>
  `).join("") || "<p class='muted'>এখনো কোনো বিনিয়োগ নেই।</p>";
}
function updateInvest(idx, field, val) {
  state.investments[idx][field] = (field === 'amount' || field === 'current_value') ? Number(val) : val;
}
function addInvestment() {
  state.investments.push({ name: "", date: "", amount: 0, current_value: 0, status: "চলমান", note: "" });
  renderInvestments();
}
function removeInvestment(idx) {
  state.investments.splice(idx, 1);
  renderInvestments();
}

/* ---------- EXPORT ---------- */
function buildFinalData() {
  state.org_name = $("orgName").value;
  state.due_day = Number($("dueDay").value) || 10;
  state.last_updated = new Date().toISOString().slice(0, 10);
  return state;
}
function generateJson() {
  const data = buildFinalData();
  $("jsonOut").value = JSON.stringify(data, null, 2);
  msg("genMsg", "তৈরি হয়েছে। এখন কপি করুন অথবা ডাউনলোড করুন।", true);
}
function copyJson() {
  if (!$("jsonOut").value) generateJson();
  $("jsonOut").select();
  document.execCommand("copy");
  msg("genMsg", "কপি হয়েছে!", true);
}
function downloadJson() {
  if (!$("jsonOut").value) generateJson();
  const blob = new Blob([$("jsonOut").value], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "data.json";
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch])); }

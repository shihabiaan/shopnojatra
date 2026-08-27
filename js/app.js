const $ = id => document.getElementById(id);
let members = [], contributions = [], investments = [], dueDay = 10;
let currentMonth = new Date().toISOString().slice(0, 7);

const money = n => "৳" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
const monthLabel = m => new Date(m + "-01").toLocaleDateString("bn-BD", { month: "long", year: "numeric" });
const dateLabel = d => d ? new Date(d + "T00:00:00").toLocaleDateString("bn-BD") : "—";
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch])); }

async function loadData() {
  try {
    const res = await fetch('data.json', { cache: 'no-store' });
    const data = await res.json();
    members = data.members || [];
    contributions = data.contributions || [];
    investments = data.investments || [];
    dueDay = data.due_day || 10;

    // pick the latest month that actually has contribution rows, else this real-world month
    const months = [...new Set(contributions.map(c => c.month))].sort();
    currentMonth = months.length ? months[months.length - 1] : currentMonth;

    render();
  } catch (e) {
    console.error(e);
    document.querySelector('main').insertAdjacentHTML('afterbegin',
      '<p class="muted">তথ্য লোড করা যায়নি — data.json ফাইলটি ঠিক আছে কিনা দেখুন।</p>');
  }
}

function render() {
  $("monthName").textContent = monthLabel(currentMonth);
  $("dueSmall").textContent = `পরিশোধের শেষ সময়: প্রতি মাসের ${dueDay} তারিখ`;
  $("dueBadge").textContent = `প্রতি মাসের ${dueDay} তারিখ`;

  const total = contributions.reduce((s, x) => s + Number(x.amount || 0), 0);
  const invested = investments.reduce((s, x) => s + Number(x.amount || 0), 0);
  $("totalContributions").textContent = money(total);
  $("totalInvestments").textContent = money(invested);
  $("cashBalance").textContent = money(total - invested);

  const monthRows = members.map(m => contributions.find(c => c.member_serial === m.serial_no && c.month === currentMonth));
  const paid = monthRows.filter(Boolean).length;
  $("paidCount").textContent = `${paid}/${members.length}`;

  $("paymentStatus").innerHTML = members.map((m, idx) => {
    const c = monthRows[idx];
    return `<div class="member-card"><strong>${escapeHtml(m.name)}</strong><small class="${c ? 'status-paid' : 'status-unpaid'}">${c ? '✓ জমা ' + money(c.amount) : '✕ এখনো জমা হয়নি'}</small></div>`;
  }).join("");

  const months = [...new Set(contributions.map(x => x.month))];
  if (!months.includes(currentMonth)) months.unshift(currentMonth);
  months.sort().reverse();
  $("monthFilter").innerHTML = months.map(x => `<option value="${x}" ${x === currentMonth ? 'selected' : ''}>${monthLabel(x)}</option>`).join("");
  renderContributions(currentMonth);

  $("investmentCards").innerHTML = investments.length
    ? investments.map(i => `<div class="investment"><h3>${escapeHtml(i.name)}</h3><div class="amount">${money(i.amount)}</div><p>তারিখ: ${dateLabel(i.date)}</p><p>বর্তমান মূল্য: ${money(i.current_value)}</p><p>${escapeHtml(i.status || "")}${i.note ? ' · ' + escapeHtml(i.note) : ''}</p></div>`).join("")
    : "<p class='muted'>এখনো কোনো বিনিয়োগ যোগ করা হয়নি।</p>";

  $("membersGrid").innerHTML = members.map(m => `<div class="member-card"><strong>${m.serial_no}. ${escapeHtml(m.name)}</strong><small>সদস্য</small></div>`).join("");
}

function renderContributions(month) {
  const rows = members.map(m => ({ m, c: contributions.find(c => c.member_serial === m.serial_no && c.month === month) }));
  $("contributionRows").innerHTML = rows.map(({ m, c }) => `<tr><td>${escapeHtml(m.name)}</td><td>${monthLabel(month)}</td><td>${money(c?.expected_amount ?? 1000)}</td><td>${money(c?.amount ?? 0)}</td><td>${dateLabel(c?.paid_date)}</td><td><span class="pill ${c ? 'paid' : 'unpaid'}">${c ? 'পরিশোধিত' : 'বাকি'}</span></td></tr>`).join("");
}

document.addEventListener('DOMContentLoaded', () => {
  $("monthFilter").addEventListener("change", e => { currentMonth = e.target.value; renderContributions(currentMonth); });
  loadData();
});

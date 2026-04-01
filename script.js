
// ── CONFIGURE YOUR WEBHOOK ─────────────────────────────────────
const WEBHOOK_URL = "https://aeoworkflow.duckdns.org/webhook/833893f0-440a-4dda-8159-592064010a3b";
// ──────────────────────────────────────────────────────────────

let allRows = [];
let charts = {};

Chart.defaults.color = "#7a907a";
Chart.defaults.font.family = "'DM Sans', sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = "#151515";
Chart.defaults.plugins.tooltip.borderColor = "#333";
Chart.defaults.plugins.tooltip.borderWidth = 1;

// Live URL pill preview
document.getElementById("urlsInput").addEventListener("input", function () {
    const urls = parseUrls(this.value);
    const el = document.getElementById("urlPills");
    el.innerHTML = "";
    urls.slice(0, 6).forEach(u => {
        const p = document.createElement("span");
        p.className = "url-pill";
        try { p.textContent = new URL(u).hostname + new URL(u).pathname; } catch { p.textContent = u; }
        el.appendChild(p);
    });
    if (urls.length > 6) {
        const m = document.createElement("span");
        m.className = "url-pill-more";
        m.textContent = ` +${urls.length - 6} more`;
        el.appendChild(m);
    }
});

function parseUrls(val) {
    return val.split(",").map(u => u.trim()).filter(u => u.length > 4);
}

// Clear
document.getElementById("clearBtn").addEventListener("click", () => {
    document.getElementById("brand").value = "";
    document.getElementById("urlsInput").value = "";
    document.getElementById("urlPills").innerHTML = "";
    document.getElementById("status").style.display = "none";
    document.getElementById("analysisSection").style.display = "none";
    Object.values(charts).forEach(c => c.destroy());
    charts = {}; allRows = [];
});

// Submit
document.getElementById("analyzeBtn").addEventListener("click", async () => {
    const btn = document.getElementById("analyzeBtn");
    const brand = document.getElementById("brand").value.trim();
    const urls = parseUrls(document.getElementById("urlsInput").value);

    if (!brand) { showStatus("error", "Please enter a Brand Name."); return; }
    if (!urls.length) { showStatus("error", "Please enter at least one URL."); return; }

    document.getElementById("analysisSection").style.display = "none";
    Object.values(charts).forEach(c => c.destroy());
    charts = {};

    btn.disabled = true;
    btn.classList.add("loading");
    showStatus("loading", `Sending ${urls.length} URL${urls.length > 1 ? "s" : ""} to webhook…`);

    try {
        const res = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            mode: "cors",
            body: JSON.stringify({ Brand: brand, URLs: urls }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            allRows = data;
            render(allRows);
            showStatus("success", `Done! ${data.length} row${data.length > 1 ? "s" : ""} returned.`);
        } else {
            showStatus("info", "Webhook responded but returned no rows.");
        }
    } catch (err) {
        if (WEBHOOK_URL.includes("YOUR_N8N")) {
            allRows = mockData(brand, urls);
            render(allRows);
            showStatus("info", "⚠ Demo mode — replace WEBHOOK_URL to go live. Showing sample data.");
        } else {
            showStatus("error", `Webhook error: ${err.message}`);
        }
    } finally {
        btn.disabled = false;
        btn.classList.remove("loading");
    }
});

// Render
function render(rows) {
    buildCharts(rows);
    populateFilters(rows);
    applyFilters();
    document.getElementById("analysisSection").style.display = "block";
    setTimeout(() => document.getElementById("analysisSection").scrollIntoView({ behavior: "smooth" }), 100);
}

// Filters
function populateFilters(rows) {
    const fill = (id, key) => {
        const sel = document.getElementById(id);
        const first = sel.options[0];
        sel.innerHTML = ""; sel.appendChild(first);
        [...new Set(rows.map(r => r[key]).filter(Boolean))].sort().forEach(v => {
            const o = document.createElement("option");
            o.value = v; o.textContent = v; sel.appendChild(o);
        });
        sel.onchange = applyFilters;
    };
    fill("filterPlatform", "Platform Name");
    fill("filterCategory", "Category");
    fill("filterSourceType", "Source Type");
    fill("filterUrlType", "URL Type");
}

function applyFilters() {
    const pf = document.getElementById("filterPlatform").value;
    const cf = document.getElementById("filterCategory").value;
    const sf = document.getElementById("filterSourceType").value;
    const uf = document.getElementById("filterUrlType").value;
    const filtered = allRows.filter(r =>
        (!pf || r["Platform Name"] === pf) &&
        (!cf || r["Category"] === cf) &&
        (!sf || r["Source Type"] === sf) &&
        (!uf || r["URL Type"] === uf)
    );
    renderTable(filtered);
    document.getElementById("filterCount").textContent = `Showing ${filtered.length} of ${allRows.length} rows`;
}

// Table
function renderTable(rows) {
    const tbody = document.getElementById("resultsBody");
    tbody.innerHTML = "";

    rows.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="cell-date">${esc(row["Date"] || "")}</td>
            <td class="cell-brand">${esc(row["Brand"] || "")}</td>
            <td class="cell-url" title="${esc(row["URL"] || "")}">${row["URL"]
                ? `<a href="${esc(row["URL"])}" target="_blank" rel="noopener">${shortUrl(row["URL"])}</a>`
                : "—"
            }</td>
            <td class="cell-title" title="${esc(row["Title"] || "")}">${esc(row["Title"] || "—")}</td>
            <td class="cell-long">${expandCell(row["Description"])}</td>
            <td class="cell-long cell-action">${expandCell(row["Action Point"])}</td>
            <td class="cell-long cell-gap">${expandCell(row["Gap Opportunity"])}</td>
            <td>${badge(row["Platform Name"], "badge-blue")}</td>
            <td>${badge(row["Source Type"], "badge-teal")}</td>
            <td>${badge(row["Category"], "badge-purple")}</td>
            <td>${badge(row["URL Type"], "badge-yellow")}</td>
          `;
        tbody.appendChild(tr);
    });

    // Expand click
    tbody.querySelectorAll(".expandable").forEach(el => {
        el.addEventListener("click", () => el.classList.toggle("open"));
    });

    // Update metric cards
    document.getElementById("metRows").textContent = rows.length;
    document.getElementById("metUrls").textContent = new Set(rows.map(r => r["URL"])).size;
    document.getElementById("metPlatforms").textContent = new Set(rows.map(r => r["Platform Name"]).filter(Boolean)).size;
    document.getElementById("metCategories").textContent = new Set(rows.map(r => r["Category"]).filter(Boolean)).size;
}

function badge(val, cls) {
    return val ? `<span class="badge ${cls}">${esc(val)}</span>` : `<span style="color:var(--text-muted)">—</span>`;
}

function expandCell(text) {
    if (!text) return `<span style="color:var(--text-muted)">—</span>`;
    const safe = esc(text);
    if (safe.length <= 55) return `<span>${safe}</span>`;
    return `<span class="expandable">
          <span class="short">${safe.slice(0, 55)}…</span>
          <span class="full">${safe}</span>
          <span class="expand-hint">click to expand</span>
        </span>`;
}

function shortUrl(url) {
    try { const u = new URL(url); return (u.hostname + u.pathname).replace(/\/$/, "").slice(0, 38); }
    catch { return url.slice(0, 38); }
}

function esc(s) {
    return String(s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Charts
function buildCharts(rows) {
    const axis = {
        grid: { color: "rgba(74,222,128,0.06)" },
        ticks: { color: "#7a907a" },
    };
    const palette = [
        "rgba(74,222,128,0.75)", "rgba(96,165,250,0.75)", "rgba(167,139,250,0.75)",
        "rgba(251,191,36,0.75)", "rgba(45,212,191,0.75)", "rgba(248,113,113,0.75)",
        "rgba(249,115,22,0.75)", "rgba(236,72,153,0.75)", "rgba(132,204,22,0.75)",
    ];

    const countBy = key => {
        const m = {};
        rows.forEach(r => { const v = r[key] || "Unknown"; m[v] = (m[v] || 0) + 1; });
        return Object.entries(m).sort((a, b) => b[1] - a[1]);
    };

    const bar = (id, entries) => {
        if (charts[id]) charts[id].destroy();
        charts[id] = new Chart(document.getElementById(id), {
            type: "bar",
            data: {
                labels: entries.map(e => e[0]),
                datasets: [{
                    label: "Rows", data: entries.map(e => e[1]),
                    backgroundColor: entries.map((_, i) => palette[i % palette.length]),
                    borderRadius: 4,
                }],
            },
            options: {
                indexAxis: "y",
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ...axis, beginAtZero: true, ticks: { ...axis.ticks, precision: 0 } },
                    y: { ...axis, grid: { display: false } },
                },
            },
        });
    };

    const doughnut = (id, entries) => {
        if (charts[id]) charts[id].destroy();
        charts[id] = new Chart(document.getElementById(id), {
            type: "doughnut",
            data: {
                labels: entries.map(e => e[0]),
                datasets: [{
                    data: entries.map(e => e[1]),
                    backgroundColor: entries.map((_, i) => palette[i % palette.length]),
                    borderColor: "#141714", borderWidth: 2,
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { padding: 14, font: { size: 11 }, usePointStyle: true, color: "#7a907a" },
                    },
                },
            },
        });
    };

    bar("platformChart", countBy("Platform Name").slice(0, 10));
    bar("categoryChart", countBy("Category").slice(0, 10));
    doughnut("sourceChart", countBy("Source Type"));
    doughnut("urlTypeChart", countBy("URL Type"));
}

function showStatus(type, msg) {
    const el = document.getElementById("status");
    el.className = type; el.innerHTML = msg; el.style.display = "block";
}

// Mock data for demo mode
function mockData(brand, urls) {
    const platforms = ["Google Search", "Reddit", "Quora", "LinkedIn", "YouTube", "Twitter/X", "Medium"];
    const sourceTypes = ["Organic", "Social", "Forum", "Video", "News", "Podcast"];
    const categories = ["Topical Authority", "Content Gap", "Competitor Mention", "FAQ", "How-To", "Listicle", "Case Study"];
    const urlTypes = ["Blog Post", "Landing Page", "Product Page", "Forum Thread", "Video", "Pillar Page"];
    const actions = [
        "Create a pillar page targeting this cluster",
        "Add internal links from supporting articles",
        "Publish a comparison article to capture mid-funnel traffic",
        "Expand thin content with an FAQ section",
        "Build a topic cluster around this keyword group",
        "Refresh outdated content and update publish date",
    ];
    const gaps = [
        "No content covering this subtopic exists on-site",
        "Competitor ranks top 3 — clear gap opportunity",
        "Missing structured data markup on this page type",
        "No supporting articles currently link to this URL",
        "Keyword cluster is underserved on this platform",
        "Search intent mismatch between content and query",
    ];

    const rows = [];
    const today = new Date().toISOString().slice(0, 10);
    urls.forEach(url => {
        const n = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < n; i++) {
            rows.push({
                "Date": today,
                "Brand": brand,
                "URL": url,
                "Title": `Sample Page Title — ${shortUrl(url)}`,
                "Description": "This description summarises the page and its topical relevance. Replace with real data from your n8n workflow.",
                "Action Point": actions[Math.floor(Math.random() * actions.length)],
                "Gap Opportunity": gaps[Math.floor(Math.random() * gaps.length)],
                "Platform Name": platforms[Math.floor(Math.random() * platforms.length)],
                "Source Type": sourceTypes[Math.floor(Math.random() * sourceTypes.length)],
                "Category": categories[Math.floor(Math.random() * categories.length)],
                "URL Type": urlTypes[Math.floor(Math.random() * urlTypes.length)],
            });
        }
    });
    return rows;
}
// Runs the page script against a stand-in browser, feeding it REAL Tesco data
// captured from the live API, plus pending and failed cases.
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const real = JSON.parse(fs.readFileSync(path.join(__dirname, "tesco_real.json"), "utf8"));
const hiring = JSON.parse(fs.readFileSync(path.join(__dirname, "hiring_real.json"), "utf8"));
const els = {};
function El(id) {
  return { id, value: "", innerHTML: "", textContent: "", dataset: {}, onsubmit: null,
    addEventListener(t, f) { if (t === "submit") this.onsubmit = f; },
    querySelectorAll() { return []; } };
}
global.document = { getElementById: id => els[id] || (els[id] = El(id)) };
let responses = {};
global.fetch = async url => {
  const hit = Object.keys(responses).find(k => url.includes(k));
  return { ok: hit !== undefined, status: hit ? 200 : 404, json: async () => (hit ? responses[hit] : {}) };
};
const api = new Function(script + "\n;return {showCompany, search, els: null};")();
const wait = () => new Promise(r => setTimeout(r, 40));
const submit = async q => { els.q = els.q || document.getElementById("q"); els.q.value = q; await document.getElementById("searchForm").onsubmit({ preventDefault() {} }); await wait(); };
const out = () => document.getElementById("out").innerHTML;
const sug = () => document.getElementById("suggest").innerHTML;
const checks = [];
const ok = (n, c) => checks.push([n, !!c]);
(async () => {
  // 1. Search finds Tesco and shows its real facts
  responses = { "companies/search": { results: [real] }, "company/tesco": real, "hiring-signals": hiring };
  await submit("Tesco");
  await wait();
  ok("Tesco name shown", out().includes("Tesco"));
  ok("real description shown", out().includes("Tesco PLC is a British"));
  ok("real headquarters shown", out().includes("Welwyn Garden City"));
  ok("key facts hidden until checked", !out().includes("Founded in 1919") && out().includes("Not shown yet"));
  ok("status says Researched", out().includes("Researched"));
  ok("website link present", out().includes("https://www.tesco.com"));
  ok("sources listed", out().includes("wikipedia.org"));
  const hire = () => document.getElementById("hiring").innerHTML;
  ok("hiring: open roles shown from real data", hire().includes("45"));
  ok("hiring: trend shown", hire().includes("Moderate growth"));
  ok("hiring: says these are adverts, not hires", hire().includes("not confirmed hires"));
  // 2. Pending company shows a clear researching state
  responses = { "companies/search": { results: [] }, "company/acme-co": { display_name: "Acme Co", status: "pending" } };
  await submit("Acme Co");
  ok("pending shows researching state", out().includes("We're researching Acme Co"));
  ok("no match offers to research it", sug().includes("Research"));
  // 3. Failed company is said plainly
  responses = { "companies/search": { results: [] }, "company/broken-ltd": { display_name: "Broken Ltd", status: "failed" } };
  await submit("Broken Ltd");
  ok("failed shows plain message", out().includes("couldn't research Broken Ltd"));
  // 3b. Unchecked claims from the summary are not shown; sections are labelled
  responses = { "companies/search": { results: [real] }, "company/tesco": real, "hiring-signals": hiring };
  await submit("Tesco");
  ok("unchecked market-share claim not shown", !out().includes("28%") && !out().includes("28.4%"));
  ok("unchecked ranking claim not shown", !out().includes("top 20"));
  ok("summary labelled as AI, not checked", out().includes("written by AI"));
  ok("brand section present", out().includes("Famous brands and products"));
  ok("Christmas advert search is labelled unchecked", out().includes("unchecked results"));
  ok("SWOT section present", out().includes("SWOT analysis"));
  ok("hiring says based on adverts, not a confidence grade", !out().includes("High confidence") && hire().includes("based on 45 job adverts"));
  // 4. Nothing invented: only real record text is shown
  ok("no invented claims", !/guaranteed|best in class/i.test(out()));
  const fails = checks.filter(([, p]) => !p);
  checks.forEach(([n, p]) => console.log((p ? "PASS " : "FAIL ") + n));
  console.log(fails.length ? `\n${fails.length} failed` : `\nAll ${checks.length} checks passed`);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log("ERROR", e.message); process.exit(1); });

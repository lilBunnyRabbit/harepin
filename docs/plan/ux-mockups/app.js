const one = (s, cap) => [{ v: "", frames: [[s, cap || ""]] }];
const k = t => "<kbd>" + t + "</kbd>";

const CONTRACT = [
  { id: "back", n: "C1", name: "One back control", L: "flow",
    facts: "<b>Rule:</b> one control, one spot, on every screen and overlay: the key-cap button, bottom left, opposite the main button. It names where it takes you. Esc on keys, B on pad, a tap on touch. Small links sit beside it; the title keeps the top left to itself.",
    picked: "B",
    variants: [{ v: "", frames: [["career", "", "b"]] }] },
  { id: "frame", n: "C2", name: "One frame, one main button", L: "flow",
    html: () =>
      '<div class="two"><div class="schema" role="img" aria-label="The shared frame and its spots">' +
      '<span style="left:3%;top:5%;width:16%;height:8%;justify-items:start">Title</span>' +
      '<span style="left:38%;top:5%;width:30%;height:8%">Stations, on the 5 roots only</span>' +
      '<span style="left:78%;top:5%;width:19%;height:8%">Online count, stars</span>' +
      '<span style="left:3%;top:17%;width:94%;height:62%">Content. The focused card has the cottontail outline.</span>' +
      '<span class="bk b" style="left:3%;top:84%;width:15%;height:11%">Back</span>' +
      '<span style="left:20%;top:84%;width:26%;height:11%">Small links</span>' +
      '<span class="pri" style="left:72%;top:84%;width:25%;height:11%">Main button</span></div>' +
      '<ol class="rules">' +
      "<li><b>Title:</b> top left, left-aligned, on every screen that has one.</li>" +
      "<li><b>Main button:</b> bottom right, the cottontail key-cap pill, one per screen. Its label is a verb and the thing: Race Round 3, Travel to Dune sea, Fit Race engine.</li>" +
      "<li><b>The focused card sets the label.</b> Moving focus never starts anything.</li>" +
      "<li><b>Small links</b> sit bottom left, next to back, each with its key. Never a second pill.</li>" +
      "<li><b>No tabs.</b> The station bar shows only on Home, Events, Garage, Online and Settings. A page behind a door shows its title instead, so there is never a second row.</li>" +
      "<li><b>Online count</b> sits top right on every screen, road and menu.</li>" +
      "<li><b>Road cards</b> use the same spots. The map and speed corners hide while a card with buttons is open.</li></ol></div>" },
  { id: "launch", n: "C3", name: "One way to start an event", L: "flow",
    html: () =>
      '<ol class="rules"><li><b>Every start goes through the start sheet:</b> the event, its place chip, star times and your car, already chosen.</li>' +
      "<li><b>Change car</b> is a small link on the sheet. It opens the car picker and comes back to the sheet.</li>" +
      "<li><b>Browsing, selecting and travelling never start a race.</b> Only the sheet's button does.</li>" +
      "<li><b>On another map</b> the button says Travel. The briefing loads the map and its Start lights up on arrival.</li>" +
      "<li><b>At a road flag</b> the sheet docks in the corner. You are driving, so start is a hold.</li></ol>" +
      '<div class="tw"><table><tr><th>You are at</th><th>You press</th><th>What opens</th><th>What starts it</th></tr>' +
      "<tr><td>Title, Home, Events · Series</td><td>" + k("Enter") + " Race Round 3</td><td>Start sheet</td><td>" + k("Enter") + " Start race</td></tr>" +
      "<tr><td>Career event, a run</td><td>" + k("Enter") + " Race Sand trail</td><td>Start sheet</td><td>" + k("Enter") + " Travel, then " + k("Enter") + " Start</td></tr>" +
      "<tr><td>Results</td><td>" + k("Enter") + " Next: Round 4</td><td>Start sheet, over the road</td><td>" + k("Enter") + " Start race</td></tr>" +
      "<tr><td>A flag on the road</td><td>Stop at it</td><td>Start sheet, docked</td><td>Hold " + k("Enter") + ". A tap changes car</td></tr>" +
      "<tr><td>Road map, Maps</td><td>" + k("Enter") + " Go to flag</td><td>You stand at the flag, sheet docked</td><td>Hold " + k("Enter") + "</td></tr></table></div>" },
  { id: "flow", n: "C4", name: "The journey", L: "flow",
    html: () => {
      const row = (label, steps) => '<div class="flowrow"><b>' + label + '</b><div class="flow">' + steps.map(([n, l, d, m]) => '<span class="node ' + l + (m ? " main" : "") + '">' + n + (d ? "<small>" + d + "</small>" : "") + "</span>").join('<span class="arrow">→</span>') + "</div></div>";
      return '<div style="display:grid;gap:14px">' +
        row("Series spine", [["Title", "S", "Race Round 3", 1], ["Start sheet", "S", "car chosen", 1], ["Briefing", "R", "only on another map"], ["Race", "R", "", 1], ["Results", "R", "Next: Round 4", 1], ["Start sheet", "R", "over the road", 1], ["Round 6", "R", ""], ["Series final", "R", "podium, rewards", 1]]) +
        row("Keep driving", [["Results", "R", "Esc"], ["Road", "R", "Next up ticket"], ["Flag", "R", "sheet docks, hold to start"], ["Race", "R", ""], ["Results", "R", ""]]) +
        row("Something else", [["Road or results", "R", "pause, then a station"], ["Events", "S", "Series, Career, Runs"], ["Start sheet", "S", ""], ["Race", "R", ""]]) +
        row("First boot", [["Road", "R", "HOLD W, 3 goals"], ["First flag", "R", ""], ["Results", "R", "Next: Series Round 1"]]) +
        '<p class="facts"><span><span class="tag t-road">Road</span> while the car can move</span><span><span class="tag t-show">Showroom</span> the menu</span><span>A race never ends in the menu. You never have to visit Home between races.</span></p></div>';
    } },
];

const SCREENS = [
  { id: "hud", n: "01", name: "Driving HUD", L: "road", pri: "none, you are driving", back: "pause button, top right", variants: one("hud", "Phone keeps the driving controls and one pause button.") },
  { id: "hudmap", n: "01a", name: "HUD minimap", L: "road", rec: ["B", "at corner-card size the terrain turns to noise; the bare line shows the lap, the next gate and the cars in one glance."],
    variants: [
      { v: "A", name: "Realistic", text: "The terrain map, cropped around you. What the HUD shows now.", frames: [["hud", ""]] },
      { v: "B", name: "Race line only", text: "The whole route as one line on the card: you, the next gate, the finish and the other cars.", frames: [["hudLine", ""]] },
      { v: "C", name: "Close-up", text: "Zoomed in and turned to face the way you drive: the next corners, side roads and the cars near you.", frames: [["hudClose", ""]] },
    ] },
  { id: "hudspd", n: "01b", name: "HUD speedometer", L: "road", rec: ["A", "the bar card stays small on a phone and mirrors the map card; the dial is the Classic layout kept as a setting."],
    variants: [
      { v: "A", name: "Bar card", text: "Speed, gear and a rev bar. What the HUD shows now.", frames: [["hud", ""]] },
      { v: "B", name: "Circular dial", text: "The dial from the Classic HUD: one thick rev arc with the red zone, speed in the middle, gear under it.", frames: [["hudDial", ""]] },
    ] },
  { id: "roam", n: "02", name: "Free roam with the Next up ticket", L: "road", pri: "none", back: "pause button", variants: one("roam", "The ticket points at the next Series round. The online count sits by the pause button.") },
  { id: "gate", n: "03", name: "Event flag", L: "road", pri: "hold Enter: Start in Sturm", back: "Road, or just drive away", variants: one("gate", "The start sheet, docked. Your pick was Enter for car choice and hold for quick start. The pill carries the hold, Change car is the small link.") },
  { id: "rmap", n: "04", name: "Road map", L: "road", pri: "Go to flag", back: "Road", variants: one("rmap") },
  { id: "pause", n: "05", name: "Pause", L: "road", pri: "the focused row, Resume first", back: "Resume", variants: one("pause", "The same panel in free roam; the run card and Restart, Leave show only in an event.") },
  { id: "results", n: "06", name: "Results", L: "road", pri: "Next: Round 4, opens the start sheet", back: "Road, keep driving",
    picked: "B", variants: one("resB", "Full board: the place, the full Series standings and the next round each get a third of the screen.") },
  { id: "final", n: "07", name: "Series final", L: "road", pri: "Next series: Alpine", back: "Road", variants: one("final", "After round 6. Your car on the podium, final standings left, rewards right.") },
  { id: "travel", n: "08", name: "Travel briefing", L: "road", pri: "Start, lit when the map is ready", back: "none, travel has begun", variants: one("travel", "The loader is the event briefing. Shown at 72%; the button fills in when the flags are placed.") },
  { id: "first", n: "09", name: "First run", L: "road", pri: "none, hold W", back: "pause button", variants: one("first", "No wizard. Three steps on the road, then the First steps goals take over: each is a toast in the same ticket card, and the Guide keeps the whole list.") },
  { id: "meet", n: "10", name: "Online meet at the pad", L: "road", pri: "Ready", back: "Drive off", variants: one("meet", "The online button keeps its own colour. Total players online in the top right corner.") },
  { id: "title", n: "11", name: "Title", L: "show", pri: "Race Round 3", back: "none", variants: one("title", "Drive Island is one link away.") },
  { id: "home", n: "12", name: "Home", L: "show", pri: "Race Round 3", back: "Road", variants: one("home", "One ticket with its reasons. The three other things to do are small cards under it.") },
  { id: "events", n: "13", name: "Events", L: "show", pri: "Race Round 3", back: "Road", variants: one("events", "The Series is the page. Career and Runs are doors that show what is behind them: the five tiers, and the daily, weekly and random run. Free modes is a link.") },
  { id: "career", n: "14", name: "Career, behind its door", L: "show", pri: "Race Sand trail", back: "Events", variants: one("career", "Tiers on top, the open tier's events by map under them. No station bar here, only the title.") },
  { id: "sheet", n: "15", name: "Start sheet", L: "show", pri: "Travel to Dune sea, or Start race when it is here", back: "Career", variants: one("sheet", "One card on a dimmed scene, nothing behind it. Change car is the small link in the car row.") },
  { id: "picker", n: "16", name: "Car picker", L: "show", pri: "Take Sturm", back: "the sheet that opened it", variants: one("picker", "One grid in class order, no class tabs. Every car shows whole in its card; the focused car is big on the right. Q and E jump to the next class. Cars over the limit stay visible but dimmed.") },
  { id: "garage", n: "17", name: "Garage", L: "show", pri: "Fit Race engine", back: "Road", variants: one("garage", "Parts are cards: slot icon, part name, what it does, and whether it is fitted, owned or its price.") },
  { id: "maps", n: "18", name: "Maps", L: "show", pri: "Travel to Dune sea", back: "Home", variants: one("maps") },
  { id: "make", n: "19", name: "Make a map", L: "show", pri: "Drive this map", back: "Maps", variants: one("make", "Custom values sit under the map code: size, hills, towns, roads.") },
  { id: "runs", n: "20", name: "Runs, behind its door", L: "show", pri: "Run Crater ring", back: "Events", variants: one("runs", "The season bar on top, the runs under it. No tabs.") },
  { id: "online", n: "21", name: "Online", L: "show", pri: "Join, or Ready in your room", back: "Road",
    picked: "A", variants: one("onA", "One list. Each room is a heading with its map, count and whether a race is running; its players sit under it with flags and Join.") },
  { id: "settings", n: "22", name: "Settings", L: "show", pri: "Open a section, then Change", back: "Road from the list, Settings from a section",
    picked: "A", variants: [{ v: "", frames: [["setA1", "Step 1: the section list as cards, each showing what is set now."], ["setA2", "Step 2: the section, with back to Settings."]] }] },
  { id: "guide", n: "23", name: "Guide and the merged pages", L: "show", pri: "Open the focused topic", back: "Settings", variants: one("guide", "Where onboarding lands: First steps progress on top, the picture topics under it as the reference to come back to. Things to try is one of them. What's new and Support are Settings sections. Modes sit behind the Free modes link on Events.") },
];

const ALL = [...CONTRACT, ...SCREENS];
let state = { v: {}, notes: {} };
let ref = null, writing = false, again = false, timer = 0, view = "b";
const $ = s => document.querySelector(s);
const setSync = t => { $("#sync").textContent = t; };
const escq = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function shots(key, fb) {
  return '<div class="pair"><div class="shot"><div class="fw d">' + S[key]("d", fb) + '</div><small>Desktop 16:9</small></div><div class="shot"><div class="fw p">' + S[key]("p", fb) + "</div><small>Phone 844 × 390</small></div></div>";
}

function section(s) {
  const tag = s.L === "road" ? '<span class="tag t-road">Road</span>' : s.L === "show" ? '<span class="tag t-show">Showroom</span>' : '<span class="tag t-flow">Contract</span>';
  const two = s.variants && s.variants.length > 1;
  const body = s.html ? s.html() : s.variants.map(v =>
    '<div class="var">' +
    (two ? '<div class="var-head"><h3>' + v.v + " · " + v.name + "</h3>" + (s.rec && s.rec[0] === v.v ? '<span class="badge">Designer pick</span>' : "") + "<p>" + v.text + "</p></div>" : "") +
    v.frames.map(([key, cap, fb]) => (two && cap ? '<h3 style="font-weight:600;font-size:13px">' + cap + "</h3>" : "") + shots(key, fb) + (!two && cap ? '<p class="facts">' + cap + "</p>" : "")).join("") +
    "</div>").join("");
  const btns = two
    ? s.variants.map(v => '<button type="button" class="v" id="v-' + s.id + "-" + v.v + '" data-id="' + s.id + '" data-val="' + v.v + '" aria-pressed="false">Approve ' + v.v + "</button>").join("")
    : '<button type="button" class="v" id="v-' + s.id + '-ok" data-id="' + s.id + '" data-val="' + (s.picked || "ok") + '" aria-pressed="false">Approve</button>';
  return '<section class="sec" id="' + s.id + '">' +
    '<div class="sec-head"><span class="n">' + s.n + "</span><h2>" + s.name + "</h2>" + tag + "</div>" +
    (s.facts ? '<p class="facts"><span>' + s.facts + "</span></p>" : "") +
    (s.pri ? '<p class="facts"><span><b>Main button:</b> ' + s.pri + "</span><span><b>Back:</b> " + s.back + "</span></p>" : "") +
    (s.rec ? '<p class="why"><b>Designer pick ' + s.rec[0] + ":</b> " + s.rec[1] + "</p>" : "") +
    body +
    '<div class="verdict"><div class="btns">' + btns + '<button type="button" class="v chg" id="v-' + s.id + '-chg" data-id="' + s.id + '" data-val="change" aria-pressed="false">Change</button></div>' +
    '<textarea id="note-' + s.id + '" data-note="' + s.id + '" placeholder="What to change on ' + escq(s.name) + '" aria-label="Note on ' + escq(s.name) + '"></textarea></div>' +
    "</section>";
}

function build() {
  $("#toc").innerHTML = ALL.map(s => '<a href="#' + s.id + '" data-toc="' + s.id + '">' + s.n + " " + s.name + "</a>").join("");
  $("#secs").innerHTML = '<p class="group">The contract</p>' + CONTRACT.map(section).join("") + '<p class="group">Every screen</p>' + SCREENS.map(section).join("");
}

function render() {
  for (const b of document.querySelectorAll("button.v")) b.setAttribute("aria-pressed", String(state.v[b.dataset.id] === b.dataset.val));
  for (const a of document.querySelectorAll("[data-toc]")) {
    const x = state.v[a.dataset.toc];
    a.classList.toggle("done", !!x && x !== "change");
    a.classList.toggle("chg", x === "change");
  }
  for (const t of document.querySelectorAll("[data-note]")) if (document.activeElement !== t) t.value = state.notes[t.dataset.note] ?? "";
  document.documentElement.dataset.back = view;
  const done = ALL.filter(s => state.v[s.id]).length;
  if (ref) setSync(done + " of " + ALL.length + " answered. Saved as you go.");
}

function save() { clearTimeout(timer); timer = setTimeout(flush, 500); }
async function flush() {
  if (!ref) { setSync("Not saved: the store is unavailable here."); return; }
  if (writing) { again = true; return; }
  writing = true;
  try { await ref.set({ ...state, at: Date.now() }); }
  catch (e) { setSync("Could not save: " + (e?.message ?? e)); }
  writing = false;
  if (again) { again = false; flush(); }
}

function fit() {
  for (const w of document.querySelectorAll(".fw")) w.style.setProperty("--k", String(w.clientWidth / (w.classList.contains("p") ? 844 : 1280)));
}

function zoom(fr) {
  const p = fr.classList.contains("p");
  const W = p ? 844 : 1280, H = p ? 390 : 720;
  const vw = window.innerWidth, vh = window.innerHeight;
  const turn = vh > vw;
  const kk = (turn ? Math.min(vh / W, vw / H) : Math.min(vw / W, vh / H)) * 0.98;
  const box = $("#lbw");
  box.style.width = (turn ? H : W) * kk + "px";
  box.style.height = (turn ? W : H) * kk + "px";
  box.innerHTML = fr.outerHTML;
  box.firstElementChild.style.transform = turn ? "translateX(" + H * kk + "px) rotate(90deg) scale(" + kk + ")" : "scale(" + kk + ")";
  $("#lb").showModal();
}

document.addEventListener("click", e => {
  if (e.target.closest("#lb")) { $("#lb").close(); return; }
  const b = e.target.closest("button.v");
  if (b) {
    const id = b.dataset.id;
    state.v[id] = state.v[id] === b.dataset.val ? null : b.dataset.val;
    if (id === "back" && (state.v.back === "A" || state.v.back === "B")) view = state.v.back.toLowerCase();
    render(); save();
    return;
  }
  const fr = e.target.closest(".fw > .fr");
  if (fr) zoom(fr);
});
document.addEventListener("input", e => { const id = e.target.dataset?.note; if (id) { state.notes[id] = e.target.value; save(); } });

build(); render(); fit();
new ResizeObserver(fit).observe($("#secs"));

(async () => {
  const guard = setTimeout(() => setSync("The store did not answer; answers stay in this view."), 10000);
  try {
    const db = await window.claude?.use?.("db");
    clearTimeout(guard);
    if (!db) { setSync("Store unavailable here; answers stay in this view."); return; }
    ref = db.doc("picks/ux-r5");
    const snap = await ref.get();
    const d = snap?.data ?? snap;
    if (d && typeof d === "object") {
      if (d.v && typeof d.v === "object") for (const [id, x] of Object.entries(d.v)) if (x === "ok" || x === "change" || x === "A" || x === "B" || x === "C") state.v[id] = x;
      if (d.notes && typeof d.notes === "object") for (const [id, x] of Object.entries(d.notes)) if (typeof x === "string") state.notes[id] = x;
    }
    if (state.v.back === "A" || state.v.back === "B") view = state.v.back.toLowerCase();
    render();
  } catch (e) { clearTimeout(guard); setSync("Could not load: " + (e?.message ?? e)); }
})();

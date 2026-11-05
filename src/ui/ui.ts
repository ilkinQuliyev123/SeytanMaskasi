import { T } from "../i18n/az";
import { UNITS, WEAPONS, PLAYER_WEAPONS, type GameMap, type ArmySetup } from "../game/data";

const root = () => document.getElementById("ui")!;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = "", parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  parent?.appendChild(e);
  return e;
}
function btn(text: string, fn: () => void, parent: HTMLElement, cls = ""): HTMLButtonElement {
  const b = el("button", cls, text, parent);
  b.onclick = fn;
  return b;
}
function screen(cls = ""): HTMLElement {
  const r = root();
  r.innerHTML = "";
  return el("div", "screen " + cls, "", r);
}

const MASK = `<svg class="mask" viewBox="0 0 200 260" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
<path d="M52 70 L30 6 L84 48 M148 70 L170 6 L116 48"/><path d="M100 36 C146 36 170 72 166 120 C164 170 140 226 100 254 C60 226 36 170 34 120 C30 72 54 36 100 36Z"/>
<path d="M48 98 Q76 84 90 112 Q66 124 48 98Z M152 98 Q124 84 110 112 Q134 124 152 98Z"/><path d="M60 60 L84 76 M140 60 L116 76 M100 40 V84"/>
<path d="M58 176 Q100 160 142 176 Q100 214 58 176Z M72 176 V190 M86 172 V198 M100 170 V204 M114 172 V198 M128 176 V190"/></svg>`;
const ICON = {
  enemy: `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/><path d="M8 1v4M8 11v4M1 8h4M11 8h4"/></svg>`,
  squad: `<svg viewBox="0 0 16 16"><circle cx="8" cy="5" r="2.5"/><path d="M3 14c0-3 2-5 5-5s5 2 5 5"/></svg>`,
  fort: `<svg viewBox="0 0 16 16"><path d="M2 14V5h2v2h2V5h4v2h2V5h2v9zM6 14v-4h4v4"/></svg>`,
};
const ARTS = [
  "radial-gradient(circle at 70% 25%,#a4161c,transparent 55%), linear-gradient(160deg,#2a0a10,#0b0b0d 60%)",
  "radial-gradient(circle at 30% 25%,#2a5a7a,transparent 55%), linear-gradient(160deg,#0d1620,#0b0b0d 60%)",
  "radial-gradient(circle at 60% 20%,#b8903c,transparent 55%), linear-gradient(160deg,#1c1608,#0b0b0d 60%)",
  "radial-gradient(circle at 40% 30%,#3a7a4a,transparent 55%), linear-gradient(160deg,#0e1a12,#0b0b0d 60%)",
];

export function clearUi(): void { root().innerHTML = ""; }

export function mainMenu(onPlay: () => void): void {
  const s = screen();
  s.insertAdjacentHTML("afterbegin", MASK);
  el("h1", "", T.title, s);
  el("div", "sub", T.subtitle, s);
  el("div", "", "", s).style.height = "4vh";
  btn(T.maps, onPlay, s);
  el("div", "help", T.controls, s);
  el("div", "ver", T.version, s);
}

export function mapsMenu(maps: GameMap[], onPick: (m: GameMap) => void, onBack: () => void): void {
  const s = screen();
  el("h2", "", T.chooseMap, s);
  const cards = el("div", "cards", "", s);
  maps.forEach((m, i) => {
    const c = el("button", "card", "", cards);
    c.style.setProperty("--art", ARTS[i % ARTS.length]);
    el("span", "no", String(i + 1).padStart(2, "0"), c);
    el("b", "", m.name, c);
    el("span", "txt", m.desc, c);
    if (!m.ready) { c.disabled = true; el("span", "badge", T.soon, c); } else c.onclick = () => onPick(m);
  });
  btn(T.back, onBack, s, "ghost");
}

export function setupMenu(map: GameMap, st: ArmySetup, onStart: (s: ArmySetup) => void, onBack: () => void): void {
  const s = screen();
  el("h2", "", map.name, s);
  el("div", "sub", T.setupTitle, s);
  const panel = el("div", "panel", "", s);
  let p = el("div", "col", "", panel);

  const range = (label: string, min: number, max: number, v: number, step = 1) => {
    el("label", "", label, p);
    const w = el("div", "rg", "", p);
    const i = el("input", "", "", w);
    i.type = "range"; i.min = String(min); i.max = String(max); i.step = String(step); i.value = String(v);
    const l = el("span", "val", String(v), w);
    i.oninput = () => (l.textContent = i.value);
    return i;
  };
  const select = (label: string, ids: string[], cur: string) => {
    el("label", "", label, p);
    const sel = el("select", "", "", p);
    for (const id of ids) {
      const o = el("option", "", WEAPONS[id].name, sel);
      o.value = id; o.selected = id === cur;
    }
    return sel;
  };

  const sam = range(T.samurai, 0, 50, st.samurai);
  const nin = range(T.ninja, 0, 50, st.ninja);
  const sw = select(T.samuraiWeapon, UNITS.samurai.weapons, st.samuraiWeapon);
  const nw = select(T.ninjaWeapon, UNITS.ninja.weapons, st.ninjaWeapon);
  p = el("div", "col", "", panel);
  const en = range(T.enemies, 50, 800, st.enemies, 50);

  el("label", "", T.myWeapons, p);
  const wl = el("div", "wlist", "", p);
  PLAYER_WEAPONS.forEach((id, i) => { const d = el("div", "", "", wl); el("b", "", String(i + 1), d); d.append(WEAPONS[id].name); });

  const row = el("div", "row", "", s);
  btn(T.start, () => onStart({
    samurai: +sam.value, ninja: +nin.value, samuraiWeapon: sw.value, ninjaWeapon: nw.value,
    enemies: +en.value, weapons: [...PLAYER_WEAPONS],
  }), row, "go");
  btn(T.back, onBack, row, "ghost");
}

export function pauseMenu(onResume: () => void, onQuit: () => void): void {
  const s = screen("clear");
  el("h1", "", T.paused, s);
  btn(T.resume, onResume, s);
  btn(T.toMenu, onQuit, s, "ghost");
  el("div", "help", T.controls, s);
}

export function endScreen(won: boolean, onMenu: () => void): void {
  const s = screen("clear");
  el("h1", won ? "win" : "lose", won ? T.win : T.lose, s);
  el("div", "sub", won ? T.winSub : T.loseSub, s);
  btn(T.toMenu, onMenu, s);
}

export interface HudState {
  hp: number; maxHp: number; weapon: string; ammo: number; mag: number; reloading: boolean;
  hour: number; weather: string; enemiesLeft: number; enemiesTotal: number; allies: number;
  form: { name: string; left: number; color: string } | null;
  cooldowns: { name: string; cd: number }[]; fps: number; msg: string;
  forts: { cleared: number; total: number }; scope: 0 | 1 | 2;
}

export function createHud(): { update(s: HudState): void; destroy(): void } {
  const r = root();
  r.innerHTML = "";
  const h = el("div", "hud", "", r);
  const tl = el("div", "tl glass", "", h);
  const tlT = el("b", "", "", tl), tlW = el("span", "", "", tl);
  const tr = el("div", "tr glass", "", h);
  const stat = (icon: string, label: string) => {
    const d = el("div", "", "", tr);
    d.insertAdjacentHTML("afterbegin", icon);
    el("span", "", label, d);
    return el("b", "", "", d);
  };
  const trE = stat(ICON.enemy, T.enemy), trS = stat(ICON.squad, T.squad), trF = stat(ICON.fort, T.forts);
  const bl = el("div", "bl glass", "", h);
  const hpt = el("div", "hpt", "", bl);
  el("span", "", T.hp, hpt);
  const hpv = el("b", "", "", hpt);
  const bar = el("div", "bar", "", bl);
  const fill = el("i", "", "", bar);
  const br = el("div", "br glass", "", h);
  const wname = el("small", "", "", br);
  const ammo = el("span", "am", "", br);
  const form = el("div", "form", "", h);
  const cds = el("div", "cds", "", h);
  const fps = el("div", "fps", "", h);
  const msg = el("div", "msg", "", h);
  const cross = el("div", "cross", "", h);
  el("i", "", "", cross);
  const scope = el("div", "scope", "", h);
  el("i", "", "", scope); el("i", "", "", scope); el("b", "", "", scope);
  let lastScope = -1;

  const set = (e: HTMLElement, t: string) => { if (e.textContent !== t) e.textContent = t; };
  // rebuild a node's children only when its key changes
  const keyed = (e: HTMLElement, k: string, build: () => void) => { if (e.dataset.k !== k) { e.dataset.k = k; e.textContent = ""; build(); } };
  return {
    update(s) {
      const hp = Math.max(0, Math.ceil(s.hp));
      keyed(hpv, `${hp}/${s.maxHp}`, () => { hpv.append(String(hp)); el("i", "", ` / ${s.maxHp}`, hpv); });
      fill.style.width = Math.max(0, Math.min(100, (s.hp / s.maxHp) * 100)).toFixed(1) + "%";
      set(wname, s.weapon);
      br.classList.toggle("rl", s.reloading);
      keyed(ammo, s.reloading ? "r" : `${s.ammo}/${s.mag}`, () => {
        if (s.reloading) ammo.textContent = T.reloading;
        else if (s.mag === 0) ammo.textContent = "—";
        else { ammo.append(String(s.ammo)); el("i", "", `/ ${s.mag}`, ammo); }
      });
      const hh = Math.floor(s.hour) % 24, mm = Math.floor((s.hour % 1) * 60);
      set(tlT, `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
      set(tlW, s.weather);
      set(trE, `${s.enemiesLeft}/${s.enemiesTotal}`);
      set(trS, String(s.allies));
      set(trF, `${s.forts.cleared}/${s.forts.total}`);
      set(form, s.form ? `${s.form.name} · ${Math.ceil(s.form.left)} s` : "");
      form.classList.toggle("on", !!s.form);
      form.style.color = s.form ? s.form.color : "";
      const act = s.cooldowns.filter(c => c.cd > 0);
      keyed(cds, act.map(c => `${c.name}:${Math.ceil(c.cd)}`).join("|"), () => {
        for (const c of act) { const d = el("div", "", c.name, cds); el("b", "", `${Math.ceil(c.cd)} s`, d); }
      });
      if (s.scope !== lastScope) {
        lastScope = s.scope;
        scope.classList.toggle("on", s.scope === 2);
        cross.classList.toggle("off", s.scope === 2);
        cross.classList.toggle("tight", s.scope === 1);
      }
      set(fps, `${T.fps} ${Math.round(s.fps)}`);
      set(msg, s.msg);
      msg.classList.toggle("on", !!s.msg);
    },
    destroy() { h.remove(); },
  };
}

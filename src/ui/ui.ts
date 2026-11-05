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

export function clearUi(): void { root().innerHTML = ""; }

export function mainMenu(onPlay: () => void): void {
  const s = screen();
  el("h1", "", T.title, s);
  el("div", "sub", T.subtitle, s);
  btn(T.maps, onPlay, s);
  el("div", "help", T.controls, s);
}

export function mapsMenu(maps: GameMap[], onPick: (m: GameMap) => void, onBack: () => void): void {
  const s = screen();
  el("h2", "", T.chooseMap, s);
  const cards = el("div", "cards", "", s);
  for (const m of maps) {
    const c = el("button", "card", "", cards);
    el("b", "", m.name, c);
    c.appendChild(document.createTextNode(m.desc));
    if (!m.ready) { c.disabled = true; el("span", "badge", T.soon, c); } else c.onclick = () => onPick(m);
  }
  btn(T.back, onBack, s, "ghost");
}

export function setupMenu(map: GameMap, st: ArmySetup, onStart: (s: ArmySetup) => void, onBack: () => void): void {
  const s = screen();
  el("h2", "", map.name, s);
  el("div", "sub", T.setupTitle, s);
  const p = el("div", "panel", "", s);

  const range = (label: string, min: number, max: number, v: number, step = 1) => {
    el("label", "", label, p);
    const w = el("div", "", "", p);
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
  const en = range(T.enemies, 50, 800, st.enemies, 50);

  el("label", "", T.myWeapons, p);
  const wl = el("div", "wlist", "", p);
  PLAYER_WEAPONS.forEach((id, i) => el("div", "", `${i + 1}. ${WEAPONS[id].name}`, wl));

  const row = el("div", "row", "", s);
  btn(T.back, onBack, row, "ghost");
  btn(T.start, () => onStart({
    samurai: +sam.value, ninja: +nin.value, samuraiWeapon: sw.value, ninjaWeapon: nw.value,
    enemies: +en.value, weapons: [...PLAYER_WEAPONS],
  }), row);
}

export function pauseMenu(onResume: () => void, onQuit: () => void): void {
  const s = screen("clear");
  el("h2", "", T.paused, s);
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
  const tl = el("div", "tl", "", h);
  const tr = el("div", "tr", "", h);
  const bl = el("div", "bl", "", h);
  const hpt = el("div", "hpt", "", bl);
  const bar = el("div", "bar", "", bl);
  const fill = el("i", "", "", bar);
  const br = el("div", "br", "", h);
  const wname = el("small", "", "", br);
  const ammo = el("span", "", "", br);
  const form = el("div", "form", "", h);
  const cds = el("div", "cds", "", h);
  const fps = el("div", "fps", "", h);
  const msg = el("div", "msg", "", h);
  const cross = el("div", "cross", "", h);
  const scope = el("div", "scope", "", h);
  el("i", "", "", scope); el("i", "", "", scope); el("b", "", "", scope);
  let lastScope = -1;

  const set = (e: HTMLElement, t: string) => { if (e.textContent !== t) e.textContent = t; };
  return {
    update(s) {
      const hp = Math.max(0, Math.ceil(s.hp));
      set(hpt, `${T.hp}: ${hp} / ${s.maxHp}`);
      fill.style.width = Math.max(0, Math.min(100, (s.hp / s.maxHp) * 100)).toFixed(1) + "%";
      set(wname, s.weapon);
      set(ammo, s.reloading ? T.reloading : s.mag === 0 ? "—" : `${s.ammo} / ${s.mag}`);
      const hh = Math.floor(s.hour) % 24, mm = Math.floor((s.hour % 1) * 60);
      set(tl, `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")} · ${s.weather}`);
      set(tr, `${T.enemy}: ${s.enemiesLeft}/${s.enemiesTotal}\n${T.squad}: ${s.allies}`);
      tr.style.whiteSpace = "pre";
      set(form, s.form ? `${s.form.name} ${Math.ceil(s.form.left)} s` : "");
      form.style.color = s.form ? s.form.color : "";
      set(cds, s.cooldowns.filter(c => c.cd > 0).map(c => `${c.name}: ${Math.ceil(c.cd)} s`).join("\n"));
      cds.style.whiteSpace = "pre";
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

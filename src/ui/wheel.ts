export interface WheelItem { name: string; desc: string; color: string; cd: number }

export function createWheel() {
  const host = document.getElementById("ui") ?? document.body;
  const root = document.createElement("div");
  root.className = "wheel";
  host.appendChild(root);
  let items: WheelItem[] = [];
  let sel = 0, opened = false, vx = 0, vy = 0;
  let slots: HTMLElement[] = [];
  let nameEl: HTMLElement, descEl: HTMLElement;

  const paint = () => {
    slots.forEach((s, i) => {
      const it = items[i];
      s.classList.toggle("sel", i === sel);
      s.classList.toggle("cd", it.cd > 0);
      s.style.setProperty("--c", it.color);
      (s.querySelector(".wi") as HTMLElement).textContent = it.cd > 0 ? `${Math.ceil(it.cd)}s` : it.name.charAt(0).toUpperCase();
    });
    nameEl.textContent = items[sel]?.name ?? "";
    descEl.textContent = items[sel]?.desc ?? "";
  };

  const build = () => {
    root.innerHTML = `<div class="wdial"><i class="wr1"></i><i class="wr2"></i><i class="wr3"></i>
      <div class="wtxt"><div class="wn"></div><div class="wd"></div><div class="wh">Q burax — seç · E — çevril</div></div></div>`;
    nameEl = root.querySelector(".wn") as HTMLElement;
    descEl = root.querySelector(".wd") as HTMLElement;
    const R = `min(32vmin, 260px)`, n = items.length;
    slots = items.map((it, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const s = document.createElement("div");
      s.className = "wslot";
      s.style.left = `calc(50% + ${Math.cos(a)} * ${R})`;
      s.style.top = `calc(50% + ${Math.sin(a)} * ${R})`;
      s.innerHTML = `<div class="wc"><span class="wi"></span></div><small>${it.name}</small>`;
      root.appendChild(s);
      return s;
    });
  };

  return {
    open(its: WheelItem[], selected: number) {
      items = its; sel = selected; vx = vy = 0; opened = true;
      build(); paint();
      root.classList.remove("show"); void root.offsetWidth; root.classList.add("show");
    },
    move(dx: number, dy: number) {
      if (!opened || !items.length) return;
      vx += dx; vy += dy;
      const len = Math.hypot(vx, vy);
      if (len > 60) { vx *= 60 / len; vy *= 60 / len; } // keep vector responsive
      if (len <= 30) return;
      const a = Math.atan2(vy, vx) + Math.PI / 2;
      const n = items.length;
      const i = Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * n) % n;
      if (i !== sel) { sel = i; paint(); }
    },
    update(its: WheelItem[]) { if (!opened) return; items = its; paint(); },
    close() { opened = false; root.classList.remove("show"); return sel; },
    isOpen: () => opened,
    destroy() { root.remove(); opened = false; },
  };
}

// Oyunun bütün məlumatları bir yerdə: xəritələr, silahlar, döyüşçü növləri, saat formaları.

export interface Weapon {
  id: string; name: string; dmg: number; rate: number; // atəş/san
  mag: number; reload: number; spread: number; range: number; noise: number; melee?: boolean;
}

export const WEAPONS: Record<string, Weapon> = {
  pbow: { id: "pbow", name: "Ox-kaman", dmg: 95, rate: 1.1, mag: 1, reload: 0.6, spread: 0.002, range: 120, noise: 4 },
  sniper: { id: "sniper", name: "CheyTac tipli snayper", dmg: 220, rate: 0.6, mag: 7, reload: 3.2, spread: 0.0008, range: 450, noise: 85 },
  glock: { id: "glock", name: "Glock tipli tapança", dmg: 30, rate: 5, mag: 17, reload: 1.5, spread: 0.02, range: 60, noise: 40 },
  rifle: { id: "rifle", name: "Dövrün tüfəngi", dmg: 70, rate: 0.9, mag: 5, reload: 2.8, spread: 0.004, range: 160, noise: 70 },
  m16: { id: "m16", name: "M16 tipli avtomat", dmg: 24, rate: 11, mag: 30, reload: 2.2, spread: 0.02, range: 110, noise: 55 },
  aug: { id: "aug", name: "AUG A3 tipli tüfəng", dmg: 27, rate: 10, mag: 30, reload: 2.4, spread: 0.014, range: 120, noise: 50 },
  katana: { id: "katana", name: "Katana", dmg: 55, rate: 1.6, mag: 0, reload: 0, spread: 0, range: 2.6, noise: 5, melee: true },
  yari: { id: "yari", name: "Nizə (yari)", dmg: 45, rate: 1.2, mag: 0, reload: 0, spread: 0, range: 3.6, noise: 5, melee: true },
  yumi: { id: "yumi", name: "Yay (yumi)", dmg: 40, rate: 0.7, mag: 20, reload: 0, spread: 0.03, range: 70, noise: 8 },
  shuriken: { id: "shuriken", name: "Şuriken", dmg: 22, rate: 2.5, mag: 12, reload: 0, spread: 0.04, range: 30, noise: 3 },
  wakizashi: { id: "wakizashi", name: "Qısa qılınc", dmg: 38, rate: 2.4, mag: 0, reload: 0, spread: 0, range: 2.2, noise: 3, melee: true },
  scimitar: { id: "scimitar", name: "Qılınc", dmg: 30, rate: 1.3, mag: 0, reload: 0, spread: 0, range: 2.4, noise: 5, melee: true },
  musket: { id: "musket", name: "Tüfəng", dmg: 35, rate: 0.5, mag: 1, reload: 3, spread: 0.05, range: 80, noise: 60 },
  bow: { id: "bow", name: "Yay", dmg: 25, rate: 0.8, mag: 30, reload: 0, spread: 0.05, range: 60, noise: 8 },
};

/** yalnız oyunçunun silahları (1–5 düymələri) */
export const PLAYER_WEAPONS = ["pbow", "sniper", "glock", "m16", "aug"] as const;

export interface UnitType { id: string; name: string; hp: number; speed: number; color: string; weapons: string[]; ally: boolean; mounted?: boolean; civ?: boolean }

export const UNITS: Record<string, UnitType> = {
  samurai: { id: "samurai", name: "Samuray", hp: 140, speed: 4.2, color: "#b3261e", weapons: ["katana", "yari", "yumi"], ally: true },
  ninja: { id: "ninja", name: "Ninja", hp: 90, speed: 6.0, color: "#15151a", weapons: ["shuriken", "wakizashi"], ally: true },
  ottoman: { id: "ottoman", name: "Osmanlı əsgəri", hp: 100, speed: 4.0, color: "#2e6b3a", weapons: ["musket", "scimitar"], ally: false },
  yeniceri: { id: "yeniceri", name: "Yeniçəri", hp: 120, speed: 4.0, color: "#8c1c1c", weapons: ["musket", "scimitar"], ally: false },
  okcu: { id: "okcu", name: "Osmanlı oxçusu", hp: 90, speed: 4.2, color: "#2e5d3a", weapons: ["bow"], ally: false },
  sipahi: { id: "sipahi", name: "Süvari (sipahi)", hp: 170, speed: 8.5, color: "#7a1f1f", weapons: ["scimitar"], ally: false, mounted: true },
  atli_okcu: { id: "atli_okcu", name: "Atlı oxçu", hp: 140, speed: 8, color: "#5a3d22", weapons: ["bow"], ally: false, mounted: true },
  mulki: { id: "mulki", name: "Kəndli", hp: 50, speed: 2.2, color: "#8a6a48", weapons: [], ally: false, civ: true },
  mulki2: { id: "mulki2", name: "Kəndli qadın", hp: 50, speed: 2.0, color: "#6a4a6a", weapons: [], ally: false, civ: true },
  mongol: { id: "mongol", name: "Monqol döyüşçüsü", hp: 110, speed: 4.6, color: "#7a5230", weapons: ["bow", "scimitar"], ally: false },
};

/** qəsr: SITES-dəki yer + oradakı döyüşçülər (əsas və köməkçi növ) */
export interface Fort { id: string; name: string; unit: string; alt: string; flag: string }
export const FORTS: Record<string, Fort> = {
  ottoman: { id: "ottoman", name: "Osmanlı qəsri", unit: "yeniceri", alt: "ottoman", flag: "#1f7a3a" },
};
export interface GameMap { id: string; name: string; desc: string; ready: boolean; forts: string[]; startHour?: number }

export const MAPS: GameMap[] = [
  { id: "palace", name: "Samuray: Dörd dağın hökmdarı", ready: true, forts: ["ottoman"], startHour: 23,
    desc: "Gecədir. Dörd dağ arasındakı sarayından çıx, keçiddən 1 km irəlidəki Osmanlı qəsrinə basqın et, yeniçəriləri təmizlə." },
  { id: "kurtulus", name: "Qurtuluş Savaşı (1919–1922)", ready: false, desc: "Fiktiv komandir. Tezliklə.", forts: [] },
  { id: "karabakh", name: "Qarabağ zonası", ready: false, desc: "Tezliklə.", forts: [] },
  { id: "city", name: "İşğal altındakı şəhər", ready: false, desc: "Fiktiv şəhər, mülkiləri qoru. Tezliklə.", forts: [] },
];

// Saat formaları (orijinal). Faza 1: ilk üçü.
export interface Form { id: string; name: string; desc: string; dur: number; cd: number; color: string }
export const FORMS: Form[] = [
  { id: "alov", name: "Alov adam", desc: "Od topu (sol klik)", dur: 25, cd: 30, color: "#ff6a00" },
  { id: "ildirim", name: "İldırım", desc: "3 qat sürət", dur: 15, cd: 25, color: "#ffe14d" },
  { id: "qaya", name: "Qaya nəhəngi", desc: "Zərər 75% az, yerə zərbə (sol klik)", dur: 20, cd: 35, color: "#8a8170" },
  { id: "kolge", name: "Kölgə", desc: "Görünməzlik — keşikçilər görmür", dur: 18, cd: 40, color: "#8a4fd0" },
  { id: "buz", name: "Buz", desc: "Qarşındakıları dondurur (sol klik)", dur: 20, cd: 35, color: "#7fd8ff" },
  { id: "qanad", name: "Qanad", desc: "Uçuş: Space qalx, Ctrl en", dur: 25, cd: 40, color: "#e0c070" },
  { id: "horumcek", name: "Hörümçək", desc: "Tor at (sol klik), divarlardan keç", dur: 20, cd: 35, color: "#7aff5a" },
  { id: "maqnit", name: "Maqnit", desc: "Tüfəngləri əllərindən çək (sol klik)", dur: 12, cd: 45, color: "#c0c6d0" },
  { id: "kicik", name: "Kiçik", desc: "Balacalaş, gizli keç", dur: 25, cd: 30, color: "#7ab648" },
  { id: "qalxan", name: "Qalxan", desc: "Sənə zərər yox, dəstə sağalır", dur: 15, cd: 50, color: "#4a8cff" },
];

export interface ArmySetup { samurai: number; ninja: number; samuraiWeapon: string; ninjaWeapon: string; enemies: number; weapons: string[] }
export const DEFAULT_SETUP: ArmySetup = { samurai: 6, ninja: 4, samuraiWeapon: "katana", ninjaWeapon: "shuriken", enemies: 500, weapons: [...PLAYER_WEAPONS] };

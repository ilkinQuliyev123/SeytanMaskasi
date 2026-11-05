// Oyunun bütün məlumatları bir yerdə: xəritələr, silahlar, döyüşçü növləri, saat formaları.

export interface Weapon {
  id: string; name: string; dmg: number; rate: number; // atəş/san
  mag: number; reload: number; spread: number; range: number; noise: number; melee?: boolean;
}

export const WEAPONS: Record<string, Weapon> = {
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

export const PLAYER_WEAPONS = ["rifle", "m16", "aug"] as const;

export interface UnitType { id: string; name: string; hp: number; speed: number; color: string; weapons: string[]; ally: boolean }

export const UNITS: Record<string, UnitType> = {
  samurai: { id: "samurai", name: "Samuray", hp: 140, speed: 4.2, color: "#b3261e", weapons: ["katana", "yari", "yumi"], ally: true },
  ninja: { id: "ninja", name: "Ninja", hp: 90, speed: 6.0, color: "#15151a", weapons: ["shuriken", "wakizashi"], ally: true },
  ottoman: { id: "ottoman", name: "Osmanlı əsgəri", hp: 100, speed: 4.0, color: "#2e6b3a", weapons: ["musket", "scimitar"], ally: false },
  mongol: { id: "mongol", name: "Monqol döyüşçüsü", hp: 110, speed: 4.6, color: "#7a5230", weapons: ["bow", "scimitar"], ally: false },
};

export interface Camp { id: string; name: string; unit: string; x: number; z: number }
export interface GameMap { id: string; name: string; desc: string; ready: boolean; camps: Camp[] }

export const MAPS: GameMap[] = [
  { id: "palace", name: "Dörd dağ arasında saray", ready: true,
    desc: "Meşənin içində sənin yapon sarayın. Dəstəni yığ, keçidlərdəki Osmanlı və Monqol düşərgələrinə basqın et.",
    camps: [{ id: "ottoman", name: "Osmanlı keşik düşərgəsi", unit: "ottoman", x: 0, z: 150 },
            { id: "mongol", name: "Monqol dəstəsinin düşərgəsi", unit: "mongol", x: 150, z: 0 }] },
  { id: "kurtulus", name: "Qurtuluş Savaşı (1919–1922)", ready: false, desc: "Fiktiv komandir. Tezliklə.", camps: [] },
  { id: "karabakh", name: "Qarabağ zonası", ready: false, desc: "Tezliklə.", camps: [] },
  { id: "city", name: "İşğal altındakı şəhər", ready: false, desc: "Fiktiv şəhər, mülkiləri qoru. Tezliklə.", camps: [] },
];

// Saat formaları (orijinal). Faza 1: ilk üçü.
export interface Form { id: string; name: string; desc: string; dur: number; cd: number; color: string }
export const FORMS: Form[] = [
  { id: "alov", name: "Alov", desc: "Od topları atır (Sol klik)", dur: 20, cd: 30, color: "#ff6a00" },
  { id: "ildirim", name: "İldırım", desc: "3 qat sürət", dur: 15, cd: 25, color: "#ffe14d" },
  { id: "qaya", name: "Qaya", desc: "Zərər 75% az, yerə zərbə (Sol klik)", dur: 20, cd: 35, color: "#8a8170" },
];

export interface ArmySetup { samurai: number; ninja: number; samuraiWeapon: string; ninjaWeapon: string; enemies: number; weapons: string[] }
export const DEFAULT_SETUP: ArmySetup = { samurai: 6, ninja: 4, samuraiWeapon: "katana", ninjaWeapon: "shuriken", enemies: 10, weapons: ["rifle", "aug"] };

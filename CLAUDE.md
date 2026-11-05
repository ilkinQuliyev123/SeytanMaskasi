# Şeytan Maskası — brauzer 3D oyunu (Babylon.js + TypeScript + Vite)

Sessiyanın əvvəlində bu faylı oxu. Hər addımdan sonra «Vəziyyət» və «Növbəti» bölmələrini yenilə.

## Qaydalar
- İstifadəçi ilə Azərbaycanca, qısa danış. Kod ağıllı və qısa, token az xərclə.
- İş bölgüsü (istifadəçinin tələbi): ASAN işlər (mətnlər, menyu/HUD, testlər, məlumat JSON-ları, README) → yüngül model subagentləri (Agent, model=haiku/sonnet). ÇƏTİN işlər (arxitektura, AI, NavMesh, hava/işıq, oyunçu, performans) → əsas model. Subagent nəticəsini həmişə yoxla (tsc, build, test).
- Kompüter zəifdir (3.9 GB RAM, i5-4210U, inteqrasiya olunmuş qrafika): low-poly, thin instances, aşağı render ölçüsü, kölgə yalnız «orta»da. Hər şey E:-də (C dolu). npm keşi: `npm_config_cache=E:\npm-cache`.
- Məzmun: döyüş hərbi bölmələr arasında; xalqı alçaldan təsvir yox; mülkilərə zorakılıq mükafatlandırılmır.
- **Ben 10 / Omnitrix**: istifadəçi dəfələrlə həqiqi Omnitrix və Ben 10 qəhrəmanlarını istədi. İMTİNA olunub (başqasının müəllif hüquqlu personajları, şəxsi istifadə olsa da). Əvəzində ORİJİNAL «transformasiya saatı» + 10 orijinal yadplanetli forma. Bu qərarı dəyişmə; nəzakətlə izah et.
- Atatürk: hörmətlə, oynanmayan fiqur (brifinq/məktub/portret). Oyunçu fiktiv komandirdir.

## Oyun planı (istifadəçidən)
- Platforma: brauzer (WebGL), quraşdırmasız. Bütün interfeys Azərbaycanca. Qrafika «cool»: stilizə olunmuş low-poly + kino tonu (ACES), bloom, FXAA, vinyet, gecə/gündüz işığı.
- Əsas ekran → «Xəritələr» → xəritə seçimi → ordu seçimi (oyunçu əsgər sayını və silahlarını özü təyin edir) → oyun.
- Xəritələr: (1) **Dörd dağ arasında saray** — meşədə oyunçunun yapon tipli sarayı, samuraylar və ninjalar; dəstə yığıb keçidlərdəki **Osmanlı** və **Monqol** düşərgələrinə basqın (HAZIR prototip). (2) Qurtuluş Savaşı 1919–1922 (fiktiv komandir). (3) Qarabağ zonası / Erməni–Azərbaycan müharibəsi (44 günlük). (4) Fiktiv işğal altında şəhər (Qəzza yerinə fiktiv): yaralıları daşımaq, ərzaq/məlumat çatdırmaq, «Qara maska qrupu» hədəf seçib şəhəri azad edir, mülkiləri qoruyur; gecə gizli hərəkət, gündüz nəzarət məntəqələri.
- Oyunçunun silahları: dövrün tüfəngi, M16 tipli, AUG A3 tipli (öz low-poly modellərimiz). Məqsəd: rayonu düşmən əsgərlərindən təmizləmək.
- Transformasiya saatı: 10 orijinal forma — Alov (od topu), İldırım (sürət), Qaya (güc/müdafiə, yerə zərbə), Kölgə (görünməzlik), Buz (dondurma), Qanad (uçuş), Hörümçək (divara dırmaşma/tor), Maqnit (silah çəkmə), Kiçik (balacalaşma), Qalxan (mülkiləri qoruyan qalxan). Hər birinin müddəti və soyuması var.
- Düşmən AI: dəstə əsaslı; tam versiyada NavMesh (Recast).
- Fazalar: F1 oyunçu, zaman/hava, 2–3 rayon (prototip) → F2 dəstə AI-si və düşmən sayı seçimi → F3 Xəritə 1 bütün rayonlar → F4 Xəritə 2 (şəhər, sahil, final) → F5 Xəritə 3 və kampaniya.

## Kod quruluşu
- `src/game/data.ts` — xəritələr, silahlar, döyüşçü növləri, saat formaları, defolt ordu.
- `src/game/logic.ts` — Babylon-suz məntiq (relyef `heightAt`, `sunAt`, hava, `canSee`, `Gun`, `hitChance`, `Watch`) — `tests/logic.test.ts` (13 test).
- `src/game/world.ts` — relyef (4 dağ), meşə (thin instances), yapon sarayı, düşərgələr; `obstacles`.
- `src/game/sky.ts` — gecə/gündüz, hava (aydın/buludlu/yağış/duman), yağış hissəcikləri.
- `src/game/units.ts` — Unit (instances), sadə AI (patrul → görür/eşidir → yaxınlaşır → vurur), dəstə «izlə/hücum».
- `src/game/player.ts` — üçüncü şəxs kamera, WASD/Shift/C, atəş (pickWithRay), 1–3 silah, R, Q/E saat.
- `src/game/game.ts` — dövrə, post-effektlər, güllə izləri (hovuz), HUD, pauza (Esc), qələbə/məğlubiyyət.
- `src/ui/ui.ts`, `src/i18n/az.ts`, `src/style.css` — menyular və HUD (sonnet yazıb).
- `src/main.ts` — giriş; `?q=mid` orta keyfiyyət; `?auto` test rejimi (menyusuz başlayır, xəta/FPS səhifə başlığına).

## Əmrlər
- `npm run dev` (oyun: http://localhost:5173), `npm run build`, `npm test`.
- Avtomatik yoxlama: `npx vite preview --port 4173` + Edge headless: `msedge --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --virtual-time-budget=15000 --user-data-dir=E:\tmp\edge-prof --dump-dom "http://localhost:4173/?auto"` → `<title>OK ...</title>`.

## Vəziyyət (05.11.2026, Mərhələ A — ilk yoxlama versiyası)
- Xəritə 1 «Samuray: Dörd dağın hökmdarı»: ±1300 m relyef, 4 dağ, 4 keçid + yollar (`SITES`, `roadPoint`, `heightAt`), sıx meşə (thin instances).
- Yapon saray kompleksi (`world.ts`): hasar, darvaza evi, içi açıq dojo (ninjalar), yan zallar, yagura, gölməçə, daş fənərlər, torii.
- Osmanlı qəsri (`fort.ts` + `fortLayout`): dişli divar/qüllələr, darvaza, saray-qala (qübbə), yaşıl bayraqlar, içəridə və çöldə kənd, küçələr, məşəllər.
- Ordu: defolt 500 (menyuda 50–800), təsadüfi növ/silah/yer: yeniçəri, qılıncçı, oxçu, sipahi süvari, atlı oxçu; divar/darvaza keşikçiləri; 4 top (xidmətçi ölsə susur); 70 mülki (güllə dəymir).
- AI: yalnız görəndə hücum; həyəcan yalnız ən yaxın 4 yoldaşa (30 m), atəş səsi ən yaxın 6-ya; 260 m-dən uzaq yatır; divar arxasına atmır.
- Oyunçu: oni maskalı samuray modeli; silahlar ox-kaman, CheyTac tipli snayper (sağ klik optika), Glock tipli, M16, AUG A3 (1–5). Dəstə halqalarla izləyir (samuray/ninja 0–50).
- Gecə: ay + ay işığı, ulduzlar, (orta keyfiyyət: ay şüaları, duman, bloom/glow), 2 «gəzən» fənər işığı.
- Testlər: 21 (logic + fort). tsc/build təmiz. Headless: `?auto` və `?auto&at=ottoman` → OK.
- İstifadəçi hələ öz noutbukunda yoxlamayıb. Oynamaq: `npm run dev` → http://localhost:5173 (və ya build + `npx vite preview --port 4173`).

## Növbəti
1. İstifadəçinin rəyi (FPS, görünüş, AI, idarəetmə) → düzəlişlər.
2. GitHub private repo `ilkinQuliyev123/SeytanMaskasi` (istifadəçi yaradır) → push (`git config http.version HTTP/1.1`).
3. Mərhələ B: Monqol, Çin, Viking qəsrləri (`SITES`-də yerləri hazır). Mərhələ C: saat çarxı + 10 orijinal bədheybət forması (Omnitrix surəti YOX).
4. Səslər, menyuda keyfiyyət seçimi, NavMesh, bundle kiçiltmə.

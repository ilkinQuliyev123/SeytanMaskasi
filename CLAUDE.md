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
- `src/game/logic.ts` — Babylon-suz: relyef (`rawHeight`, oyunda `heightAt` relyef meşindən oxuyur), `SITES`, yollar, `HAMLETS`, `NORTH` (meşə/ot/məhəllə), `townLayout` (labirint), `fortLayout` (4 darvaza), `Grid`, `Gun`, `Watch`, `canSee`.
- `src/game/world.ts` — relyef (PBR qarışıq toxuma), yollar, meşə, yapon saray kompleksi + dojo, yapon kəndləri, 2 m ot (`inTallGrass`), labirint məhəllə.
- `src/game/fort.ts` — Osmanlı qəsri (qum daşı divar, qüllələr, 4 darvaza, saray-qala, kənd halqaları, məşəllər, bayraqlar).
- `src/game/materials.ts` — PBR toxumalar (Poly Haven CC0), HDRI, relyef qarışıq materialı.
- `src/game/kit.ts` — primitivlərdən model dəsti (`texMap` ilə toxuma), sadə uzaq-LOD modellər, silah modelləri (+daraq), top.
- `src/game/chars.ts` — animasiyalı personajlar (Quaternius CC0: Universal Base Characters, Modular Outfits, Universal Animation Library). (növ, hal) şablonları + instance-lar; aksesuarlar sümüyə çəki ilə; `warm()`, `tick()`.
- `src/game/units.ts` — döyüşçü AI, LOD (`setLod`), animasiya halları (`setAnim`, 0.3 s histerezis).
- `src/game/player.ts` — oyunçu: animasiyalı samuray, 6 silah (5 + saat), nişan/optika, tullanma, formalar, əjdaha sürmə.
- `src/game/dragon.ts` — 7 m əjdaha (G çağırır, enir, mindirir; alov). `src/game/forms.ts` — saat + 10 orijinal forma modeli. `src/game/cannon.ts` — top (Poly Haven modeli).
- `src/game/sky.ts` — gecə/gündüz, ay, ulduzlar, duman, yağış. `src/game/audio.ts` — prosedur səslər (sonnet). `src/game/game.ts` — hamısını birləşdirir.
- `src/ui/ui.ts`, `src/ui/wheel.ts`, `src/style.css`, `src/i18n/az.ts` — kinematik UI (sonnet).
- `tools/fetch_assets.py` (Poly Haven), `tools/fetch_itch.py` (Quaternius itch.io), `tools/extract_chars.py`. Xam zip-lər `assets-raw/` (gitignore).

## Blender modelləri (09.11.2026)
- Blender 5.2 quraşdırılıb: `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`. Modellər prosedur Python skriptləridir (əl ilə modelləmə yox), vertex rəngi + düz üçbucaq → JSON (sinxron yüklənir):
  `"<blender.exe>" --background --factory-startup --python tools/blender/<skript>.py -- src/game/models/<ad>.json [önizləmə.png]`
- `tools/blender/lowpoly.py` — ümumi (Model, box, poly, ixrac, Workbench önizləmə). `flora.py` — ağaclar/kollar/qayalar (+ `_lo` LOD). `houses.py` — yapon minka/kayabuki. `ottoman.py` — Osmanlı sıra evinin 5 m-lik hissələri (+ `_lo`, `_end` alınlıq).
- Oyunda: `src/game/flora.ts` (`lowpolyMesh`, `floraMesh`, `houseMesh`, `ottoMesh`). Ox çevrilməsi: Blender (x,y,z) → oyun (x,z,y) + üçbucaq sırası çevrilir (yoxlanıb). Rənglər hər üçbucağa bir dəfə (indeks `floor(i/3)`).
- `world.ts → scatterChunked(mesh, ms, cell, pickable, far, lod)`: thin instance-ları hüceyrələrə bölür. **Diqqət:** `mesh.clone()` həndəsəni paylaşır, thin instance matrisləri həndəsədə saxlanır → hər hissəyə `VertexData.ExtractFromMesh` ilə öz həndəsəsi verilməlidir (yoxsa nəhəng üçbucaqlar).
- Yoxlama: `?flora` (modellər gündüz), `?auto&at=hamlet|street|town`, `?h=11` (başlanğıc saatı). `?auto`-da ekranda üçbucaq sayı + ən ağır meşlər.
- BlenderMCP (canlı Blender idarəsi) hələ qoşulmayıb — istifadəçi addonu özü quraşdırmalı və `claude mcp add blender ...` işlətməlidir (avtomatik etmək bloklandı).

## Əmrlər
- Build + yerli server: `npx vite build` → `npx vite preview --host 127.0.0.1 --port 4173` → http://127.0.0.1:4173 (istifadəçi Ctrl+F5 etməlidir).
- Yoxlama: Edge headless `--screenshot` / `--dump-dom` + `--enable-logging=stderr --v=0` (konsol xətaları üçün `grep CONSOLE`). Test parametrləri: `?auto`, `?auto&at=town`, `?auto&at=ottoman`, `?setup`.
- **Diqqət:** headless proqram renderidir (FPS göstərmir). İstifadəçinin FPS-i (HD 4400) ilk versiyada ~52 idi; ağır dəyişikliklərdən sonra «donur» dedi — real FPS ölçülməyib.

## Vəziyyət (09.11.2026 — istifadəçi 2–4 saat yox idi, «Blender ilə yenilə» dedi)
Edildi (hamısı push, son `2c20ec4`+): Blender ağacları/kollar/qayalar (hər iki xəritə), yapon kənd evləri, Osmanlı məhəlləsi modul evləri, hissələrə bölmə + LOD.
Ölçülən (headless, `?auto` başlanğıc): çəkilən ~0.9 M üçbucaq. Məhəllənin içində ~2.2 M, onun **1.4 M-i personajlar** (`Male_Ranger…` — yeniçərilər) → növbəti performans hədəfi: personaj LOD-u/sayı.
Həll olunmamış: səmada qara uzunsov «zolaqlar» (köhnə versiyada da var — mənbəyi tapılmayıb); Xəritə 2-də gəmi qara görünür (köhnə).
İstifadəçi hələ real FPS deməyib — soruş.

## Vəziyyət (06.11.2026 gecə — istifadəçi layihəni DAYANDIRDI)
Son commit `57a23fd` (GitHub private: ilkinQuliyev123/SeytanMaskasi). Xəritə 1 oynanır, amma istifadəçi narazıdır:
- «Qrafika pisdir», «Bannerlord kimi olsun», «animasiya çox daha yaxşı olsun», «donur», «oyunçular divarın içinə girir, havada qalır», «əjdaha göydədir, minmək olmur».
- Son düzəlişlər (istifadəçi hələ yoxlamayıb): relyefə dəqiq oturma (sampler), əjdahanı G ilə çağırma, LOD (90 m-dən uzaqda sadə model), şablonları əvvəlcədən hazırlama, istifadə olunmayan animasiyaları dayandırma.

### Mənim səhvlərim (təkrarlanmasın)
- İstifadəçiyə «hazırdır» deməmişdən əvvəl öz-özünə real oyun ssenarisini yoxlamadım (əjdahaya minmək, divar toqquşması, uzun oyun FPS).
- Silahları gizli meşə bağladım (görünmədi); skeletli merge xətası (sideOrientation); animasiya halı hər kadrda dəyişib instance yaradırdı (donma); şablonlar oyun ortasında yaradılırdı (ilişmə); analitik hündürlük ≠ çəkilən relyef (havada qalma).
- Qayda: hər dəyişiklikdən sonra headless skrinşot + konsol yoxla, **və** oyun mexanikasını (min/düş, toqquşma, döyüş) ssenari ilə test et; FPS-ə təsir edən hər şeyi «Aşağı» keyfiyyətdə söndürülə bilən et.

## Çatışmazlıqların auditi (özüm tapdım — sabah istifadəçiyə bildir)
**Funksionallıq / səhvlər**
1. Yol tapma yoxdur: əsgərlər divara/evə dirənir, labirint məhəllədə ilişir → Recast NavMesh (`recast-detour` artıq quraşdırılıb) + crowd agentləri.
2. Toqquşma yalnız dairələrlə: evlərin künclərindən keçmək olur; kamera divarın içinə girir → kamera üçün raycast (divara yaxınlaşanda kameranı yaxınlaşdır).
3. Personaj modelləri güzgüdür (sağ↔sol: silah sol əldə görünə bilər) — `scaling.x=-1` əvəzinə düzgün handedness həlli.
4. Süvarilər (sipahi, atlı oxçu) və 10 bədheybət forması hələ primitiv modeldir; animasiyasız.
5. Əjdaha: enmə/qalxma animasiyası, zərər görmə, dəstədə ikinci rolu yoxdur; minmə real oyunda yoxlanmayıb.
6. Atəş effektləri yoxdur: lülə alovu, tüstü, güllə izi/qığılcım, qan/toz, vurma işarəsi (hit marker), ölüm səsi.
7. Ayarlar menyusu yoxdur: keyfiyyət, səs, siçan həssaslığı, FOV (keyfiyyət hələ URL ilə).
8. Mini-xəritə/kompas/hədəf işarəsi yoxdur — 1 km yolda istiqamət itir.
9. Səslər test olunmayıb; 3D (yerləşmiş) səs yoxdur.
10. Ölü cəsədlər yığılır (500); uzaqda sadə modeldə yıxılma yoxdur.
11. Qəsrin içindəki saraya girmək olmur; dojo-ya girmək olur, amma kamera divardan keçir.
12. Mülkilər döyüşdə qaçmır (yalnız gizlənir).
13. Saxlama/yükləmə yoxdur.
14. Deploy: Cloudflare Pages + Access (yalnız istifadəçinin Gmail-i) — istifadəçi hesab açmalıdır.
15. Bundle böyükdür (~6.5 MB JS + 60 MB assets) — ilk yükləmə uzun.

**Qrafika — nə etmək olar (HD 4400-də real olan)**
1. Kölgələr: `CascadedShadowGenerator` (2 kaskad, yalnız yaxın) + aşağı keyfiyyətdə personaj altında «blob» kölgə.
2. Ağaclar: primitiv konuslar ən zəif yerdir → CC0 ağac modelləri (Quaternius Stylized Nature MegaKit və ya Poly Haven aşağı-poli) + uzaqda billboard impostor.
3. Yaxında qısa ot (GPU instansing), yol kənarında kol/qaya modelləri (Poly Haven `boulder_01` aşağı LOD).
4. Rəng düzəlişi: LUT (gecə — mavi kölgə / isti fənər), daha güclü ay işığı, kəskinlik; ay şüaları yalnız «Orta»da.
5. Relyef: hər qatın normal xəritəsi, qayalıqda triplanar, detal toxuması.
6. Effektlər: məşəl alovu hissəcikləri + işıq titrəməsi, atəşböcəkləri, qığılcımlar, tüstü.
7. Su: gölməçə/düyü tarlası üçün əks etdirmə (yalnız «Orta»).
8. Animasiya: Universal Animation Library 2 (CC0, 130+ klip: qılınc kombinasiyaları, döyüş, parkur) — itch-dən `tools/fetch_itch.py` ilə; üst bədən qatı (yeriyərkən nişan), ayaq IK, kök hərəkəti; oyunçu üçün 2K toxuma.
9. Binalar: qutu evlər əvəzinə modul tikinti dəsti (CC0 orta əsr/şərq evləri) — ən çox fərq yaradan addımlardan biri.
- **Dürüst qeyd:** Bannerlord-un minimum tələbi GTX 660 + 6 GB RAM-dır; istifadəçinin noutbuku (HD 4400, 4 GB) bundan aşağıdır. Bannerlord səviyyəsi bu kompüterdə heç bir mühərriklə mümkün deyil; hədəf — «stilizə, amma zəngin və hamar». Güclü kompüter olarsa: Unreal Engine 5 + pulsuz Marketplace/Fab aktivləri.

## Vəziyyət (06.11.2026 axşam — /compact əvvəli, layihə dayandırıldı)
Auditdən DÜZƏLDİLDİ (istifadəçi hələ oynamayıb): #1 dinləyici sızması (Player.dispose/AbortController), #2 şablon görünməzlik titrəməsi,
#3 əjdaha ölür → yerə enir, 300 can yığanda qalxır + xəbərdarlıq, #5 Esc-də çarx bağlanır, #6 düşmən atəş səsi silaha görə,
#7 əjdahadan düzgün düşmə, #8 F hücum → ən yaxın düşmənə davam, #12 ölüm → yaxındakı 3 yoldaş meyitə gəlir, #13 top havadakını hədəf almır,
kamera toqquşması (raycast), vurma işarəsi (hit marker). Qalan audit bəndləri: #4, #9, #10, #11, #14.

**Ssenari testləri:** `src/test/scenarios.ts`, `?test` ilə (100 düşmən; TEST rejimində oyun dövrəsi setInterval ilə, sabit dt 0.06,
render ölçüsü 1/8 — headless virtual zamanda rAF işləmir). Yoxlayır: hərəkət, yerə oturma, maneə içində əsgər, divardan keçmə,
əjdahaya minmək/uçmaq/düşmək, tullanma. Nəticə səhifə başlığında `TEST n/m`. **Diqqət:** Git Bash-dan msedge stdout gəlmir —
PowerShell ilə işlət: `& $edge --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --virtual-time-budget=200000 --window-size=800,450 --user-data-dir=E:\tmp\pN --no-first-run --dump-dom "http://127.0.0.1:4173/?test"`.
Son run 600 s-də bitmədi (çox yavaş) — sabah: test zamanı kölgə/hissəcik/post-effektləri söndür, düşmən 30-a endir, ya da yalnız seçilmiş ssenarini işlət (`?test=dragon`).
Əvvəlki (zamanı düzgün ölçməyən) run-da «yerə oturma» və «maneə içində yoxdur» KEÇDİ; «əjdahaya minmək», «tullanma» o zaman ölçülə bilmədi — yenidən yoxla.

## Kod auditi — məntiq xətaları (06.11 gecə, kodu oxuyaraq tapdım; sabah düzəlt)
1. **Yaddaş/klaviatura sızması:** `Player` konstruktoru `window`-a keydown/keyup/mouseup qoşur və heç vaxt silmir → menyuya qayıdıb yenidən oynayanda köhnə oyunçu da düymələri tutur. Düzəliş: `Player.dispose()` + `quit()`-də çağır.
2. **Görünməzlik titrəməsi:** `CharLib.tick()` istifadə olunmayan şablonu `setEnabled(false)` edir; əsgər yeni hala keçəndə instance 0.5 s-ə qədər görünmür. Düzəliş: `instance()` içində şablonu dərhal `setEnabled(true)` et.
3. **Ölü əjdaha uçmağa davam edir:** `Dragon.hp` 0 olanda heç nə olmur; HUD-da canı da yoxdur. Düzəliş: yerə düşmə + HUD zolağı + sürmə bağlanır.
4. **Ölüm animasiyası görünmür:** «dead» şablonu yükləmədə bir dəfə oynayıb bitir → yeni ölən əsgər birdən uzanmış görünür. Düzəliş: hər ölüm üçün qısa ömürlü «dying» şablonu (2–3 fazalı hovuz) və ya ölümdə instance-ı qısa müddət öz skeletli klonuna keçir.
5. **Çarx pauzada açıq qalır:** Esc basılanda `wheel` bağlanmır, `player.wheelOpen` true qalır → siçan kamerası işləmir. Düzəliş: `lockChange`-də `wheel.close()`.
6. **Düşmən atəş səsi həmişə «musket»** (oxçu da tüfəng səsi verir). Düzəliş: `onShot`-a silah növünü ötür.
7. **Əjdahadan düşəndə** oyunçu havadan birdən yerə teleport olur, `jumpH`/`flyH` sıfırlanmır; əjdaha minilmiş halda düşmən onu hədəf seçir, amma zərəri HUD-da yoxdur.
8. **`F` hücum əmri:** dəstə darvazaya çatıb orada dayanır (alert sıfırlanmır, içəri girmir). Düzəliş: darvazaya çatanda növbəti nöqtə — qəsr mərkəzi/ən yaxın düşmən.
9. **Qələbə şərti:** bütün 500 əsgəri öldürmək lazımdır, o cümlədən uzaqda gəzən süvariləri → çox uzun/yorucu. Düzəliş: qəsr «ələ keçirilir» — saray həyətində bayrağı tutmaq (X s dayan) + qalan düşmənlər qaçır/təslim olur.
10. **Sursat sonsuzdur** (yalnız daraq var) — strateji məna yoxdur. Əlavə: ehtiyat sursat + qəsrlərdə sursat qutuları.
11. **`?auto`/`?setup` test parametrləri** istehsalda da işləyir (zərərsiz, amma gizlət).
12. **Gündüz düşmənin görmə məsafəsi 50 m, gecə 22 m** — snayper 450 m-dən hər kəsi təhlükəsiz vurur; vurulan əsgərin yoldaşları həyəcan almır. Düzəliş: yaxınlıqda ölən yoldaş → həyəcan (səs-küysüz də), snayperin yerini təxmin etmə.
13. **Toplar** yalnız `alarmed` olanda atır, amma qəsrdən 130 m-də hər kəsi (mülki istisna) hədəf ala bilir, o cümlədən əjdahanı — əjdahaya top mərmisi parabola ilə çata bilmir (hündürlük nəzərə alınmır).
14. **Qəsr bayrağı** təmizlənəndə rəngi dəyişir, amma digər qəsrlər hələ yoxdur — «Qəsrlər 0/1» xəritə 1 üçün düzdür, Mərhələ B-də SITES-dən avtomatik gəlməlidir.

## Əlavə olunmalı məntiqli şeylər (istifadəçi «mütləq əlavə et» dedi)
- **Gizli öldürmə:** arxadan yaxınlaşıb V ilə səssiz öldürmə (ninja/samuray üslubu).
- **Dəstə əmrləri:** «izlə / dayan / hücum / geri çəkil» radial menyusu, hədəf nöqtəsi göstərmək.
- **Can bərpası:** döyüşdən kənarda yavaş bərpa + dərman (kəndlərdə).
- **Kompas + hədəf işarəsi + mini-xəritə**; qəsr/məhəllə adları ekranda göstərilir.
- **Çətinlik səviyyəsi** (asan/orta/çətin) və **ayarlar** (keyfiyyət, səs, həssaslıq, FOV, düşmən sayı).
- **Saxlama nöqtələri** (məhəlləyə çatanda, darvazada) — ölüm = sıfırdan başlama olmasın.
- **Süvari davranışı:** açıq sahədə hücum (charge), oxçular məsafə saxlayır, qılıncçılar dəstə ilə gəlir.
- **Mülkilər:** döyüş yaxınlaşanda qaçıb evlərə girir; mülkiyə zərər yoxdur (qayda).
- **Əjdaha əmrləri:** «yanımda uç / hücum et / yerə en» (H düyməsi).
- **Vurma hissi:** hit marker, ekran titrəməsi, qan/qığılcım, ölüm səsi, düşmənin geri itələnməsi.

## Növbəti (sabah — istifadəçiyə əvvəlcə bu siyahını qısa xülasə ilə bildir, sonra təsdiqlə başla)
1. İstifadəçidən son versiyanın FPS-ini al (`?q=mid` olmadan); FPS ölçən «performans rejimi» əlavə et.
2. NavMesh + kamera toqquşması + divar/ev toqquşmasını düzəlt (ən çox şikayət olunan).
3. Atəş effektləri + hit marker + ayarlar menyusu + kompas/mini-xəritə.
4. Qrafika planından 1–4 və 9 (ağaclar, binalar, kölgə, LUT) — hər addımdan sonra skrinşot + istifadəçiyə FPS sualı.
5. UAL2 animasiyaları, süvari və bədheybət modellərini təkmilləşdir; əjdahanı real ssenari ilə test et.
6. Deploy (Cloudflare Pages + Access) — istifadəçi hesab açanda.
7. Sonra Mərhələ B (Monqol, Çin, Viking qəsrləri) və digər xəritələr.


## Vəziyyət (09.11.2026 axşam — istifadəçi 2 saatlığa getdi)
Son commit-lər GitHub-dadır (`3dee403` və əvvəlki). **Xəritə 2 — Qurtuluş Savaşı** yazılıb və brauzerdə açılır (skrinşotlarla yoxlanıb: kənd, əsgərlər, səngər, sahil, günəş, gəmilər).
- Fayllar: `src/game/kurtulus.ts` (oyun dövrəsi: ordular, 9 gəmi + desant qayıqları, 6 təpə topu, mərmi/effektlər, sübh səması/işıq, FPS-ə görə ekran ölçüsü), `src/game/kurtulus_world.ts` (dünya: dar vadi, kənd + divarlı kazarma, otlaq/samanlıq, 10 səngər x = −1000…800, sahil x≈960, təpələr, bitki).
- Yoxlama: `?map=kurtulus&n=60&s=20&at=coast|hill|trench` (birbaşa xəritə 2, az əsgər, kamera mövqeyi).
- Dar vadi; kazarma divarları → 200 m otlaq və samanlıq → 200 m-dən bir 10 səngər sahilə qədər; en — iki yandakı dağlarda bitir.
- 100 türk əsgəri (kabalak, xaki), hamıda süngülü tüfəng (yaxında süngü; F hücum əmrində 40 m-dən süngü həmləsi); oyunçuda snayper + M16.
- Quruda 3 kazarma (səngər müdafiəçiləri + kazarmadakılar). Donanma (9 gəmi × 50) **atəş açmır**; oyunçu son səngərə yaxınlaşanda (x > TRENCH_X[8] − 60) qayıqlarla 10-luq desant çıxarır.
- 6 təpə topu (ən hündürdə böyük top, ora ziqzaq yol). G — 3 əsgəri topa göndər (özləri gəmi/qayığı vurur), H — geri çağır, E — topa keç (sarı halqa — düşmə yeri; mərmi dəqiq ora düşür).
- **Mühüm düzəliş:** skeletli instance-larda glTF kökünün güzgüsü dünya fəzasında tətbiq olunurdu — animasiyalı əsgər x-də əks yerdə çəkilirdi (xəritə 1-də mərkəzə yaxın olduğu üçün az bilinirdi). `Unit.place`-də kompensasiya (position.x = −x, rotation.y = −facing), animasiyalı instance-lar `alwaysSelectAsActiveMesh`, vurma yoxlaması sadə (far) model üzrə.
- Görüntü: vertex rəngli sübh səması, isti günəş / soyuq ətraf işıq, ColorCurves, toz və ağız alovu. «Orta»da əlavə: kölgə (oyunçu ətrafı 80 m), duman, bloom, FXAA.
- FPS (istifadəçidə ~11 idi): animasiyalı model (≈25k təpə!) yalnız ən yaxın 10 əsgərdə ≤ 40 m; zəif rejimdə post-proses keçidi yox (tonlama scene.imageProcessingConfiguration-da), kölgə/duman yox, az ot/ağac; 60 FPS hədəfli avtomatik ekran ölçüsü. **Yeni FPS hələ ölçülməyib** — istifadəçidən soruş.
- Noutbukda **NVIDIA GeForce 840M** də var: Edge və Chrome registrdə (HKCU\Software\Microsoft\DirectX\UserGpuPreferences, GpuPreference=2) NVIDIA-ya keçirildi — brauzer yenidən açılmalıdır; edge://gpu ilə yoxla.

### Blender (istifadəçi: «Blender ilə yaz, oyun bitəndə Blender-i bağlayarıq»)
- Blender 4.5.15 LTS portativ: `E:\Blender\blender-4.5.15-windows-x64` (SHA256 rəsmi ilə yoxlanıb). MCP serveri: `E:\Blender\mcp-venv\Scripts\mcp-for-blender.exe` (paket blender-mcp → mcp-for-blender). Əlavə: `E:\Blender\addon\addon.py` (yalnız localhost:9876).
- Avto rejim əlavəni Blender-ə qoşmağı və `claude mcp add`-i blokladı → **istifadəçi özü edəcək**: Blender → Edit → Preferences → Add-ons → Install from Disk → addon.py → «MCP for Blender» işarələ; N → BlenderMCP → Connect; terminalda `claude mcp add blender -s user -- E:\Blender\mcp-venv\Scripts\mcp-for-blender.exe`; Claude Code-u yenidən aç.
- Blender skills paketi (96 bacarıq) `C:\Users\ILKIN\.claude\skills`-də quruludur.
- İş qaydası: Blender-də model → GLB ixrac (`public/assets/...`) → Blender-i bağla → oyunu yoxla (3.9 GB RAM ikisinə çatmır). Hər modelin təpə sayına limit (FPS).

## Növbəti (istifadəçi qayıdanda)
1. Soruş: Blender addımları edildimi? FPS neçədir (NVIDIA ilə)?
2. Blender qoşulubsa: əvvəl türk əsgəri + süngülü tüfəng (aşağı-poli; mövcud UAL skeletinə uyğun), sonra gəmi, top, binalar → GLB.
3. FPS 60 deyilsə: əsgər sayı / ot məsafəsi, uzaq ağacları gizlət, relyef materialını ucuzlaşdır.
4. Xəritə 2-də yoxlanmayanlar: G ilə topa heyət, gəmi/qayıq batırma, desant, süngü; kənd və böyük təpə görüntüsü; dağların rəngi (dumanda çox açıq).
5. Köhnə siyahı: xəritə 1 (NavMesh, ayarlar, mini-xəritə), xəritə 3–4, deploy, səs.

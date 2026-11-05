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

## Əmrlər
- Build + yerli server: `npx vite build` → `npx vite preview --host 127.0.0.1 --port 4173` → http://127.0.0.1:4173 (istifadəçi Ctrl+F5 etməlidir).
- Yoxlama: Edge headless `--screenshot` / `--dump-dom` + `--enable-logging=stderr --v=0` (konsol xətaları üçün `grep CONSOLE`). Test parametrləri: `?auto`, `?auto&at=town`, `?auto&at=ottoman`, `?setup`.
- **Diqqət:** headless proqram renderidir (FPS göstərmir). İstifadəçinin FPS-i (HD 4400) ilk versiyada ~52 idi; ağır dəyişikliklərdən sonra «donur» dedi — real FPS ölçülməyib.

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

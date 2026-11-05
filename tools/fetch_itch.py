"""Quaternius-in pulsuz (CC0) paketlərini itch.io-dan endirir: Standard/glTF faylları → assets-raw/.
İşlət: python tools/fetch_itch.py"""
import http.cookiejar, json, os, re, sys, urllib.parse, urllib.request

PAGES = ["universal-animation-library", "universal-base-characters", "modular-character-outfits-fantasy"]
OUT = os.path.join(os.path.dirname(__file__), "..", "assets-raw")
jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
op.addheaders = [("User-Agent", "Mozilla/5.0")]


def req(url, data=None):
    return op.open(url, urllib.parse.urlencode(data).encode() if data is not None else None, timeout=120)


def main():
    os.makedirs(OUT, exist_ok=True)
    for page in PAGES:
        base = f"https://quaternius.itch.io/{page}"
        dl = json.loads(req(base + "/download_url", {}).read())["url"]
        html = req(dl).read().decode("utf-8", "replace")
        csrf = re.search(r'name="csrf_token" value="([^"]+)"', html)
        uploads = re.findall(r'data-upload_id="(\d+)".*?class="name" title="([^"]+)"', html, re.S)
        print(page, [n for _, n in uploads])
        for uid, name in uploads:
            low = name.lower()
            if "source" in low or "blend" in low or not low.endswith(".zip"):
                continue  # yalnız pulsuz Standard/glTF
            path = os.path.join(OUT, name)
            if os.path.exists(path):
                continue
            data = {"csrf_token": csrf.group(1)} if csrf else {}
            info = json.loads(req(f"https://quaternius.itch.io/{page}/file/{uid}?source=game_download&after_download_lightbox=1&as_props=1", data).read())
            if "url" not in info:
                print("  atlandı:", name, info); continue
            with req(info["url"]) as r, open(path, "wb") as f:
                f.write(r.read())
            print("  ✓", name, os.path.getsize(path) // 1048576, "MB")


if __name__ == "__main__":
    sys.exit(main())

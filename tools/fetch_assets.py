"""Poly Haven-dən (CC0) PBR toxumaları, gecə HDRI-si və modelləri public/assets-ə endirir.
İşlət: python tools/fetch_assets.py   (artıq olan fayllar yenidən endirilmir)"""
import json, os, sys, urllib.request

UA = {"User-Agent": "SeytanMaskasi-game/1.0"}
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "assets")
RES = "1k"  # zəif video kart üçün 1K
TEXTURES = {  # oyundakı ad: Poly Haven adı
    "forest": "forest_ground_04", "grass": "leafy_grass", "rock": "aerial_rocks_02", "dirt": "park_dirt",
    "cobble": "cobblestone_floor_08", "sandstone": "large_sandstone_blocks_01", "plaster": "clay_plaster",
    "roof": "clay_roof_tiles_02", "jstone": "japanese_stone_wall", "cedar": "japanese_cedar_planks",
    "slate": "grey_roof_tiles", "whitewall": "beige_wall_001", "bark": "pine_bark",
}
MAPS = {"Diffuse": "diff", "nor_gl": "nor", "arm": "arm"}


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()


def save(url, path):
    if os.path.exists(path):
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    data = get(url)
    with open(path, "wb") as f:
        f.write(data)
    print(f"  {os.path.basename(path)}  {len(data) // 1024} KB")


def main():
    for name, ph in TEXTURES.items():
        files = json.loads(get(f"https://api.polyhaven.com/files/{ph}"))
        for key, short in MAPS.items():
            save(files[key][RES]["jpg"]["url"], os.path.join(OUT, "tex", f"{name}_{short}.jpg"))
    hdri = json.loads(get("https://api.polyhaven.com/files/moonlit_golf"))
    save(hdri["hdri"]["1k"]["hdr"]["url"], os.path.join(OUT, "sky", "night.hdr"))
    for model in ["cannon_01"]:  # gltf + onun toxumaları
        g = json.loads(get(f"https://api.polyhaven.com/files/{model}"))["gltf"][RES]["gltf"]
        save(g["url"], os.path.join(OUT, "models", model, f"{model}.gltf"))
        for rel, inc in g.get("include", {}).items():
            save(inc["url"], os.path.join(OUT, "models", model, rel))


if __name__ == "__main__":
    sys.exit(main())

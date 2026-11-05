"""assets-raw/ zip-lərindən lazım olan personaj, geyim və animasiya fayllarını public/assets/chars-a çıxarır."""
import json, os, posixpath, zipfile

RAW = os.path.join(os.path.dirname(__file__), "..", "assets-raw")
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "chars")
WANT = {
    "Universal Base Characters[Standard].zip": [
        "Base Characters/Godot - UE/Superhero_Male_FullBody", "Base Characters/Godot - UE/Superhero_Female_FullBody",
        "Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/Hair_Beard"],
    "Modular Character Outfits - Fantasy[Standard].zip": ["Outfits/Male_Ranger", "Outfits/Male_Peasant", "Outfits/Female_Peasant"],
}


def main():
    os.makedirs(OUT, exist_ok=True)
    for zn, items in WANT.items():
        z = zipfile.ZipFile(os.path.join(RAW, zn)); names = z.namelist()
        for it in items:
            g = next(n for n in names if n.endswith(it + ".gltf"))
            d = posixpath.dirname(g)
            j = json.loads(z.read(g))
            deps = [b["uri"] for b in j.get("buffers", []) if "uri" in b] + [i["uri"] for i in j.get("images", []) if "uri" in i]
            for f in [posixpath.basename(g)] + deps:
                b = posixpath.basename(f)
                src = g if f == b == posixpath.basename(g) else next((n for n in names if n.endswith("/" + b) or n.endswith("/" + b.replace("_png.png", ".png"))), None)
                if not src:
                    print("  çatışmır:", b); continue
                with open(os.path.join(OUT, b), "wb") as o:
                    o.write(z.read(src))
            nodes = [n.get("name") for n in j.get("nodes", [])]
            print(posixpath.basename(it), "meshes", len(j.get("meshes", [])), "skins", len(j.get("skins", [])), "nodes", len(nodes), "deps", deps)
    z = zipfile.ZipFile(os.path.join(RAW, "Universal Animation Library[Standard].zip"))
    with open(os.path.join(OUT, "UAL1.glb"), "wb") as o:
        o.write(z.read("Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb"))


if __name__ == "__main__":
    main()

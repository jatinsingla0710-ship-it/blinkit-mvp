from PIL import Image
from pathlib import Path

src = Path(
    r"C:\Users\ambem\.cursor\projects\c-Users-ambem-blinkit-mvp\assets"
    r"\c__Users_ambem_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"285dad25caf36728fb2ee47337b4be3e_images_Add_a_subheading-"
    r"274b7d20-2b61-4c61-b4cd-4e1b762d3492.png"
)
out = Path(r"c:\Users\ambem\blinkit-mvp\apps\sales-pwa\public\icons")
img = Image.open(src).convert("RGBA")
print("source", img.size)

def fit_square(image, size, pad_ratio=0.0, bg=(14, 56, 40, 255)):
    canvas = Image.new("RGBA", (size, size), bg)
    inner = max(1, int(size * (1 - 2 * pad_ratio)))
    w, h = image.size
    scale = max(inner / w, inner / h)
    nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    resized = image.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - inner) // 2
    top = (nh - inner) // 2
    cropped = resized.crop((left, top, left + inner, top + inner))
    offset = (size - inner) // 2
    canvas.paste(cropped, (offset, offset), cropped)
    return canvas

corner = img.getpixel((2, 2))
bg = (corner[0], corner[1], corner[2], 255)
print("bg", bg)

fit_square(img, 192, 0.0, bg).save(out / "icon-192.png", optimize=True)
fit_square(img, 512, 0.0, bg).save(out / "icon-512.png", optimize=True)
fit_square(img, 512, 0.18, bg).save(out / "icon-512-maskable.png", optimize=True)
fit_square(img, 180, 0.0, bg).save(out / "apple-touch-icon.png", optimize=True)
for name in [
    "icon-192.png",
    "icon-512.png",
    "icon-512-maskable.png",
    "apple-touch-icon.png",
]:
    p = out / name
    with Image.open(p) as check:
        print(name, check.size, p.stat().st_size)

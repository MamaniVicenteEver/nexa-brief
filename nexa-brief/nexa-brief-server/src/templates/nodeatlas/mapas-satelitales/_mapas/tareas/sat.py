"""sat.py <src.jpg> <lon0s,lon1s,latTop,latBottom> <lon0,lon1,lat0,lat1> <px por grado> <out.jpg>
Recorta Blue Marble (equirectangular), lo pasa a Mercator y lo gradúa como la referencia (océano azul marino)."""
import sys, numpy as np
from PIL import Image, ImageEnhance
Image.MAX_IMAGE_PIXELS = None
merc = lambda lat: np.log(np.tan(np.pi / 4 + np.radians(lat) / 2))
src, sb, b, ppd, out = sys.argv[1], [float(x) for x in sys.argv[2].split(",")], [float(x) for x in sys.argv[3].split(",")], float(sys.argv[4]), sys.argv[5]
lon0s, lon1s, lat1s, lat0s = sb; lon0, lon1, lat0, lat1 = b
im = Image.open(src); W, H = im.size
x0 = int((lon0 - lon0s) / (lon1s - lon0s) * W); x1 = int((lon1 - lon0s) / (lon1s - lon0s) * W)
y0 = int((lat1s - lat1) / (lat1s - lat0s) * H); y1 = int((lat1s - lat0) / (lat1s - lat0s) * H)
crop = im.crop((x0, y0, x1, y1)).resize((int((lon1 - lon0) * ppd), int((lat1 - lat0) * ppd)), Image.LANCZOS)
a = np.asarray(crop).astype(np.float32) / 255
m0, m1 = merc(lat0), merc(lat1); oh = int(round((m1 - m0) / np.radians(1) * ppd))
m = m1 - (np.arange(oh) + 0.5) / oh * (m1 - m0); lat = np.degrees(2 * np.arctan(np.exp(m)) - np.pi / 2)
a = a[np.clip(((lat1 - lat) / (lat1 - lat0) * a.shape[0]).astype(int), 0, a.shape[0] - 1)]
r, g, bl = a[..., 0], a[..., 1], a[..., 2]
ocean = np.clip((bl - np.maximum(r, g) * 1.05) * 5, 0, 1)[..., None]
lum = a.mean(-1, keepdims=True)
a = (a ** 1.15 * 0.95) * (1 - ocean) + (np.array([0.07, 0.15, 0.22]) + lum * np.array([0.15, 0.35, 0.45])) * ocean
img = ImageEnhance.Color(ImageEnhance.Contrast(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))).enhance(1.12)).enhance(1.25)
img.save(out, quality=88); print(out, img.size)

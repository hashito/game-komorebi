# OG image 1200x630 from the game's own render (tools/play/og.mjs): sky from the render, the island on the right, the title on the left.
# python -I tools/make-og.py D:/komorebi-stages/og-src.png assets/og-image.png
import sys
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
W, H = 1200, 630
sky = im.crop((20, 0, 21, im.height)).resize((W, H))
island = im.crop((160, 95, 1330, 915))
s = 0.71
island = island.resize((round(island.width * s), round(island.height * s)), Image.LANCZOS)
# keep the island's own sky behind it: blend its border into the backdrop by pasting with a soft mask
mask = Image.new('L', island.size, 255)
d = ImageDraw.Draw(mask)
for i in range(24):
    d.rectangle((i, i, island.width - 1 - i, island.height - 1 - i), outline=round(255 * i / 24))
canvas = sky.copy()
canvas.paste(island, (W - island.width - 10, (H - island.height) // 2 + 4), mask)
d = ImageDraw.Draw(canvas)
F = 'C:/Windows/Fonts/'
title = ImageFont.truetype(F + 'BIZ-UDGothicB.ttc', 66)
sub = ImageFont.truetype(F + 'BIZ-UDGothicB.ttc', 25)
en = ImageFont.truetype(F + 'BIZ-UDGothicR.ttc', 20)
x, y = 48, 170
d.text((x + 3, y + 4), 'こもれび', font=title, fill=(255, 251, 234))
d.text((x, y), 'こもれび', font=title, fill=(51, 69, 54))
d.text((x + 3, y + 88), 'の庭', font=title, fill=(255, 251, 234))
d.text((x, y + 84), 'の庭', font=title, fill=(51, 69, 54))
d.text((x + 2, y + 172), 'KOMOREBI GARDEN', font=en, fill=(73, 104, 69))
for i, line in enumerate(['空に浮かぶ島に', '木や花を植えて', 'くるりと眺める箱庭']):
    d.text((x, y + 220 + i * 36), line, font=sub, fill=(68, 90, 64))
canvas.save(out, optimize=True)
print(out, canvas.size)

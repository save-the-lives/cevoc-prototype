#!/usr/bin/env python3
"""Builds the prototype's evidence images and videos from the photo set in assets-src/real.

Every frame gets a camera data strip and a SAMPLE band so nothing can be mistaken for real evidence, and the number
plates are re-lettered to match each fictitious notice. Run from the repo root:  python3 scripts/make-media.py
Needs Pillow and ffmpeg. Output goes to public/assets/media.
"""
import os, subprocess, sys
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

SRC = 'assets-src/real'
OUT = 'public/assets/media'
TMP = os.environ.get('MEDIA_TMP', '/tmp/cevoc-media')
os.makedirs(OUT, exist_ok=True); os.makedirs(TMP, exist_ok=True)
MONO = '/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf'
SANS = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'

# plate boxes (x0, y0, x1, y1) in the source frames
VEH = {
    'v27': ('02-frame-01-original.webp', (248, 396, 328, 424)),  # white SUV
    'v25': ('03-frame-01-original.webp', (247, 372, 317, 397)),  # white sedan
    'v28': ('05-frame-01-original.webp', (123, 368, 201, 396)),  # dark wagon, wet night
    'v24': ('06-frame-01-original.webp', (338, 463, 415, 489)),  # grey SUV
    'v26': ('08-frame-01-original.webp', (365, 437, 444, 468)),  # ute
}
DAY = {'wide-m4': '14-incident-m4.webp', 'wide-road': '10-frame-01-original.webp', 'site': '16-incident-regional.webp', 'urban': '15-incident-urban.webp',
       'before': '11-before.png', 'ambiguous': '12-ambiguous.png', 'after': '13-after.png'}
DRIVER = {'d1': '01-frame-01-original.webp', 'd7': '07-frame-01-original.webp'}


def load(name):
    return Image.open(os.path.join(SRC, name)).convert('RGB')


def font(path, size):
    return ImageFont.truetype(path, size)


def relabel(im, bbox, text):
    """Replace the plate lettering inside bbox with `text`, matching the photo's tone."""
    x0, y0, x1, y1 = bbox
    g = im.convert('L').crop(bbox)
    data = sorted(g.tobytes())
    light = data[int(len(data) * 0.85)]
    dark = data[int(len(data) * 0.08)]
    w, h = x1 - x0, y1 - y0
    plate = Image.new('RGB', (w, h), (light,) * 3)
    ImageDraw.Draw(plate).rectangle([0, 0, w - 1, h - 1], outline=(max(dark, 40),) * 3)
    big = Image.new('L', (w * 10, h * 4), 0)
    ImageDraw.Draw(big).text((w * 5, h * 2), text, font=font(SANS, int(h * 4 * 0.78)), fill=255, anchor='mm')
    glyph = big.crop(big.getbbox()).resize((int(w * 0.84), int(h * 0.62)), Image.LANCZOS)
    plate.paste(Image.new('RGB', glyph.size, (max(dark, 25),) * 3), (int(w * 0.08), int(h * 0.19)), glyph)
    plate = plate.filter(ImageFilter.GaussianBlur(0.55))
    out = im.copy(); out.paste(plate, (x0, y0))
    return out


def bars(im, strip, band='SAMPLE IMAGE  -  MOCK DATA  -  NOT EVIDENCE', width=None):
    """Camera data strip on top, SAMPLE band at the bottom."""
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    w, h = im.size
    size = max(11, round(w / 44))
    top = size + 12; bot = size + 10
    canvas = Image.new('RGB', (w, h + top + bot), (6, 8, 12))
    canvas.paste(im, (0, top))
    d = ImageDraw.Draw(canvas)
    d.text((8, top // 2), strip, font=font(MONO, size), fill=(235, 240, 245), anchor='lm')
    d.rectangle([0, h + top, w, h + top + bot], fill=(160, 24, 44))
    d.text((w // 2, h + top + bot // 2), band, font=font(SANS, max(10, size - 2)), fill=(255, 225, 230), anchor='mm')
    return canvas


def closeup(im, bbox, strip):
    x0, y0, x1, y1 = bbox
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    cw = max((x1 - x0) * 4.4, 220); chh = cw * 2 / 3
    box = (int(cx - cw / 2), int(cy - chh * 0.42), int(cx + cw / 2), int(cy + chh * 0.58))
    box = (max(box[0], 0), max(box[1], 0), min(box[2], im.width), min(box[3], im.height))
    c = im.crop(box).resize((900, round(900 * (box[3] - box[1]) / (box[2] - box[0]))), Image.LANCZOS)
    c = ImageEnhance.Contrast(c).enhance(1.08).filter(ImageFilter.UnsharpMask(1.4, 90, 2))
    return bars(c, strip)


def save(im, name, q=84):
    im.save(os.path.join(OUT, name), 'JPEG', quality=q, optimize=True, progressive=True)


def vehicle_frame(key, plate):
    f, bb = VEH[key]
    return relabel(load(f), bb, plate), bb


def shift(im, dx=14, dy=6, bright=1.07, contrast=1.05, scale=1.04):
    """A second capture of the same vehicle a little later: slightly different framing and exposure."""
    w, h = im.size
    big = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    x = min(max(int((big.width - w) / 2 + dx), 0), big.width - w); y = min(max(int((big.height - h) / 2 + dy), 0), big.height - h)
    out = big.crop((x, y, x + w, y + h))
    return ImageEnhance.Contrast(ImageEnhance.Brightness(out).enhance(bright)).enhance(contrast)


def make():
    # 1 fixed speed: CEV123 at PAR-001
    s = 'PAR-001  2026-09-18 07:42:13  68 km/h  LIMIT 60'
    im, bb = vehicle_frame('v27', 'CEV123')
    save(bars(im, s), 'cev123-scene.jpg'); save(closeup(im, bb, s + '  PLATE'), 'cev123-plate.jpg')
    save(bars(load(DAY['wide-m4']), 'PAR-001  WIDE VIEW OF THE ROAD', width=1100), 'cev123-wide.jpg')
    # 2 mobile speed at night: MOB789 at MOB-312
    s = 'MOB-312  2026-09-04 22:16:40  81 km/h  LIMIT 70'
    im, bb = vehicle_frame('v28', 'MOB789')
    save(bars(im, s), 'mob789-scene.jpg'); save(closeup(im, bb, s + '  PLATE'), 'mob789-plate.jpg')
    save(bars(load(DAY['site']), 'MOB-312  CAMERA SET UP AT THE SITE', width=1100), 'mob789-site.jpg')
    bars(im, s).save(f'{TMP}/mob789-vid.jpg', quality=92)
    # 3 red-light speed: RLC456 at RYD-014 (a sequence of frames plus the plate)
    s1 = 'RYD-014  2026-08-02 18:05:46  RED 2.1s  54 km/h'; s2 = 'RYD-014  2026-08-02 18:05:48  RED 3.2s  54 km/h'
    save(bars(load(DAY['before']), s1, width=1100), 'rlc456-red1.jpg'); save(bars(load(DAY['after']), s2, width=1100), 'rlc456-red2.jpg')
    im, bb = vehicle_frame('v24', 'RLC456')
    save(closeup(im, bb, 'RYD-014  2026-08-02 18:05:48  PLATE'), 'rlc456-plate.jpg')
    save(bars(load(DAY['urban']), 'RYD-014  WIDE VIEW OF THE INTERSECTION', width=1100), 'rlc456-wide.jpg')
    mid = 'RYD-014  2026-08-02 18:05:47  RED 2.6s  54 km/h'
    for n, (k, t) in enumerate((('before', s1), ('ambiguous', mid), ('after', s2)), 1):
        bars(load(DAY[k]), t, width=1100).save(f'{TMP}/rl{n}.jpg', quality=92)
    # 4 average speed: HVY321 between two points on AVG-HUM
    f, bb = VEH['v26']; a = relabel(load(f), bb, 'HVY321')
    save(bars(a, 'AVG-HUM  POINT A  2026-09-11 03:38:00'), 'hvy321-pointa.jpg')
    save(bars(shift(a), 'AVG-HUM  POINT B  2026-09-11 03:48:00'), 'hvy321-pointb.jpg')
    save(closeup(a, bb, 'AVG-HUM  2026-09-11 03:48:00  PLATE'), 'hvy321-plate.jpg')
    # 5 mobile phone: PHN555 at PHN-M4
    save(bars(load(DRIVER['d1']), 'PHN-M4  2026-09-23 08:12:05  DRIVER AREA'), 'phn555-driver.jpg')
    im, bb = vehicle_frame('v25', 'PHN555')
    save(closeup(im, bb, 'PHN-M4  2026-09-23 08:12:05  PLATE'), 'phn555-plate.jpg')
    # 6 RED777 at RYD-014
    t1 = 'RYD-014  2026-09-02 17:20:10  RED 0.6s  49 km/h'; t2 = 'RYD-014  2026-09-02 17:20:11  RED 1.4s  49 km/h'
    save(bars(load(DAY['ambiguous']), t1, width=1100), 'red777-red1.jpg'); save(bars(load(DAY['after']), t2, width=1100), 'red777-red2.jpg')
    im, bb = vehicle_frame('v27', 'RED777')
    save(closeup(im, bb, 'RYD-014  2026-09-02 17:20:11  PLATE'), 'red777-plate.jpg')
    # 7 SPD404 at PAR-001
    s = 'PAR-001  2026-08-14 06:55:30  71 km/h  LIMIT 60'
    im, bb = vehicle_frame('v25', 'SPD404')
    save(bars(im, s), 'spd404-scene.jpg'); save(closeup(im, bb, s + '  PLATE'), 'spd404-plate.jpg')
    save(bars(load(DAY['wide-road']), 'PAR-001  WIDE VIEW OF THE ROAD', width=1100), 'spd404-wide.jpg')
    # 8 MOB205 at MOB-312
    s = 'MOB-312  2026-09-12 20:41:02  79 km/h  LIMIT 70'
    im, bb = vehicle_frame('v24', 'MOB205')
    save(bars(im, s), 'mob205-scene.jpg'); save(closeup(im, bb, s + '  PLATE'), 'mob205-plate.jpg')
    save(bars(load(DAY['site']), 'MOB-312  CAMERA SET UP AT THE SITE', width=1100), 'mob205-site.jpg')
    # 9 PHN808 at PHN-M4
    save(bars(load(DRIVER['d7']), 'PHN-M4  2026-10-01 07:35:44  DRIVER AREA'), 'phn808-driver.jpg')
    im, bb = vehicle_frame('v28', 'PHN808')
    save(closeup(im, bb, 'PHN-M4  2026-10-01 07:35:44  PLATE'), 'phn808-plate.jpg')
    # 10 HVY654 at AVG-HUM
    f, bb = VEH['v28']; a = relabel(load(f), bb, 'HVY654')
    save(bars(a, 'AVG-HUM  POINT A  2026-09-25 02:02:00'), 'hvy654-pointa.jpg')
    save(bars(shift(a, dx=-12, dy=4, bright=1.1), 'AVG-HUM  POINT B  2026-09-25 02:12:00'), 'hvy654-pointb.jpg')
    save(closeup(a, bb, 'AVG-HUM  2026-09-25 02:12:00  PLATE'), 'hvy654-plate.jpg')


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print(r.stderr[-1500:]); sys.exit(1)


def videos():
    # slow push-in on the night frame, with sensor noise and a vignette
    run(['ffmpeg', '-y', '-loglevel', 'error', '-loop', '1', '-i', f'{TMP}/mob789-vid.jpg', '-t', '8', '-vf',
         "scale=1300:-2,zoompan=z='min(1+0.0011*on,1.38)':x='iw/2-(iw/zoom/2)':y='ih*0.62-(ih/zoom/2)':d=200:s=640x720:fps=25,noise=alls=9:allf=t,vignette=PI/5,format=yuv420p",
         '-c:v', 'libx264', '-crf', '29', '-preset', 'veryfast', '-movflags', '+faststart', f'{OUT}/mob789-video.mp4'])
    # the red-light sequence: three burst frames, each with a slow push-in, joined with hard cuts like an enforcement burst
    clips = []
    for n in (1, 2, 3):
        c = f'{TMP}/rl-clip{n}.mp4'
        run(['ffmpeg', '-y', '-loglevel', 'error', '-loop', '1', '-i', f'{TMP}/rl{n}.jpg', '-t', '2.7', '-vf',
             "scale=1500:-2,zoompan=z='1+0.0011*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=68:s=1100x692:fps=25,noise=alls=7:allf=t,format=yuv420p",
             '-c:v', 'libx264', '-crf', '27', '-preset', 'veryfast', c])
        clips.append(c)
    with open(f'{TMP}/rl-list.txt', 'w') as fh:
        fh.write(''.join(f"file '{c}'\n" for c in clips))
    run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', f'{TMP}/rl-list.txt', '-c:v', 'libx264', '-crf', '27', '-preset', 'veryfast', '-movflags', '+faststart', f'{OUT}/rlc456-video.mp4'])
    for n in ('mob789', 'rlc456'):
        run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '1.2', '-i', f'{OUT}/{n}-video.mp4', '-frames:v', '1', '-q:v', '4', f'{OUT}/{n}-video-poster.jpg'])


def sizes():
    import json
    d = {f: max(1, round(os.path.getsize(os.path.join(OUT, f)) / 1024)) for f in sorted(os.listdir(OUT))}
    with open('src/media-sizes.json', 'w') as fh:
        json.dump(d, fh, indent=1)


if __name__ == '__main__':
    make(); videos(); sizes()
    print('done:', len(os.listdir(OUT)), 'files in', OUT)

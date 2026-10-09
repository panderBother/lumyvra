"""Render a seamless original particle-sculpture film, with no downloaded media.
Requires numpy, opencv-python and imageio-ffmpeg. Assets are generated offline.
"""
from pathlib import Path
import math
import subprocess
import cv2
import numpy as np
import imageio_ffmpeg

DEST = Path(__file__).resolve().parents[1] / "public" / "media"
DEST.mkdir(parents=True, exist_ok=True)
W, H, FPS, SECONDS = 960, 1280, 24, 10
rng = np.random.default_rng(817)
u, v = np.meshgrid(np.linspace(0, 2 * math.pi, 420, endpoint=False), np.linspace(0, 2 * math.pi, 58, endpoint=False))
u, v = u.ravel(), v.ravel()
stars = rng.random((260, 4))
yy, xx = np.mgrid[0:H, 0:W]
halo = np.exp(-(((xx-W*.53)/(W*.55))**2+((yy-H*.42)/(H*.32))**2))
base = np.stack([12+halo*9, 15+halo*12, 11+halo*5], axis=-1).astype(np.float32)
encoder = subprocess.Popen([
    imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-f", "rawvideo", "-vcodec", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264", "-preset", "fast",
    "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(DEST / "lumyvra-sound-bloom.mp4")
], stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)

for frame in range(FPS*SECONDS):
    t = frame / (FPS*SECONDS) * math.tau
    # A folded sound ribbon: depth and lighting move, with identical loop endpoints.
    radius = 2.12 + .30*np.sin(3*u+t) + .13*np.cos(5*u-2*t)
    tube = .56 + .11*np.sin(2*u-t)
    x = (radius + tube*np.cos(v))*np.cos(u)
    y = (radius + tube*np.cos(v))*np.sin(u)
    z = tube*np.sin(v) + .4*np.sin(2*u+t)
    tilt = .6 + .13*np.sin(t)
    y, z = y*np.cos(tilt)-z*np.sin(tilt), y*np.sin(tilt)+z*np.cos(tilt)
    turn = .24*np.sin(t)+.14
    x, y = x*np.cos(turn)-y*np.sin(turn), x*np.sin(turn)+y*np.cos(turn)
    scale = 163 / (1-z*.11)
    px, py = (W*.51+x*scale).astype(int), (H*.40+y*scale).astype(int)
    intensity = (.22+.78*(np.sin(v+u*.8+t)*.5+.5))*(.6+(z+1.8)*.23)
    points = np.zeros((H,W), np.float32)
    valid = (px>1)&(px<W-2)&(py>1)&(py<H-2)
    np.add.at(points,(py[valid],px[valid]),intensity[valid])
    # Keep sharp point cores; bloom only the surrounding light.
    sharp = cv2.GaussianBlur(points,(3,3),.45)
    glow = cv2.GaussianBlur(points,(0,0),5)
    light = np.minimum(sharp*180+glow*125,240)
    image = base + light[:,:,None]*np.array([.90,1.,.57],np.float32)
    for sx,sy,depth,phase in stars:
        ax = int((sx*W+7*np.sin(t+phase*math.tau))%W)
        ay = int((sy*H+10*np.cos(t+phase*math.tau))%H)
        brightness = 22+depth*80*(.65+.35*np.sin(t+phase*math.tau))
        cv2.circle(image,(ax,ay),1,(brightness*.85,brightness,brightness*.6),-1,cv2.LINE_AA)
    rgb=np.clip(image,0,255).astype(np.uint8)
    if frame==0: cv2.imwrite(str(DEST/"lumyvra-sound-bloom-poster.webp"),cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR),[cv2.IMWRITE_WEBP_QUALITY,92])
    encoder.stdin.write(rgb.tobytes())
    if frame % FPS == 0: print(f"Rendered {frame//FPS}/{SECONDS}s",flush=True)
encoder.stdin.close()
if encoder.wait()!=0: raise RuntimeError("Video encoding failed")
print(f"Saved {DEST / 'lumyvra-sound-bloom.mp4'}",flush=True)

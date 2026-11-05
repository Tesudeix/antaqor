# -*- coding: utf-8 -*-
"""ANTAQOR өдрийн (цайвар) давхарга — theme-day.css (2026-10-23).
src доторх БОДИТ Tailwind өнгөний классуудыг уншиж, гэрэлтэлтээр нь (luminance)
ангилж цайвар утга онооно. theme-light.css (2026-09) нь хуучин палитрт зориулсан
тул 10/19-ний #0A0A0A/#141414/#1E1E1E гэр бүлийг огт мэдэхгүй — энэ нь тэр цоорхой.
class~= (яг токен) тааруулна: hover:/md: хувилбар суурь төлөвт хүчээр орохгүй."""
import os, re, sys, colorsys
SRC = sys.argv[1]
SKIP = ("/rent", "/yuki", "/erchis", "RentApp", "theme-light", "theme-day")
pat = re.compile(r'((?:[a-z-]+:)*)(bg|from|via|to|text|placeholder|border(?:-[trblxy])?|divide|ring|outline|fill|stroke|decoration|caret|shadow)-\[(#[0-9A-Fa-f]{6})\](/\d+)?')
found = {}
for root, _, files in os.walk(SRC):
    for f in files:
        p = os.path.join(root, f)
        if ".bak" in f or not f.endswith((".tsx", ".ts")) or any(s in p for s in SKIP): continue
        for m in pat.finditer(open(p, encoding="utf-8", errors="ignore").read()):
            key = (m.group(1), m.group(2), m.group(3).upper(), m.group(4) or "")
            found[key] = found.get(key, 0) + 1

def lum(h):
    c = [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
def sat(h):
    r, g, b = [int(h[i:i+2], 16) for i in (1, 3, 5)]
    return max(r, g, b) - min(r, g, b)
def hue(h):
    r, g, b = [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]
    return colorsys.rgb_to_hsv(r, g, b)[0] * 360

BRAND, BRAND_D = "#2E29FF", "#1F1AD9"
KEEP = {"#2E29FF", "#1F1AD9", "#4C47FF", "#5B3BFF", "#2563FF"}
def surface(h, hover=False):
    if h in KEEP: return None
    L = lum(h)
    if sat(h) > 40 and L < 0.06: return "#EEF0FF" if not hover else "#E4E7FF"   # бараан цэнхэр/өнгөт гадаргуу → брэнд tint
    if L < 0.0058: return "#F8F9FD" if not hover else "#F1F2F7"                  # хуудасны суурь
    if L < 0.0095: return "#FFFFFF" if not hover else "#F4F5FA"                  # карт
    if L < 0.017: return "#F1F2F7" if not hover else "#EAECF3"                   # өргөгдсөн
    if L < 0.06: return "#E8EAF2" if not hover else "#E1E4EE"
    return None
def ink(h):
    L, S = lum(h), sat(h)
    if S > 70 and L > 0.12:                      # өнгөт цайвар бичиг → цагаан дээр AA
        H = hue(h)
        if 45 <= H < 70: return BRAND            # шар (#FCEE0A, #FFD300) → брэнд
        if 70 <= H < 170: return "#15803D"
        if 170 <= H < 200: return "#0E7490"
        if 200 <= H < 255: return "#1D4ED8"
        if 255 <= H < 290: return "#5B21B6"
        if 20 <= H < 45: return "#B45309"
        return "#C81E4A"
    if L >= 0.85: return "#14151C"
    if L >= 0.60: return "#30333F"
    if L >= 0.28: return "#565967"
    if L >= 0.12: return "#686B78"
    return None
def line(h):
    if h in KEEP: return None
    L, S = lum(h), sat(h)
    if S > 70 and L > 0.25 and 45 <= hue(h) < 70: return BRAND
    if L < 0.06: return "#E3E6EE"
    return None

S = ':root[data-theme="light"] body'
rules = {}   # (prop, value) -> selectors
def add(prop, val, sel): rules.setdefault((prop, val), []).append(sel)
skipped = []
for (vp, kind, h, op), n in sorted(found.items(), key=lambda x: -x[1]):
    tok = f'{vp}{kind}-[{h}]{op}'
    interactive = [v for v in vp.split(":") if v in ("hover", "focus", "focus-visible", "active", "group-hover", "peer-focus", "focus-within")]
    resp_only = vp and not interactive and not any(v in ("placeholder", "disabled", "file", "dark") for v in vp.split(":"))
    if "dark:" in vp or "marker:" in vp or "print:" in vp: continue
    if kind in ("bg", "from", "via", "to"):
        v = surface(h, hover=bool(interactive))
        if not v: continue
        if op:   # бараан /80 → цайвар тунгалаг (наалдамхай толгой, sheet)
            a = int(op[1:]) / 100
            v = f"rgba({int(v[1:3],16)},{int(v[3:5],16)},{int(v[5:7],16)},{max(a, 0.86):.2f})" if kind == "bg" else v
        prop = {"bg": "background-color", "from": "--tw-gradient-from", "via": "--tw-gradient-via", "to": "--tw-gradient-to"}[kind]
        if kind in ("from", "via", "to"): v = f"{v} var(--tw-gradient-{kind}-position)"
    elif kind in ("text", "fill", "stroke", "decoration", "caret", "placeholder"):
        v = ink(h)
        if not v: continue
        prop = {"text": "color", "fill": "fill", "stroke": "stroke", "decoration": "text-decoration-color", "caret": "caret-color", "placeholder": "color"}[kind]
        if kind == "placeholder" or "placeholder" in vp: v = "#8A8D99"
    elif kind.startswith(("border", "divide", "ring", "outline")):
        v = line(h)
        if not v: continue
        prop = {"ring": "--tw-ring-color", "outline": "outline-color"}.get(kind, "border-color")
    else:
        continue
    esc = tok.replace('"', '\\"')
    if "placeholder" in vp or kind == "placeholder":
        sel = f'{S} [class~="{esc}" i]::placeholder'
    elif interactive:
        state = {"hover": ":hover", "focus": ":focus", "focus-visible": ":focus-visible", "active": ":active", "focus-within": ":focus-within"}
        if "group-hover" in interactive: sel = f'{S} .group:hover [class~="{esc}" i]'
        elif "peer-focus" in interactive: sel = f'{S} .peer:focus ~ [class~="{esc}" i]'
        else: sel = f'{S} [class~="{esc}" i]{"".join(state[i] for i in interactive if i in state)}'
    else:
        sel = f'{S} [class~="{esc}" i]'
    if "disabled:" in vp and "::placeholder" not in sel: sel += ":disabled"
    if kind == "divide": sel += " > * + *"
    add(prop, v, sel)

out = [__doc__.replace('"""', "").join(["/*", "*/"]) if False else "/* ══ theme-day.css — ҮҮСГЭСЭН (scripts/theme-day.gen.py). Гараар засах бол theme-day-extra хэсэгт. ══ */"]
for (prop, val), sels in rules.items():
    out.append(",\n".join(sorted(set(sels))) + f" {{ {prop}: {val} !important; }}")
print("\n".join(out))
print(f"/* {sum(len(v) for v in rules.values())} сонгогч · {len(found)} класс уншсан */")

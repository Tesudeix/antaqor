# -*- coding: utf-8 -*-
"""Generate the ANTAQOR light-theme override layer for globals.css.

Written as a generator rather than by hand because every rule needs three
variants (base, hover, focus/group-hover) and the base rule needs a
:not() guard so a `hover:text-[#X]` utility does not get force-applied in
its resting state. Hand-writing ~150 of those is how typos happen.
"""

SCOPE = ':root[data-theme="light"]'

# ── ӨДӨР palette ────────────────────────────────────────────────────────
CANVAS   = "var(--l-canvas)"
SURFACE  = "var(--l-surface)"
SURF2    = "var(--l-surface-2)"
LINE     = "var(--l-line)"
LINESTR  = "var(--l-line-strong)"
LINESOL  = "var(--l-line-solid)"
INK      = "var(--l-ink)"
MUTED    = "var(--l-muted)"
DIM      = "var(--l-dim)"
ACC      = "var(--l-accent-ink)"
ACCDEEP  = "var(--l-accent-deep)"
TINT     = "var(--l-tint)"

VARIANTS = ["hover", "focus", "focus-visible", "active", "group-hover",
            "peer-focus", "disabled", "placeholder", "file", "aria-selected",
            "data-[active=true]"]


def esc(s):
    """CSS attribute-selector value — only the double quote needs escaping."""
    return s.replace('"', '\\"')


def block(prop, value, pats, kind, no_slash=False, comment=None, guards=("hover", "focus")):
    """One mapping bucket → base rule + variant rule.

    `pats` are raw class-name substrings (e.g. `bg-[#0A0A0A]`).
    """
    out = []
    if comment:
        out.append("/* %s */" % comment)

    base, var = [], []
    for p in pats:
        e = esc(p)
        # A `hover:`/`focus:`/`group-hover:` form of the SAME utility must not
        # win in the resting state. Responsive forms (`md:bg-…`) SHOULD, so the
        # guard names the interactive prefixes instead of any `:` at all.
        sel = '%s [class*="%s"]' % (SCOPE, e)
        for g in guards:
            sel += ':not([class*="%s:%s"])' % (g, e)
        if no_slash:
            # `bg-[#000000]/70` is a scrim over media, not a surface. Leave it.
            sel += ':not([class*="%s/"])' % e
        base.append(sel)
        var.append('%s [class*=":%s"]:is(:hover,:focus,:focus-visible,:active)' % (SCOPE, e))
        var.append('%s .group:hover [class*="group-hover:%s"]' % (SCOPE, e))
        if "placeholder" in guards:
            var.append('%s [class*="placeholder:%s"]::placeholder' % (SCOPE, e))
        if "disabled" in guards:
            var.append('%s [class*="disabled:%s"]:disabled' % (SCOPE, e))

    out.append(",\n".join(base) + " {\n  %s: %s !important;\n}" % (prop, value))
    out.append(",\n".join(var) + " {\n  %s: %s !important;\n}" % (prop, value))
    return "\n".join(out)


def plain(sels, decls, comment=None):
    out = []
    if comment:
        out.append("/* %s */" % comment)
    out.append(",\n".join(sels) + " {\n" + "\n".join("  %s" % d for d in decls) + "\n}")
    return "\n".join(out)


P = []

HEADER = u'''
/* ══════════════════════════════════════════════════════════════════════════
   §07 — ӨДӨР / ШӨНӨ.  Нэг систем, хоёр горим.        (2026-08-21)

   Энэ сайт ШӨНӨӨР бичигдсэн: globals.css-ийн бүх өнгө болон 100+ файлын
   arbitrary hex нь харанхуй суурь дээр тооцоологдсон. Тиймээс "гэрэл"
   горим нэмэх нь хоёр тусдаа ажил байсан:

   1) Дээрх COHESION давхаргыг УНТРААХ. Тэр давхарга нь хуучин гэрэлтэй
      сэдвийн үлдэгдэл (bg-white, bg-[#f2f5f8], text-[#0e1726] …)-ийг
      харанхуй руу албаддаг байсан. Гэрэл горимд тэдгээр нь ЗӨВ утга —
      саадыг нь авахад өөрсдөө буцаж ирнэ. Тиймээс cohesion-ий селектор
      бүрийг `html:not([data-theme="light"])`-ээр угтвар болгосон.

   2) ХАРАНХУЙД ТӨРСӨН утгуудыг гэрэл рүү буулгах — доорх урвуу давхарга.
      bg-[#0A0A0A], text-[#E8E8E8], border-[rgba(255,255,255,.08)] нь гэрэл
      дээр утгагүй (цагаан дээр цагаан). Cohesion-той яг ижил техник:
      ангийн НЭРЭЭР барьж, утгыг нь дахин тодорхойлно.

   Радиус (§03), сүүдэргүй (§04), товч хүрээгүй (§05) нь ӨНГӨ БИШ, ГЕОМЕТР
   — хоёр горимд ижил хэвээр үлдэнэ. Гэрэл горим нь өөр сайт биш, ижил
   сайтын өөр цаг.

   ГУРВАН ДҮРЭМ, ЭНЭ ДАВХАРГЫГ ЗАСАХААС ӨМНӨ УНШ:
   • Селектор бүр `:root[data-theme="light"] body:not(:has(.yuki-root))`-ээр
     эхэлнэ. `:root[attr]` нь cohesion-ий `html:not([attr])`-аас өндөр
     жинтэй тул файлын дараалалаас үл хамааран ялна.
   • Үндсэн дүрэм бүр `:not([class*=":<тухайн анги>"])` хамгаалалттай.
     Үүнгүй бол `hover:text-[#FD5E53]` бичсэн 172 элемент амарч байхдаа ч
     улаан болно. Хажууд нь hover/focus/active/group-hover хувилбарын
     дүрэм тусад нь явна.
   • Хар дэвсгэртэй ЗУРАГ дээрх цагаан бичиг цагаан хэвээр (доорх SCRIM
     хэсэг). Тэнд ink болговол зураг дээр уншигдахгүй болно.
   ══════════════════════════════════════════════════════════════════════════ */

:root[data-theme="light"] {
  /* ── ӨДРИЙН гадаргууны шат. Шөнийн урвуу: карт нь суурьнаасаа ЦАЙВАР
        байснаа гэрэл дээр суурь нь карт руу ойртож, карт цэвэр цагаан
        болно. Цэвэр #FFFFFF-ийг СУУРЬ болгож болохгүй — тэгвэл картад
        өргөгдөх зай үлдэхгүй, бүх зүйл нэг хавтгайд наалдана. */
  --l-canvas:       #F7F5F2;   /* хуудасны суурь — цагаанаас нэг шат доогуур */
  --l-surface:      #FFFFFF;   /* карт, самбар — суурьнаас ДЭЭР */
  --l-surface-2:    #EEEBE7;   /* үүрлэсэн гадаргуу, input, hover бай */
  --l-surface-3:    #E4E0DB;   /* дарагдсан төлөв, идэвхтэй чип */
  --l-line:         rgba(23,23,26,0.10);
  --l-line-strong:  rgba(23,23,26,0.22);
  --l-line-solid:   #E4E1DD;   /* тунгалаг бус хуваагч */
  --l-tint:         rgba(23,23,26,0.05);

  /* Текстийн шат — гурвуулаа #FBFAF9 дээр AA давсан:
     ink 16.4:1 · muted 6.8:1 · dim 4.6:1 */
  --l-ink:          #17171A;
  --l-muted:        #55555C;
  --l-dim:          #6E6E76;

  /* TENGER гэрэл дээр. Дүүргэлт нь #FD5E53 хэвээр (түүн дээрх бичиг нь
     шөнөтэй адил бараан — цагаан бичиг коралл дээр 3:1 хүрэхгүй). Харин
     БИЧИГ болж хэрэглэгдэх үед гүнзгийрүүлнэ: #FD5E53 нь цагаан дээр
     2.9:1 буюу уншигдахгүй, #C7402F нь 4.9:1. */
  --l-accent-ink:   #C7402F;
  --l-accent-deep:  #A83224;

  color-scheme: light;

  /* Гараар бичсэн CSS-ийн уншдаг токенууд. Tailwind-ийн @theme inline нь
     утилитэд утгыг ШУУД шигтгэдэг тул эдгээрийг сольсноор `bg-surface`
     төрлийн утилит өөрчлөгдөхгүй — гэхдээ энэ апп тэдгээрийг ашигладаггүй
     (бүгд arbitrary hex), харин .card / .su-… / .blog-content зэрэг нь var()
     уншдаг тул эндээс шууд дагана. */
  --color-background: #F7F5F2;
  --color-foreground: #17171A;
  --color-surface:    #FFFFFF;
  --color-border:     #E4E1DD;
  --color-ink:        #17171A;
  --color-muted:      #55555C;
  --color-dim:        #6E6E76;
  --color-black:      #F7F5F2;
  --surface:          #FFFFFF;
  --surface-2:        #EEEBE7;
  --surface-hover:    #E4E0DB;
  --line:             rgba(23,23,26,0.10);
  --line-strong:      rgba(23,23,26,0.22);

  --nav-fg:           #55555C;
  --nav-fg-strong:    #17171A;
  --nav-hover-bg:     #EEEBE7;
  --nav-active-bg:    rgba(253,94,83,0.12);

  --glow: 0 0 0 1px #FD5E53, 0 8px 22px -8px rgba(253,94,83,0.55);

  /* Хоёр горимын товчлуур */
  --tt-track:  #E6E2DD;
  --tt-edge:   rgba(23,23,26,0.12);
  --tt-thumb:  #FFFFFF;
  --tt-ico:    #8A8A92;
  --tt-ico-on: #C7402F;
}

:root[data-theme="dark"] {
  --tt-track:  #232327;
  --tt-edge:   rgba(255,255,255,0.10);
  --tt-thumb:  #3B3B41;
  --tt-ico:    #7A7A82;
  --tt-ico-on: #FD5E53;
}

/* ─── Суурь ─────────────────────────────────────────────────────────────── */
:root[data-theme="light"] {
  background: var(--l-canvas);
}
:root[data-theme="light"] body {
  background: var(--l-canvas);
  color: var(--l-ink);
}
/* .light-page нь дээр харанхуй руу нугалагдсан — гэрэл горимд буцаана. */
:root[data-theme="light"]:has(.light-page),
:root[data-theme="light"] body:has(.light-page) {
  background: var(--l-canvas);
  color: var(--l-ink);
}
:root[data-theme="light"] ::selection {
  background: #FD5E53;
  color: #17171A;
}
:root[data-theme="light"] ::-webkit-scrollbar-thumb,
:root[data-theme="light"] body:has(.light-page) ::-webkit-scrollbar-thumb {
  background: #C9C5C0;
}
/* Брэндийн хөшиг — өдөр цагаан дэвсгэр дээр гарна. */
:root[data-theme="light"] .intro-splash { background: var(--l-canvas); }
'''
P.append(HEADER)

# ── БҮРХҮҮЛ: хуудасны суурь болж хэрэглэгддэг харанхуй хэсгүүд ───────────
# Зөвхөн ҮНЭХЭЭР хуудасны суурь болдог хэсгүүд.
PAGE_DARK = ["#161618", "#151518", "#171719", "#181818", "#18181b", "#1a1a1e",
             "#1c1c22"]
TRUE_BLACK = ["#000000", "#000"]

P.append(block("background-color", CANVAS, ["bg-[%s]" % h for h in PAGE_DARK], "bg",
               comment=u"Хуудасны суурь → өдрийн суурь."))
P.append(block("background-color", CANVAS, ["bg-[%s]" % h for h in TRUE_BLACK],
               "bg", no_slash=True,
               comment=u"Цэвэр хар. `/` бүхий хувилбарыг ЗӨВХӨН энд хассан — bg-black/70\n"
                       u"   гэдэг нь гадаргуу биш, зураг дээрх хөшиг. Бусад hex дээр\n"
                       u"   `/` нь ердөө тунгалагдуу гадаргуу (жишээ нь bg-[#0E0E12]/95\n"
                       u"   гэсэн хөвөгч чип) тул тэднийг хасах нь харанхуй чип дээр\n"
                       u"   бараан бэх үлдээж, уншигдахгүй болгоно."))

# .bg-black нь @theme-ийн --color-black-оос #161618 болж шийдэгддэг.
P.append(plain(
    ['%s .bg-black' % SCOPE, '%s .hover\\:bg-black:hover' % SCOPE],
    ["background-color: %s !important;" % CANVAS],
    comment=u"Tailwind-ийн `bg-black` (--color-black = #161618). bg-black/70 нь хөшиг — үлдэнэ."))

# ── САМБАР: картын түвшин ───────────────────────────────────────────────
# Картын түвшин. Шөнийн сэдэвт эдгээрийн ихэнх нь суурь #161618-аас БАРААН
# байсан — "хонхойсон" самбар. Өдөр самбар нь эсрэгээрээ суурьнаас ДЭЭГҮҮР
# гардаг тул бүгд цэвэр цагаан руу очно. Кодын жинхэнэ хэрэглээ (grep) үүнийг
# баталсан: `bg-[#141419]`-ийн 76 хэрэглээний бараг бүгд нь `rounded-[4px]
# border border-[rgba(255,255,255,0.08)] p-4` буюу карт.
PANEL_DARK = ["#010101", "#050505", "#060608", "#06060A", "#070709", "#08080A",
              "#0A0A0A", "#0A0A0C", "#0A0A0F", "#0B0B0F", "#0c0c0f", "#0d0d10",
              "#0E0E10", "#0E0E12", "#0e0e14", "#101014", "#111114", "#131316",
              "#13131A", "#141416", "#141419", "#14141a", "#141420", "#141018",
              "#0e1726", "#1A1A1D", "#1B1B25", "#1C1C20", "#1D1D20", "#1E1E21",
              "#1F1F23", "#202023", "#22222c", "#232323", "#26262A"]

P.append(block("background-color", SURFACE, ["bg-[%s]" % h for h in PANEL_DARK], "bg",
               comment=u"Картын түвшин. Шөнөд суурьнаас ЦАЙВАР байсан нь өдөрт цэвэр цагаан."))

CHIP_DARK = ["#232327", "#2C2C31", "#2a2a35", "#2A2A30", "#3A3A40", "#2a2a34"]
P.append(block("background-color", SURF2, ["bg-[%s]" % h for h in CHIP_DARK], "bg",
               comment=u"Чип, идэвхтэй мөр, аватарын нүд — картаас нэг шат гүн."))

P.append(block("background-color", LINESOL, ["bg-[#333338]"], "bg",
               comment=u"#333338 нь хүрээний токен; дэвсгэр болж хэрэглэгдэхдээ 1px хуваагч."))

# Цагаан тунгалаг налархай (hover tint) → бараан налархай
P.append(plain(
    ['%s [class*="bg-[rgba(255,255,255,"]:not([class*=":bg-[rgba(255,255,255,"])' % SCOPE,
     '%s .bg-white\\/5' % SCOPE,
     '%s .bg-white\\/10' % SCOPE,
     '%s .bg-white\\/20' % SCOPE,
     '%s .bg-white\\/35' % SCOPE],
    ["background-color: %s !important;" % TINT],
    comment=u"Шөнийн цагаан налархай (hover/идэвхтэй) → өдрийн бараан налархай.\n"
            u"   bg-white/95 зэрэг ӨНДӨР alpha нь налархай биш, гадаргуу — үлдээв."))
P.append(plain(
    ['%s [class*="hover:bg-[rgba(255,255,255,"]:hover' % SCOPE,
     '%s .hover\\:bg-white\\/5:hover' % SCOPE,
     '%s .hover\\:bg-white\\/10:hover' % SCOPE,
     '%s .hover\\:bg-white\\/20:hover' % SCOPE,
     '%s .group:hover [class*="group-hover:bg-[rgba(255,255,255,"]' % SCOPE],
    ["background-color: %s !important;" % TINT]))

# ── ГРАДИЕНТ: харанхуй зогсоолууд ───────────────────────────────────────
GRAD_DARK = ["#0d0d10", "#0E0E10", "#0E0E12", "#101014", "#141018", "#141419",
             "#0A0A0C", "#161618"]
grad_sel = []
for h in GRAD_DARK:
    for pos in ("from", "via", "to"):
        grad_sel.append('%s [class*="%s-[%s]"]' % (SCOPE, pos, esc(h)))
P.append(plain(grad_sel,
               ["--tw-gradient-from: %s !important;" % CANVAS,
                "--tw-gradient-via: %s !important;" % CANVAS,
                "--tw-gradient-to: %s !important;" % CANVAS],
               comment=u"Хэсгийг суурь руу уусгадаг харанхуй градиент → өдрийн суурь руу."))

# ── БИЧИГ ───────────────────────────────────────────────────────────────
TEXT_INK = ["#FFFFFF", "#ffffff", "#fff", "#FFF", "#F2F2F4", "#f2f2f4",
            "#E8E8E8", "#e8e8e8", "#F8F8F6", "#f5f5f7", "#F4EFE6", "#F4F0E8",
            "#e8e6e1", "#F0F0F2", "#d9d9e1", "#D4D4D8", "#E8E8E6", "#F2F2F0"]
P.append(block("color", INK, ["text-[%s]" % h for h in TEXT_INK], "text",
               comment=u"Шөнийн үндсэн бичиг (цайвар) → өдрийн бэх."))
P.append(plain(['%s .text-white:not([class*=":text-white"])' % SCOPE],
               ["color: %s !important;" % INK]))
P.append(plain(['%s .hover\\:text-white:hover' % SCOPE,
                '%s .active\\:text-white:active' % SCOPE,
                '%s .group:hover .group-hover\\:text-white' % SCOPE],
               ["color: %s !important;" % INK]))

TEXT_MUTED = ["#B8B8BE", "#B8B8BD", "#A1A1A6", "#c9c9d1", "#AAAAAA", "#9A9A9F",
              "#8A8A92", "#8A8680", "#8890A0", "#94a3b8", "#d5dce3", "#dde3ea",
              "#ddd", "#D6D6DE", "#C2C2CE"]
P.append(block("color", MUTED, ["text-[%s]" % h for h in TEXT_MUTED], "text", guards=("hover", "focus", "placeholder", "disabled"),
               comment=u"Хоёрдогч бичиг. #94a3b8 · #d5dce3 · #dde3ea нь хуучин гэрэлт\n"
                       u"   сэдвийн үлдэгдэл боловч цагаан дээр 2.6:1 — хэтэрхий бүдэг\n"
                       u"   тул эдгээрийг ч мөн энэ шатанд татав."))
P.append(plain(['%s [class*="text-white/"]:not([class*=":text-white/"])' % SCOPE,
                '%s [class*="text-[rgba(240,236,227,"]' % SCOPE,
                '%s [class*="text-[rgba(244,239,230,"]' % SCOPE],
               ["color: %s !important;" % MUTED]))

TEXT_DIM = ["#808088", "#6B6B72", "#6E6E76", "#56565E", "#4a4a55", "#4A4A4F",
            "#45454C", "#6b6b73", "#5a5550", "#4A4A55", "#5C5C63"]
P.append(block("color", DIM, ["text-[%s]" % h for h in TEXT_DIM], "text", guards=("hover", "focus", "placeholder", "disabled"),
               comment=u"Гуравдагч / placeholder. Шөнөд эдгээр нь БҮДЭГ үүрэгтэй байсан;\n"
                       u"   #56565E-ийг өдөр шууд үлдээвэл 7:1 болж хүчтэй бичиг мэт\n"
                       u"   уншигдана — шатлал эргэнэ. Тиймээс үүргээр нь буулгав."))

# TENGER бичиг болохдоо гүнзгийрнэ
P.append(block("color", ACC, ["text-[#FD5E53]"], "text",
               comment=u"TENGER бичиг болж хэрэглэгдэх үед (768 газар) гүнзгийрнэ:\n"
                       u"   #FD5E53 цагаан дээр 2.9:1, #C7402F нь 4.9:1. Дүүргэлт нь\n"
                       u"   #FD5E53 хэвээр — түүн дээрх бичиг хоёр горимд адил бараан."))
P.append(block("color", ACCDEEP, ["text-[#FD7B72]"], "text",
               comment=u"Шөнөд hover нь ЦАЙВАР, өдөр БАРААН — тиймээс эсрэг тийш."))

# ── ХҮРЭЭ ───────────────────────────────────────────────────────────────
BORDER_HAIR = ["#333338", "#232327", "#1C1C20", "#2a2a35", "#22222c", "#101014",
               "#0a0a0c", "#2a2a34", "#2a2825", "#3a3835", "#1a1a1e", "#26262A",
               "#1E1E21", "#0E0E10"]
P.append(block("border-color", LINE, ["border-[%s]" % h for h in BORDER_HAIR], "border",
               comment=u"Шөнийн үсэн зураас (харанхуй hex) → өдрийн үсэн зураас."))
P.append(plain(['%s [class*="border-[rgba(255,255,255,"]:not([class*=":border-[rgba(255,255,255,"])' % SCOPE,
                '%s .border-white:not([class*=":border-white"])' % SCOPE,
                '%s [class*="border-white/"]:not([class*=":border-white/"])' % SCOPE],
               ["border-color: %s !important;" % LINE],
               comment=u"381 газарт бичигдсэн rgba(255,255,255,…) хүрээ — цагаан дээр\n"
                       u"   цагаан болж алга болно. Alpha бүрийг нэг утга руу цуглуулав:\n"
                       u"   0.04-оос 0.18 хүртэлх ялгаа нь шөнөд ч нүдэнд мэдрэгддэггүй."))
P.append(plain(['%s [class*="hover:border-[rgba(255,255,255,"]:hover' % SCOPE,
                '%s [class*="focus:border-[rgba(255,255,255,"]:focus' % SCOPE,
                '%s .hover\\:border-white:hover' % SCOPE,
                '%s .group:hover [class*="group-hover:border-[rgba(255,255,255,"]' % SCOPE],
               ["border-color: %s !important;" % LINESTR]))

BORDER_STRONG = ["#F2F2F4", "#56565E", "#808088", "#45454C", "#FFFFFF"]
P.append(block("border-color", LINESTR, ["border-[%s]" % h for h in BORDER_STRONG], "border",
               comment=u"Шөнөд ЦАЙВАР хүрээ = онцолсон/сонгогдсон төлөв. Өдөр тэр утга нь\n"
                       u"   бүр мөсөн алга болох тул онцлолыг хүчтэй зураас болгож хадгалав."))

# ── SCRIM: зураг/видео дээрх хар хөшиг өдөр ч хар хэвээр ────────────────
SCRIM = ('[class*="bg-black/"], [class*="from-black/"], [class*="via-black/"], '
         '[class*="to-black/"], [class*="bg-[rgba(0,0,0,"], '
         '[class*="from-[rgba(0,0,0,"], [class*="bg-[#000000]/"], [class*="bg-[#000]/"]')
# Зураг нь ШУУД (эсвэл нэг давхар) хүүхэд байх ёстой, "хаа нэгтээ дотор"
# биш. Мөн body БАЙЖ БОЛОХГҮЙ. Хоёулаа амьд сайтаас олдсон бодит алдааны
# хамгаалалт — доорх тайлбарыг унш.
MEDIA = (':not(body):has(> :is(img, video, picture), '
         '> :is(a, span, div, figure, button) > :is(img, video, picture))')
LIGHTTEXT = (':is(.text-white, [class*="text-white"], [class*="text-[#FFFFFF]"], '
             '[class*="text-[#ffffff]"], [class*="text-[#fff]"], [class*="text-[#F2F2F4]"], '
             '[class*="text-[#E8E8E8]"], [class*="text-[#B8B8BE]"], [class*="text-[#8A8A92]"], '
             '[class*="text-[#F8F8F6]"], [class*="text-[#D4D4D8]"])')
P.append(plain(
    [
        # хөшиг нь ЗУРГИЙГ дүүргэж, бичиг нь дотор нь
        '%s :is(%s)%s %s' % (SCOPE, SCRIM, MEDIA, LIGHTTEXT),
        # хөшиг нь absolute давхарга, зураг ба бичиг нь ХАЖУУД нь — хамгийн түгээмэл
        '%s :has(> :is(%s))%s %s' % (SCOPE, SCRIM, MEDIA, LIGHTTEXT),
        # хөшиг ӨӨРӨӨ бичгээ агуулсан, зураг нь ах дүү нь
        '%s :has(> :is(%s))%s :is(%s)' % (SCOPE, SCRIM, MEDIA, SCRIM),
    ],
    ["color: #FFFFFF !important;"],
    comment=u"ХАМГИЙН ЧУХАЛ ОНЦГОЙ ТОХИОЛДОЛ. Зураг/видеон дээр тавьсан хар хөшиг\n"
            u"   нь өдөр ч хар хэвээр (зураг өөрөө өөрчлөгддөггүй) тул түүн дээрх\n"
            u"   бичгийг бэх болговол уншигдахаа болино.\n\n"
            u"   `:has(img, video, …)` НӨХЦӨЛ НЬ ЗААВАЛ. Үүнгүйгээр дүрэм нь\n"
            u"   МОДАЛ цонх руу ч дамжина: AuthModal-ын бүтэц нь\n"
            u"   `<div class=\"bg-black/75\"><div class=\"bg-[#141416]\">…` буюу\n"
            u"   самбар нь хөшигний ҮР ХҮҮХЭД. Самбар өдөр цагаан болох тул\n"
            u"   толгойн бичиг цагаан үлдвэл цагаан дээр цагаан болно — амьд\n"
            u"   сайт дээр яг ийм алдаа гарч, эндээс олдсон. Модал дотор зураг\n"
            u"   байдаггүй тул `:has(img)` нь хоёрыг цэвэрхэн салгана."))

# ── ГАРААР БИЧСЭН КОМПОНЕНТУУД ──────────────────────────────────────────
COMP = u'''
/* ─── Гараар бичсэн классууд. Эдгээр нь var() биш, шууд hex агуулдаг тул
   токен солиход дагахгүй — өдрийн утгыг нь нэрээр нь дахин зарлав. ─── */
:root[data-theme="light"] .btn-primary,
:root[data-theme="light"] .btn-neon,
:root[data-theme="light"] .btn-blood { color: #17171A; }

:root[data-theme="light"] .input-dark {
  background: var(--l-surface);
  border-color: var(--l-line);
  color: var(--l-ink);
}
:root[data-theme="light"] .input-dark::placeholder { color: var(--l-dim); }

:root[data-theme="light"] .card { background: var(--l-surface); border-color: var(--l-line); }
:root[data-theme="light"] .card:hover { border-color: var(--l-line-strong); }

:root[data-theme="light"] .headline { color: var(--l-ink); }
:root[data-theme="light"] .headline .accent,
:root[data-theme="light"] .headline .dot { color: var(--l-accent-ink); text-shadow: none; }

:root[data-theme="light"] .dropdown-item { color: var(--l-ink); }
:root[data-theme="light"] .dropdown-item:hover { background: rgba(253,94,83,0.10); }

:root[data-theme="light"] .static-ramp { color: #C4C0BA; }
:root[data-theme="light"] .chip-live,
:root[data-theme="light"] .chip-sync,
:root[data-theme="light"] .chip-archive { border-color: var(--l-line); }
:root[data-theme="light"] .chip-live { color: var(--l-accent-ink); border-color: rgba(253,94,83,.42); }
:root[data-theme="light"] .chip-sync { color: var(--l-muted); }
:root[data-theme="light"] .chip-archive { color: var(--l-dim); }

/* .su-* давхарга бүхэлдээ var() уншдаг тул дээрх токеноор аль хэдийн
   өдөр болсон. Ганц үл хамаарах зүйл нь primary товчны бичиг. */
:root[data-theme="light"] .su-btn--primary { color: #17171A; }
:root[data-theme="light"] .su-badge--accent { color: var(--l-accent-ink); }

/* Агуулгын хоёр хэлбэр — засварлагч ба нийтлэл. */
:root[data-theme="light"] .rich-editor-content h1,
:root[data-theme="light"] .rich-editor-content h2,
:root[data-theme="light"] .rich-editor-content h3,
:root[data-theme="light"] .rich-editor-content strong,
:root[data-theme="light"] .blog-content h1,
:root[data-theme="light"] .blog-content h2,
:root[data-theme="light"] .blog-content h3,
:root[data-theme="light"] .blog-content strong { color: var(--l-ink); }
:root[data-theme="light"] .rich-editor-content,
:root[data-theme="light"] .blog-content p,
:root[data-theme="light"] .blog-content li,
:root[data-theme="light"] .blog-content blockquote,
:root[data-theme="light"] .rich-editor-content blockquote,
:root[data-theme="light"] .blog-content pre,
:root[data-theme="light"] .rich-editor-content pre,
:root[data-theme="light"] .re-prompt-body,
:root[data-theme="light"] .re-prompt-template-body,
:root[data-theme="light"] .re-challenge-body,
:root[data-theme="light"] .re-card-body,
:root[data-theme="light"] .re-check-item,
:root[data-theme="light"] .re-table td { color: var(--l-muted); }
:root[data-theme="light"] .blog-content a,
:root[data-theme="light"] .rich-editor-content a,
:root[data-theme="light"] .re-link-url { color: var(--l-accent-ink); }
:root[data-theme="light"] .blog-content a:hover,
:root[data-theme="light"] .rich-editor-content a:hover { color: var(--l-accent-deep); }
:root[data-theme="light"] .blog-content code,
:root[data-theme="light"] .rich-editor-content code { color: var(--l-accent-deep); background: rgba(253,94,83,0.10); }
:root[data-theme="light"] .blog-content pre,
:root[data-theme="light"] .rich-editor-content pre,
:root[data-theme="light"] .re-card-title,
:root[data-theme="light"] .re-link-card { background: var(--l-surface-2); border-color: var(--l-line); }
:root[data-theme="light"] .re-callout-info,
:root[data-theme="light"] .re-callout-warning,
:root[data-theme="light"] .re-callout-success,
:root[data-theme="light"] .re-callout-tip,
:root[data-theme="light"] .re-callout-note,
:root[data-theme="light"] .re-card-title,
:root[data-theme="light"] .re-link-title,
:root[data-theme="light"] .re-table th,
:root[data-theme="light"] .re-prompt-template-title { color: var(--l-ink); }
:root[data-theme="light"] .re-table th,
:root[data-theme="light"] .re-table td,
:root[data-theme="light"] .re-prompt-block,
:root[data-theme="light"] .re-card-box,
:root[data-theme="light"] .re-step { border-color: var(--l-line); }
:root[data-theme="light"] .re-table tr:hover td { background: var(--l-tint); }
:root[data-theme="light"] .blog-content hr,
:root[data-theme="light"] .rich-editor-content hr,
:root[data-theme="light"] .rich-editor-content hr.re-hr {
  background: linear-gradient(to right, transparent, rgba(23,23,26,0.16), transparent);
}
:root[data-theme="light"] .blog-content img,
:root[data-theme="light"] .rich-editor-content img { border-color: var(--l-line); }

/* Атмосферын туслахууд — цагаан дээр цагаан шуугиан утгагүй. */
:root[data-theme="light"] .grain::after { mix-blend-mode: multiply; opacity: 0.03; }
:root[data-theme="light"] .scanlines {
  background-image: repeating-linear-gradient(0deg, rgba(23,23,26,.03) 0 1px, transparent 1px 3px);
}
:root[data-theme="light"] .hero-smoke {
  background: radial-gradient(46% 38% at 50% 62%, rgba(253,94,83,0.10), transparent 70%);
}

/* Хөвөгч бүлүүр ба нааш толгой — өдөр гүн нь ГАДАРГУУНЫ шатаар биш,
   зөөлөн сүүдрээр илэрнэ (өдөр гэрлийн эх сурвалж БАЙНА). §04 нь зөвхөн
   `shadow-` анги бүхий элементэд хамаарах тул эдгээрийг нэрээр нь өгөв. */
:root[data-theme="light"] {
  --chrome-bg:   rgba(247,245,242,0.86);
  --chrome-line: rgba(23,23,26,0.10);
}
:root[data-theme="light"] .app-chrome-top {
  box-shadow: 0 1px 0 rgba(23,23,26,0.07);
}
/* Хөвөгч бүлүүр нь `bg-[#1B1B1F]/95` — `/`-тэй тул дээрх гадаргуун дүрэмд
   ЗОРИУД баригдахгүй (тэр нь `/`-тэйг зураг дээрх хөшиг гэж үзэж алгасдаг).
   Энэ ганц тохиолдолд `/` нь хөшиг биш, тунгалагдуу гадаргуу — нэрээр нь. */
:root[data-theme="light"] .app-chrome-dock {
  background: rgba(255,255,255,0.94) !important;
  box-shadow: 0 8px 28px -10px rgba(23,23,26,0.28);
}
'''
P.append(COMP)

TOGGLE = u'''
/* ══════════════════════════════════════════════════════════════════════════
   ГОРИМ СОЛИГЧ — толгой мөрөнд.

   Харагдах байдал нь React-ийн state-ээс биш, `<html data-theme>`-ээс ШУУД
   CSS-ээр уншигдана. Учир нь: серверт зурагдах үед localStorage байхгүй тул
   state-ээс хамаарвал эхний хормыг буруу байрлалд зурж, hydration дээр
   бүлүүр нь харайна. Атрибутаас уншихад толгой дахь блоклох скрипт аль
   хэдийн зөв утгыг тавьчихсан байдаг тул эхний фрэйм л зөв.
   ══════════════════════════════════════════════════════════════════════════ */
.theme-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  width: 62px;
  height: 32px;
  padding: 3px;
  background: var(--tt-track, #232327);
  border-radius: 999px;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px var(--tt-edge, rgba(255,255,255,0.10));
  -webkit-tap-highlight-color: transparent;
  transition: background 240ms var(--ease-out), box-shadow 240ms var(--ease-out);
}
.theme-toggle:focus-visible { outline: 2px solid #FD5E53; outline-offset: 2px; }

.theme-toggle__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 28px;
  height: 26px;
  border-radius: 999px;
  background: var(--tt-thumb, #3B3B41);
  box-shadow: 0 1px 2px rgba(0,0,0,0.22);
  transition: transform 340ms var(--ease-out), background 240ms var(--ease-out);
}
:root[data-theme="dark"] .theme-toggle__thumb { transform: translateX(28px); }

.theme-toggle__ico {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 26px;
  color: var(--tt-ico, #7A7A82);
  transition: color 240ms var(--ease-out);
}
.theme-toggle__ico svg { display: block; width: 15px; height: 15px; }
:root:not([data-theme="dark"]) .theme-toggle__ico--sun,
:root[data-theme="dark"] .theme-toggle__ico--moon { color: var(--tt-ico-on, #FD5E53); }

/* Утсан дээр толгойн мөр давчуу — жаахан нарийсна, гэхдээ 32px өндөр нь
   хэвээр (хүрэх талбай нь эргэн тойрны 44px хүрээгээрээ хангагдана). */
@media (max-width: 400px) {
  .theme-toggle { width: 56px; }
  .theme-toggle__thumb { width: 25px; }
  .theme-toggle__ico { width: 25px; }
  :root[data-theme="dark"] .theme-toggle__thumb { transform: translateX(25px); }
}

/* ══════════════════════════════════════════════════════════════════════════
   ШИЛЖИЛТ. Зөвхөн СОЛИХ мөчид — байнга биш.

   `.theme-anim` нь товч дархад <html>-д ~420ms тавигдаад авагдана. Байнга
   тавьчихвал хуудас ачаалах бүрд бүх элемент өнгөө "нааш" гүйлгэж, мөн
   энгийн hover бүр 320ms болж удаашрана. Солих мөчид л хэрэгтэй.

   `transform`-ыг ЗОРИУД оруулаагүй: navbar/bottombar нь өөрсдийн гулсах
   шилжилттэй, түүнийг дарвал солих үед цэс сэгсэрнэ.
   ══════════════════════════════════════════════════════════════════════════ */
:root.theme-anim,
:root.theme-anim *,
:root.theme-anim *::before,
:root.theme-anim *::after {
  transition-property: background-color, background-image, border-color, color,
                       fill, stroke, box-shadow, outline-color;
  transition-duration: 320ms;
  transition-timing-function: var(--ease-out);
}
@media (prefers-reduced-motion: reduce) {
  :root.theme-anim,
  :root.theme-anim *,
  :root.theme-anim *::before,
  :root.theme-anim *::after { transition-duration: 0.01ms; }
}
'''
P.append(TOGGLE)

import io  # generated -> src/app/theme-light.css
out = u"\n\n".join(P) + u"\n"
with io.open("out/light-layer.css", "w", encoding="utf-8") as f:
    f.write(out)
print("bytes:", len(out.encode("utf-8")))
print("rules:", out.count("{"))

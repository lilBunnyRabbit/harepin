// The game's own icon sprite (index.html), inlined so the mockups use the shipped set.
const GI = {"car":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 16v-3.4a1.5 1.5 0 0 1 1-1.4l3-1.2 2-3.3a1.5 1.5 0 0 1 1.3-.7h4.4a1.5 1.5 0 0 1 1.2.6l2.6 3.4 1.6.6a1.5 1.5 0 0 1 .9 1.4V16\"/><path d=\"M9.5 16h5\"/><circle cx=\"7\" cy=\"16.5\" r=\"2.2\"/><circle cx=\"17\" cy=\"16.5\" r=\"2.2\"/></svg>","settings":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg>","menu":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><path d=\"M4 7h16M4 12h16M4 17h16\"/></svg>","edit":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 20h4L19 9l-4-4L4 16z\"/></svg>","back":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 5l-7 7 7 7\"/></svg>","gauge":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 17a8 8 0 1 1 16 0\"/><path d=\"M12 17l4-5\"/></svg>","paint":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"><path d=\"M12 3.5c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z\"/></svg>","chat":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 4.5h12a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-6l-4.5 3.5v-3.5H6a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3z\"/></svg>","recenter":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"7\"/><circle cx=\"12\" cy=\"12\" r=\"1.5\" fill=\"currentColor\"/><path d=\"M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5\"/></svg>","modes":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 21V4\"/><path d=\"M6 4.5h11.5l-2.5 4 2.5 4H6\"/></svg>","aids":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.5l1.6-4.2a1.5 1.5 0 0 1 1.4-1h8a1.5 1.5 0 0 1 1.4 1l1.6 4.2V16H5z\"/><path d=\"M8.5 18.5c-1.2 1 1.2 2 0 3M15.5 18.5c-1.2 1 1.2 2 0 3\"/></svg>","close":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><path d=\"M6 6l12 12M18 6L6 18\"/></svg>","play":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"><path d=\"M8 5l11 7-11 7z\"/></svg>","reset-car":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3v7M8.5 6.5 12 3l3.5 3.5\"/><path d=\"M5 17h14v-3l-2-3H7l-2 3z\"/><path d=\"M7.5 20h.01M16.5 20h.01\"/></svg>","restart":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 12a9 9 0 1 0 3-6.7\"/><path d=\"M3 4v5h5\"/></svg>","rewind":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"><path d=\"M11 6.5v11L3.5 12zM20.5 6.5v11L13 12z\"/></svg>","pause":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\"><path d=\"M9 6v12M15 6v12\"/></svg>","pedal-up":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 15l6-6 6 6\"/></svg>","pedal-down":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 9l6 6 6-6\"/></svg>","bolt":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"><path d=\"M13 2.5L5 13.5h6l-1 8 8-11h-6z\"/></svg>","steer-left":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 5l-7 7 7 7\"/></svg>","steer-right":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 5l7 7-7 7\"/></svg>","graphics":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 18l6-8 4 5 2.5-3L21 18z\"/><circle cx=\"16.5\" cy=\"6.5\" r=\"2\"/></svg>","dice":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"3\"/><circle cx=\"8.5\" cy=\"8.5\" r=\"1\" fill=\"currentColor\"/><circle cx=\"15.5\" cy=\"8.5\" r=\"1\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"12\" r=\"1\" fill=\"currentColor\"/><circle cx=\"8.5\" cy=\"15.5\" r=\"1\" fill=\"currentColor\"/><circle cx=\"15.5\" cy=\"15.5\" r=\"1\" fill=\"currentColor\"/></svg>","lock":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"5\" y=\"11\" width=\"14\" height=\"9.5\" rx=\"2\"/><path d=\"M8 11V8a4 4 0 0 1 8 0v3\"/></svg>","flag":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 21V4M6 4.5h11l-2.5 4 2.5 4H6\"/></svg>","trophy":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v3.5M8 20.5h8M9.5 20.5l.5-3h4l.5 3\"/></svg>","globe":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z\"/></svg>","people":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"9\" cy=\"8.5\" r=\"3.5\"/><path d=\"M3 19.5a6 6 0 0 1 12 0\"/><path d=\"M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14a6 6 0 0 1 3.5 5.5\"/></svg>","controls":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 7h10a4.5 4.5 0 0 1 4.4 5.4l-.9 4.2a2 2 0 0 1-3.4 1L15 15.5H9l-2.1 2.1a2 2 0 0 1-3.4-1l-.9-4.2A4.5 4.5 0 0 1 7 7z\"/><path d=\"M8 10.5v3M6.5 12h3\"/><circle cx=\"16\" cy=\"11\" r=\".6\" fill=\"currentColor\"/><circle cx=\"16\" cy=\"13.5\" r=\".6\" fill=\"currentColor\"/></svg>","display":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"4.5\" width=\"18\" height=\"12\" rx=\"2\"/><path d=\"M9 20h6M12 16.5V20\"/></svg>","share":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 14.5V4M8 7.5l4-3.5 4 3.5\"/><path d=\"M5.5 11.5v7a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-7\"/></svg>","check":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 12.5l4.5 4.5L19 7.5\"/></svg>","bug":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 7.5a5 5 0 0 1 5 5V15a5 5 0 0 1-10 0v-2.5a5 5 0 0 1 5-5z\"/><path d=\"M9.5 6.5L8 4.5M14.5 6.5L16 4.5M7 13H3.5M20.5 13H17M7.5 17.5L5 19.5M16.5 17.5L19 19.5\"/></svg>","idea":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 17.5v-1.7c0-.9-.5-1.7-1.2-2.4A6 6 0 1 1 16.2 13.4c-.7.7-1.2 1.5-1.2 2.4v1.7z\"/><path d=\"M10 21h4\"/></svg>","heart":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z\"/></svg>","external":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M13.5 4.5H19.5V10.5M19.5 4.5L11 13\"/><path d=\"M17 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7H10\"/></svg>","camera":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 8.5h3.2l1.6-2.5h6.4l1.6 2.5H20v11H4z\"/><circle cx=\"12\" cy=\"13.5\" r=\"3.2\"/></svg>","audio":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 9.5h3l4.5-4v13L7 14.5H4z\"/><path d=\"M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11\"/></svg>","slot-engine":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 8h12v9H4zM8 8V5h4v3M16 11h3v4h-3M4 12H2\"/></svg>","slot-tyres":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6\"/></svg>","slot-aero":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 8h18l-2 3H5zM8 11v6M16 11v6\"/></svg>","slot-suspension":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3v3l-5 2 10 2-10 2 10 2-10 2 5 2v3\"/></svg>","slot-brakes":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M11 6a7 7 0 1 0 0 14a7 7 0 1 0 0-14M11 11a2 2 0 1 0 0 4a2 2 0 1 0 0-4M16 5a8 8 0 0 1 4 6\"/></svg>","slot-weight":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 8a4 4 0 1 1 8 0M6 8h12l2 12H4z\"/></svg>","slot-bias":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 4v16M5 20h14M4 9l3-4 3 4M14 9l3-4 3 4M4 9a3 3 0 0 0 6 0M14 9a3 3 0 0 0 6 0\"/></svg>","slot-nitro":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 3h6M10 3v3M14 3v3M8 6h8v14H8zM8 11h8\"/></svg>","slot-decal":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 16l5-8h5l-5 8zM12 16l5-8h3l-5 8z\"/></svg>","slot-number":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M10 9l2-1v8\"/></svg>","slot-ink":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 20l4-1 11-11-3-3L5 16zM14 7l3 3\"/></svg>","slot-part":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2\"/></svg>","drive-fwd":"<svg viewBox=\"0 0 24 24\"><rect x=\"9.5\" y=\"7\" width=\"5\" height=\"10\" rx=\"2\" fill=\"currentColor\" opacity=\".35\"/><rect x=\"3\" y=\"2.5\" width=\"18\" height=\"5\" rx=\"2.5\" fill=\"currentColor\"/><rect x=\"3\" y=\"16.5\" width=\"18\" height=\"5\" rx=\"2.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" opacity=\".35\"/></svg>","drive-rwd":"<svg viewBox=\"0 0 24 24\"><rect x=\"9.5\" y=\"7\" width=\"5\" height=\"10\" rx=\"2\" fill=\"currentColor\" opacity=\".35\"/><rect x=\"3\" y=\"2.5\" width=\"18\" height=\"5\" rx=\"2.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" opacity=\".35\"/><rect x=\"3\" y=\"16.5\" width=\"18\" height=\"5\" rx=\"2.5\" fill=\"currentColor\"/></svg>","drive-awd":"<svg viewBox=\"0 0 24 24\"><rect x=\"9.5\" y=\"7\" width=\"5\" height=\"10\" rx=\"2\" fill=\"currentColor\" opacity=\".35\"/><rect x=\"3\" y=\"2.5\" width=\"18\" height=\"5\" rx=\"2.5\" fill=\"currentColor\"/><rect x=\"3\" y=\"16.5\" width=\"18\" height=\"5\" rx=\"2.5\" fill=\"currentColor\"/></svg>","tyre-street":"<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"7.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.5\"/></svg>","tyre-sport":"<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"7.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.5\"/><circle cx=\"12\" cy=\"12\" r=\"3\" fill=\"currentColor\"/></svg>","tyre-semi-slick":"<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"9.5\" fill=\"currentColor\"/></svg>","tyre-slicks":"<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"10.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"7\" fill=\"currentColor\"/></svg>","tyre-rally":"<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"5.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\"/><g fill=\"currentColor\"><rect x=\"9\" y=\"0.5\" width=\"6\" height=\"5\" rx=\"0.75\"/><rect x=\"9\" y=\"18.5\" width=\"6\" height=\"5\" rx=\"0.75\"/><rect x=\"0.5\" y=\"9\" width=\"5\" height=\"6\" rx=\"0.75\"/><rect x=\"18.5\" y=\"9\" width=\"5\" height=\"6\" rx=\"0.75\"/></g></svg>","tyre-all-terrain":"<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"5.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\"/><g fill=\"currentColor\"><circle cx=\"12.0\" cy=\"2.4\" r=\"1.8\"/><circle cx=\"18.8\" cy=\"5.2\" r=\"1.8\"/><circle cx=\"21.6\" cy=\"12.0\" r=\"1.8\"/><circle cx=\"18.8\" cy=\"18.8\" r=\"1.8\"/><circle cx=\"12.0\" cy=\"21.6\" r=\"1.8\"/><circle cx=\"5.2\" cy=\"18.8\" r=\"1.8\"/><circle cx=\"2.4\" cy=\"12.0\" r=\"1.8\"/><circle cx=\"5.2\" cy=\"5.2\" r=\"1.8\"/></g></svg>","tyre-mud-terrain":"<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"5.25\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\"/><path d=\"M12 0.5l3.5 5h-7zM12 23.5l3.5-5h-7zM0.5 12l5-3.5v7zM23.5 12l-5-3.5v7zM3.9 3.9l6 1.1-4.9 4.9zM20.1 20.1l-6-1.1 4.9-4.9zM20.1 3.9l-1.1 6-4.9-4.9zM3.9 20.1l1.1-6 4.9 4.9z\" fill=\"currentColor\"/></svg>"};
const svg = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";
const IC = {
  chev: GI.back, go: GI.back.replace("<svg", '<svg class="flip"'), globe: GI.globe, flag: GI.flag, lock: GI.lock, pause: GI.pause, check: GI.check,
  die: GI.dice, screen: GI.graphics, sun: GI.display, wheel: GI.aids, cam: GI.camera, pad: GI.controls, vol: GI.audio, people: GI.people,
  book: GI.idea, spark: GI.bolt, heart: GI.heart, car: GI.car, left: GI["steer-left"], right: GI["steer-right"], trophy: GI.trophy,
  up: svg('<path d="M12 20V5M6 11l6-6 6 6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
};

const cap = k => '<i class="cap d-only">' + k + "</i>";
const kb = (key, label, cls = "") => '<span class="kb ' + cls + '">' + cap(key) + "<span>" + label + "</span></span>";
const lnk = (key, label) => '<span class="lnk">' + cap(key) + label + "</span>";
const stars = (n, of = 3) => '<span class="stars"><b>' + "★".repeat(n) + "</b>" + "★".repeat(of - n) + "</span>";
const here = extra => '<span class="loc here">' + IC.flag + "<b>Here</b>" + (extra ? '<span class="dim">' + extra + "</span>" : "") + "</span>";
const away = (name, extra) => '<span class="loc">' + IC.globe + "<b>" + name + "</b>" + (extra ? '<span class="dim">' + extra + "</span>" : "") + "</span>";
const plate = s => { const [c, pi] = s.split(" "); return '<span class="plate c-' + c.toLowerCase() + '"><b>' + c + "</b><span>" + pi + "</span></span>"; };
const online = '<span class="chip"><i class="dot"></i>38 online</span>';
const season = '<span class="chip"><span class="star">★</span>34</span>';
const pic = (img, style = "") => '<div class="pic i-' + img + '" style="' + style + '"></div>';
const times = '<div class="times"><span class="chip in">★ <span class="mono">1:20</span></span><span class="chip in">★★ <span class="mono">1:14</span></span><span class="chip in">★★★ <span class="mono">1:09</span></span></div>';
const FLAGS = {
  ee: "linear-gradient(#2f6fd0 0 33%, #1c1c1c 33% 66%, #f4f4f4 66%)",
  de: "linear-gradient(#1c1c1c 0 33%, #d83a3a 33% 66%, #e9c341 66%)",
  it: "linear-gradient(90deg, #3f9a5a 0 33%, #f4f4f4 33% 66%, #d83a3a 66%)",
  fr: "linear-gradient(90deg, #2b56a6 0 33%, #f4f4f4 33% 66%, #d83a3a 66%)",
  nl: "linear-gradient(#c33a3a 0 33%, #f4f4f4 33% 66%, #2b56a6 66%)",
  at: "linear-gradient(#d83a3a 0 33%, #f4f4f4 33% 66%, #d83a3a 66%)",
  pl: "linear-gradient(#f4f4f4 0 50%, #d83a3a 50%)",
  jp: "radial-gradient(circle, #d83a3a 0 30%, #f4f4f4 32%)",
  ua: "linear-gradient(#2f6fd0 0 50%, #e9c341 50%)",
};
const flag = c => '<i class="flag" style="background:' + FLAGS[c] + '"></i>';
const call = (x, f) => (typeof x === "function" ? x(f) : x || "");

function stations(on) {
  return '<div class="stations">' + cap("Q") + ["Home", "Events", "Garage", "Online", "Settings"].map(s => "<span" + (s === on ? ' class="on"' : "") + ">" + s + "</span>").join("") + cap("E") + "</div>";
}

function F(o) {
  return (f, fb) => {
    const car = o.car ? (f === "p" ? o.car[1] : o.car[0]) : "";
    const bkA = o.back ? '<span class="bk bk-a">' + IC.chev + "<span>" + o.back + "</span>" + cap("Esc") + "</span>" : "";
    const bkB = o.back ? '<span class="kb q bk bk-b">' + cap("Esc") + '<span class="p-only" style="display:grid">' + IC.chev + "</span><span>" + o.back + "</span></span>" : "";
    return (
      '<div class="fr ' + f + " " + o.layer + '"' + (fb ? ' data-fb="' + fb + '"' : "") + ">" +
      '<div class="bg i-' + o.bg + (o.bg === "stage" ? " stage" : "") + '" style="' + car + '"></div>' +
      (o.veil ? '<div class="veil" style="opacity:' + o.veil + '"></div>' : "") +
      (o.floor ? '<div class="floor"></div><div class="sky"></div>' : "") +
      call(o.scene, f) +
      (o.bare ? "" :
        '<div class="top"><div class="tl">' + bkA + (o.title ? '<div class="ttl"><span class="eb">' + o.title[0] + "</span><b>" + o.title[1] + "</b></div>" : "") + "</div>" +
        (o.station ? stations(o.station) : "<span></span>") +
        '<div class="tr">' + call(o.chips, f) + "</div></div>") +
      '<div class="body">' + call(o.body, f) + "</div>" +
      '<div class="bot"><div class="bl">' + bkB + (o.sec || []).join("") + '</div><div class="br">' + (o.note ? '<span class="note">' + o.note + "</span>" : "") + call(o.cta, f) + "</div></div>" +
      "</div>"
    );
  };
}

const STAND_PRE = [["Kai Moreno", 43], ["Hare", 40], ["Mara Voss", 31], ["Iris Kade", 27]];
const STAND_POST = [["Kai Moreno", 68, 25], ["Hare", 58, 18], ["Mara Voss", 46, 15], ["Iris Kade", 39, 12], ["Niko Hale", 32, 10], ["Teo Lind", 26, 8], ["Sana Ortiz", 18, 6], ["Elsa Brandt", 13, 4]];
const standRows = (rows, gain) => rows.map(([n, p, g], i) => '<div' + (n === "Hare" ? ' class="me"' : "") + '><span class="pos mono">' + (i + 1) + "</span><b>" + (n === "Hare" ? "Hare · you" : n) + "</b>" + (gain ? '<span class="gain mono">+' + g + "</span>" : "<span></span>") + '<span class="mono">' + p + "</span></div>").join("");

const pauseBtn = '<span class="ibtn">' + IC.pause + "</span>";
const hudMap = label => '<div class="card hud-corner hud-map">' + pic("map_island") + '<div class="rw sp sm"><b>' + label[0] + '</b><span class="dim mono">' + label[1] + "</span></div></div>";
const hudSpd = (n, gear, rpm) => '<div class="card hud-corner hud-spd"><div class="rw sp" style="align-items:flex-end"><span class="n">' + n + '</span><span class="col g0" style="align-items:flex-end"><span class="h2 mono">' + gear + '</span><span class="sm dim">km/h</span></span></div><span class="bar"><i style="width:' + rpm + '%"></i></span><div class="asst d-only"><span>TC</span><span>ABS</span><span class="off">STM</span><span>Steer</span></div></div>';
const touchHud = '<div class="touch l p-only"><span>' + IC.left + "</span><span>" + IC.right + '</span></div><div class="touch r p-only"><span class="sm"><b>Brake</b></span><span class="sm"><b>Gas</b></span></div>';

const hudSpdP = (n, gear, rpm) => '<div class="card hud-corner hud-spd"><div class="rw sp" style="align-items:flex-end"><span class="n">' + n + '</span><span class="h2 mono">' + gear + '</span></div><span class="bar"><i style="width:' + rpm + '%"></i></span></div>';

const S = {};

const hudScene = (map, spd) => f =>
    '<div class="card hud-top"><div class="col g0"><span class="eb">Series · Round 3 of 6</span><b class="h3 nw">Reverse run</b></div><span class="big">P3</span><div class="col g0"><span class="eb">Lap</span><b class="h3 mono">2/3</b></div><div class="col g0"><span class="eb">Gap</span><b class="h3 mono">+1.2</b></div><div class="col g0 d-only"><span class="eb">Time</span><b class="h3 mono">1:12.4</b></div></div>' +
    '<div class="top" style="grid-template-columns:1fr"><div class="tr">' + pauseBtn + "</div></div>" +
    '<div class="card hud-corner hud-map">' + map + (f === "d" ? '<div class="rw sp sm"><b>Next gate</b><span class="dim mono">240 m</span></div>' : "") + "</div>" +
    (spd ? hudDial(128, 4, 72, f) : f === "d" ? hudSpd(128, 4, 72) : hudSpdP(128, 4, 72)) + (f === "d" ? "" : touchHud);
const DIAL = "M 47 153 A 75 75 0 1 1 153 153";
const hudDial = (n, gear, rpm, f) =>
  '<div class="card hud-corner hud-spd"><div class="dialw"><svg viewBox="8 8 184 184"><path class="dt" pathLength="100" d="' + DIAL + '"/><path class="dz" pathLength="100" stroke-dasharray="0 88 12 100" d="' + DIAL + '"/><path class="df" pathLength="100" stroke-dasharray="' + rpm + ' 100" d="' + DIAL + '"/></svg>' +
  '<div class="dn"><span class="n mono">' + n + '</span><span class="sm dim d-only">km/h</span></div><b class="dg h2 mono">' + gear + "</b></div>" +
  (f === "d" ? '<div class="asst"><span>TC</span><span>ABS</span><span class="off">STM</span><span>Steer</span></div>' : "") + "</div>";
const TRACK = "M28,72 C14,44 34,16 72,16 C100,16 108,30 132,24 C158,18 184,26 180,48 C177,64 150,56 136,62 C120,69 130,86 150,88 C170,90 168,100 140,100 C100,100 44,104 28,72 Z";
const diamond = (x, y, r, cls) => '<path class="' + cls + '" d="M' + x + "," + (y - r) + " L" + (x + r) + "," + y + " L" + x + "," + (y + r) + " L" + (x - r) + "," + y + ' Z"/>';
const MM = {
  real: pic("map_island"),
  line: '<svg class="mm" viewBox="0 0 208 116" preserveAspectRatio="xMidYMid meet"><path class="trk case" d="' + TRACK + '"/><path class="trk" d="' + TRACK + '"/><path class="fin" d="M22,74 L34,69"/>' +
    '<circle class="gate" cx="180" cy="48" r="6"/><circle class="riv" cx="72" cy="16" r="6.5"/><circle class="riv" cx="150" cy="24" r="6.5"/><circle class="riv" cx="167" cy="26" r="6.5"/>' + diamond(132, 24, 10, "you") + "</svg>",
  close: '<svg class="mm" viewBox="0 0 208 116" preserveAspectRatio="xMidYMid slice"><path class="side" d="M-10,74 C40,70 70,64 104,62"/><path class="side" d="M150,34 C170,50 190,58 220,60"/>' +
    '<path class="road" d="M104,130 C104,90 100,74 112,56 C124,38 160,36 172,-10"/><path class="ahead" d="M104,96 C104,82 102,72 112,56 C122,41 146,36 158,20"/>' +
    '<path class="gate" d="M146,12 L170,28"/><circle class="riv" cx="110" cy="60" r="6"/><circle class="riv" cx="136" cy="36" r="6"/><path class="you" d="M104,84 L113,104 L104,99 L95,104 Z"/></svg>',
};
S.hud = F({ layer: "road", bg: "road3", bare: true, scene: hudScene(MM.real) });
S.hudLine = F({ layer: "road", bg: "road3", bare: true, scene: hudScene(MM.line) });
S.hudClose = F({ layer: "road", bg: "road3", bare: true, scene: hudScene(MM.close) });
S.hudDial = F({ layer: "road dial", bg: "road3", bare: true, scene: hudScene(MM.real, 1) });


S.roam = F({
  layer: "road", bg: "road3", bare: true,
  scene: f =>
    '<div class="card ticket"><span class="arr">' + IC.up + '</span><div class="col g0"><span class="eb">Next up · Series Round 3</span><b class="h3">Reverse run</b>' + here('<span class="mono">340 m</span> ahead') + "</div></div>" +
    '<div class="top" style="grid-template-columns:1fr"><div class="tr">' + online + pauseBtn + "</div></div>" +
    (f === "d" ? hudMap(["Island · Harwar", "M"]) + hudSpd(86, 3, 48) : hudSpdP(86, 3, 48) + touchHud),
});

S.gate = F({
  layer: "road", bg: "road2", floor: true, back: "Road",
  chips: online,
  body: () =>
    '<div class="s-gate"><div class="card pad gate">' +
    '<div class="hd"><span class="eb">Rookie 2 of 7 · Time trial</span><b class="h1">Harbour sprint</b>' + here("Island · Harwar") + "</div>" + times +
    '<div class="carrow">' + pic("car_sturm") + '<div class="col g0 f1"><b class="h3">Sturm ' + plate("B 612") + '</b><span class="sm dim">Fits class B max · your best 1:15.8</span></div></div>' +
    "</div></div>",
  sec: [],
  cta: f => lnk("Enter", "Change car") + kb(f === "d" ? "Hold Enter" : "", f === "d" ? "Start in Sturm" : "Hold: Start in Sturm", "hold"),
});

const RFLAGS = [
  { n: "Docks drift", t: "Rookie · Drift", km: "2.1 km", st: 2, pin: [37, 21], side: 0, row: 0 },
  { n: "Reverse run", t: "Series · Round 3", km: "340 m", st: -1, pin: [20, 73], side: 0, row: 1, foc: 1 },
  { n: "First lap", t: "Rookie · Race", km: "2.6 km", st: 3, pin: [60, 26], side: 1, row: 0 },
  { n: "Harbour sprint", t: "Rookie · Time trial", km: "1.2 km", st: 2, pin: [76, 45], side: 1, row: 1 },
];
S.rmap = F({
  layer: "road", bg: "road3", veil: 0.82, back: "Road", title: ["Island · Harwar", "Road map"],
  chips: online,
  body: f => {
    const d = f === "d";
    const W = d ? 1216 : 812, H = d ? 528 : 262, mx = (W - H) / 2;
    const pad = d ? 20 : 12, cw = d ? 272 : 204, ch = d ? 68 : 50, jog = d ? 28 : 16;
    const rows = d ? [72, 356] : [30, 168];
    const px = p => [mx + (p[0] / 100) * H, (p[1] / 100) * H];
    let lines = "", cards = "", pins = "";
    for (const fl of RFLAGS) {
      const [x, y] = px(fl.pin);
      const top = rows[fl.row], my = top + ch / 2;
      const ex = fl.side ? W - pad - cw : pad + cw;
      const pts = ex + "," + my + " " + (ex + (fl.side ? -jog : jog)) + "," + my + " " + x + "," + y;
      lines += '<polyline class="lead case" points="' + pts + '"/><polyline class="lead' + (fl.foc ? " on" : "") + '" points="' + pts + '"/>';
      pins += '<i class="pin' + (fl.foc ? " sel" : "") + '" style="left:' + x + "px;top:" + y + 'px"></i>';
      cards += '<div class="co' + (fl.foc ? " foc" : "") + '" style="' + (fl.side ? "right" : "left") + ":" + pad + "px;top:" + top + "px;width:" + cw + "px;height:" + ch + 'px"><div class="col g0"><span class="eb">' + fl.t + '</span><b class="nw">' + fl.n + '</b></div><div class="rt"><b class="mono sm">' + fl.km + "</b>" + (fl.st < 0 ? '<span class="sm cot nw">Next up</span>' : stars(fl.st)) + "</div></div>";
    }
    const [ux, uy] = px([38, 49]);
    return '<div class="s-rmap"><div class="card mapwrap"><div class="pic i-map_island"></div><svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none">' + lines + "</svg>" + pins + '<i class="pin you" style="left:' + ux + "px;top:" + uy + 'px"></i>' + cards + "</div></div>";
  },
  sec: [lnk("O", "Other maps")],
  note: "Moves you to the flag. No loading.",
  cta: kb("Enter", "Go to flag"),
});

S.pause = F({
  layer: "road", bg: "road3", veil: 0.55, back: "Resume", title: ["Series · Round 3 of 6", "Paused"],
  chips: online,
  body: () =>
    '<div class="s-pause"><div class="card pad ppanel">' +
    '<div class="col g1"><div class="carrow txt"><div class="col g0"><span class="eb">Reverse run</span><b class="h3">P3 · Lap 2/3</b></div><b class="h2 mono">1:12.4</b></div>' +
    '<div class="rw g1"><span class="qbtn f1">Restart</span><span class="qbtn f1">Leave</span></div></div>' +
    '<div class="col g1"><span class="eb">Assists</span><div class="rw g1 wrap"><span class="chip in">' + IC.check + 'TC</span><span class="chip in">' + IC.check + 'ABS</span><span class="chip in dim">STM</span><span class="chip in">' + IC.check + "Steer</span></div></div>" +
    '<div class="col g1" style="grid-column:1/-1"><span class="eb">Go to</span><div class="doors">' + ["Home", "Events", "Garage", "Online", "Settings", "Road map"].map(d => '<div class="li fill"><span>' + d + "</span>" + IC.go + "</div>").join("") + "</div></div>" +
    "</div></div>",
  note: "Leaving the race asks first.",
  cta: kb("Enter", "Resume"),
});

const nextRound = '<div class="col g0"><span class="eb">Next · Round 4 of 6</span><b class="h2">Rival duel</b>' + here("Island · Sturm fits") + "</div>";

S.resB = F({
  layer: "road", bg: "road1", veil: 0.62, back: "Road", title: ["Series · Round 3 of 6", "Reverse run"],
  chips: online,
  body: () =>
    '<div class="s-resb">' +
    '<div class="card pad stampc"><div class="stamp"><span class="place">2<sup>nd</sup></span>' + stars(2) + '<span class="sm dim">of 8 · 0.8 s behind Kai Moreno</span></div>' +
    '<div class="col g1"><div class="rw sp sm"><b>Series · 2nd, 58 pts</b><span class="dim">3 of 6 done</span></div><div class="rounds"><i class="done"></i><i class="done"></i><i class="done"></i><i></i><i></i><i></i></div></div>' +
    '<div class="factgrid"><div class="fact capn"><span class="eb">Your time</span><span class="v">4:21.8</span></div><div class="fact capn"><span class="eb">Best lap</span><span class="v">1:25.2</span></div><div class="fact capn"><span class="eb">Points</span><span class="v cot">+18</span></div><div class="fact capn"><span class="eb">Credits</span><span class="v">+40</span></div></div></div>' +
    '<div class="card pad col g1"><div class="rw sp"><b class="h3">Series standings</b><span class="sm dim">after 3 of 6</span></div><div class="standfull">' + standRows(STAND_POST, true) + "</div></div>" +
    '<div class="card nextc foc">' + pic("ser_s1_rival") + '<div class="pad">' + nextRound + "</div></div>" +
    "</div>",
  sec: [lnk("R", "Restart"), lnk("V", "View Series")],
  cta: kb("Enter", "Next: Round 4"),
});

S.final = F({
  layer: "road", bg: "stage", car: ["--carx:640px;--cary:458px;--zoom:1.2", "--carx:422px;--cary:258px;--zoom:1.25"], back: "Road",
  chips: online,
  body: () =>
    '<div class="s-final">' +
    '<div class="card pad col g1"><b class="h3">Final standings</b><div class="standfull">' + standRows([["Hare", 112], ["Kai Moreno", 98], ["Mara Voss", 81], ["Iris Kade", 66], ["Niko Hale", 52]]) + "</div></div>" +
    '<div class="champ"><span class="eb">Harepin Series · Season 1 · Island</span><span class="h0">Champion</span><span class="h3 dim">4 wins in 6 rounds</span></div>' +
    '<div class="card pad col g1"><b class="h3">Rewards</b>' +
    '<div class="rew">' + pic("car_fujin") + '<div class="col g0"><b>Fujin</b><span class="sm dim">Season car</span></div></div>' +
    '<div class="rew"><span class="ic">★</span><div class="col g0"><b class="mono">+600 cr</b><span class="sm dim">Credits</span></div></div>' +
    '<div class="rew"><span class="ic">' + IC.trophy + '</span><div class="col g0"><b>Island champion</b><span class="sm dim">Title</span></div></div></div>' +
    "</div>",
  sec: [lnk("V", "View Series")],
  cta: kb("Enter", "Next series: Alpine"),
});

S.travel = F({
  layer: "road", bg: "kind_dunes", veil: 0.72, title: ["Travelling · Island · Harwar to", "Dune sea · Sabkha"],
  body: () =>
    '<div class="s-travel">' +
    '<div class="brief"><span class="eb">Rookie 4 of 7 · Time trial</span><b class="d1">Sand trail</b>' + times +
    '<div class="specs"><div class="col g0"><span class="eb">Route</span><b>3.2 km · sand</b></div><div class="col g0"><span class="eb">Class</span><b>B max</b></div><div class="col g0"><span class="eb">Your best</span><b class="mono">no time yet</b></div></div>' +
    '<div class="carrow">' + pic("car_sturm") + '<div class="col g0"><b class="h3">Sturm ' + plate("B 612") + '</b><span class="sm dim">Starts at the flag, engine running</span></div></div></div>' +
    '<div class="card tmap">' + '<div class="pic i-map_dunes"></div>' + "</div>" +
    '<div class="card load"><b class="nw">Placing flags</b><span class="bar"><i style="width:72%"></i></span><b class="mono">72%</b></div>' +
    "</div>",
  note: "Lights up when the map is ready.",
  cta: kb("Enter", "Start", "off"),
});

S.first = F({
  layer: "road", bg: "road3", bare: true,
  scene: f =>
    '<div class="paint">' + (f === "d" ? "HOLD W" : "HOLD GAS") + "</div>" +
    '<div class="card hud-top steps"><span class="on"><i>1</i>Drive</span><span><i>2</i>Steer</span><span><i>3</i>Reach the flag</span><span class="tail">' + IC.go + "First steps" + IC.go + "Guide</span></div>" +
    '<div class="card ticket mid"><span class="arr">' + IC.flag + '</span><div class="col g0"><span class="eb">First steps · 1 of 14</span><b class="h3 nw">Reach the first flag</b><span class="sm dim nw">Next: Finish a lap</span></div></div>' +
    '<div class="top" style="grid-template-columns:1fr"><div class="tr">' + pauseBtn + "</div></div>" +
    (f === "d" ? hudSpd(0, "N", 6) : touchHud),
});

S.meet = F({
  layer: "road", bg: "road2", floor: true, back: "Drive off",
  chips: online,
  scene: () => '<div class="card hud-top"><div class="col g0"><span class="eb">Race meet · Room FOX-12</span><b class="h3 nw">Harbour loop · 3 laps</b></div><span class="big on">0:12</span></div>',
  body: () =>
    '<div class="s-meet">' +
    [["sturm", "Hare · you", "Not ready", 0], ["coupe", "Mika", "Ready", 1, "ee"], ["rally", "Jonas", "Ready", 1, "de"], ["kaze", "Aiko", "Picking a car", 0, "jp"]]
      .map(d => '<div class="card drv' + (d[1].includes("you") ? " foc" : "") + '">' + pic("car_" + d[0]) + '<div class="capn"><span class="sm ' + (d[3] ? "rdy" : "dim") + '">' + (d[3] ? IC.check : "") + d[2] + '</span><b class="rw g1">' + (d[4] ? flag(d[4]) : "") + d[1] + "</b></div></div>").join("") +
    '<div class="card drv open">' + IC.car + '<span class="sm">Open slot<br>drive onto the pad</span></div>' +
    "</div>",
  sec: [lnk("C", "Change car")],
  note: "2 of 4 ready. It starts when everyone is.",
  cta: kb("Enter", "Ready", "on"),
});

S.title = F({
  layer: "show", bg: "stage", car: ["--carx:420px;--cary:440px;--zoom:1.35", "--carx:240px;--cary:235px;--zoom:1.4"], floor: true,
  chips: () => season + online,
  scene: () => '<div class="wordmark">' + LOGO + "Harepin</div>",
  body: () =>
    '<div class="s-title"><span></span><div class="card cont foc">' + pic("ser_s1_reverse") +
    '<div class="pad col g1"><span class="eb">Continue · Harepin Series</span><b class="h2">Round 3 of 6 · Reverse run</b>' + here("Island · 2 pts behind Kai Moreno") + "</div></div></div>",
  sec: [lnk("D", "Drive Island"), lnk("H", "Home")],
  cta: kb("Enter", "Race Round 3"),
});

S.home = F({
  layer: "show", bg: "stage", car: ["--carx:330px;--cary:400px;--zoom:1.15", "--carx:200px;--cary:215px;--zoom:1.3"], floor: true, station: "Home", back: "Road",
  chips: () => season + online,
  body: () =>
    '<div class="s-home"><div class="carbay"><span class="chip cartag"><b>Sturm</b>' + plate("B 612") + '</span></div>' +
    '<div class="col"><div class="card tix foc">' + pic("ser_s1_reverse") +
    '<div class="pad col g1"><div class="hd"><span class="eb">Next · Harepin Series</span><b class="h1">Round 3 of 6 · Reverse run</b>' + here("Island · Harwar") + "</div>" +
    '<div class="reasons sm"><span>' + IC.check + "2 pts behind Kai Moreno</span><span>" + IC.check + "Sturm fits class B</span><span>" + IC.check + "About 4 min</span></div></div></div>" +
    '<div class="others"><div class="card capn"><span class="eb">Career</span><b class="nw">Sand trail</b></div><div class="card capn"><span class="eb">Today\'s run</span><b class="nw">Crater ring <span class="star">+3★</span></b></div><div class="card capn"><span class="eb">Free roam</span><b class="nw">Island · Harwar</b></div></div></div></div>',
  sec: [lnk("C", "Car"), lnk("M", "Maps")],
  cta: kb("Enter", "Race Round 3"),
});

const tierMini = (img, name, lock) => '<div class="mini' + (lock ? " lock" : " sel") + '">' + pic(img) + "<span>" + (lock ? IC.lock : "") + name + "</span></div>";
const runMini = (img, name, gain) => '<div class="mini">' + pic(img) + "<span>" + name + '<b class="star">' + gain + "</b></span></div>";
const doorHead = (name, what, chip) => '<div class="dhead"><div class="col g0"><b class="h2">' + name + '</b><span class="sm dim">' + what + '</span></div><span class="rw g1"><span class="chip in d-only">' + chip + '</span><span class="go">' + IC.go + "</span></span></div>";

S.events = F({
  layer: "show", bg: "world", veil: 0.5, station: "Events", back: "Road",
  chips: () => season + online,
  body: () =>
    '<div class="s-events"><div class="card series foc">' + pic("ser_s1_reverse") +
    '<div class="pad col g1"><div class="hd"><span class="eb">Harepin Series · Season 1</span><b class="h1">Round 3 of 6 · Reverse run</b>' + here("Island · Harwar") + "</div>" +
    '<div class="rounds"><i class="done"></i><i class="done"></i><i class="now"></i><i></i><i></i><i></i></div>' +
    '<div class="stand sm">' + standRows(STAND_PRE) + "</div></div></div>" +
    '<div class="col"><div class="card door">' + doorHead("Career", "Win stars in events to open the next tier", '<span class="star">★</span>9 of 21') +
    '<div class="strip">' + tierMini("ser_s1_opener", "Rookie") + tierMini("kind_alpine", "Club", 1) + tierMini("kind_volcano", "Pro", 1) + tierMini("kind_sky", "Elite", 1) + tierMini("kind_mainland", "Legend", 1) + "</div></div>" +
    '<div class="card door">' + doorHead("Runs", "A new run every day and every week", '<span class="star">★</span>34 · 12 days left') +
    '<div class="strip">' + runMini("kind_volcano", "Daily", "+3★") + runMini("ser_s1_final", "Weekly", "+5★") + runMini("kind_sky", "Random", "+1★") + "</div></div></div></div>",
  sec: [lnk("F", "Free modes")],
  cta: kb("Enter", "Race Round 3"),
});

const careerBody =
  '<div class="s-career"><div class="tiers">' +
  '<div class="card tier foc">' + pic("ser_s1_opener") + '<div class="capn"><span class="eb">Tier 1 of 5 · now</span><b class="h2">Rookie</b><span class="sm dim">9 of 21 ★ · 7 events on 3 maps</span></div></div>' +
  [["Club", "Opens at 12 ★", "kind_alpine"], ["Pro", "Opens at 30 ★", "kind_volcano"], ["Elite", "Opens at 54 ★", "kind_sky"], ["Legend", "Opens at 84 ★", "kind_mainland"]]
    .map(t => '<div class="card tier lock">' + pic(t[2]) + '<div class="capn"><b class="h3 rw g1">' + IC.lock + t[0] + '</b><span class="sm dim nw">' + t[1] + "</span></div></div>").join("") +
  '</div><div class="bymap">' +
  [["Island · Harwar", 1, [["First lap", 3], ["Harbour sprint", 2], ["Docks drift", 2]]], ["Dune sea · Sabkha", 0, [["Sand trail", 0, 1], ["Mirage gymkhana", 0]]], ["Volcano · Kaldera", 0, [["Crater ring", 2], ["Lava run", 0]]]]
    .map(m => '<div class="mapgrp">' + (m[1] ? here(m[0]) : away(m[0])) + '<div class="evs">' + m[2].map(e => '<div class="card ev' + (e[2] ? " foc" : "") + '"><b class="nw sm">' + e[0] + "</b>" + stars(e[1]) + "</div>").join("") + "</div></div>").join("") +
  "</div></div>";

S.career = F({
  layer: "show", bg: "world", veil: 0.5, back: "Events", title: ["Events", "Career"],
  chips: () => season + online,
  body: () => careerBody,
  note: "Rookie 4 of 7 · on Dune sea",
  cta: kb("Enter", "Race Sand trail"),
});

S.sheet = F({
  layer: "show", bg: "world", veil: 0.82, back: "Career", title: ["Events", "Career"],
  chips: () => season + online,
  body: () =>
    '<div class="s-sheet"><div class="card sheet">' + pic("kind_dunes") +
    '<div class="pad col g1 f1"><div class="hd"><span class="eb">Rookie 4 of 7 · Time trial</span><b class="h1">Sand trail</b>' + away("Dune sea · Sabkha", "another map") + "</div>" + times +
    '<span class="sm dim">3.2 km · sand · class B max</span>' +
    '<div class="carrow end">' + pic("car_sturm") + '<div class="col g0 f1"><b class="h3">Sturm ' + plate("B 612") + '</b><span class="sm dim">Your car fits</span></div>' + lnk("C", "Change car") + "</div></div></div></div>",
  note: "Starts on arrival. About 5 s to load.",
  cta: kb("Enter", "Travel to Dune sea"),
});

const CARS = [["hatch", "Hatch", "D 310"], ["tsumuji", "Tsumuji", "D 385"], ["rally", "Rally", "C 470"], ["coupe", "Coupe", "C 520"], ["sturm", "Sturm", "B 612", 1], ["kaze", "Kaze", "B 655"], ["muscle", "Muscle", "A 720", 0, 1], ["fujin", "Fujin", "S1 810", 0, 1]];
S.picker = F({
  layer: "show", bg: "world", veil: 0.78, back: "Sand trail", title: ["Sand trail · class B max", "Choose a car"],
  chips: () => season,
  body: () =>
    '<div class="s-pick"><div class="cars">' + CARS.map(c => '<div class="card carc' + (c[3] ? " foc" : "") + (c[4] ? " no" : "") + '">' + pic("car_" + c[0]) + '<div class="cc"><b class="nw">' + c[1] + '</b>' + plate(c[2]) + "</div></div>").join("") + "</div>" +
    '<div class="card pad col">' + '<div class="bigcar d-only pic i-car_sturm"></div>' +
    '<div class="carinfo"><div class="col g0"><span class="eb">Your car now</span><b class="h1">Sturm</b><span class="sm dim">Build: Harbour grip</span></div>' +
    '<div class="meters sm">' + [["Speed", 64], ["Accel", 58], ["Grip", 77], ["Brakes", 61]].map(m => "<b>" + m[0] + '</b><span class="bar"><i style="width:' + m[1] + '%"></i></span>').join("") + "</div></div>" +
    '<span class="sm dim end">Muscle and Fujin are over class B.</span></div></div>',
  sec: [lnk("Q E", "Next class")],
  cta: kb("Enter", "Take Sturm"),
});

const PARTS = [["Stock", "Factory tune", "Fitted"], ["Tuned", "+15% torque, revs higher, +15 kg", "Owned"], ["Race", "+30% torque, revs much higher, +30 kg", "1 200 cr", 1], ["Supercharger", "+57% torque from idle, revs higher, +35 kg", "A · 4 800 cr"]];
S.garage = F({
  layer: "show", bg: "stage", car: ["--carx:380px;--cary:330px;--zoom:1.3", "--carx:200px;--cary:150px;--zoom:1.25"], floor: true, station: "Garage", back: "Road",
  chips: () => '<span class="chip"><b class="mono">2 450 cr</b></span>' + online,
  body: () =>
    '<div class="s-garage"><div class="slots">' + ["Engine", "Tyres", "Aero", "Suspension", "Brakes", "Weight", "Bias", "Nitro"].map((s, i) => '<span class="chip' + (i === 0 ? " foc" : "") + '">' + GI["slot-" + s.toLowerCase()] + s + "</span>").join("") + "</div>" +
    '<div class="card pad col"><div class="rw sp"><div class="col g0"><span class="eb">Sturm · Engine</span><b class="h2">Race</b></div><span class="rw g1">' + plate("B 612") + '' + IC.go + '' + plate("B 624") + '</span></div>' +
    '<div class="parts">' + PARTS.map((p, i) => '<div class="card part' + (p[3] ? " foc" : "") + '"><span class="lv">' + GI["slot-engine"] + '</span><div class="col g0 f1"><b class="nw">' + p[0] + '</b><span class="sm dim blurb">' + p[1] + '</span></div><span class="chip in' + (i > 1 ? " mono" : "") + '">' + (i === 0 ? IC.check : "") + p[2] + "</span></div>").join("") + "</div>" +
    '<div class="meters sm end">' + [["Speed", 64, 71], ["Accel", 58, 66], ["Grip", 77, 77]].map(m => "<b>" + m[0] + '</b><span class="bar up" style="--to:' + m[2] + '%"><i style="width:' + m[1] + '%"></i></span>').join("") + "</div></div></div>",
  sec: [lnk("C", "Change car"), lnk("B", "Builds")],
  cta: kb("Enter", "Fit Race engine"),
});

S.maps = F({
  layer: "show", bg: "world", veil: 0.55, back: "Home", title: ["Home", "Maps"],
  chips: () => season + online,
  body: () =>
    '<div class="s-maps"><div class="card bigmap"><div class="pic i-map_dunes"><i class="pin sel" style="left:36%;top:58%"></i><i class="pin" style="left:63%;top:34%"></i></div>' +
    '<div class="pad col f1"><div class="col g0"><span class="eb">Dune sea · 2 events open</span><b class="h1">Dune sea · Sabkha</b><span class="sm dim">0 of 6 ★ here</span></div>' +
    '<div class="list">' + [["Sand trail", "Rookie · Time trial", 0, 1], ["Mirage gymkhana", "Rookie · Gymkhana", 0, 0]].map(e => '<div class="li fill' + (e[3] ? " foc" : "") + '"><div class="col g0 f1"><b>' + e[0] + '</b><span class="sm dim">' + e[1] + "</span></div>" + stars(e[2]) + "</div>").join("") + "</div></div></div>" +
    '<div class="rail">' + [["map_island", "Island · Harwar", "Here · 7 of 9 ★", 0], ["map_dunes", "Dune sea · Sabkha", "2 events open", 1], ["map_volcano", "Volcano · Kaldera", "1 event open", 0], ["map_alpine", "Alpine · Hochtal", "Series season 2", 0]].map(m => '<div class="card mapc' + (m[3] ? " foc" : "") + '">' + pic(m[0]) + '<div class="capn"><b class="nw sm">' + m[1] + "</b>" + (m[2].startsWith("Here · ") ? here(m[2].slice(7)) : '<span class="sm dim nw">' + m[2] + "</span>") + "</div></div>").join("") +
    '<div class="card mapc add"><b class="sm rw g1">' + IC.plus + "Make a map</b></div></div></div>",
  note: "A tap only selects. Travel loads the map.",
  cta: kb("Enter", "Travel to Dune sea"),
});

S.make = F({
  layer: "show", bg: "world", veil: 0.55, back: "Maps", title: ["Home · Maps", "Make a map"],
  chips: () => season + online,
  body: () =>
    '<div class="s-make"><div class="card bigmap">' + '<div class="pic i-map_alpine"></div>' +
    '<div class="pad col f1"><div class="col g0"><span class="eb">Alpine · rolled</span><b class="h1">Alpine · Hochtal</b><span class="sm dim d-only">5 towns · 38 km of road · snow above 1 400 m</span></div>' +
    '<div class="col g1"><span class="eb">Map code</span><div class="field"><b class="mono f1">A-7K2Q-M4XD</b><span class="sm dim">Copy</span></div></div>' +
    '<div class="col g1"><span class="eb">Custom map</span><div class="knobs sm">' + [["Size", "Medium", 55], ["Hills", "Steep", 80], ["Towns", "5", 50], ["Roads", "38 km", 40]].map(k => "<b>" + k[0] + '</b><span class="bar"><i style="width:' + k[2] + '%"></i></span><span class="dim">' + k[1] + "</span>").join("") + '</div><span class="sm dim d-only">Change a value and the map rolls again.</span></div></div></div>' +
    '<div class="col"><div class="card roll foc"><span class="die">' + IC.die + '</span><div class="col g0 f1"><b class="h2">Roll</b><span class="sm dim">A new map of this type</span></div>' + cap("R") + "</div>" +
    '<div class="kinds">' + [["island", "Island"], ["alpine", "Alpine", 1], ["mainland", "Lakes"], ["volcano", "Volcano"], ["dunes", "Dune sea"], ["sky", "Sky"]].map(k => '<div class="card kind' + (k[2] ? " sel" : "") + '">' + pic("kind_" + k[0]) + '<span class="rw g0' + (k[2] ? " cot" : "") + '">' + (k[2] ? IC.check : "") + k[1] + "</span></div>").join("") + "</div></div></div>",
  cta: kb("Enter", "Drive this map"),
});

S.runs = F({
  layer: "show", bg: "world", veil: 0.55, back: "Events", title: ["Events", "Runs"],
  chips: () => online,
  body: () =>
    '<div class="s-runs"><div class="card season"><div class="col g0"><span class="eb">Season 4 · 12 days left</span><b class="h2"><span class="star">★</span> 34 season stars</b></div>' +
    '<div class="track"><i style="width:68%"></i><span class="got" style="left:20%"></span><span class="got" style="left:40%"></span><span class="got" style="left:60%"></span><span class="next" style="left:80%"></span><span style="left:100%"></span></div>' +
    '<div class="col g0" style="text-align:right"><span class="eb">Next reward at 40 ★</span><b>Copper tint</b></div></div>' +
    '<div class="runs">' + [["kind_volcano", "Daily · 14 h left", "Crater ring", "Volcano · Kaldera", "+3★", 1], ["ser_s1_final", "Weekly · 4 stages", "Island cup", "Here", "+5★", 0], ["kind_sky", "Random", "Roll a run", "Any map", "+1★", 0]]
      .map(r => '<div class="card run' + (r[5] ? " foc" : "") + '">' + pic(r[0]) + '<div class="capn"><span class="eb">' + r[1] + '</span><b class="h2">' + r[2] + '</b><span class="rw sp sm">' + (r[3] === "Here" ? here("Island · Harwar") : away(r[3])) + '<b class="star">' + r[4] + "</b></span></div></div>").join("") +
    '<div class="card run build">' + IC.plus + '<b>Build a run</b><span class="sm dim">Map, mode, car</span></div></div></div>',
  note: "Free runs earn up to 6 ★ a day.",
  cta: kb("Enter", "Run Crater ring"),
});

const roomTile =
  '<div class="card room">' + pic("kind_island") + '<div class="pad col g1"><div class="col g0"><span class="eb">Your room · FOX-12</span><b class="h2">Island · Harwar</b><span class="sm dim">3 drivers · roaming</span></div>' +
  '<div class="carrow txt"><div class="col g0"><span class="eb">Race setup</span><b>Harbour loop · 3 laps</b></div><span class="sm dim">Change</span></div></div></div>';
const PLAYERS = [["ee", "Mika", "FOX-12", 0], ["de", "Jonas", "FOX-12", 0], ["jp", "Aiko", "OWL-03", 1], ["it", "Luca", "OWL-03", 1], ["fr", "Lea", "OWL-03", 1], ["nl", "Sven", "ELK-27", 0], ["ua", "Oksana", "ELK-27", 0], ["pl", "Pavel", "BEE-40", 1], ["at", "Elsa", "BEE-40", 1], ["it", "Gia", "HEN-11", 0], ["de", "Timo", "RAM-08", 1], ["fr", "Noe", "RAM-08", 1]];
const ROOMS = { "FOX-12": ["Island · Harwar", "3/8", 0, "Roaming"], "OWL-03": ["Dune sea · Sabkha", "6/8", 1, "Racing · lap 2/3"], "ELK-27": ["Alpine · Hochtal", "2/8", 0, "In lobby"], "BEE-40": ["Volcano · Kaldera", "5/8", 1, "Racing · lap 1/5"], "HEN-11": ["Island · Bleble", "1/8", 0, "Roaming"], "RAM-08": ["Sky · Track", "4/8", 1, "Racing · lap 3/3"] };
const status = r => '<span class="st' + (r[2] ? " race" : "") + '"><i class="dot"></i>' + r[3] + "</span>";

S.onA = F({
  layer: "show", bg: "world", veil: 0.55, station: "Online", back: "Road",
  chips: () => online,
  body: f => {
    let rows = "";
    const limit = f === "p" ? 3 : 4;
    const per = gi => (f === "p" ? (gi === 1 ? 2 : 1) : gi === 3 ? 1 : 2);
    Object.entries(ROOMS).slice(0, limit).forEach(([id, r], gi) => {
      rows += '<div class="pr grp"><b class="who">' + (gi === 0 ? "Your room · " : "") + id + " · " + r[0] + "</b>" + status(r) + '<b class="mono sm">' + r[1] + "</b></div>";
      PLAYERS.filter(p => p[2] === id).slice(0, per(gi)).forEach((p, i) => {
        const foc = gi === 1 && i === 0;
        rows += '<div class="pr in' + (foc ? " foc" : "") + '">' + flag(p[0]) + '<b class="who">' + p[1] + "</b><span></span>" + (gi === 0 ? '<span class="sm dim">with you</span>' : '<span class="join">Join</span>') + "</div>";
      });
    });
    return '<div class="s-online">' + roomTile + '<div class="card plist"><div class="hd"><b class="h3">Players online</b><span class="sm dim">38 players · 9 rooms · 3 racing</span></div><div class="rows">' + rows + "</div></div></div>";
  },
  sec: [lnk("I", "Copy invite"), lnk("N", "New room")],
  note: "Joining moves you to Dune sea.",
  cta: kb("Enter", "Join Aiko", "on"),
});

const SECS = [["Graphics", ["Quality high", "60 fps", "Shadows on"], "screen"], ["Display", ["Brand Dark", "HUD normal", "km/h"], "sun"], ["Driving", ["Steer assist low", "TC and ABS on", "Auto gears"], "wheel"], ["Camera", ["Chase, near", "Shake low", "FOV 70"], "cam"], ["Controls", ["Keyboard", "Pad ready", "Rumble on"], "pad"], ["Audio", ["Engine 80", "Effects 70", "Music off"], "vol"], ["Online", ["Name Hare", "Room FOX-12", "Chat on"], "people"], ["Guide", ["6 topics", "How things work"], "book"], ["What's new", ["0.55.0", "3 changes"], "spark"], ["Support", ["Feedback", "Credits"], "heart"]];
const setRows = '<div class="card rows setrows">' +
  [["Steer assist", "Smooths keyboard steering", '<span class="seg"><span>Off</span><span class="on">Low</span><span>High</span></span>', 1], ["Stability", "Catches slides before a spin", '<i class="tog"></i>'], ["Traction control", "Limits wheelspin on power", '<i class="tog on"></i>'], ["ABS", "Keeps steering under braking", '<i class="tog on"></i>'], ["Gears", "Auto shifts for you", '<span class="seg"><span class="on">Auto</span><span>Manual</span></span>'], ["Rewind", "Hold to wind a mistake back", '<i class="tog on"></i>', 0, 1], ["Brake help", "Slows you into tight corners", '<i class="tog"></i>', 0, 1]]
    .map(r => '<div class="setrow' + (r[3] ? " foc" : "") + (r[4] ? " d-only" : "") + '"><div class="col g0"><b>' + r[0] + "</b>" + (r[1] ? '<span class="sm dim d-only">' + r[1] + "</span>" : "") + "</div>" + r[2] + "</div>").join("") + "</div>";
const setHelp = '<div class="card pad col"><div class="col g0"><span class="eb">Steer assist</span><b class="h3">Low</b></div><span class="sm dim">Eases the wheel back to centre and softens quick taps. Good on keyboard; turn it off on a wheel.</span><div class="prev i-road3 pic"></div></div>';

const S_SETLIST = '<div class="s-setlist">' + SECS.map((s, i) => '<div class="card secc' + (i === 2 ? " foc" : "") + '">' + IC[s[2]] + '<b class="h3">' + s[0] + '</b><span class="vals sm dim">' + s[1].join(" · ") + "</span>" + IC.go + "</div>").join("") + "</div>";
S.setA1 = F({
  layer: "show", bg: "world", veil: 0.6, station: "Settings", back: "Road",
  body: () => S_SETLIST,
  sec: [lnk("X", "Reset all")],
  cta: kb("Enter", "Open Driving"),
});
S.setA2 = F({
  layer: "show", bg: "world", veil: 0.6, back: "Settings", title: ["Settings", "Driving"],
  body: () => '<div class="s-setpage">' + setRows + setHelp + "</div>",
  sec: [lnk("X", "Reset Driving")],
  cta: kb("Enter", "Change"),
});

S.guide = F({
  layer: "show", bg: "world", veil: 0.6, back: "Settings", title: ["Settings", "Guide"],
  body: () =>
    '<div class="s-guide"><div class="card season"><div class="col g0"><span class="eb">First steps · after your first run</span><b class="h2">2 of 14 done</b></div><div class="track pri"><i style="width:14%"></i></div><div class="col g0" style="text-align:right"><span class="eb">Next step</span><b>Finish a lap</b></div></div>' + [["road3", "Driving", "Keys, pad, touch and the assists"], ["ser_s1_knockout", "Events and stars", "Flags, star times, tiers", 1], ["ser_s1_opener", "Harepin Series", "Rounds, points, the season car"], ["car_sturm", "Cars and parts", "Classes, builds, the Garage"], ["map_island", "Maps", "Travel, roll or make one"], ["kind_sky", "Things to try", "Jumps, drift zones, the sky track"]]
      .map(g => '<div class="card gd' + (g[3] ? " foc" : "") + '">' + pic(g[0]) + '<div class="capn"><b class="h3">' + g[1] + '</b><span class="sm dim">' + g[2] + "</span></div></div>").join("") + "</div>",
  cta: kb("Enter", "Open Events and stars"),
});

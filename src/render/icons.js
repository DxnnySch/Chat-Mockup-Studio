// Inline SVG icon set (24x24, stroke based). Generic glyphs only — no brand marks.
const P = {
  spark: { fill: true, d: '<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>' },
  bot: { d: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 5v3"/><circle cx="12" cy="4" r="1"/><circle cx="9" cy="14" r="1.2"/><circle cx="15" cy="14" r="1.2"/>' },
  brain: { d: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a3 3 0 0 0-3-1z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/>' },
  user: { d: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>' },
  flask: { d: '<path d="M9 3h6M10 3v6l-5.5 9.5A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3"/><path d="M7.5 15h9"/>' },
  atom: { d: '<circle cx="12" cy="12" r="1.5"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/>' },
  chat: { d: '<path d="M4 5h16v11H9l-5 4z"/>' },
  star: { d: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>' },
  leaf: { d: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15z"/><path d="M5 19l8-8"/>' },
  book: { d: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>' },
  cap: { d: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c3 2.5 9 2.5 12 0v-4.5"/>' },
  cpu: { d: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>' },
  copy: { d: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>' },
  like: { d: '<path d="M7 11v9H4v-9zM7 11l4-8c1.5 0 2.5 1 2.5 2.5V9h5.2a1.5 1.5 0 0 1 1.5 1.8l-1.4 7.5A2 2 0 0 1 16.9 20H7"/>' },
  dislike: { d: '<g transform="rotate(180 12 12)"><path d="M7 11v9H4v-9zM7 11l4-8c1.5 0 2.5 1 2.5 2.5V9h5.2a1.5 1.5 0 0 1 1.5 1.8l-1.4 7.5A2 2 0 0 1 16.9 20H7"/></g>' },
  regenerate: { d: '<path d="M20 11a8 8 0 0 0-14-4M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14 4M20 20v-4h-4"/>' },
  share: { d: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7h14v-7"/>' },
  speak: { d: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>' },
  more: { fill: true, d: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>' },
  check: { d: '<path d="M5 12.5l4.5 4.5L19 7.5"/>' },
  attach: { d: '<path d="M20 11l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L10 16.5a1.7 1.7 0 0 1-2.4-2.4L15 6.7"/>' },
  mic: { d: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>' },
  send: { d: '<path d="M12 19V5M6 11l6-6 6 6"/>' },
  play: { fill: true, d: '<path d="M8 5v14l11-7z"/>' },
  pause: { fill: true, d: '<rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/>' },
  file: { d: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>' },
  link: { d: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>' },
  chevron: { d: '<path d="M9 6l6 6-6 6"/>' },
  chevdown: { d: '<path d="M6 9l6 6 6-6"/>' },
  info: { d: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>' },
  warn: { d: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>' },
  error: { d: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>' },
  tool: { d: '<path d="M14.5 6.5a4 4 0 0 0 4.9 4.9L9 21.8a2.1 2.1 0 0 1-3-3l10.2-10.3"/><path d="M14.5 6.5L17 4l3 3-2.5 2.5"/>' },
  clock: { d: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
  quote: { fill: true, d: '<path d="M4 11c0-4 2-6 5-7v2.5C7.500 7 7 8 7 9h3v7H4zM14 11c0-4 2-6 5-7v2.5C17.500 7 17 8 17 9h3v7h-6z"/>' },
  plus: { d: '<path d="M12 5v14M5 12h14"/>' },
  image: { d: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18l5-5 4 4 3-3 4 4"/>' },
  globe: { d: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>' },
  sidebar: { d: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>' },
};
export const ICON_NAMES = Object.keys(P);

export function icon(name, size = 20, color = 'currentColor', sw = 1.8) {
  const p = P[name] || P.info;
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${p.fill ? color : 'none'}" stroke="${p.fill ? 'none' : color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p.d}</svg>`;
}

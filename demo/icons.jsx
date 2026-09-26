// The site's one icon set: 24×24 line icons drawn for this site, rendered with currentColor.
const paths = {
  overview: 'M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5h4v5',
  gauge: 'M4.5 17a8 8 0 1 1 15 0M12 13l4-4M12 13.2a.2.2 0 1 0 0-.4.2.2 0 0 0 0 .4',
  examples: 'M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z',
  feather: 'M20 4c-6 0-11 4-12 11l-3 5M8 15h6c3 0 5-2 6-5M9 11h6',
  flask: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7.5 15h9',
  book: 'M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2V5zM4 20a2 2 0 0 0 2 2h13v-4',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  branch: 'M6 4v12M18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 8c0 5-6 4-12 8',
  package: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5M8 5.2l8 4.6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  sidebar: 'M4 5h16v14H4zM9 5v14',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  chevron: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  check: 'M5 12.5l4.5 4.5L19 7',
  markdown: 'M4 6h16v12H4zM7 15V9l2.5 3L12 9v6M16 9v6M14 13l2 2 2-2',
  prompt: 'M4 5h16v11H9l-5 4zM8 9l2 2-2 2M12 13h4',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  tablet: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  monitor: 'M3 5h18v11H3zM9 20h6M12 16v4',
  reset: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4',
  share: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  pen: 'M15 5l4 4L8 20H4v-4zM13 7l4 4',
  text: 'M5 6V4h14v2M12 4v16M9 20h6',
  listCheck: 'M4 7l1.5 1.5L8 6M4 16l1.5 1.5L8 15M11 7h9M11 16h9',
  code: 'M9 7l-5 5 5 5M15 7l5 5-5 5',
  table: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
  sigma: 'M18 5H6l6 7-6 7h12',
  columns: 'M4 5h7v14H4zM13 5h7v14h-7z',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5a1 1 0 1 0 0-.01',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  box: 'M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10',
  braces: 'M8 4H7a2 2 0 0 0-2 2v4l-2 2 2 2v4a2 2 0 0 0 2 2h1M16 4h1a2 2 0 0 1 2 2v4l2 2-2 2v4a2 2 0 0 1-2 2h-1',
  history: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4M12 8v4l3 2',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.5v.01',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17h5v-1.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z',
  warning: 'M12 3l10 18H2zM12 10v5M12 18v.01',
  terminal: 'M4 5h16v14H4zM7 10l3 2-3 2M12 15h5',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.7a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.7a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  a11y: 'M12 6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM5 9l7 1.5L19 9M12 10.5V15l-3 5M12 15l3 5',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  bolt: 'M13 3L5 13h6l-1 8 8-10h-6z',
  scissors: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.5 7.5L20 18M8.5 16.5L20 6',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  palette: 'M12 3a9 9 0 0 0 0 18c1.2 0 1.5-1 1.2-2-.3-1 .3-2 1.5-2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10zM7.5 11.5h.01M9.5 7.5h.01M14.5 7.5h.01',
  clipboard: 'M9 4h6v3H9zM9 5.5H6v15h12v-15h-3',
};

/** @param {{ name: keyof typeof paths, size?: number, label?: string }} props */
export function Icon({ name, size = 16, label }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={paths[name]} />
    </svg>
  );
}

export const iconNames = Object.keys(paths);

/** The same icon as an SVG string, for DOM code outside React (site blocks). */
export const svg = (name, size = 16) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;

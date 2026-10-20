// Look presets. Each is a partial {canvas, chrome, theme, participants} merged over the base project.
import { FONT_STACKS as F } from './defaults.js';

export const PRESETS = {
  'Clean Light': {},
  'Clean Dark': {
    canvas: { bg: { mode: 'solid', color: '#0f1115' } },
    chrome: { header: { bg: '#171a21', color: '#e8eaed' }, input: { bg: '#171a21', color: '#e8eaed', border: '#2b303b', sendColor: '#7aa2ff' } },
    theme: {
      colors: { text: '#e8eaed', muted: '#9aa3b2', accent: '#7aa2ff', link: '#8fb4ff', surface: '#0f1115', border: '#2b303b', codeBg: '#171a21', codeText: '#e8eaed' },
      user: { bg: '#232a3b', color: '#e8eaed', borderColor: '#2f3850' }, assistant: { color: '#e8eaed' },
      actions: { color: '#9aa3b2' }, thinking: { bg: '#171a21', color: '#9aa3b2', borderColor: '#2b303b' },
      media: { borderColor: '#2b303b' }, chip: { bg: '#171a21', color: '#e8eaed', borderColor: '#2b303b' },
      chart: { gridColor: '#2b303b', axisColor: '#9aa3b2' }, diagram: { nodeBg: '#1c2336', nodeBorder: '#7aa2ff', nodeText: '#e8eaed', edgeColor: '#9aa3b2' },
      avatar: { ringColor: '#0f1115' },
    },
    participants: { assistant: { avatar: { bg: '#e8eaed', color: '#0f1115' } } },
  },
  'Warm Serif': {
    canvas: { bg: { mode: 'solid', color: '#faf5ec' } },
    chrome: { header: { bg: '#f2eadb', color: '#3b2f22', style: 'bar' }, input: { bg: '#f2eadb', color: '#3b2f22', border: '#dccfb6', sendColor: '#b4552d' } },
    theme: {
      font: { body: F['Book serif'], heading: F['Book serif'], size: 23, lineHeight: 1.55 },
      colors: { text: '#3b2f22', muted: '#7a6a55', accent: '#b4552d', link: '#9a431f', surface: '#faf5ec', border: '#dccfb6', codeBg: '#f2eadb' },
      user: { bg: '#efe3cc', color: '#3b2f22', radius: 14, borderColor: '#dccfb6' }, assistant: { color: '#3b2f22' },
      actions: { color: '#7a6a55' }, thinking: { bg: '#f2eadb', color: '#7a6a55', borderColor: '#dccfb6' },
      media: { borderColor: '#dccfb6' }, chip: { bg: '#faf5ec', color: '#3b2f22', borderColor: '#dccfb6' },
      chart: { gridColor: '#e7dcc6', axisColor: '#7a6a55' }, diagram: { nodeBg: '#f2eadb', nodeBorder: '#b4552d', nodeText: '#3b2f22', edgeColor: '#7a6a55' },
    },
    participants: { assistant: { avatar: { bg: '#b4552d', color: '#fff8ee' } }, user: { avatar: { bg: '#7a6a55' } } },
  },
  'Bubbles': {
    canvas: { bg: { mode: 'gradient', color: '#f5f7ff', color2: '#e9f3ff', angle: 160 } },
    chrome: { header: { bg: '#ffffff', style: 'window' }, input: { bg: '#ffffff' } },
    theme: {
      font: { body: F.Rounded, heading: F.Rounded },
      user: { bg: '#2563eb', color: '#ffffff', radius: 26, shadow: 'sm' },
      assistant: { layout: 'bubble', bg: '#ffffff', radius: 26, padX: 22, padY: 16, maxWidth: 88, shadow: 'sm', borderWidth: 1, borderColor: '#e1e6f0' },
      avatar: { size: 52 },
    },
  },
  'Terminal': {
    canvas: { bg: { mode: 'solid', color: '#0b0f0b' } },
    chrome: { header: { bg: '#121812', color: '#8df08d', title: 'research@lab:~', subtitle: '', modelBadge: '', style: 'window' }, input: { bg: '#121812', color: '#8df08d', border: '#244024', sendColor: '#8df08d', radius: 6, placeholder: '> type a message', disclaimer: '' } },
    theme: {
      font: { body: F.Mono, heading: F.Mono, size: 20 },
      colors: { text: '#b6f5b6', muted: '#5fae5f', accent: '#8df08d', link: '#8df08d', surface: '#0b0f0b', border: '#244024', codeBg: '#121812', codeText: '#b6f5b6' },
      user: { layout: 'plain', bg: 'transparent', color: '#ffffff', padX: 0, padY: 0, align: 'left', maxWidth: 100 },
      assistant: { color: '#b6f5b6' }, avatar: { show: false }, names: { show: true, showForUser: true, uppercase: true },
      actions: { show: false, color: '#5fae5f' }, thinking: { bg: '#121812', color: '#5fae5f', borderColor: '#244024' },
      media: { radius: 2, borderColor: '#244024' }, code: { radius: 2 },
      chip: { bg: '#121812', color: '#b6f5b6', borderColor: '#244024', radius: 4 },
      chart: { gridColor: '#1d2e1d', axisColor: '#5fae5f' }, diagram: { nodeBg: '#121812', nodeBorder: '#8df08d', nodeText: '#b6f5b6', edgeColor: '#5fae5f' },
    },
  },
  'Poster High-Contrast': {
    canvas: { width: 760, padding: 36, physicalCm: 30 },
    chrome: { header: { bg: '#ffffff', color: '#000000', style: 'bar' }, input: { bg: '#ffffff', color: '#000000', border: '#000000', sendColor: '#0072B2' } },
    theme: {
      font: { body: F.Arial, heading: F.Arial, size: 28, lineHeight: 1.45, weight: 400 },
      colors: { text: '#000000', muted: '#333333', accent: '#0072B2', link: '#004f7c', border: '#000000', codeBg: '#f0f0f0' },
      gap: 30,
      user: { bg: '#d6e9f8', color: '#000000', borderWidth: 3, borderColor: '#0072B2', radius: 18 },
      assistant: { layout: 'bubble', bg: '#ffffff', color: '#000000', borderWidth: 3, borderColor: '#000000', radius: 18, padX: 22, padY: 16, maxWidth: 100 },
      avatar: { size: 64 }, names: { scale: 0.8 }, meta: { scale: 0.75 }, sources: { scale: 0.8 },
      actions: { color: '#000000', scale: 1 }, thinking: { bg: '#f0f0f0', color: '#222222', borderColor: '#000000' },
      media: { borderWidth: 3, borderColor: '#000000', captionScale: 0.8 }, chip: { borderColor: '#000000', color: '#000000' },
      chart: { gridColor: '#bbbbbb', axisColor: '#000000', fontScale: 0.8 }, diagram: { nodeBg: '#ffffff', nodeBorder: '#000000', nodeText: '#000000', edgeColor: '#000000', fontScale: 0.8 },
    },
    participants: { user: { avatar: { bg: '#0072B2' } }, assistant: { avatar: { bg: '#000000' } } },
  },
};

// Simple line icons for the portal. 24x24, stroke uses currentColor.
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export function GamePlanIcon(props) {
  return <svg {...base} {...props}><path d="M3 12l9-9 9 9" /><path d="M12 3v18" /><path d="M5 21h14" /></svg>;
}
export function CashIcon(props) {
  return <svg {...base} {...props}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /></svg>;
}
export function ToolsIcon(props) {
  return <svg {...base} {...props}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" /></svg>;
}
export function HomeIcon(props) {
  return <svg {...base} {...props}><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></svg>;
}
export function TargetIcon(props) {
  return <svg {...base} {...props}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>;
}
export function PencilIcon(props) {
  return <svg {...base} {...props}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>;
}
export function ClientsIcon(props) {
  return <svg {...base} {...props}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 010 7" /><path d="M18 14.7c2 .7 3.2 2.5 3.6 5.3" /></svg>;
}
export function BrushIcon(props) {
  return <svg {...base} {...props}><path d="M18.4 2.6a2 2 0 012.9 2.9L11 15.8 8.2 13z" /><path d="M7 14.5c-2 0-3.5 1.5-3.5 3.5 0 1.2-.5 2-1.5 2.5 3.5 1 7-1 7-4.5z" /></svg>;
}
export function ArrowLeftIcon(props) {
  return <svg {...base} {...props}><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>;
}
export function ArrowRightIcon(props) {
  return <svg {...base} {...props}><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>;
}
export function WorkbookIcon(props) {
  return <svg {...base} {...props}><path d="M4 4h16v16H4z" /><path d="M4 9h16M9 4v16" /></svg>;
}

// Icons.jsx — Lucide-style inline SVG icon system
// Replaces emoji icons throughout the app

function makeIcon(name, paths) {
  const Icon = ({ size = 16, className = '', strokeWidth = 2, ...props }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucide lucide-${name} ${className}`}
      aria-hidden="true"
      {...props}
    >
      {paths}
    </svg>
  );
  Icon.displayName = `Icon_${name}`;
  return Icon;
}

export const Home = makeIcon('home', <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>);
export const Star = makeIcon('star', <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>);
export const StarFilled = makeIcon('star-filled', <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor"/>);
export const Trophy = makeIcon('trophy', <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></>);
export const List = makeIcon('list', <><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></>);
export const Settings = makeIcon('settings', <><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></>);
export const Search = makeIcon('search', <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>);
export const X = makeIcon('x', <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>);
export const ChevronDown = makeIcon('chevron-down', <polyline points="6 9 12 15 18 9"/>);
export const ChevronUp = makeIcon('chevron-up', <polyline points="18 15 12 9 6 15"/>);
export const ChevronRight = makeIcon('chevron-right', <polyline points="9 18 15 12 9 6"/>);
export const ChevronLeft = makeIcon('chevron-left', <polyline points="15 18 9 12 15 6"/>);
export const Plus = makeIcon('plus', <><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></>);
export const Check = makeIcon('check', <polyline points="20 6 9 17 4 12"/>);
export const CheckCircle = makeIcon('check-circle', <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>);
export const Clock = makeIcon('clock', <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>);
export const Timer = makeIcon('timer', <><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></>);
export const LogOut = makeIcon('log-out', <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></>);
export const User = makeIcon('user', <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>);
export const Users = makeIcon('users', <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>);
export const ExternalLink = makeIcon('external-link', <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></>);
export const Trash = makeIcon('trash-2', <><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></>);
export const Edit = makeIcon('edit-2', <><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></>);
export const Eye = makeIcon('eye', <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>);
export const EyeOff = makeIcon('eye-off', <><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></>);
export const Zap = makeIcon('zap', <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>);
export const Shuffle = makeIcon('shuffle', <><polyline points="16 3 21 3 21 8"/><line x1="4" x2="21" y1="20" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" x2="21" y1="15" y2="21"/><line x1="4" x2="9" y1="4" y2="9"/></>);
export const FileText = makeIcon('file-text', <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></>);
export const Lock = makeIcon('lock', <><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>);
export const Sparkles = makeIcon('sparkles', <><path d="m12 3-1.91 5.81-5.82 1.91 5.82 1.91L12 18.44l1.91-5.81 5.82-1.91-5.82-1.91Z"/><path d="M5 3v4"/><path d="M3 5h4"/><path d="M19 17v4"/><path d="M17 19h4"/></>);
export const AlertTriangle = makeIcon('alert-triangle', <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></>);
export const ArrowRight = makeIcon('arrow-right', <><line x1="5" x2="19" y1="12" y2="12"/><polyline points="12 5 19 12 12 19"/></>);
export const History = makeIcon('history', <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></>);
export const Info = makeIcon('info', <><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></>);
export const Horse = makeIcon('horse', <><path d="M10.4 2.7c0 1.1.9 2 2 2s2-.9 2-2v-.5"/><path d="M13 4.3c1.3.3 4 1.9 4 5.7"/><path d="M6 7v1"/><path d="M7 3c.5 0 1 .2 1.4.6L12 7l-1 1-4-4"/><path d="M3 7v2c0 3 3 5 6 5h3v5l-3 3h9V11c0-3-3-4-5-4"/></>);
export const Filter = makeIcon('filter', <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>);
export const Crown = makeIcon('crown', <><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></>);
export const Flag = makeIcon('flag', <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></>);
export const Menu = makeIcon('menu', <><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></>);
export const BarChart = makeIcon('bar-chart', <><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></>);
export const Upload = makeIcon('upload', <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></>);

// Default export with all icons
const Icons = {
  Home, Star, StarFilled, Trophy, List, Settings, Search, X,
  ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  Plus, Check, CheckCircle, Clock, Timer,
  LogOut, User, Users, ExternalLink, Trash, Edit, Eye, EyeOff,
  Zap, Shuffle, FileText, Lock, Sparkles, AlertTriangle,
  ArrowRight, History, Info, Horse, Filter, Crown, Flag,
  Menu, BarChart, Upload,
};

export default Icons;

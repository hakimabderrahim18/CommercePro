import React, { createContext, useContext, useState, useEffect } from 'react';

export const THEME_COLORS = [
  {
    id: 'blue',
    name: 'Bleu Nuit & Royal (Par défaut)',
    primary: '#2563eb', // blue-600
    primaryHover: '#1d4ed8', // blue-700
    primaryLight: '#eff6ff', // blue-50
    primaryBorder: '#bfdbfe', // blue-200
    primaryText: '#1e40af', // blue-800
    sidebarBg: '#0f172a', // slate-900 nuit
    sidebarHeaderBg: '#020617', // slate-950
    sidebarBorder: '#1e293b', // slate-800
    sidebarHover: '#1e293b',
    colorBadge: '#2563eb',
    previewClass: 'from-blue-600 to-indigo-600'
  },
  {
    id: 'indigo',
    name: 'Indigo Profond & Nuit Mystique',
    primary: '#4f46e5', // indigo-600
    primaryHover: '#4338ca', // indigo-700
    primaryLight: '#eef2ff', // indigo-50
    primaryBorder: '#c7d2fe', // indigo-200
    primaryText: '#3730a3', // indigo-800
    sidebarBg: '#1e1b4b', // indigo-950 nuit
    sidebarHeaderBg: '#0f0e26',
    sidebarBorder: '#312e81', // indigo-900
    sidebarHover: '#2e2a72',
    colorBadge: '#6366f1',
    previewClass: 'from-indigo-600 to-purple-600'
  },
  {
    id: 'emerald',
    name: 'Émeraude & Vert Forêt Profond',
    primary: '#059669', // emerald-600
    primaryHover: '#047857', // emerald-700
    primaryLight: '#ecfdf5', // emerald-50
    primaryBorder: '#a7f3d0', // emerald-200
    primaryText: '#065f46', // emerald-800
    sidebarBg: '#06281e', // sombre émeraude
    sidebarHeaderBg: '#021812',
    sidebarBorder: '#064e3b', // emerald-900
    sidebarHover: '#0a3d2e',
    colorBadge: '#10b981',
    previewClass: 'from-emerald-600 to-teal-600'
  },
  {
    id: 'teal',
    name: 'Teal Abyssal & Océan Turquoise',
    primary: '#0d9488', // teal-600
    primaryHover: '#0f766e', // teal-700
    primaryLight: '#f0fdfa', // teal-50
    primaryBorder: '#99f6e4', // teal-200
    primaryText: '#115e59', // teal-800
    sidebarBg: '#042727', // teal très sombre
    sidebarHeaderBg: '#021717',
    sidebarBorder: '#134e4a', // teal-900
    sidebarHover: '#083a3a',
    colorBadge: '#14b8a6',
    previewClass: 'from-teal-600 to-cyan-600'
  },
  {
    id: 'violet',
    name: 'Violet Impérial & Nuit Pourpre',
    primary: '#7c3aed', // violet-600
    primaryHover: '#6d28d9', // violet-700
    primaryLight: '#f5f3ff', // violet-50
    primaryBorder: '#ddd6fe', // violet-200
    primaryText: '#5b21b6', // violet-800
    sidebarBg: '#210d44', // violet très sombre
    sidebarHeaderBg: '#120527',
    sidebarBorder: '#4c1d95', // violet-900
    sidebarHover: '#331566',
    colorBadge: '#8b5cf6',
    previewClass: 'from-violet-600 to-fuchsia-600'
  },
  {
    id: 'rose',
    name: 'Bordeaux & Rubis Sombre',
    primary: '#e11d48', // rose-600
    primaryHover: '#be123c', // rose-700
    primaryLight: '#fff1f2', // rose-50
    primaryBorder: '#fecdd3', // rose-200
    primaryText: '#9f1239', // rose-800
    sidebarBg: '#330814', // rose bordeaux très sombre
    sidebarHeaderBg: '#1c030a',
    sidebarBorder: '#881337', // rose-900
    sidebarHover: '#4c0d1e',
    colorBadge: '#f43f5e',
    previewClass: 'from-rose-600 to-pink-600'
  },
  {
    id: 'amber',
    name: 'Ambre Doré & Havane Sombre',
    primary: '#d97706', // amber-600
    primaryHover: '#b45309', // amber-700
    primaryLight: '#fffbeb', // amber-50
    primaryBorder: '#fde68a', // amber-200
    primaryText: '#92400e', // amber-800
    sidebarBg: '#2c1906', // havane/ambre très sombre
    sidebarHeaderBg: '#180d02',
    sidebarBorder: '#78350f', // amber-900
    sidebarHover: '#422409',
    colorBadge: '#f59e0b',
    previewClass: 'from-amber-600 to-orange-600'
  },
  {
    id: 'slate',
    name: 'Noir Carbone & Titane Sombre',
    primary: '#475569', // slate-600
    primaryHover: '#334155', // slate-700
    primaryLight: '#f8fafc', // slate-50
    primaryBorder: '#cbd5e1', // slate-200
    primaryText: '#1e293b', // slate-800
    sidebarBg: '#121214', // noir pur mat
    sidebarHeaderBg: '#09090b',
    sidebarBorder: '#27272a',
    sidebarHover: '#202024',
    colorBadge: '#64748b',
    previewClass: 'from-slate-700 to-zinc-800'
  }
];

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [currentColorId, setCurrentColorId] = useState(() => {
    return localStorage.getItem('commercepost_theme_color') || 'blue';
  });

  const activeTheme = THEME_COLORS.find(c => c.id === currentColorId) || THEME_COLORS[0];

  useEffect(() => {
    localStorage.setItem('commercepost_theme_color', activeTheme.id);
    document.documentElement.setAttribute('data-theme-color', activeTheme.id);

    // Injection des variables CSS natives pour colorer dynamiquement l'interface
    const root = document.documentElement;
    root.style.setProperty('--color-primary', activeTheme.primary);
    root.style.setProperty('--color-primary-hover', activeTheme.primaryHover);
    root.style.setProperty('--color-primary-light', activeTheme.primaryLight);
    root.style.setProperty('--color-primary-border', activeTheme.primaryBorder);
    root.style.setProperty('--color-primary-text', activeTheme.primaryText);

    // Sidebar Dynamic Colors
    root.style.setProperty('--sidebar-bg', activeTheme.sidebarBg);
    root.style.setProperty('--sidebar-header-bg', activeTheme.sidebarHeaderBg);
    root.style.setProperty('--sidebar-border', activeTheme.sidebarBorder);
    root.style.setProperty('--sidebar-hover', activeTheme.sidebarHover);
  }, [activeTheme]);

  const changeThemeColor = (colorId) => {
    const found = THEME_COLORS.find(c => c.id === colorId);
    if (found) {
      setCurrentColorId(found.id);
    }
  };

  return (
    <ThemeContext.Provider value={{ currentColorId, activeTheme, changeThemeColor, colorsList: THEME_COLORS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

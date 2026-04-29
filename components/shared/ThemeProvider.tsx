'use client'

import { useEffect } from 'react'

export type ThemeKey = 'orange' | 'blue' | 'green' | 'purple' | 'red' | 'teal'

export interface ThemeColors {
  accent: string
  accentHover: string
  accentShadow: string
  label: string
}

export const THEMES: Record<ThemeKey, ThemeColors> = {
  orange: {
    label: 'Pomarańcz (domyślny)',
    accent: '#e07818',
    accentHover: '#c96b10',
    accentShadow: 'rgba(224,120,24,0.15)',
  },
  blue: {
    label: 'Niebieski',
    accent: '#2563eb',
    accentHover: '#1d4ed8',
    accentShadow: 'rgba(37,99,235,0.15)',
  },
  green: {
    label: 'Zielony',
    accent: '#10a872',
    accentHover: '#0d8f60',
    accentShadow: 'rgba(16,168,114,0.15)',
  },
  purple: {
    label: 'Fioletowy',
    accent: '#a855f7',
    accentHover: '#9333ea',
    accentShadow: 'rgba(168,85,247,0.15)',
  },
  red: {
    label: 'Czerwony',
    accent: '#e8384f',
    accentHover: '#c9293e',
    accentShadow: 'rgba(232,56,79,0.15)',
  },
  teal: {
    label: 'Morski',
    accent: '#0ea5e9',
    accentHover: '#0284c7',
    accentShadow: 'rgba(14,165,233,0.15)',
  },
}

export const THEME_STORAGE_KEY = 'crm-theme'

export function applyTheme(key: ThemeKey) {
  const theme = THEMES[key]
  const root = document.documentElement
  root.style.setProperty('--accent', theme.accent)
  root.style.setProperty('--accent-hover', theme.accentHover)
  root.style.setProperty('--accent-shadow', theme.accentShadow)
}

export function ThemeProvider() {
  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeKey | null
    if (saved && THEMES[saved]) {
      applyTheme(saved)
    }
  }, [])
  return null
}

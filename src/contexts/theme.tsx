import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

type ThemeMode = 'light' | 'dark'

interface ThemeContextType {
  mode: ThemeMode
  toggle: () => void
  colors: typeof LIGHT
}

const DARK = {
  gradient: 'linear-gradient(135deg, #1a2a22 0%, #1e2e26 25%, #212f28 50%, #1c2b23 75%, #182720 100%)',
  sidebarBg: 'rgba(18,28,22,0.95)',
  sidebarBorder: 'rgba(255,255,255,0.06)',
  sidebarText: '#e8f0ec',
  sidebarTextMuted: 'rgba(255,255,255,0.45)',
  sidebarActive: 'rgba(45,180,140,0.2)',
  sidebarActiveText: '#5ee8b8',
  sidebarHover: 'rgba(255,255,255,0.05)',
  sidebarLogo: '#5ee8b8',
  headerBg: 'rgba(18,28,22,0.9)',
  headerBorder: 'rgba(255,255,255,0.06)',
  headerText: '#e8f0ec',
  contentBg: 'transparent',
}

const LIGHT = {
  gradient: 'linear-gradient(135deg, #f8fffe 0%, #f0faf6 25%, #e8f5f0 50%, #e0f0ea 75%, #d8ebe4 100%)',
  sidebarBg: 'rgba(255,255,255,0.8)',
  sidebarBorder: 'rgba(0,0,0,0.06)',
  sidebarText: '#0d2e1c',
  sidebarTextMuted: 'rgba(13,46,28,0.5)',
  sidebarActive: 'rgba(13,46,28,0.1)',
  sidebarActiveText: '#0a3320',
  sidebarHover: 'rgba(13,46,28,0.05)',
  sidebarLogo: '#0a3320',
  headerBg: 'rgba(255,255,255,0.85)',
  headerBorder: 'rgba(0,0,0,0.06)',
  headerText: '#0d2e1c',
  contentBg: 'transparent',
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  toggle: () => {},
  colors: LIGHT,
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('sgi-theme')
    return (saved === 'dark' || saved === 'light') ? saved : 'light'
  })

  useEffect(() => {
    localStorage.setItem('sgi-theme', mode)
  }, [mode])

  const toggle = () => setMode(m => m === 'light' ? 'dark' : 'light')
  const colors = mode === 'dark' ? DARK : LIGHT

  return (
    <ThemeContext.Provider value={{ mode, toggle, colors }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)

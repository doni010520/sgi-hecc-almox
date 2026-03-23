import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

type ThemeMode = 'light' | 'dark'

interface ThemeContextType {
  mode: ThemeMode
  toggle: () => void
  colors: typeof LIGHT
}

const DARK = {
  gradient: 'linear-gradient(135deg, #b0f5d0 0%, #78d8a0 25%, #50b87a 50%, #3a9a68 75%, #2e7d52 100%)',
  sidebarBg: 'rgba(10,15,20,0.75)',
  sidebarBorder: 'rgba(255,255,255,0.08)',
  sidebarText: '#fff',
  sidebarTextMuted: 'rgba(255,255,255,0.5)',
  sidebarActive: 'rgba(255,255,255,0.12)',
  sidebarActiveText: '#fff',
  sidebarHover: 'rgba(255,255,255,0.06)',
  sidebarLogo: '#fff',
  headerBg: 'rgba(10,15,20,0.65)',
  headerBorder: 'rgba(255,255,255,0.08)',
  headerText: '#fff',
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

import React, { createContext, useContext, useState, useEffect } from 'react';

const themes = {
  clawed: {
    name: 'Clawed',
    background: '#0a0a0a',
    backgroundTranslucent: 'rgba(10, 10, 10, 0.85)',
    surface: 'rgba(26, 26, 26, 0.7)',
    surfaceSolid: '#1a1a1a',
    border: 'rgba(0, 219, 56, 0.3)',
    primary: '#00db38',
    primaryDark: '#00a02a',
    primaryLight: '#00ff41',
    secondary: '#ff0080',
    secondaryDark: '#cc0066',
    secondaryLight: '#ff33a0',
    textPrimary: '#ffffff',
    textSecondary: '#a0a0a0',
    textDisabled: '#666666',
    bodyBg: '#050805',
    hueRotate: '90deg',
  },
  green: {
    name: 'Green',
    background: '#001100',
    backgroundTranslucent: 'rgba(0, 17, 0, 0.85)',
    surface: 'rgba(0, 17, 0, 0.7)',
    surfaceSolid: '#001a00',
    border: 'rgba(51, 255, 51, 0.3)',
    primary: '#33ff33',
    primaryDark: '#00cc00',
    primaryLight: '#66ff66',
    secondary: '#66ffcc',
    secondaryDark: '#33cc99',
    secondaryLight: '#99ffdd',
    textPrimary: '#33ff33',
    textSecondary: '#66cc66',
    textDisabled: '#336633',
    bodyBg: '#000e05',
    hueRotate: '60deg',
  },
  gray: {
    name: 'Gray',
    background: '#0a0a0a',
    backgroundTranslucent: 'rgba(10, 10, 10, 0.85)',
    surface: 'rgba(20, 20, 20, 0.7)',
    surfaceSolid: '#141414',
    border: 'rgba(160, 160, 160, 0.3)',
    primary: '#a0a0a0',
    primaryDark: '#808080',
    primaryLight: '#c0c0c0',
    secondary: '#b0b0b0',
    secondaryDark: '#909090',
    secondaryLight: '#d0d0d0',
    textPrimary: '#c0c0c0',
    textSecondary: '#909090',
    textDisabled: '#505050',
    bodyBg: '#050505',
    hueRotate: '0deg',
  },
};

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [themeName, setThemeName] = useState(() => {
    return localStorage.getItem('void-theme') || 'clawed';
  });

  const theme = themes[themeName] || themes.clawed;

  useEffect(() => {
    localStorage.setItem('void-theme', themeName);

    // Apply theme to CSS variables
    const root = document.documentElement;
    root.style.setProperty('--color-background', theme.background);
    root.style.setProperty('--color-background-translucent', theme.backgroundTranslucent);
    root.style.setProperty('--color-surface', theme.surface);
    root.style.setProperty('--color-surface-solid', theme.surfaceSolid);
    root.style.setProperty('--color-border', theme.border);
    root.style.setProperty('--color-primary', theme.primary);
    root.style.setProperty('--color-primary-dark', theme.primaryDark);
    root.style.setProperty('--color-primary-light', theme.primaryLight);
    root.style.setProperty('--color-secondary', theme.secondary);
    root.style.setProperty('--color-secondary-dark', theme.secondaryDark);
    root.style.setProperty('--color-secondary-light', theme.secondaryLight);
    root.style.setProperty('--color-text-primary', theme.textPrimary);
    root.style.setProperty('--color-text-secondary', theme.textSecondary);
    root.style.setProperty('--color-text-disabled', theme.textDisabled);

    // Update body background
    document.body.style.backgroundColor = theme.background;

    // Update the ::before pseudo-element via a CSS class
    document.body.dataset.theme = themeName;
  }, [themeName, theme]);

  const setTheme = (name) => {
    if (themes[name]) {
      setThemeName(name);
    }
  };

  const cycleTheme = () => {
    const themeNames = Object.keys(themes);
    const currentIndex = themeNames.indexOf(themeName);
    const nextIndex = (currentIndex + 1) % themeNames.length;
    setThemeName(themeNames[nextIndex]);
  };

  return (
    <ThemeContext.Provider value={{ theme, themeName, setTheme, cycleTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;

import { createContext, useState, useContext } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [colorMode, setColorMode] = useState('monochrome');
  const [canToggle, setCanToggle] = useState(true);

  const toggleColorMode = () => {
    if (canToggle) {
      setColorMode(prevMode => prevMode === 'monochrome' ? 'color' : 'monochrome');
    }
  };

  return (
    <ThemeContext.Provider value={{ colorMode, toggleColorMode, canToggle, setCanToggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
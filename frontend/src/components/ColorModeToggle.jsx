import { useTheme } from '../context/themeContext';
import styles from './ColorModeToggle.module.css';

const ColorModeToggle = () => {
  const { colorMode, toggleColorMode, canToggle } = useTheme();

  return (
    <div className={styles.toggleContainer}>
      <span className={styles.label}>Mode:</span>
      <button
        onClick={toggleColorMode}
        className={`${styles.toggleButton} ${colorMode === 'color' ? styles.color : styles.monochrome} ${!canToggle ? styles.disabled : ''}`}
        disabled={!canToggle}
      >
        {colorMode === 'color' ? 'Color' : 'Monochrome'}
      </button>
    </div>
  );
};

export default ColorModeToggle;
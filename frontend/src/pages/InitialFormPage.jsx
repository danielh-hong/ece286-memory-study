import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../context/themeContext';
import { useScore } from '../context/scoreContext';
import styles from './InitialFormPage.module.css';
import Notification from '../components/Notification';

const InitialFormPage = () => {
  const navigate = useNavigate();
  const { colorMode, toggleColorMode } = useTheme();
  const { updateParticipantInfo } = useScore();

  const [notification, setNotification] = useState('');
  const [stats, setStats] = useState({
    totalParticipants: 0,
    colorFirstCount: 0,
    monochromeFirstCount: 0
  });

  const [formData, setFormData] = useState({
    name: '',
    library: 'Other',
    customLocation: '',
    candy: ''
  });

  const [useCustomLocation, setUseCustomLocation] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/test-stats`);
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
        setNotification('Failed to load test statistics');
      }
    };
    fetchStats();
  }, []);

  // Decide recommended start mode
  const recommendedStartWithColor = stats.monochromeFirstCount > stats.colorFirstCount;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setNotification('Please enter your name to continue');
      return;
    }
    const finalLocation = useCustomLocation ? formData.customLocation : formData.library;
    if (!finalLocation.trim()) {
      setNotification('Please select or enter a location');
      return;
    }

    updateParticipantInfo({
      name: formData.name,
      library: finalLocation,
      candy: formData.candy,
      startedWithColor: colorMode === 'color'
    });

    navigate('/calibration');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'library' && value === 'custom') {
      setUseCustomLocation(true);
    } else if (name === 'library') {
      setUseCustomLocation(false);
    }
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRecommendation = () => {
    if (recommendedStartWithColor && colorMode !== 'color') {
      toggleColorMode();
    } else if (!recommendedStartWithColor && colorMode !== 'monochrome') {
      toggleColorMode();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.navLinks}>
        <Link to="/all-results" className={styles.navLink}>View All Results</Link>
      </div>
      
      <Notification message={notification} type="warning" />

      <div className={styles.card}>
        <h1 className={styles.title}>Memory Test Study</h1>

        <div className={styles.stats}>
          <p><strong>Test Statistics:</strong></p>
          <p>Total participants: {stats.totalParticipants}</p>
          <p>Started with color: {stats.colorFirstCount}</p>
          <p>Started with monochrome: {stats.monochromeFirstCount}</p>
          <p className={styles.recommendation}>
            Recommended starting mode: <strong>{recommendedStartWithColor ? 'Color' : 'Monochrome'}</strong>
            <button className={styles.recommendButton} onClick={handleRecommendation}>
              Use Recommended
            </button>
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.consentText}>
            <h2>Consent Form</h2>
            <p>
              By participating in this study, you consent to having your test results collected for
              research purposes. All data will be anonymized. You may withdraw at any time.
            </p>
            <p>
              This study investigates the impact of color variation on visual memory performance.
            </p>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="name">Name:</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Enter your name"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="library">Testing Location:</label>
            <select
              id="library"
              name="library"
              value={formData.library}
              onChange={handleChange}
              className={styles.selectField}
            >
              <option value="Gerstein">Gerstein Library</option>
              <option value="Robarts">Robarts Library</option>
              <option value="Hart House">Hart House</option>
              <option value="Bahen">Bahen Centre</option>
              <option value="custom">Other (specify)</option>
            </select>

            {useCustomLocation && (
              <input
                type="text"
                id="customLocation"
                name="customLocation"
                value={formData.customLocation}
                onChange={handleChange}
                placeholder="Enter location"
                className={styles.customInput}
              />
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="candy">Incentive Candy:</label>
            <input
              type="text"
              id="candy"
              name="candy"
              value={formData.candy}
              onChange={handleChange}
              placeholder="Enter candy type (optional)"
            />
          </div>

          <div className={styles.currentMode}>
            <p>You will start with: <strong>{colorMode === 'color' ? 'Color' : 'Monochrome'} mode</strong></p>
            <p>You can change this with the toggle in the top right</p>
          </div>

          <button type="submit" className={styles.submitButton}>
            Begin Test
          </button>
        </form>
      </div>
    </div>
  );
};

export default InitialFormPage;
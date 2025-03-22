import { useState, useEffect } from 'react';
import styles from './Notification.module.css';

const Notification = ({ message, type = 'info', duration = 3000 }) => {
  const [visible, setVisible] = useState(!!message);

  useEffect(() => {
    if (message) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [message, duration]);

  if (!message || !visible) return null;

  return (
    <div className={`${styles.notification} ${styles[type]}`}>
      {message}
    </div>
  );
};

export default Notification;
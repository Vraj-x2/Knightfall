import { Link } from 'react-router-dom';
import styles from './Brand.module.css';

// The knight mark; decorative wherever the wordmark sits beside it.
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg className={styles.mark} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4c6ef5" />
          <stop offset="1" stopColor="#364fc7" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#logo-g)" />
      <path
        fill="#fff"
        d="M22 50h22v-4c0-6-3-10-3-16 0-4 2-7 2-7l-4-1-1-5-4 4c-7 1-12 6-13 13l5 2 5-4c1 3-1 6-5 9-3 2-4 5-4 9z"
      />
    </svg>
  );
}

export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.brand} aria-label="Knightfall home">
        <LogoMark size={30} />
        <span className={styles.wordmark}>Knightfall</span>
      </Link>
      <div className={styles.headerActions}>{children}</div>
    </header>
  );
}

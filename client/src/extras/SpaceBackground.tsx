import { useEffect, useState } from 'react';
import { getSpacePicture, type SpacePicture } from './apod';
import styles from './SpaceBackground.module.css';

const HIDE_KEY = 'chess-space-hidden';

function loadHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === '1';
  } catch {
    return false;
  }
}

// NASA's picture of the day behind every page, softened so the board stays readable, with its credit.
export function SpaceBackground() {
  const [picture, setPicture] = useState<SpacePicture | null>(null);
  const [hidden, setHidden] = useState(loadHidden);

  useEffect(() => {
    let live = true;
    void getSpacePicture().then((p) => live && setPicture(p));
    return () => {
      live = false;
    };
  }, []);

  function toggle() {
    setHidden(!hidden);
    try {
      localStorage.setItem(HIDE_KEY, hidden ? '0' : '1');
    } catch {
      // Storage blocked: the choice lasts until the page closes.
    }
  }

  if (!picture) return null;
  return (
    <>
      {!hidden && <div className={styles.backdrop} style={{ backgroundImage: `url("${picture.imageUrl}")` }} aria-hidden="true" />}
      <p className={styles.credit}>
        {!hidden && (
          <a href={picture.pageUrl} target="_blank" rel="noopener noreferrer">
            NASA picture of the day: {picture.title}
            {picture.copyright && ` · © ${picture.copyright}`}
          </a>
        )}
        <button className={styles.toggle} onClick={toggle}>
          {hidden ? 'Show space background' : 'Hide'}
        </button>
      </p>
    </>
  );
}

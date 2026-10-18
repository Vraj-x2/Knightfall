import { useEffect, useState } from 'react';

const COPIED_MS = 2000;

export function ShareLink() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      window.prompt('Copy this link', window.location.href);
    }
  }

  return (
    <button className="btn" onClick={copy}>
      {copied ? 'Copied' : 'Copy invite link'}
    </button>
  );
}

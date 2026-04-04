'use client';

import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    if (localStorage.getItem('pwa-dismissed')) return;

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // iOS detection
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    if (ios) {
      // Show iOS instructions after 3 seconds
      setTimeout(() => setShow(true), 3000);
      return;
    }

    // Chrome/Android — listen for beforeinstallprompt
    const handler = (e: any) => {
      e.preventDefault();
      setPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setShow(false);
  };

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    localStorage.setItem('pwa-dismissed', '1');
  };

  if (!show || dismissed) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="rounded-2xl p-4 shadow-2xl"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #007AFF, #5856D6)' }}>P</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Add Pulse to your home screen
            </p>
            {isIOS ? (
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> for the app experience
              </p>
            ) : (
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Install for instant access — works offline too
              </p>
            )}
          </div>
          <button onClick={handleDismiss} className="shrink-0 text-lg leading-none"
            style={{ color: 'var(--text-tertiary)' }}>✕</button>
        </div>
        {!isIOS && (
          <button onClick={handleInstall}
            className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}>
            Install App
          </button>
        )}
      </div>
    </div>
  );
}

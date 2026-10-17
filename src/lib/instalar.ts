import { useEffect, useState } from 'react';

/**
 * Instalación como app (PWA). Chrome/Edge (Android y PC) avisan con
 * "beforeinstallprompt" apenas carga la página, así que se captura aquí,
 * al importar el módulo, y se guarda para cuando la persona toque "Instalar".
 * iPhone no tiene ese evento: allá se muestran los pasos manuales.
 */
interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let pendiente: EventoInstalar | null = null;
const CAMBIO = 'instalar-cambio';

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pendiente = e as EventoInstalar;
    window.dispatchEvent(new Event(CAMBIO));
  });
  window.addEventListener('appinstalled', () => {
    pendiente = null;
    window.dispatchEvent(new Event(CAMBIO));
  });
}

const yaInstalada = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function useInstalarApp() {
  const [puede, setPuede] = useState(() => pendiente !== null);
  const [instalada, setInstalada] = useState(yaInstalada);

  useEffect(() => {
    const actualizar = () => {
      setPuede(pendiente !== null);
      setInstalada(yaInstalada());
    };
    window.addEventListener(CAMBIO, actualizar);
    return () => window.removeEventListener(CAMBIO, actualizar);
  }, []);

  const instalar = async () => {
    if (!pendiente) return false;
    await pendiente.prompt();
    const { outcome } = await pendiente.userChoice;
    pendiente = null;
    setPuede(false);
    if (outcome === 'accepted') setInstalada(true);
    return outcome === 'accepted';
  };

  return { instalada, puede, instalar, ios: esIOS() };
}

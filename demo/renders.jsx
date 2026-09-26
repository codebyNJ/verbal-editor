import { useEffect, useRef, useState } from 'react';
import s from './Workspace.module.css';

window.__renders ??= 0;
window.__renderIds ??= [];

/** The bindings' optional render hook: it feeds the counter and the e2e render gate. */
export const onRender = (id) => {
  window.__renders++;
  window.__renderIds.push(id);
};

/** Live count of editor block renders since the page mounted; a click resets it. */
export function RenderCounter() {
  const [n, setN] = useState(window.__renders);
  const last = useRef(n);
  useEffect(() => {
    let raf;
    const tick = () => {
      if (window.__renders !== last.current) setN((last.current = window.__renders));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <button type="button" className={s.counter} key={n} title={`Last rendered: ${window.__renderIds.slice(-8).join(', ') || 'none'}. Click to reset.`}
      onClick={() => ((window.__renders = 0), (window.__renderIds = []))}>
      <span className={s.dot} /> {n}<span className={s.unit}> {n === 1 ? 'render' : 'renders'}</span>
    </button>
  );
}

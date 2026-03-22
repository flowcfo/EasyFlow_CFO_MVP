import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { formatCurrencyWhole } from '../utils/format.js';

export default function AnimatedCounter({ value, suffix = '', duration = 1.5, className = '' }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;

    const start = 0;
    const end = typeof value === 'number' ? value : parseFloat(value) || 0;
    const startTime = performance.now();

    function animate(currentTime) {
      const elapsed = (currentTime - startTime) / (duration * 1000);
      const progress = Math.min(elapsed, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (end - start) * eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplay(end);
      }
    }

    requestAnimationFrame(animate);
  }, [value, duration, inView]);

  return (
    <motion.span ref={ref} className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {formatCurrencyWhole(display)}
      {suffix}
    </motion.span>
  );
}

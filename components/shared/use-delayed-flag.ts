"use client";

import { useEffect, useRef, useState } from "react";

export function useDelayedFlag(active: boolean, showAfter = 120, minShow = 300) {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (active && !visible) {
      const timer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, showAfter);
      return () => clearTimeout(timer);
    }
    if (!active && visible) {
      const timer = setTimeout(() => setVisible(false), Math.max(0, minShow - (Date.now() - shownAt.current)));
      return () => clearTimeout(timer);
    }
  }, [active, visible, showAfter, minShow]);

  return visible;
}

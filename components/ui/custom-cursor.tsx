'use client';

import React, { useEffect, useState, useRef } from 'react';

export function CustomCursor() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isHoveringInteractive, setIsHoveringInteractive] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);

  const dotWrapperRef = useRef<HTMLDivElement>(null);
  const ringWrapperRef = useRef<HTMLDivElement>(null);

  const mousePos = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    // Only activate on devices with fine pointer (mouse/trackpad, not touch)
    if (typeof window === 'undefined') return;
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!hasFinePointer || prefersReducedMotion) {
      return;
    }

    setMounted(true);

    // Hide the native OS cursor only while the custom cursor system is
    // active for this device (not tied to momentary visibility).
    document.documentElement.classList.add('custom-cursor-active');

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      setVisible(true);

      // Check if hovering interactive elements
      const target = e.target instanceof Element ? e.target : null;
      const isInteractive = Boolean(
        target?.closest(
          'button, a, input, select, textarea, [role="button"], .hover-lift, .cursor-pointer'
        )
      );
      setIsHoveringInteractive(isInteractive);
    };

    // relatedTarget is null exactly when the mouse leaves the window/viewport.
    const handleMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget) {
        setVisible(false);
      }
    };

    const handleMouseDown = () => setIsMouseDown(true);
    const handleMouseUp = () => setIsMouseDown(false);
    // Reset the pressed state if the window loses focus mid-press (e.g. a
    // drag that ends outside the window, or an alert stealing focus).
    const handleBlur = () => setIsMouseDown(false);

    // Smooth trailing ring animation loop
    const animateRing = () => {
      // Smooth interpolation (lerp)
      ringPos.current.x += (mousePos.current.x - ringPos.current.x) * 0.22;
      ringPos.current.y += (mousePos.current.y - ringPos.current.y) * 0.22;

      if (dotWrapperRef.current) {
        dotWrapperRef.current.style.transform = `translate3d(${mousePos.current.x}px, ${mousePos.current.y}px, 0) translate(-50%, -50%)`;
      }
      if (ringWrapperRef.current) {
        ringWrapperRef.current.style.transform = `translate3d(${ringPos.current.x}px, ${ringPos.current.y}px, 0) translate(-50%, -50%)`;
      }

      rafId.current = requestAnimationFrame(animateRing);
    };

    rafId.current = requestAnimationFrame(animateRing);

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseout', handleMouseOut);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseout', handleMouseOut);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', handleBlur);
      document.documentElement.classList.remove('custom-cursor-active');
    };
  }, []);

  if (!mounted || !visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden="true">
      {/* Inner Dot: outer wrapper is positioned by the RAF loop, inner element handles scale */}
      <div
        ref={dotWrapperRef}
        className="fixed top-0 left-0 will-change-transform"
        style={{ transform: 'translate3d(-100px, -100px, 0) translate(-50%, -50%)' }}
      >
        <div
          className={`size-2 rounded-full bg-primary transition-opacity duration-150 ${
            isHoveringInteractive ? 'opacity-80 scale-125' : 'opacity-90 scale-100'
          } ${isMouseDown ? 'scale-75' : ''}`}
        />
      </div>

      {/* Trailing Ring: outer wrapper is positioned by the RAF loop, inner element handles scale */}
      <div
        ref={ringWrapperRef}
        className="fixed top-0 left-0 will-change-transform"
        style={{ transform: 'translate3d(-100px, -100px, 0) translate(-50%, -50%)' }}
      >
        <div
          className={`rounded-full border transition-[width,height,background-color,border-color,box-shadow] duration-200 ease-out ${
            isHoveringInteractive
              ? 'size-9 bg-primary/10 border-primary/60 scale-110 shadow-xs'
              : 'size-6 bg-transparent border-primary/30 scale-100'
          } ${isMouseDown ? 'scale-90 bg-primary/20' : ''}`}
        />
      </div>
    </div>
  );
}

export default CustomCursor;

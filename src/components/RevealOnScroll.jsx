import React, { useEffect, useRef, useState } from 'react';

/**
 * RevealOnScroll
 * Smoothly animates headings, text blocks, tabs, cards, and list rows as they enter
 * the viewport during scroll down.
 *
 * Properties:
 * - delay: Delay in ms (for staggered children, e.g. 60ms, 120ms)
 * - threshold: Intersection threshold (default 0.12)
 * - rootMargin: Viewport rootMargin (default '0px 0px -30px 0px')
 * - as: Underlying HTML tag (default 'div')
 * - className: Additional CSS classes
 */
export default function RevealOnScroll({
  children,
  delay = 0,
  threshold = 0.12,
  rootMargin = '0px 0px -30px 0px',
  as: Component = 'div',
  className = '',
  style = {},
  ...props
}) {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef(null);

  useEffect(() => {
    // 1. Respect prefers-reduced-motion immediately
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setIsVisible(true);
      return;
    }

    // 2. Fallback if IntersectionObserver is not supported
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const node = domRef.current;
    if (!node) return;

    // 3. If element is already in the viewport on mount, reveal immediately
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setIsVisible(true);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(node);

    // Safety fallback: ensure element is never permanently hidden
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 3500);

    return () => {
      clearTimeout(timer);
      if (node) observer.unobserve(node);
      observer.disconnect();
    };
  }, [threshold, rootMargin]);

  return (
    <Component
      ref={domRef}
      data-reveal={isVisible ? 'visible' : 'hidden'}
      className={`transition-reveal ${className}`}
      style={{
        ...style,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(18px)',
        transition: 'opacity 550ms cubic-bezier(0.22, 1, 0.36, 1), transform 550ms cubic-bezier(0.22, 1, 0.36, 1)',
        transitionDelay: `${delay}ms`,
        willChange: isVisible ? 'auto' : 'opacity, transform',
      }}
      {...props}
    >
      {children}
    </Component>
  );
}

/**
 * RevealGroup
 * Helper to wrap an array of children with sequential stagger delays (e.g. 70ms per item)
 */
export function RevealGroup({
  children,
  stagger = 70,
  baseDelay = 0,
  className = '',
  as: Component = 'div',
  ...props
}) {
  return (
    <Component className={className} {...props}>
      {React.Children.map(children, (child, idx) => {
        if (!React.isValidElement(child)) return child;
        return (
          <RevealOnScroll delay={baseDelay + idx * stagger}>
            {child}
          </RevealOnScroll>
        );
      })}
    </Component>
  );
}

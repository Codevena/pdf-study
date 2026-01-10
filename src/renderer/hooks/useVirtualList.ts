import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface UseVirtualListOptions {
  itemHeight: number;
  overscan?: number; // Number of items to render above/below visible area
}

interface VirtualListResult<T> {
  containerRef: React.RefObject<HTMLDivElement>;
  virtualItems: Array<{
    index: number;
    item: T;
    style: React.CSSProperties;
  }>;
  totalHeight: number;
}

export function useVirtualList<T>(
  items: T[],
  options: UseVirtualListOptions
): VirtualListResult<T> {
  const { itemHeight, overscan = 3 } = options;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    setContainerHeight(container.clientHeight);

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    return { startIndex, endIndex };
  }, [scrollTop, containerHeight, itemHeight, items.length, overscan]);

  // Create virtual items
  const virtualItems = useMemo(() => {
    const result: Array<{ index: number; item: T; style: React.CSSProperties }> = [];

    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex && i < items.length; i++) {
      result.push({
        index: i,
        item: items[i],
        style: {
          position: 'absolute',
          top: i * itemHeight,
          left: 0,
          right: 0,
          height: itemHeight,
        },
      });
    }

    return result;
  }, [items, visibleRange, itemHeight]);

  const totalHeight = items.length * itemHeight;

  return {
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    virtualItems,
    totalHeight,
  };
}

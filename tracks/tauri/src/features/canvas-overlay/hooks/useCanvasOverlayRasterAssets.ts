import { useEffect, useRef, useState } from 'react';
import type { ShapeWithId } from '../utils/shapeGeometry';

const getRasterShapeSource = (shape: ShapeWithId) => {
  if (shape.shape.type === 'image') {
    return shape.shape.data.src;
  }
  if (shape.shape.type === 'markdown') {
    return shape.shape.data.renderedImage;
  }
  return '';
};

export const useCanvasOverlayRasterAssets = (shapes: ShapeWithId[]) => {
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [imageVersion, setImageVersion] = useState(0);

  useEffect(() => {
    const disposers: Array<() => void> = [];

    shapes.forEach((shape) => {
      const src = getRasterShapeSource(shape);
      if (!src) return;

      const cached = imageCacheRef.current.get(src);
      const image = cached || new Image();
      if (!cached) {
        image.src = src;
        imageCacheRef.current.set(src, image);
      }

      if (!image.complete) {
        const rerender = () => setImageVersion((value) => value + 1);
        image.addEventListener('load', rerender);
        image.addEventListener('error', rerender);
        disposers.push(() => {
          image.removeEventListener('load', rerender);
          image.removeEventListener('error', rerender);
        });
      }
    });

    return () => {
      disposers.forEach((dispose) => dispose());
    };
  }, [shapes]);

  return {
    imageCache: imageCacheRef.current,
    imageVersion,
  };
};

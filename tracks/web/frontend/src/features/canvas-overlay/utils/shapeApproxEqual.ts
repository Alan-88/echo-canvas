import type { ShapeData } from '../../../types';

const NUMERIC_DIFF_EPSILON = 0.001;

const isComparableObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isApproximatelyEqualValue = (left: unknown, right: unknown): boolean => {
  if (typeof left === 'number' && typeof right === 'number') {
    return Math.abs(left - right) <= NUMERIC_DIFF_EPSILON;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    return left.every((value, index) => isApproximatelyEqualValue(value, right[index]));
  }

  if (isComparableObject(left) || isComparableObject(right)) {
    if (!isComparableObject(left) || !isComparableObject(right)) return false;
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every((key) => isApproximatelyEqualValue(left[key], right[key]));
  }

  return left === right;
};

export const isShapeApproximatelyEqual = (left: ShapeData, right: ShapeData) =>
  isApproximatelyEqualValue(left, right);

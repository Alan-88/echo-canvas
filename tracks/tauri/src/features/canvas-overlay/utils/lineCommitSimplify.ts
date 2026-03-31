interface PointPair {
  x: number;
  y: number;
}

interface SimplifyLineForCommitOptions {
  penSize: number;
}

const MAX_COMMIT_POINT_PAIRS = 1200;
const COORDINATE_PRECISION = 2;

const toPointPairs = (points: number[]): PointPair[] => {
  const pairs: PointPair[] = [];
  for (let index = 0; index + 1 < points.length; index += 2) {
    pairs.push({ x: points[index], y: points[index + 1] });
  }
  return pairs;
};

const toFlatPoints = (pairs: PointPair[]): number[] => {
  const flat: number[] = [];
  pairs.forEach((pair) => {
    flat.push(pair.x, pair.y);
  });
  return flat;
};

const quantizeValue = (value: number, precision = COORDINATE_PRECISION) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const distance = (left: PointPair, right: PointPair) =>
  Math.hypot(right.x - left.x, right.y - left.y);

const perpendicularDistance = (
  point: PointPair,
  lineStart: PointPair,
  lineEnd: PointPair
) => {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return distance(point, lineStart);
  }

  const numerator = Math.abs(
    dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x
  );
  const denominator = Math.hypot(dx, dy);
  return denominator > 0 ? numerator / denominator : 0;
};

const dedupeByDistance = (pairs: PointPair[], minDistance: number): PointPair[] => {
  if (pairs.length <= 2) return pairs;

  const deduped: PointPair[] = [pairs[0]];
  for (let index = 1; index < pairs.length; index += 1) {
    const current = pairs[index];
    const previous = deduped[deduped.length - 1];
    if (distance(previous, current) >= minDistance || index === pairs.length - 1) {
      deduped.push(current);
    }
  }
  return deduped;
};

const quantizePairs = (pairs: PointPair[]): PointPair[] =>
  pairs.map((pair) => ({
    x: quantizeValue(pair.x),
    y: quantizeValue(pair.y),
  }));

const clampPairCount = (pairs: PointPair[], maxPairs: number): PointPair[] => {
  if (pairs.length <= maxPairs) return pairs;
  if (maxPairs <= 2) {
    return [pairs[0], pairs[pairs.length - 1]];
  }

  const clamped: PointPair[] = [pairs[0]];
  const interiorCount = maxPairs - 2;
  const span = pairs.length - 1;
  for (let index = 1; index <= interiorCount; index += 1) {
    const mappedIndex = Math.round((index * span) / (interiorCount + 1));
    const next = pairs[Math.min(Math.max(mappedIndex, 1), pairs.length - 2)];
    clamped.push(next);
  }
  clamped.push(pairs[pairs.length - 1]);
  return clamped;
};

const rdpSimplify = (pairs: PointPair[], epsilon: number): PointPair[] => {
  if (pairs.length <= 2) return pairs;

  let maxDistance = 0;
  let splitIndex = -1;
  const first = pairs[0];
  const last = pairs[pairs.length - 1];

  for (let index = 1; index < pairs.length - 1; index += 1) {
    const nextDistance = perpendicularDistance(pairs[index], first, last);
    if (nextDistance > maxDistance) {
      maxDistance = nextDistance;
      splitIndex = index;
    }
  }

  if (maxDistance <= epsilon || splitIndex <= 0) {
    return [first, last];
  }

  const left = rdpSimplify(pairs.slice(0, splitIndex + 1), epsilon);
  const right = rdpSimplify(pairs.slice(splitIndex), epsilon);
  return [...left.slice(0, -1), ...right];
};

const getSimplifyDistanceThreshold = (penSize: number) =>
  Math.max(0.6, Math.min(2.4, penSize * 0.18));

const getSimplifyEpsilon = (penSize: number) =>
  Math.max(0.35, Math.min(1.8, penSize * 0.12));

export const simplifyLinePointsForCommit = (
  rawPoints: number[],
  { penSize }: SimplifyLineForCommitOptions
): number[] => {
  if (rawPoints.length <= 4) {
    return rawPoints;
  }

  const rawPairs = toPointPairs(rawPoints);
  if (rawPairs.length <= 2) {
    return rawPoints;
  }

  const deduped = dedupeByDistance(rawPairs, getSimplifyDistanceThreshold(penSize));
  if (deduped.length <= 2) {
    return toFlatPoints(quantizePairs(deduped));
  }

  const simplified = rdpSimplify(deduped, getSimplifyEpsilon(penSize));
  const normalized = simplified.length >= 2 ? simplified : deduped;
  const clamped = clampPairCount(normalized, MAX_COMMIT_POINT_PAIRS);
  return toFlatPoints(quantizePairs(clamped));
};

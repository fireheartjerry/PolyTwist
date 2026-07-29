// @ts-check

/**
 * Exact normalized rational number.
 * @typedef {{numerator:bigint,denominator:bigint}} Rational
 */

/** @param {bigint} value */
export function absBigInt(value) {
  return value < 0n ? -value : value;
}

/** @param {bigint} a @param {bigint} b */
export function gcdBigInt(a, b) {
  let x = absBigInt(a);
  let y = absBigInt(b);
  while (y !== 0n) {
    const remainder = x % y;
    x = y;
    y = remainder;
  }
  return x;
}

/** @param {bigint} a @param {bigint} b */
export function lcmBigInt(a, b) {
  if (a === 0n || b === 0n) return 0n;
  return absBigInt((a / gcdBigInt(a, b)) * b);
}

/** @param {bigint} numerator @param {bigint} [denominator] @returns {Rational} */
export function makeRational(numerator, denominator = 1n) {
  if (denominator === 0n) throw new Error('Rational denominator cannot be zero.');
  if (numerator === 0n) return { numerator: 0n, denominator: 1n };
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = gcdBigInt(numerator, denominator);
  return {
    numerator: sign * numerator / divisor,
    denominator: absBigInt(denominator) / divisor,
  };
}

/**
 * Parses integers, decimal/scientific strings, fraction strings, and finite numbers.
 * Numeric inputs are interpreted through their deterministic decimal spelling.
 *
 * @param {Rational|string|number|bigint|{numerator:string|number|bigint,denominator?:string|number|bigint}} value
 * @returns {Rational}
 */
export function parseRational(value) {
  if (typeof value === 'object' && value !== null && 'numerator' in value) {
    const numerator = BigInt(value.numerator);
    const denominator = BigInt(value.denominator ?? 1);
    return makeRational(numerator, denominator);
  }
  if (typeof value === 'bigint') return makeRational(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Rational numeric input must be finite.');
    return parseRational(String(Object.is(value, -0) ? 0 : value));
  }
  const source = String(value).trim();
  const fraction = /^([+-]?\d+)\s*\/\s*([+-]?\d+)$/.exec(source);
  if (fraction) return makeRational(BigInt(fraction[1]), BigInt(fraction[2]));

  const decimal = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(source);
  if (!decimal || (!decimal[2] && !decimal[3])) {
    throw new Error(`Invalid rational scalar: ${source}`);
  }
  const sign = decimal[1] === '-' ? -1n : 1n;
  const whole = decimal[2] || '0';
  const fractional = decimal[3] || '';
  const exponent = Number(decimal[4] ?? 0);
  if (!Number.isSafeInteger(exponent)) throw new Error(`Rational exponent is out of range: ${source}`);
  const digits = `${whole}${fractional}`.replace(/^0+(?=\d)/, '') || '0';
  const decimalPlaces = fractional.length - exponent;
  if (decimalPlaces <= 0) return makeRational(sign * BigInt(digits) * 10n ** BigInt(-decimalPlaces));
  return makeRational(sign * BigInt(digits), 10n ** BigInt(decimalPlaces));
}

/** @param {Rational} value */
export function rationalKey(value) {
  return `${value.numerator}/${value.denominator}`;
}

/** @param {Rational} value */
export function rationalToNumber(value) {
  const numerator = Number(value.numerator);
  const denominator = Number(value.denominator);
  if (Number.isFinite(numerator) && Number.isFinite(denominator)) {
    return numerator / denominator;
  }
  const numeratorDigits = absBigInt(value.numerator).toString();
  const denominatorDigits = value.denominator.toString();
  const precision = 16;
  const numeratorPrefix = numeratorDigits.slice(0, precision);
  const denominatorPrefix = denominatorDigits.slice(0, precision);
  const numeratorMantissa = Number(numeratorPrefix) / 10 ** (numeratorPrefix.length - 1);
  const denominatorMantissa = Number(denominatorPrefix) / 10 ** (denominatorPrefix.length - 1);
  const exponent = numeratorDigits.length - denominatorDigits.length;
  const sign = value.numerator < 0n ? -1 : 1;
  return sign * (numeratorMantissa / denominatorMantissa) * 10 ** exponent;
}

/** @param {Rational} value */
export function signRational(value) {
  return value.numerator < 0n ? -1 : value.numerator > 0n ? 1 : 0;
}

/** @param {Rational} value @returns {Rational} */
export function negateRational(value) {
  return { numerator: -value.numerator, denominator: value.denominator };
}

/** @param {Rational} value @returns {Rational} */
export function absRational(value) {
  return { numerator: absBigInt(value.numerator), denominator: value.denominator };
}

/** @param {Rational} a @param {Rational} b @returns {Rational} */
export function addRational(a, b) {
  return makeRational(
    a.numerator * b.denominator + b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}

/** @param {Rational} a @param {Rational} b @returns {Rational} */
export function subtractRational(a, b) {
  return makeRational(
    a.numerator * b.denominator - b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}

/** @param {Rational} a @param {Rational} b @returns {Rational} */
export function multiplyRational(a, b) {
  return makeRational(a.numerator * b.numerator, a.denominator * b.denominator);
}

/** @param {Rational} a @param {Rational} b @returns {Rational} */
export function divideRational(a, b) {
  if (b.numerator === 0n) throw new Error('Cannot divide by zero.');
  return makeRational(a.numerator * b.denominator, a.denominator * b.numerator);
}

/** @param {Rational} a @param {Rational} b */
export function compareRational(a, b) {
  const difference = a.numerator * b.denominator - b.numerator * a.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

/**
 * @typedef {{
 *   normal:readonly [
 *     Rational|string|number|bigint,
 *     Rational|string|number|bigint,
 *     Rational|string|number|bigint
 *   ],
 *   constant:Rational|string|number|bigint,
 *   id?:string,
 *   tag?:string,
 *   meta?:Record<string,unknown>
 * }} RationalPlaneInput
 */

/**
 * @typedef {{
 *   normal:[Rational,Rational,Rational],
 *   constant:Rational,
 *   integerCoefficients:[bigint,bigint,bigint,bigint],
 *   key:string,
 *   carrierKey:string,
 *   orientationAgainstCarrier:-1|1,
 *   sourceId:string|null,
 *   tag:string|null,
 *   meta:Record<string,unknown>
 * }} NormalizedPlane
 */

/**
 * Normalizes an oriented equation `normal·x = constant` up to positive scale.
 * The first nonzero carrier coefficient is made positive only in `carrierKey`;
 * `key` retains the input orientation.
 *
 * @param {RationalPlaneInput} input
 * @returns {NormalizedPlane}
 */
export function normalizePlane(input) {
  if (!Array.isArray(input.normal) || input.normal.length !== 3) {
    throw new Error('Plane normal must contain exactly three coefficients.');
  }
  const coefficients = [
    parseRational(input.normal[0]),
    parseRational(input.normal[1]),
    parseRational(input.normal[2]),
    parseRational(input.constant),
  ];
  if (coefficients.slice(0, 3).every((value) => value.numerator === 0n)) {
    throw new Error('Plane normal cannot be zero.');
  }
  let denominator = 1n;
  for (const coefficient of coefficients) denominator = lcmBigInt(denominator, coefficient.denominator);
  let integers = /** @type {[bigint,bigint,bigint,bigint]} */ (coefficients.map(
    (coefficient) => coefficient.numerator * (denominator / coefficient.denominator),
  ));
  let divisor = 0n;
  for (const integer of integers) divisor = gcdBigInt(divisor, integer);
  if (divisor === 0n) throw new Error('Plane equation cannot be identically zero.');
  integers = /** @type {[bigint,bigint,bigint,bigint]} */ (integers.map((integer) => integer / divisor));
  const key = `${integers[0]},${integers[1]},${integers[2]}|${integers[3]}`;
  const firstNonzero = integers.slice(0, 3).find((integer) => integer !== 0n);
  const orientationAgainstCarrier = /** @type {-1|1} */ (firstNonzero && firstNonzero < 0n ? -1 : 1);
  const carrierIntegers = integers.map((integer) => integer * BigInt(orientationAgainstCarrier));
  const carrierKey = `${carrierIntegers[0]},${carrierIntegers[1]},${carrierIntegers[2]}|${carrierIntegers[3]}`;
  return {
    normal: [
      makeRational(integers[0]),
      makeRational(integers[1]),
      makeRational(integers[2]),
    ],
    constant: makeRational(integers[3]),
    integerCoefficients: integers,
    key,
    carrierKey,
    orientationAgainstCarrier,
    sourceId: input.id === undefined ? null : String(input.id),
    tag: input.tag === undefined ? null : String(input.tag),
    meta: structuredClone(input.meta ?? {}),
  };
}

/** @param {NormalizedPlane} plane @returns {NormalizedPlane} */
export function negatePlane(plane) {
  return normalizePlane({
    normal: [
      negateRational(plane.normal[0]),
      negateRational(plane.normal[1]),
      negateRational(plane.normal[2]),
    ],
    constant: negateRational(plane.constant),
    id: plane.sourceId ?? undefined,
    tag: plane.tag ?? undefined,
    meta: plane.meta,
  });
}

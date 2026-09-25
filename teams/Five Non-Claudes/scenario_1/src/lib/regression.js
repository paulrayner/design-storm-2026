// Single-feature ordinary least squares, plus an honest time-based train/test
// split and the three scores the guide leans on (R², RMSE, MAE). Dependency-free
// and fast, so the whole fit recomputes on every slider move.

/**
 * Fit y = a*x + b by closed-form least squares over an array of {x, y} pairs.
 * Returns { a, b, n }. With fewer than 2 points or zero x-variance, slope is 0
 * and the intercept is the mean of y (a flat "predict the average" line).
 *
 * @param {{x:number, y:number}[]} pairs
 */
export function fit(pairs) {
  const n = pairs.length
  if (n === 0) return { a: 0, b: 0, n: 0 }

  let sx = 0, sy = 0
  for (const p of pairs) {
    sx += p.x
    sy += p.y
  }
  const mx = sx / n
  const my = sy / n

  let sxx = 0, sxy = 0
  for (const p of pairs) {
    const dx = p.x - mx
    sxx += dx * dx
    sxy += dx * (p.y - my)
  }

  if (sxx === 0) return { a: 0, b: my, n }
  const a = sxy / sxx
  const b = my - a * mx
  return { a, b, n }
}

/** Predict y for a single x under a fitted model. */
export function predict(model, x) {
  return model.a * x + model.b
}

/**
 * Score a model against pairs: R², RMSE, MAE. R² is 1 - SSres/SStot; it is 0 when
 * the model is no better than always guessing the mean of y, and negative when it
 * is worse. With zero y-variance R² is reported as NaN (undefined).
 *
 * @param {{x:number, y:number}[]} pairs
 * @param {{a:number, b:number}} model
 */
export function score(pairs, model) {
  const n = pairs.length
  if (n === 0) return { r2: NaN, rmse: NaN, mae: NaN, n: 0 }

  let sy = 0
  for (const p of pairs) sy += p.y
  const my = sy / n

  let ssRes = 0, ssTot = 0, absSum = 0
  for (const p of pairs) {
    const yhat = predict(model, p.x)
    const err = p.y - yhat
    ssRes += err * err
    absSum += Math.abs(err)
    const dy = p.y - my
    ssTot += dy * dy
  }

  const rmse = Math.sqrt(ssRes / n)
  const mae = absSum / n
  const r2 = ssTot === 0 ? NaN : 1 - ssRes / ssTot
  return { r2, rmse, mae, n }
}

/**
 * Split pairs into train (earlier) and test (later) halves by position, without
 * shuffling. The pairs must already be sorted by date. Training only ever sees
 * earlier days than the test set, so scores are an honest forecast of unseen
 * future days rather than a memorization check.
 *
 * @param {{t:string, x:number, y:number}[]} pairs  sorted ascending by date
 * @param {number} trainFraction  default 0.5
 */
export function timeSplit(pairs, trainFraction = 0.5) {
  const cut = Math.floor(pairs.length * trainFraction)
  return { train: pairs.slice(0, cut), test: pairs.slice(cut) }
}

/**
 * Full pipeline for a paired dataset: split by time, fit on train, score on both
 * train and test, and produce fitted values across every pair (for plotting).
 *
 * @param {{t:string, x:number, y:number}[]} pairs  sorted ascending by date
 * @param {number} trainFraction
 * @returns {{
 *   model: {a:number,b:number,n:number},
 *   train: {r2,rmse,mae,n}, test: {r2,rmse,mae,n},
 *   fitted: {t:string, actual:number, predicted:number, split:'train'|'test'}[],
 *   splitDate: string|null
 * }}
 */
export function fitAndScore(pairs, trainFraction = 0.5) {
  const { train, test } = timeSplit(pairs, trainFraction)
  const model = fit(train)
  const trainScore = score(train, model)
  const testScore = score(test, model)

  const cut = train.length
  const fitted = pairs.map((p, i) => ({
    t: p.t,
    actual: p.y,
    predicted: predict(model, p.x),
    split: i < cut ? 'train' : 'test',
  }))
  const splitDate = test.length ? test[0].t : null

  return { model, train: trainScore, test: testScore, fitted, splitDate }
}

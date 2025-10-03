import { DEFAULT_OUTCOME, NEUTRAL_WEIGHT, OUTCOME_ORDER } from './constants.js';

function normalizeOutcome(rawOutcome, outcomeOrder = OUTCOME_ORDER) {
  if (!rawOutcome || typeof rawOutcome !== 'string') {
    return DEFAULT_OUTCOME;
  }

  const trimmed = rawOutcome.trim();
  const lower = trimmed.toLowerCase();

  const exact = outcomeOrder.find(label => label.toLowerCase() === lower);
  if (exact) {
    return exact;
  }

  const partial = outcomeOrder.find(label => {
    const normalizedLabel = label.toLowerCase();
    return (
      normalizedLabel.startsWith(lower) ||
      lower.startsWith(normalizedLabel) ||
      normalizedLabel.includes(lower) ||
      lower.includes(normalizedLabel)
    );
  });
  if (partial) {
    return partial;
  }

  return DEFAULT_OUTCOME;
}

function safeEvaluate(criteria, context) {
  if (!criteria || typeof criteria !== 'string') {
    return false;
  }

  try {
    // eslint-disable-next-line no-new-func
    const evaluator = new Function(...Object.keys(context), `return (${criteria});`);
    const result = evaluator(...Object.values(context));
    return Boolean(result);
  } catch (error) {
    console.warn('Failed to evaluate rule criteria', criteria, error);
    return false;
  }
}

function cloneProbabilities(base, order = OUTCOME_ORDER) {
  const result = {};
  order.forEach(outcome => {
    const normalized = normalizeOutcome(outcome, order);
    result[normalized] = Number(base?.[normalized] ?? 0);
  });
  return result;
}

function applyProbabilityShift(probabilities, shift, order = OUTCOME_ORDER, observed = new Set()) {
  if (!shift) {
    return observed;
  }

  Object.entries(shift).forEach(([rawOutcome, delta]) => {
    const outcome = normalizeOutcome(rawOutcome, order);
    if (!Number.isFinite(delta)) {
      return;
    }
    observed.add(outcome);
    probabilities[outcome] = Number(probabilities[outcome] ?? 0) + delta;
  });

  return observed;
}

function normalizeProbabilityDistribution(probabilities, observed, order = OUTCOME_ORDER) {
  const outcomes = order.map(outcome => normalizeOutcome(outcome, order));
  outcomes.forEach(outcome => {
    if (!Object.prototype.hasOwnProperty.call(probabilities, outcome)) {
      probabilities[outcome] = 0;
    }
  });

  const sum = Object.values(probabilities).reduce((acc, value) => acc + value, 0);
  const observedList = Array.from(observed).filter(outcome => outcomes.includes(outcome));

  if (Math.abs(sum) < Number.EPSILON && observedList.length > 0) {
    const share = 1 / observedList.length;
    observedList.forEach(outcome => {
      probabilities[outcome] = share;
    });
    outcomes
      .filter(outcome => !observedList.includes(outcome))
      .forEach(outcome => {
        probabilities[outcome] = 0;
      });
    return probabilities;
  }

  if (sum > 0) {
    Object.keys(probabilities).forEach(outcome => {
      probabilities[outcome] = probabilities[outcome] / sum;
    });
  }

  return probabilities;
}

export function evaluateClientForCarrier(client, carrier, options = {}) {
  const outcomeOrder = options.outcomeOrder ?? OUTCOME_ORDER;
  const context = { client, carrier };
  const baseProbabilities = cloneProbabilities(carrier?.baseProbabilities ?? {}, outcomeOrder);
  const observedOutcomes = new Set();
  const rules = Array.isArray(carrier?.rules) ? carrier.rules : [];

  const matchedRules = rules.filter(rule => safeEvaluate(rule.criteria, context));

  let outcome = normalizeOutcome(carrier?.baseOutcome, outcomeOrder);
  let weight = Number(carrier?.baseWeight ?? NEUTRAL_WEIGHT);

  if (matchedRules.length === 0) {
    outcome = normalizeOutcome('N/A', outcomeOrder);
    weight = NEUTRAL_WEIGHT;
  } else {
    matchedRules.forEach(rule => {
      if (rule.probabilityShift) {
        applyProbabilityShift(baseProbabilities, rule.probabilityShift, outcomeOrder, observedOutcomes);
      }
    });

    const prioritizedRule = matchedRules
      .slice()
      .sort((a, b) => (Number(b.priority ?? 0) - Number(a.priority ?? 0)))[0];

    if (prioritizedRule) {
      outcome = normalizeOutcome(prioritizedRule.outcome, outcomeOrder);
      if (Number.isFinite(Number(prioritizedRule.weight))) {
        weight = Number(prioritizedRule.weight);
      }
    }
  }

  normalizeProbabilityDistribution(baseProbabilities, observedOutcomes, outcomeOrder);

  return {
    outcome,
    weight,
    matches: matchedRules,
    probabilities: baseProbabilities
  };
}

export { normalizeOutcome, safeEvaluate, normalizeProbabilityDistribution };

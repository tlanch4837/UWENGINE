import assert from 'assert/strict';
import { evaluateClientForCarrier, normalizeProbabilityDistribution, safeEvaluate } from '../src/evaluator.js';
import { OUTCOME_ORDER } from '../src/constants.js';

const client = {
  age: 45,
  creditScore: 680,
  smoker: false,
  bmi: 29
};

const carrier = {
  id: 'test',
  name: 'Test Carrier',
  baseOutcome: 'Standard',
  baseWeight: 1,
  baseProbabilities: {
    Preferred: 0.3,
    Standard: 0.4,
    Substandard: 0.3
  },
  rules: [
    {
      id: 'one',
      criteria: 'client.age < 30',
      outcome: 'Preferred',
      weight: 1.4,
      priority: 1,
      probabilityShift: {
        Preferred: 0.1,
        Standard: -0.1
      }
    }
  ]
};

const errorRule = {
  id: 'error',
  criteria: 'client.missing.value > 1',
  outcome: 'Decline',
  weight: 0.9
};

function createCarrier(overrides = {}) {
  return {
    ...carrier,
    rules: [...carrier.rules],
    ...overrides
  };
}

describe('evaluateClientForCarrier', () => {
  it('returns N/A outcome and neutral weight when no rules match', () => {
    const evaluation = evaluateClientForCarrier(client, createCarrier({ rules: [] }));
    assert.equal(evaluation.outcome, 'N/A');
    assert.equal(evaluation.weight, 1);
  });

  it('maps unknown outcomes to Standard by default', () => {
    const evaluation = evaluateClientForCarrier(client, createCarrier({
      rules: [
        {
          ...carrier.rules[0],
          criteria: 'client.age > 40',
          outcome: 'Elite Preferred'
        }
      ]
    }));
    assert.equal(evaluation.outcome, 'Preferred');
  });

  it('redistributes zero-sum probability shifts evenly across observed outcomes', () => {
    const evaluation = evaluateClientForCarrier(client, createCarrier({
      baseProbabilities: {},
      rules: [
        {
          ...carrier.rules[0],
          criteria: 'client.age > 40',
          probabilityShift: {
            Preferred: 0.4,
            Standard: -0.4
          }
        }
      ]
    }));
    const values = evaluation.probabilities;
    assert.equal(values.Preferred, 0.5);
    assert.equal(values.Standard, 0.5);
  });

  it('guards expression evaluation errors and treats them as non-matches', () => {
    const evaluation = evaluateClientForCarrier(client, createCarrier({ rules: [errorRule] }));
    assert.equal(evaluation.matches.length, 0);
  });
});

describe('normalizeProbabilityDistribution', () => {
  it('spreads zero-sum across observed outcomes evenly', () => {
    const probabilities = {
      Preferred: 0.1,
      Standard: -0.1,
      Substandard: 0
    };
    const observed = new Set(['Preferred', 'Standard']);
    const normalized = normalizeProbabilityDistribution(probabilities, observed, OUTCOME_ORDER);
    assert.equal(normalized.Preferred, 0.5);
    assert.equal(normalized.Standard, 0.5);
  });
});

describe('safeEvaluate', () => {
  it('returns false when runtime errors occur', () => {
    const result = safeEvaluate('client.missing.value > 1', { client: {} });
    assert.equal(result, false);
  });
});

function describe(name, fn) {
  console.group(name);
  try {
    fn();
  } finally {
    console.groupEnd(name);
  }
}

function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(error);
    throw error;
  }
}

import { evaluateClientForCarrier, normalizeOutcome } from './evaluator.js';
import { sampleCarriers } from './data.js';
import { OUTCOME_ORDER } from './constants.js';

const carrierSelect = document.querySelector('#carrierSelect');
const conditionsInput = document.querySelector('#conditionsInput');
const evalButton = document.querySelector('#evalButton');
const resultsContainer = document.querySelector('#results');
const banner = document.querySelector('#importBanner');
const ruleList = document.querySelector('#ruleList');
const importButton = document.querySelector('#importButton');

let carriers = [];
let selectedCarrierIds = new Set();

function updateBanner() {
  const shouldShow = carriers.length === 0;
  banner.classList.toggle('hidden', !shouldShow);
  banner.setAttribute('aria-hidden', String(!shouldShow));
}

function updateEvalState() {
  const hasCarrierSelected = selectedCarrierIds.size > 0;
  const hasConditions = conditionsInput.value.trim().length > 0;
  evalButton.disabled = !(hasCarrierSelected && hasConditions);
}

function renderCarrierOptions() {
  carrierSelect.innerHTML = '';
  carriers.forEach(carrier => {
    const option = document.createElement('option');
    option.value = carrier.id;
    option.textContent = carrier.name;
    option.selected = selectedCarrierIds.has(carrier.id);
    carrierSelect.appendChild(option);
  });
}

function findDuplicateCriteria(rules) {
  const seen = new Map();
  const duplicates = new Set();

  rules.forEach(rule => {
    const key = (rule.criteria ?? '').trim();
    if (!key) {
      return;
    }
    if (seen.has(key)) {
      duplicates.add(key);
    }
    seen.set(key, rule.id);
  });

  return duplicates;
}

function renderRules() {
  ruleList.innerHTML = '';
  if (selectedCarrierIds.size === 0) {
    return;
  }

  selectedCarrierIds.forEach(carrierId => {
    const carrier = carriers.find(item => item.id === carrierId);
    if (!carrier) {
      return;
    }

    const header = document.createElement('h3');
    header.textContent = `${carrier.name} Rules`;
    ruleList.appendChild(header);

    const duplicates = findDuplicateCriteria(carrier.rules || []);
    if (duplicates.size > 0) {
      console.warn('Duplicate underwriting criteria detected', {
        carrier: carrier.name,
        criteria: Array.from(duplicates)
      });
    }

    const list = document.createElement('ul');
    list.className = 'rule-list';

    carrier.rules?.forEach(rule => {
      const item = document.createElement('li');
      item.className = 'rule-item';
      const duplicate = duplicates.has((rule.criteria ?? '').trim());
      if (duplicate) {
        item.classList.add('duplicate');
      }

      const name = document.createElement('div');
      name.className = 'rule-name';
      name.textContent = rule.name ?? rule.id;

      const criteria = document.createElement('code');
      criteria.textContent = rule.criteria ?? 'No criteria';

      const outcome = document.createElement('span');
      outcome.className = 'rule-outcome';
      outcome.textContent = `Outcome: ${normalizeOutcome(rule.outcome)}`;

      item.appendChild(name);
      if (duplicate) {
        const badge = document.createElement('span');
        badge.className = 'duplicate-badge';
        badge.textContent = 'Duplicate criteria';
        item.appendChild(badge);
      }
      item.appendChild(criteria);
      item.appendChild(outcome);
      list.appendChild(item);
    });

    ruleList.appendChild(list);
  });
}

function renderResults(evaluations) {
  resultsContainer.innerHTML = '';
  evaluations.forEach(evaluation => {
    const card = document.createElement('article');
    card.className = 'result-card';

    const header = document.createElement('header');
    header.textContent = evaluation.carrier.name;

    const outcome = document.createElement('p');
    outcome.innerHTML = `<strong>Outcome:</strong> ${evaluation.outcome}`;

    const weight = document.createElement('p');
    weight.innerHTML = `<strong>Weight:</strong> ${evaluation.weight.toFixed(2)}`;

    const probabilityHeader = document.createElement('h4');
    probabilityHeader.textContent = 'Probability Distribution';

    const probabilityList = document.createElement('ul');
    probabilityList.className = 'probability-list';

    OUTCOME_ORDER.forEach(outcomeLabel => {
      const item = document.createElement('li');
      const value = evaluation.probabilities[outcomeLabel] ?? 0;
      item.textContent = `${outcomeLabel}: ${(value * 100).toFixed(1)}%`;
      probabilityList.appendChild(item);
    });

    card.appendChild(header);
    card.appendChild(outcome);
    card.appendChild(weight);
    card.appendChild(probabilityHeader);
    card.appendChild(probabilityList);
    resultsContainer.appendChild(card);
  });
}

function parseClientConditions() {
  try {
    const parsed = JSON.parse(conditionsInput.value || '{}');
    return parsed;
  } catch (error) {
    alert('Invalid JSON for client conditions. Please correct and try again.');
    throw error;
  }
}

function handleEvaluate() {
  try {
    const client = parseClientConditions();
    const evaluations = Array.from(selectedCarrierIds)
      .map(carrierId => carriers.find(carrier => carrier.id === carrierId))
      .filter(Boolean)
      .map(carrier => {
        const evaluation = evaluateClientForCarrier(client, carrier);
        return {
          carrier,
          ...evaluation
        };
      });

    renderResults(evaluations);
  } catch (error) {
    console.error('Unable to evaluate client', error);
  }
}

carrierSelect.addEventListener('change', event => {
  selectedCarrierIds = new Set(Array.from(event.target.selectedOptions).map(option => option.value));
  updateEvalState();
  renderRules();
});

evalButton.addEventListener('click', event => {
  event.preventDefault();
  handleEvaluate();
});

conditionsInput.addEventListener('input', () => {
  updateEvalState();
});

importButton.addEventListener('click', () => {
  carriers = sampleCarriers.slice();
  selectedCarrierIds = new Set(carriers.map(carrier => carrier.id));
  updateBanner();
  renderCarrierOptions();
  renderRules();
  updateEvalState();
});

function bootstrap() {
  conditionsInput.value = JSON.stringify(
    {
      age: 35,
      creditScore: 710,
      smoker: false,
      bmi: 24
    },
    null,
    2
  );
  updateBanner();
  updateEvalState();
}

bootstrap();

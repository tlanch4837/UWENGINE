export const sampleCarriers = [
  {
    id: 'carrier-a',
    name: 'Carrier A',
    baseOutcome: 'Standard',
    baseWeight: 1,
    baseProbabilities: {
      Preferred: 0.4,
      Standard: 0.4,
      Substandard: 0.2
    },
    rules: [
      {
        id: 'a-1',
        name: 'Young Preferred',
        criteria: 'client.age < 30 && client.creditScore >= 720',
        outcome: 'Preferred',
        weight: 1.3,
        priority: 2,
        probabilityShift: {
          Preferred: 0.2,
          Standard: -0.2
        }
      },
      {
        id: 'a-2',
        name: 'High Risk',
        criteria: 'client.smoker === true || client.bmi > 32',
        outcome: 'Decline',
        weight: 0.7,
        priority: 3,
        probabilityShift: {
          Decline: 0.4,
          Standard: -0.3,
          Substandard: -0.1
        }
      },
      {
        id: 'a-3',
        name: 'Duplicate Warning',
        criteria: 'client.smoker === true || client.bmi > 32',
        outcome: 'Decline',
        weight: 0.6,
        priority: 1,
        probabilityShift: {
          Decline: 0.1,
          Standard: -0.1
        }
      }
    ]
  },
  {
    id: 'carrier-b',
    name: 'Carrier B',
    baseOutcome: 'Standard',
    baseWeight: 1,
    baseProbabilities: {
      Preferred: 0.3,
      Standard: 0.5,
      Substandard: 0.2
    },
    rules: [
      {
        id: 'b-1',
        name: 'Wellness',
        criteria: '!client.smoker && client.bmi < 27',
        outcome: 'Elite Preferred',
        weight: 1.2,
        priority: 1,
        probabilityShift: {
          Preferred: 0.1,
          Standard: -0.1
        }
      }
    ]
  }
];

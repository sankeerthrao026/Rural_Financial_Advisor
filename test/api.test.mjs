async function testApis() {
  console.log('Testing /api/ai/business-advisor...');
  try {
    const res = await fetch('http://localhost:3000/api/ai/business-advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'Warangal, Telangana',
        category: 'Dairy Farming',
        marginCapital: 100000,
        language: 'en',
      }),
    });

    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Market Reach Headline:', data.marketReach?.headline);
    console.log('Pricing Suggestion:', data.pricingSuggestion?.recommendedBand);
    console.log('Competitor Density:', data.competitorDensity?.densityLevel);
    console.log('SWOT Strengths Count:', data.swot?.strengths?.length);
    console.log('Provider Used:', data.providerUsed);
    console.log('✅ Business Advisor API Test SUCCESS!\n');
  } catch (err) {
    console.error('Error testing business advisor API:', err);
  }

  console.log('Testing /api/ai/risk-explanation...');
  try {
    const res = await fetch('http://localhost:3000/api/ai/risk-explanation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        risk: {
          riskType: 'negative_cash_flow',
          ruleCode: 'RULE_2',
          severity: 'alert',
          reason: 'Expenses exceeded income',
          metrics: { netCashFlow: -15000 },
        },
        language: 'en',
      }),
    });

    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Risk Explanation Title:', data.title);
    console.log('Explanation:', data.explanation);
    console.log('Action Steps Count:', data.practicalActionSteps?.length);
    console.log('✅ Risk Explanation API Test SUCCESS!\n');
  } catch (err) {
    console.error('Error testing risk explanation API:', err);
  }
}

testApis();

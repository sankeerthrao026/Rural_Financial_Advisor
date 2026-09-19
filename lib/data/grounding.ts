import marketData from '@/data/market-data.json';
import populationData from '@/data/population-data.json';
import schemesData from '@/data/schemes.json';

export interface GroundedContext {
  categoryKey: string;
  categoryData: any;
  districtKey: string;
  districtData: any;
  relevantSchemes: any[];
  summaryContext: string;
}

export function lookupGroundedContext(location: string, category: string): GroundedContext {
  const locLower = (location || '').toLowerCase();
  const catLower = (category || '').toLowerCase();

  // Match business category
  let categoryKey = 'dairy';
  if (catLower.includes('poultry') || catLower.includes('కోడి') || catLower.includes('చికెన్') || catLower.includes('chicken')) {
    categoryKey = 'poultry';
  } else if (catLower.includes('kirana') || catLower.includes('grocery') || catLower.includes('కిరాణా') || catLower.includes('store') || catLower.includes('shop')) {
    categoryKey = 'kirana';
  } else if (catLower.includes('weav') || catLower.includes('handloom') || catLower.includes('చేనేత') || catLower.includes('saree') || catLower.includes('textile')) {
    categoryKey = 'weaving';
  } else if (catLower.includes('tailor') || catLower.includes('టైలరింగ్') || catLower.includes('dress') || catLower.includes('boutique')) {
    categoryKey = 'tailoring';
  } else if (catLower.includes('mill') || catLower.includes('flour') || catLower.includes('మిల్లు') || catLower.includes('agri') || catLower.includes('processing')) {
    categoryKey = 'agri_processing';
  }

  const categoryData = (marketData.categories as any)[categoryKey] || marketData.categories.dairy;

  // Match district
  let districtKey = 'default_rural';
  if (locLower.includes('warangal') || locLower.includes('వరంగల్')) {
    districtKey = 'warangal';
  } else if (locLower.includes('karimnagar') || locLower.includes('కరీంనగర్')) {
    districtKey = 'karimnagar';
  } else if (locLower.includes('nalgonda') || locLower.includes('నల్గొండ')) {
    districtKey = 'nalgonda';
  } else if (locLower.includes('nizamabad') || locLower.includes('నిజామాబాద్')) {
    districtKey = 'nizamabad';
  }

  const districtData = (populationData.districts as any)[districtKey] || populationData.districts.default_rural;

  // Match schemes
  const relevantSchemes = schemesData.schemes;

  const summaryContext = `
District Demographic Profile:
- Region: ${districtData.name}, ${districtData.state}
- Average Village Population: ${districtData.averageVillagePopulation}
- Total Rural Households: ${districtData.totalRuralHouseholds}
- Key Crops / Agri Base: ${districtData.majorCrops?.join(', ')}
- Commercial Hubs: ${districtData.commercialHubs?.join(', ')}

Category Benchmark (${categoryData.name}):
- Typical Project Cost: ₹${categoryData.benchmarkProjectCost.typical.toLocaleString('en-IN')} (Range: ₹${categoryData.benchmarkProjectCost.min.toLocaleString('en-IN')} - ₹${categoryData.benchmarkProjectCost.max.toLocaleString('en-IN')})
- Realistic Profit Margin: ${categoryData.marginRange}
- Daily Volume Benchmark: ${categoryData.averageDailyVolume}
- Local Competitor Density: ${categoryData.competitorDensity}
- Pricing Benchmarks: ${JSON.stringify(categoryData.pricingBenchmarks)}
- Seasonal Patterns: ${categoryData.demandSeasonality}
- Local Operating Risks: ${categoryData.keyRisks?.join('; ')}
`.trim();

  return {
    categoryKey,
    categoryData,
    districtKey,
    districtData,
    relevantSchemes,
    summaryContext,
  };
}

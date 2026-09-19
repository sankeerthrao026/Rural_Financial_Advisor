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
  if (catLower.includes('poultry') || catLower.includes('కోడి') || catLower.includes('చికెన్') || catLower.includes('chicken') || catLower.includes('मुर्गी')) {
    categoryKey = 'poultry';
  } else if (catLower.includes('kirana') || catLower.includes('grocery') || catLower.includes('కిరాణా') || catLower.includes('store') || catLower.includes('shop') || catLower.includes('किराना')) {
    categoryKey = 'kirana';
  } else if (catLower.includes('weav') || catLower.includes('handloom') || catLower.includes('చేనేత') || catLower.includes('saree') || catLower.includes('textile') || catLower.includes('बुनकर')) {
    categoryKey = 'weaving';
  } else if (catLower.includes('tailor') || catLower.includes('టైలరింగ్') || catLower.includes('dress') || catLower.includes('boutique') || catLower.includes('सिलाई')) {
    categoryKey = 'tailoring';
  } else if (catLower.includes('mill') || catLower.includes('flour') || catLower.includes('మిల్లు') || catLower.includes('agri') || catLower.includes('processing') || catLower.includes('चक्की')) {
    categoryKey = 'agri_processing';
  } else if (catLower.includes('potter') || catLower.includes('clay') || catLower.includes('కుండల') || catLower.includes('మట్టి') || catLower.includes('मिट्टी') || catLower.includes('कुम्हार')) {
    categoryKey = 'pottery';
  } else if (catLower.includes('carpen') || catLower.includes('wood') || catLower.includes('వడ్రంగి') || catLower.includes('furniture') || catLower.includes('बढ़ई') || catLower.includes('काष्ठ')) {
    categoryKey = 'carpentry';
  } else if (catLower.includes('fish') || catLower.includes('aqua') || catLower.includes('చేపల') || catLower.includes('రొయ్యల') || catLower.includes('मत्स्य') || catLower.includes('मछली')) {
    categoryKey = 'fishery';
  } else if (catLower.includes('auto') || catLower.includes('repair') || catLower.includes('tractor') || catLower.includes('బైక్') || catLower.includes('ట్రాక్టర్') || catLower.includes('मैकेनिक') || catLower.includes('सर्विस')) {
    categoryKey = 'auto_repair';
  } else if (catLower.includes('canteen') || catLower.includes('food') || catLower.includes('hotel') || catLower.includes('హోటల్') || catLower.includes('టిఫిన్') || catLower.includes('होटल') || catLower.includes('कैंटीन') || catLower.includes('ढाबा')) {
    categoryKey = 'street_food';
  }

  const categoryData = (marketData.categories as any)[categoryKey] || marketData.categories.dairy;

  // Match district across Telangana, AP, Maharashtra, Karnataka, UP, Bihar
  let districtKey = 'default_rural';
  if (locLower.includes('warangal') || locLower.includes('వరంగల్')) {
    districtKey = 'warangal';
  } else if (locLower.includes('karimnagar') || locLower.includes('కరీంనగర్')) {
    districtKey = 'karimnagar';
  } else if (locLower.includes('nalgonda') || locLower.includes('నల్గొండ')) {
    districtKey = 'nalgonda';
  } else if (locLower.includes('nizamabad') || locLower.includes('నిజామాబాద్')) {
    districtKey = 'nizamabad';
  } else if (locLower.includes('khammam') || locLower.includes('ఖమ్మం')) {
    districtKey = 'khammam';
  } else if (locLower.includes('mahabubnagar') || locLower.includes('మహబూబ్‌నగర్') || locLower.includes('palamoor')) {
    districtKey = 'mahabubnagar';
  } else if (locLower.includes('ranga') || locLower.includes('rangareddy') || locLower.includes('రంగారెడ్డి')) {
    districtKey = 'rangareddy';
  } else if (locLower.includes('guntur') || locLower.includes('గుంటూరు')) {
    districtKey = 'guntur';
  } else if (locLower.includes('chittoor') || locLower.includes('చిత్తూరు') || locLower.includes('madanapalle')) {
    districtKey = 'chittoor';
  } else if (locLower.includes('godavari') || locLower.includes('గోదావరి') || locLower.includes('bhimavaram')) {
    districtKey = 'west_godavari';
  } else if (locLower.includes('kolhapur') || locLower.includes('कोल्हापूर')) {
    districtKey = 'kolhapur';
  } else if (locLower.includes('solapur') || locLower.includes('सोलापूर')) {
    districtKey = 'solapur';
  } else if (locLower.includes('nashik') || locLower.includes('नाशिक') || locLower.includes('lasalgaon')) {
    districtKey = 'nashik';
  } else if (locLower.includes('belagavi') || locLower.includes('belgaum') || locLower.includes('ಬೆಳಗಾವಿ')) {
    districtKey = 'belagavi';
  } else if (locLower.includes('mandya') || locLower.includes('ಮಂಡ್ಯ')) {
    districtKey = 'mandya';
  } else if (locLower.includes('dharwad') || locLower.includes('hubballi') || locLower.includes('ಧಾರವಾಡ')) {
    districtKey = 'dharwad';
  } else if (locLower.includes('varanasi') || locLower.includes('वाराणसी') || locLower.includes('banaras')) {
    districtKey = 'varanasi';
  } else if (locLower.includes('gorakhpur') || locLower.includes('गोरखपुर')) {
    districtKey = 'gorakhpur';
  } else if (locLower.includes('lucknow') || locLower.includes('लखनऊ') || locLower.includes('malihabad')) {
    districtKey = 'lucknow';
  } else if (locLower.includes('muzaffarpur') || locLower.includes('मुज़फ़्फ़रपुर')) {
    districtKey = 'muzaffarpur';
  } else if (locLower.includes('patna') || locLower.includes('पटना')) {
    districtKey = 'patna_rural';
  } else if (locLower.includes('madhubani') || locLower.includes('मधुबनी')) {
    districtKey = 'madhubani';
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
- Commercial Hubs & Mandis: ${districtData.commercialHubs?.join(', ')}
- Banking Infrastructure: ${districtData.bankingOutlets}

Category Benchmark (${categoryData.name}):
- Typical Project Cost: ₹${categoryData.benchmarkProjectCost.typical.toLocaleString('en-IN')} (Range: ₹${categoryData.benchmarkProjectCost.min.toLocaleString('en-IN')} - ₹${categoryData.benchmarkProjectCost.max.toLocaleString('en-IN')})
- Realistic Profit Margin: ${categoryData.marginRange}
- Daily Volume Benchmark: ${categoryData.averageDailyVolume}
- Local Competitor Density: ${categoryData.competitorDensity}
- Pricing Benchmarks: ${JSON.stringify(categoryData.pricingBenchmarks)}
- Seasonal Demand Patterns: ${categoryData.demandSeasonality}
- Mandi Price Trends & Seasonality: ${JSON.stringify(categoryData.mandiPriceTrends || {})}
- Local Operating Risks: ${categoryData.keyRisks?.join('; ')}
- Prudent Next Steps: ${categoryData.recommendedActions?.join('; ')}
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

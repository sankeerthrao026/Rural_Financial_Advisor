import { NextRequest, NextResponse } from 'next/server';
import { apiClient, FinanceAdviceRequest, FinanceAdviceResponse } from '@/lib/api/client';
import { callGeminiApi } from '@/lib/ai/gemini';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FinanceAdviceRequest;
    const {
      marginCapital,
      loanAmount,
      projectCost,
      quarterlyEmi,
      category,
      gender,
      socialCategory,
      location,
      workingCapitalRatio,
      userQuery,
      history,
      language,
    } = body;

    // 1. Attempt call to FastAPI backend /finance/advisor-chat
    try {
      const apiResult = await apiClient.consultFinanceAdvisor({
        marginCapital: Number(marginCapital) || 100000,
        loanAmount: Number(loanAmount) || 900000,
        projectCost: Number(projectCost) || 1000000,
        quarterlyEmi: Number(quarterlyEmi) || 42000,
        category: category || 'Dairy Farming',
        gender: gender || 'female',
        socialCategory: socialCategory || 'General',
        location: location || 'Warangal, Telangana',
        workingCapitalRatio: typeof workingCapitalRatio === 'number' ? workingCapitalRatio : undefined,
        userQuery: typeof userQuery === 'string' ? userQuery : undefined,
        history: Array.isArray(history) ? history : undefined,
        language: language === 'te' ? 'te' : 'en',
      });

      if (apiResult.success && apiResult.data) {
        return NextResponse.json(apiResult.data);
      }
    } catch (apiErr) {
      console.warn('[FinanceAdvisor Route] FastAPI backend unreachable, using Next.js Gemini/Grounded pipeline:', apiErr);
    }

    // 2. Deterministic calculations for grounded baseline
    const isTe = language === 'te';
    const isWoman = ['female', 'woman', 'f'].includes((gender || '').toLowerCase());
    const isScSt = ['SC', 'ST'].includes((socialCategory || '').toUpperCase());
    const isObc = (socialCategory || '').toUpperCase() === 'OBC';
    const cleanLoan = Number(loanAmount) || 900000;
    const cleanMargin = Number(marginCapital) || 100000;
    const cleanProjectCost = Number(projectCost) || (cleanLoan + cleanMargin);
    const cleanEmi = Number(quarterlyEmi) || Math.round((cleanLoan * 1.09) / (5 * 4));
    const catLower = (category || 'Dairy Farming').toLowerCase();
    const cleanCat = category || 'Dairy Farming';
    const cleanLoc = location || 'Warangal, Telangana';

    // Working Capital vs Capex
    let defaultRatio = 0.5;
    let wcUses = ['Operational raw materials & consumables', 'Short-term liquidity & utility payments'];
    let capexUses = ['Machinery & commercial production fixtures', 'Transport/handling equipment'];

    if (catLower.includes('dairy') || catLower.includes('cattle')) {
      defaultRatio = 0.35;
      wcUses = ['High-protein cattle feed & dry fodder reserves', 'Veterinary care, vaccines & milk transport cans'];
      capexUses = ['High-yield Murrah buffaloes / dairy cows', 'Pucca cattle shed construction & bulk milk chiller'];
    } else if (catLower.includes('kirana') || catLower.includes('grocery')) {
      defaultRatio = 0.75;
      wcUses = ['FMCG wholesale stock & inventory replenishment', 'Bulk grains, pulses, spices & customer credit buffer'];
      capexUses = ['Commercial deep freezer & refrigeration', 'Modular steel racks, electronic scale & billing POS'];
    } else if (catLower.includes('weave') || catLower.includes('handloom')) {
      defaultRatio = 0.60;
      wcUses = ['Mulberry silk yarn, cotton yarn & metallic zari', 'Natural dyes, warp materials & weaver artisan wages'];
      capexUses = ['Fly-shuttle pit looms & electronic Jacquard box', 'Warping drum, creel stand & pirn winder'];
    }

    const ratio = typeof workingCapitalRatio === 'number' ? Math.max(0.05, Math.min(0.95, workingCapitalRatio)) : defaultRatio;
    const wcPercent = Math.round(ratio * 1000) / 10;
    const capexPercent = Math.round((100 - wcPercent) * 10) / 10;
    const wcAmount = Math.round(cleanLoan * (wcPercent / 100));
    const capexAmount = cleanLoan - wcAmount;

    // Seasonal Moratorium
    let isSeasonal = true;
    let leanSeason = 'April – June (Peak Summer Heat)';
    let peakSeason = 'August – January (Monsoon Flush)';
    let guidanceEn = 'In dairy farming, summer heat stress depresses milk yield by 20%–30%. We advise requesting a 1-quarter summer moratorium or interest-only period, accelerating principal repayment during the post-monsoon flush season.';
    let guidanceTe = 'పాడి పరిశ్రమలో వేసవి కాలంలో పాల దిగుబడి తగ్గుతుంది కాబట్టి 1 త్రైమాసికం మారటోరియం తీసుకుని, శీతాకాలంలో అసలు వేగంగా చెల్లించడం ఉత్తమం.';

    if (catLower.includes('kirana') || catLower.includes('grocery')) {
      leanSeason = 'July – August (Kharif Sowing Season)';
      peakSeason = 'October – January (Festive Harvest Surge)';
      guidanceEn = 'Rural grocery cash flows tighten during sowing months as farmers conserve cash for seeds. Request standard quarterly EMIs with working capital buffer before the festival season.';
      guidanceTe = 'ఖరీఫ్ విత్తనాల కాలంలో అరువులు పెరుగుతాయి కాబట్టి సాధారణ వాయిదాలు చెల్లించి, పండుగల ముందు వర్కింగ్ క్యాపిటల్ పెంచుకోండి.';
    } else if (catLower.includes('weave') || catLower.includes('handloom')) {
      leanSeason = 'June – August (Monsoon Humidity)';
      peakSeason = 'September – February (Wedding & Festival Season)';
      guidanceEn = 'Handloom drying slows during monsoon humidity. Structure a 1-quarter moratorium during monsoon, matching principal amortization with the wedding season.';
      guidanceTe = 'వర్షాకాలంలో అమ్మకాలు మందగిస్తాయి కాబట్టి 1 త్రైమాసిక మారటోరియం తీసుకుని, పెళ్లిళ్ల సీజన్లో అసలు చెల్లించండి.';
    }

    // Recommended Schemes
    const standUpWhy = isWoman
      ? "As a woman entrepreneur, you are legally prioritized under Stand-Up India's branch mandate for loans up to ₹1 Crore with concessional interest rates and lower margin money."
      : isScSt
      ? "As an SC/ST entrepreneur, every commercial bank branch has a mandatory credit target under Stand-Up India with concessional margin money."
      : "Eligible for greenfield enterprise expansion when partnering with qualifying women or SC/ST co-promoters.";

    const schemes = [
      {
        id: 'stand-up-india',
        name: 'Stand-Up India Scheme for Women & SC/ST',
        nameTe: 'స్టాండ్-అప్ ఇండియా పథకం (మహిళలు & SC/ST)',
        agency: 'SIDBI & Scheduled Commercial Banks',
        maxAmount: 10000000,
        subsidyOrConcession: 'Lowest commercial rate, 15% margin money, NCGTC credit guarantee',
        subsidyOrConcessionTe: 'తక్కువ వడ్డీ రేటు, 15% మార్జిన్ మనీ, ప్రభుత్వ క్రెడిట్ గ్యారెంటీ',
        whyRecommended: standUpWhy,
        whyRecommendedTe: 'మహిళలు మరియు SC/ST లకు బ్యాంక్ బ్రాంచ్‌లో ప్రాధాన్యత లభిస్తుంది.',
        isTopMatch: isWoman || isScSt,
      },
      {
        id: 'pmegp',
        name: 'PMEGP Credit Linked Subsidy Scheme',
        nameTe: 'పీఎంఈజీపీ (PMEGP) సబ్సిడీ పథకం',
        agency: 'KVIC, KVIB & DIC',
        maxAmount: 5000000,
        subsidyOrConcession: isWoman || isScSt || isObc ? '35% Rural Capital Subsidy (Special Category)' : '25% Rural Capital Subsidy (General Category)',
        subsidyOrConcessionTe: isWoman || isScSt || isObc ? 'గ్రామీణ ప్రాంతాల్లో 35% భారీ సబ్సిడీ' : 'గ్రామీణ ప్రాంతాల్లో 25% సబ్సిడీ',
        whyRecommended: isWoman || isScSt || isObc ? 'Special Category grants you an elevated 35% capital subsidy, drastically cutting debt burden.' : 'Provides a 25% rural capital subsidy on micro-enterprises.',
        whyRecommendedTe: 'ప్రత్యేక కేటగిరీ కింద 35% ప్రభుత్వ సబ్సిడీ లభిస్తుంది.',
        isTopMatch: !(isWoman || isScSt) && isObc,
      },
      {
        id: 'mudra',
        name: 'Pradhan Mantri MUDRA Yojana (Kishor/Tarun)',
        nameTe: 'పీఎం ముద్రా యోజన',
        agency: 'NCGTC & Banks',
        maxAmount: 1000000,
        subsidyOrConcession: '100% collateral-free, MUDRA RuPay card for working capital',
        subsidyOrConcessionTe: 'ఎలాంటి షూరిటీ అవసరం లేదు, వర్కింగ్ క్యాపిటల్ కోసం ముద్రా కార్డ్',
        whyRecommended: 'Universal collateral-free micro-credit up to ₹10 Lakhs with flexible revolving credit for inventory.',
        whyRecommendedTe: 'రూ. 10 లక్షల వరకు ఎలాంటి పూచీకత్తు అవసరం లేదు.',
        isTopMatch: !(isWoman || isScSt || isObc),
      },
    ];

    const topScheme = schemes.find((s) => s.isTopMatch) || schemes[0];
    const schemeName = topScheme.name;

    const loanExplanation = isTe
      ? `ప్రాజెక్ట్ మొత్తం వ్యయం ₹${cleanProjectCost.toLocaleString('en-IN')}. మీ పెట్టుబడి ₹${cleanMargin.toLocaleString('en-IN')} కాగా బ్యాంక్ రుణం ₹${cleanLoan.toLocaleString('en-IN')}. త్రైమాసిక వాయిదా ₹${cleanEmi.toLocaleString('en-IN')}.`
      : `Total project outlay is ₹${cleanProjectCost.toLocaleString('en-IN')}, with ₹${cleanMargin.toLocaleString('en-IN')} promoter equity and ₹${cleanLoan.toLocaleString('en-IN')} bank loan. Quarterly EMI is ₹${cleanEmi.toLocaleString('en-IN')}.`;

    let replyText = '';
    let providerUsed = 'Grounded Local Finance Engine';

    // 3. Conversational AI Generation via Gemini if query is provided
    if (userQuery && userQuery.trim()) {
      const cleanUserQuery = userQuery.trim();

      if (process.env.GEMINI_API_KEY) {
        let historyPrompt = '';
        if (history && history.length > 0) {
          const recentHistory = history.slice(-8);
          historyPrompt =
            'PREVIOUS CONVERSATION:\n' +
            recentHistory
              .map((h) => `${h.role === 'user' ? 'Entrepreneur' : 'Loan Advisor'}: ${h.content}`)
              .join('\n') +
            '\n\n';
        }

        const systemPrompt = isTe
          ? `You are the RuralCred AI Loan & Finance Advisor.
You converse with rural Indian micro-entrepreneurs in supportive, respectful, and practical language.
CRITICAL MANDATORY LANGUAGE RULE:
The selected active application language is TELUGU (తెలుగు).
Respond entirely in Telugu script. Do NOT write in English or Hindi. Do NOT provide bilingual text.
STRICT RULES:
1. NEVER alter, hallucinate, or recalculate the verified loan numbers provided in the LOAN SUMMARY below (these are calculated deterministically by our banking engine).
2. Directly answer the entrepreneur's current question, referencing their exact loan amount (₹${cleanLoan.toLocaleString('en-IN')}), EMI (₹${cleanEmi.toLocaleString('en-IN')}), working capital split, schemes, or seasonal moratorium where appropriate.
3. Tailor your explanation to their demographic profile (e.g. woman entrepreneur, ${socialCategory || 'OBC'} category, ${cleanLoc} location, ${cleanCat} enterprise).`
          : `You are the RuralCred AI Loan & Finance Advisor.
You converse with rural Indian micro-entrepreneurs in supportive, respectful, and practical language.
CRITICAL MANDATORY LANGUAGE RULE:
The selected active application language is ENGLISH.
Respond entirely in English. Do NOT include Telugu, Hindi, or regional-language scripts. Answer the user's question directly and completely in English.
STRICT RULES:
1. NEVER alter, hallucinate, or recalculate the verified loan numbers provided in the LOAN SUMMARY below (these are calculated deterministically by our banking engine).
2. Directly answer the entrepreneur's current question, referencing their exact loan amount (₹${cleanLoan.toLocaleString('en-IN')}), EMI (₹${cleanEmi.toLocaleString('en-IN')}), working capital split, schemes, or seasonal moratorium where appropriate.
3. Tailor your explanation to their demographic profile (e.g. woman entrepreneur, ${socialCategory || 'OBC'} category, ${cleanLoc} location, ${cleanCat} enterprise).`;

        const userPrompt = `${historyPrompt}VERIFIED LOAN & ENTREPRENEUR SUMMARY:
- Margin Capital (Equity): ₹${cleanMargin.toLocaleString('en-IN')}
- Bank Loan Amount: ₹${cleanLoan.toLocaleString('en-IN')}
- Total Project Outlay: ₹${cleanProjectCost.toLocaleString('en-IN')}
- Quarterly EMI: ₹${cleanEmi.toLocaleString('en-IN')}
- Working Capital Split: ₹${wcAmount.toLocaleString('en-IN')} (${wcPercent}%) -> Uses: ${wcUses.join(', ')}
- Capital Expenditure (Capex) Split: ₹${capexAmount.toLocaleString('en-IN')} (${capexPercent}%) -> Uses: ${capexUses.join(', ')}
- Entrepreneur Demographics: Gender: ${gender || 'female'}, Social Category: ${socialCategory || 'OBC'}, Business: ${cleanCat}, Location: ${cleanLoc}
- Seasonal Moratorium Guidance: ${guidanceEn}
- Recommended Schemes: ${schemes.map((s) => `${s.name} (${s.subsidyOrConcession} - Why: ${s.whyRecommended})`).join('; ')}

CURRENT ENTREPRENEUR INQUIRY:
${cleanUserQuery}

Provide a comprehensive, accurate, and supportive conversational answer (2 to 4 paragraphs) addressing the entrepreneur's question directly using their exact business facts.`;

        try {
          const geminiResult = await callGeminiApi({
            systemInstruction: systemPrompt,
            userPrompt,
            temperature: 0.25,
          });

          if (geminiResult.success && geminiResult.text?.trim()) {
            replyText = geminiResult.text.trim();
            providerUsed = `Google Gemini (${geminiResult.model})`;
          }
        } catch (geminiErr) {
          console.warn('[FinanceAdvisor Route] Gemini call failed, falling back to local synthesizer:', geminiErr);
        }
      }

      // 4. Grounded question-aware fallback if Gemini is offline
      if (!replyText) {
        const q = cleanUserQuery.toLowerCase();

        // A. Schemes & Government Subsidies
        if (q.includes('scheme') || q.includes('eligible') || q.includes('government') || q.includes('subsidy') || q.includes('subsidies') || q.includes('pmegp') || q.includes('stand-up') || q.includes('mudra') || q.includes('vishwakarma') || q.includes('nbcfdc')) {
          if (q.includes('pmegp')) {
            replyText = isTe
              ? `పీఎంఈజీపీ (PMEGP) పథకం కింద గ్రామీణ ప్రాంతంలో మీ ${cleanCat} యూనిట్‌కు 35% భారీ మూలధన సబ్సిడీ లభిస్తుంది. మీ ₹${cleanLoan.toLocaleString('en-IN')} రుణంలో దాదాపు ₹${Math.round(cleanProjectCost * 0.35).toLocaleString('en-IN')} ప్రభుత్వ సబ్సిడీగా లభించి మీ రుణ భారాన్ని గణనీయంగా తగ్గిస్తుంది.`
              : `PMEGP (Prime Minister Employment Generation Programme) provides up to 35% capital subsidy for rural micro-enterprises. For your ${cleanCat} enterprise in ${cleanLoc}, this delivers approximately ₹${Math.round(cleanProjectCost * 0.35).toLocaleString('en-IN')} in government margin subsidy, substantially reducing your net loan liability.`;
          } else if (q.includes('stand-up') || q.includes('standup')) {
            replyText = isTe
              ? `స్టాండ్-అప్ ఇండియా (Stand-Up India) పథకం కింద మహిళలు మరియు SC/ST పారిశ్రామికవేత్తలకు బ్యాంక్ బ్రాంచ్‌లలో ప్రాధాన్యతతో కూడిన రుణాలు లభిస్తాయి. ఇందులో తక్కువ మార్జిన్ మనీ (15%) మరియు NCGTC క్రెడిట్ గ్యారెంటీ రక్షణతో ₹${cleanLoan.toLocaleString('en-IN')} రుణం పొందవచ్చు.`
              : `Stand-Up India mandates scheduled bank branches to prioritize credit for women and SC/ST entrepreneurs for loans up to ₹1 Crore. It features concessional 15% promoter margin and government credit guarantee coverage for your ₹${cleanLoan.toLocaleString('en-IN')} loan.`;
          } else {
            replyText = isTe
              ? `మీ ప్రొఫైల్ (${isWoman ? 'మహిళా పారిశ్రామికవేత్త' : 'పారిశ్రామికవేత్త'}, ${socialCategory || 'OBC'}, ${cleanLoc}) ఆధారంగా మీరు ఈ క్రింది ప్రభుత్వ పథకాలకు అర్హులు:\n1. ${topScheme.nameTe}: ${topScheme.subsidyOrConcessionTe}\n2. పీఎంఈజీపీ (PMEGP): గ్రామీణ ప్రాంతాల్లో 25% నుండి 35% వరకు మూలధన సబ్సిడీ.\n3. పీఎం ముద్రా యోజన: రూ. 10 లక్షల వరకు ఎలాంటి తాకట్టు లేని రుణం.`
              : `Based on your profile (${isWoman ? 'Woman Entrepreneur' : 'Entrepreneur'}, ${socialCategory || 'OBC'}, ${cleanLoc}), you qualify for the following government credit schemes:\n1. ${topScheme.name}: ${topScheme.subsidyOrConcession} (${topScheme.whyRecommended})\n2. PMEGP (KVIC): Provides 25% to 35% rural capital subsidy.\n3. PM MUDRA Yojana: Up to ₹10 Lakhs collateral-free credit with flexible working capital.`;
          }
        }
        // B. Seasonal Moratorium / Grace Period
        else if (q.includes('moratorium') || q.includes('summer') || q.includes('lean') || q.includes('grace') || q.includes('pause') || q.includes('skip') || q.includes('flush') || q.includes('monsoon')) {
          replyText = isTe
            ? `${guidanceTe} ${leanSeason} కాలంలో మీ ఆదాయం తగ్గినప్పుడు 1 త్రైమాసికం పాటు కేవలం వడ్డీ మాత్రమే చెల్లించే సౌకర్యం (Interest-only Moratorium) తీసుకోవచ్చు. దీనివల్ల మీ నగదు ప్రవాహంపై భారం పడదు.`
            : `${guidanceEn} During ${leanSeason}, you can structure a 1-quarter principal moratorium with your lender, paying only the accrued interest. Principal repayment accelerates during ${peakSeason} when seasonal cash flows peak.`;
        }
        // C. Bank Documents & Approval Requirements
        else if (q.includes('document') || q.includes('paperwork') || q.includes('bank') || q.includes('require') || q.includes('approval') || q.includes('apply') || q.includes('kyc') || q.includes('proof')) {
          replyText = isTe
            ? `మీ ₹${cleanLoan.toLocaleString('en-IN')} రుణ దరఖాస్తు ఆమోదం కోసం బ్యాంక్ క్రింది పత్రాలను పరిశీలిస్తుంది:\n1. కేవైసీ (ఆధార్ కార్డు మరియు పాన్ కార్డు)\n2. నివాస మరియు కుల ధృవీకరణ పత్రం (${socialCategory || 'OBC'})\n3. యంత్రాలు మరియు పరికరాల ప్రొఫార్మా కొటేషన్లు (₹${capexAmount.toLocaleString('en-IN')})\n4. మీ స్వంత పెట్టుబడి సంసిద్ధతను (₹${cleanMargin.toLocaleString('en-IN')}) చూపే 6 నెలల బ్యాంక్ ఖాతా స్టేట్‌మెంట్ లేదా లాగ్‌బుక్ రికార్డులు\n5. ఉద్యామ్ రిజిస్ట్రేషన్ (Udyam MSME Certificate).`
            : `To approve your ₹${cleanLoan.toLocaleString('en-IN')} credit facility, lending institutions require the following documentation checklist:\n1. KYC Verification: Aadhaar Card and PAN Card\n2. Demographic proof: Residence & Community/Caste Certificate (${socialCategory || 'OBC'})\n3. Capex Quotations: Formal dealer proforma invoices for equipment (₹${capexAmount.toLocaleString('en-IN')})\n4. Equity Margin Proof: 6 months of bank statements or digital logbook records proving your ₹${cleanMargin.toLocaleString('en-IN')} equity capital\n5. Udyam MSME Registration and basic project profile.`;
        }
        // D. Quarterly Repayment & EMI Calculations
        else if (q.includes('repay') || q.includes('quarterly') || q.includes('emi') || q.includes('installment') || q.includes('how much pay') || q.includes('schedule')) {
          replyText = isTe
            ? `మీ ₹${cleanLoan.toLocaleString('en-IN')} రుణానికి 5 సంవత్సరాల కాలపరిమితిలో త్రైమాసిక వాయిదా సుమారు ₹${cleanEmi.toLocaleString('en-IN')}. తగ్గుతున్న అసలు పద్ధతిలో వడ్డీ లెక్కించబడుతుంది కాబట్టి ప్రతి త్రైమాసికానికి అసలు చెల్లించే కొద్దీ వడ్డీ భారం తగ్గుతుంది.`
            : `For your ₹${cleanLoan.toLocaleString('en-IN')} credit facility over a 5-year tenure, your scheduled quarterly reducing-balance repayment is ₹${cleanEmi.toLocaleString('en-IN')}. As principal amortizes each quarter, your interest obligation progressively reduces, preserving enterprise operating cash flow.`;
        }
        // E. Interest Rate & Cost of Borrowing
        else if (q.includes('interest') || q.includes('rate') || q.includes('outlay') || q.includes('cost')) {
          const approxTotalInterest = Math.round(cleanLoan * 0.28);
          replyText = isTe
            ? `ప్రాధాన్యతా రంగ రుణాల కింద మీ వడ్డీ రేటు సుమారు 9.0% – 10.5% వార్షిక ప్రాతిపదికన తగ్గుతున్న నిల్వపై లెక్కించబడుతుంది. మొత్తం 5 సంవత్సరాల కాలంలో చెల్లించాల్సిన మొత్తం వడ్డీ సుమారు ₹${approxTotalInterest.toLocaleString('en-IN')} కాగా మొత్తం తిరిగి చెల్లింపు ₹${(cleanLoan + approxTotalInterest).toLocaleString('en-IN')}.`
            : `Under priority sector credit guidelines, the applicable interest rate is structured between 9.0% and 10.5% p.a. on a reducing-balance basis. Over the full 5-year tenure, total interest outlay is approximately ₹${approxTotalInterest.toLocaleString('en-IN')}, bringing total principal + interest outlay to ₹${(cleanLoan + approxTotalInterest).toLocaleString('en-IN')}.`;
        }
        // F. Affordability & Equity Margin Readiness
        else if (q.includes('afford') || q.includes('capital') || q.includes('equity') || q.includes('margin') || q.includes('enough')) {
          replyText = isTe
            ? `మీ వద్ద ఉన్న ₹${cleanMargin.toLocaleString('en-IN')} స్వంత పెట్టుబడి, మొత్తం ప్రాజెక్ట్ వ్యయంలో 10% వాటాను ఖచ్చితంగా భర్తీ చేస్తుంది. వ్యాపార నగదు ప్రవాహం ఆధారంగా మీ డెట్ సర్వీస్ కవరేజ్ నిష్పత్తి (DSCR) 1.95x గా అంచనా వేయబడింది, కాబట్టి మీరు ఈ రుణాన్ని సులభంగా తిరిగి చెల్లించవచ్చు.`
            : `Your equity contribution of ₹${cleanMargin.toLocaleString('en-IN')} comfortably satisfies the 10% promoter margin requirement for your ₹${cleanProjectCost.toLocaleString('en-IN')} project outlay. Based on typical revenue margins in ${cleanCat}, your projected Debt-Service Coverage Ratio (DSCR) is ~1.95x, indicating healthy debt affordability.`;
        }
        // G. Working Capital vs Capex Split
        else if (q.includes('working capital') || q.includes('capex') || q.includes('difference') || q.includes('split') || q.includes('ratio')) {
          replyText = isTe
            ? `వర్కింగ్ క్యాపిటల్ మరియు కేపెక్స్ మధ్య ప్రధాన తేడా:\n- వర్కింగ్ క్యాపిటల్ (₹${wcAmount.toLocaleString('en-IN')}, ${wcPercent}%): రోజువారీ కార్యకలాపాలు, దాణా/ముడిసరుకు కొనుగోలు మరియు అరువుల నిల్వ కోసం ఉపయోగపడుతుంది.\n- కేపెక్స్ (₹${capexAmount.toLocaleString('en-IN')}, ${capexPercent}%): శాశ్వత ఆస్తులైన యంత్రాలు, పశువులు లేదా షెడ్ల నిర్మాణం కోసం ఉపయోగపడుతుంది. ఈ విభజన బ్యాంకర్లకు రుణ భద్రతను ఇస్తుంది.`
            : `The distinction between Working Capital and Capex in your financing structure:\n- Working Capital (₹${wcAmount.toLocaleString('en-IN')}, ${wcPercent}%): Revolving liquidity allocated for cyclical operational inputs like ${wcUses.join(', ')}.\n- Capital Expenditure (₹${capexAmount.toLocaleString('en-IN')}, ${capexPercent}%): Long-term asset investments like ${capexUses.join(', ')}.\nLenders require this structured split to ensure borrowed capital directly generates productive capacity without operational starvation.`;
        }
        // H. General contextual reply
        else {
          replyText = isTe
            ? `మీ ${cleanLoc} లోని ${cleanCat} వ్యాపార విశ్లేషణ ప్రకారం, మీ ₹${cleanLoan.toLocaleString('en-IN')} రుణానికి త్రైమాసిక వాయిదా ₹${cleanEmi.toLocaleString('en-IN')}. వర్కింగ్ క్యాపిటల్ ₹${wcAmount.toLocaleString('en-IN')} (${wcPercent}%) మరియు స్థిర పరికరాల కోసం ₹${capexAmount.toLocaleString('en-IN')} (${capexPercent}%) కేటాయించబడింది. ప్రభుత్వ పథకాలు, సబ్సిడీలు లేదా బ్యాంక్ పత్రాల గురించి ఏవైనా ప్రశ్నలు అడగవచ్చు.`
            : `Regarding your inquiry for ${cleanCat} in ${cleanLoc}: your structured financing covers ₹${cleanLoan.toLocaleString('en-IN')} with quarterly repayments of ₹${cleanEmi.toLocaleString('en-IN')}, divided into ₹${wcAmount.toLocaleString('en-IN')} (${wcPercent}%) working capital and ₹${capexAmount.toLocaleString('en-IN')} (${capexPercent}%) capex. Please feel free to ask about scheme subsidies, moratorium terms, or bank document preparation.`;
        }
      }
    } else {
      // Default welcome greeting
      replyText = isTe
        ? `నమస్కారం! మీ ${cleanCat} వ్యాపారం కోసం సమగ్ర ఆర్థిక ప్రణాళిక సిద్ధం చేయబడింది. మీ ₹${cleanMargin.toLocaleString('en-IN')} పెట్టుబడికి ₹${cleanLoan.toLocaleString('en-IN')} బ్యాంక్ రుణం జతచేయబడింది. మీకు తగిన ప్రభుత్వ పథకాలు మరియు మారటోరియం షెడ్యూల్ క్రింద చూడవచ్చు.`
        : `Welcome! I have analyzed your ${cleanCat} financing requirements in ${cleanLoc}. Your ₹${cleanMargin.toLocaleString('en-IN')} promoter equity qualifies for ₹${cleanLoan.toLocaleString('en-IN')} institutional credit with a quarterly repayment of ₹${cleanEmi.toLocaleString('en-IN')}. Review tailored schemes and seasonal cash-flow advisory below.`;
    }

    const responsePayload: FinanceAdviceResponse = {
      reply: replyText,
      replyTe: isTe ? replyText : undefined,
      loanExplanation,
      loanExplanationTe: isTe ? loanExplanation : undefined,
      recommendedSchemes: schemes,
      workingCapitalBreakdown: {
        workingCapitalPercent: wcPercent,
        capexPercent: capexPercent,
        workingCapitalAmount: wcAmount,
        capexAmount: capexAmount,
        workingCapitalUses: wcUses,
        capexUses: capexUses,
      },
      seasonalMoratoriumAdvice: {
        isSeasonal,
        businessType: cleanCat,
        leanSeasonMonths: leanSeason,
        peakSeasonMonths: peakSeason,
        moratoriumQuartersRecommended: 1,
        guidance: guidanceEn,
        guidanceTe,
      },
      providerUsed,
    };

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error('API Error /api/ai/finance-advisor:', error);
    return NextResponse.json(
      {
        error: 'Finance advisory error',
        details: error?.message,
      },
      { status: 500 }
    );
  }
}

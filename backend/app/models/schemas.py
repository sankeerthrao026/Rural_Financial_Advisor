from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field

# ----------------- User Profile -----------------
class UserProfile(BaseModel):
    id: str = "demo-user"
    email: Optional[str] = "anita.dairy@ruralcred.in"
    name: str = "Anita Sharma"
    businessName: str = "Sharma Dairy Farm"
    location: str = "Warangal, Telangana"
    category: str = "Dairy Farming"
    marginCapital: float = 100000.0
    hasActiveLoan: bool = False
    simulatingSecondLoan: bool = False
    onboardingCompleted: bool = True
    gender: Optional[str] = "female"
    socialCategory: Optional[str] = "General"
    language: str = "en"
    inputMode: str = "text"

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    businessName: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = None
    marginCapital: Optional[float] = None
    hasActiveLoan: Optional[bool] = None
    simulatingSecondLoan: Optional[bool] = None
    onboardingCompleted: Optional[bool] = None
    gender: Optional[str] = None
    socialCategory: Optional[str] = None
    language: Optional[str] = None
    inputMode: Optional[str] = None

# ----------------- Deterministic Finance Engine -----------------
class SchemeDetails(BaseModel):
    id: str
    name: str
    nameTe: str
    agency: str
    interestRateAnnual: float
    tenureYears: int
    moratoriumMonths: int
    maxProjectCost: float
    repaymentFrequency: str = "Quarterly"

class AmortizationRow(BaseModel):
    quarter: int
    isMoratorium: bool
    startingPrincipal: float
    principalPaid: float
    interestPaid: float
    totalPayment: float
    remainingBalance: float

class FinanceCalculateRequest(BaseModel):
    marginCapital: float = Field(..., gt=0, description="Promoter own capital contribution in INR")

class FinancePlanResponse(BaseModel):
    marginCapital: float
    projectCost: float
    loanAmount: float
    scheme: SchemeDetails
    quarterlyEmi: float
    totalQuarters: int
    moratoriumQuarters: int
    repaymentQuarters: int
    totalInterestPaid: float
    totalRepayment: float
    amortizationSchedule: List[AmortizationRow]

class MetricBreakdown(BaseModel):
    metric: str
    score: int
    weight: str
    label: str
    labelTe: str

class FinancialHealthResponse(BaseModel):
    score: int
    status: Literal["excellent", "steady", "caution"]
    statusTe: str
    summary: str
    summaryTe: str
    breakdown: List[MetricBreakdown]

# ----------------- Conversational AI Finance Advisor -----------------
class SchemeEligibilityInput(BaseModel):
    loanAmount: float = Field(..., gt=0, description="Requested loan amount in INR")
    category: str = Field(default="Dairy Farming", description="Business trade or enterprise type")
    gender: str = Field(default="female", description="Gender: female, male, other")
    socialCategory: str = Field(default="General", description="Social category: General, OBC, SC, ST")
    locationType: Literal["rural", "urban"] = Field(default="rural", description="Geographic location")
    isNewEnterprise: bool = Field(default=True, description="Whether this is a new greenfield enterprise")
    isArtisanTrade: Optional[bool] = Field(default=None, description="Explicit artisan craft flag")

class SchemeCalculationResult(BaseModel):
    schemeId: str
    schemeName: str
    schemeNameTe: str
    category: str
    agency: str
    isEligible: bool
    ineligibilityReason: Optional[str] = None
    maxEligibleLoan: float
    requestedLoanAmount: float
    sanctionedLoanAmount: float
    promoterContribution: float
    promoterContributionPercent: float
    totalProjectCost: float
    interestRateAnnual: float
    subsidyPercent: Optional[float] = None
    subsidyAmount: Optional[float] = None
    tenureYears: float
    tenureMonths: int
    moratoriumMonths: int
    monthlyEmi: float
    quarterlyEmi: float
    totalInterestPaid: float
    totalRepayment: float
    collateralFree: bool
    guaranteeCoverage: str
    guaranteeCoverageTe: str
    benefits: List[str]
    benefitsTe: List[str]
    isTopMatch: bool = False

class TailoredSchemeRecommendation(BaseModel):
    id: str
    name: str
    nameTe: str
    agency: str
    maxAmount: float
    subsidyOrConcession: str
    subsidyOrConcessionTe: str
    whyRecommended: str
    whyRecommendedTe: str
    isTopMatch: bool = False

class WorkingCapitalBreakdown(BaseModel):
    workingCapitalPercent: float
    capexPercent: float
    workingCapitalAmount: float
    capexAmount: float
    workingCapitalUses: List[str]
    capexUses: List[str]

class SeasonalMoratoriumAdvice(BaseModel):
    isSeasonal: bool
    businessType: str
    leanSeasonMonths: str
    peakSeasonMonths: str
    moratoriumQuartersRecommended: int
    guidance: str
    guidanceTe: str

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class FinanceAdviceRequest(BaseModel):
    marginCapital: float
    loanAmount: float
    projectCost: float
    quarterlyEmi: float
    category: str = "Dairy Farming"
    gender: str = "female"
    socialCategory: str = "General"
    location: str = "Warangal, Telangana"
    workingCapitalRatio: Optional[float] = None
    userQuery: Optional[str] = None
    history: Optional[List[ChatMessage]] = Field(default_factory=list)
    language: str = "en"

class FinanceAdviceResponse(BaseModel):
    reply: str
    replyTe: Optional[str] = None
    loanExplanation: str
    loanExplanationTe: Optional[str] = None
    recommendedSchemes: List[TailoredSchemeRecommendation]
    workingCapitalBreakdown: WorkingCapitalBreakdown
    seasonalMoratoriumAdvice: SeasonalMoratoriumAdvice
    providerUsed: str

# ----------------- Deterministic Risk Engine -----------------
class DetectedRisk(BaseModel):
    ruleCode: str
    riskType: str
    severity: Literal["alert", "warning", "info"]
    title: str
    titleTe: str
    reason: str
    reasonTe: str
    metrics: Dict[str, Any] = {}

class RiskAnalysisRequest(BaseModel):
    hasActiveLoan: bool = False
    simulatingSecondLoan: bool = False
    totalIncome: float = 0.0
    totalExpenses: float = 0.0
    netCashFlow: float = 0.0
    previousNetCashFlow: Optional[float] = None

class RiskAnalysisResponse(BaseModel):
    detectedRisks: List[DetectedRisk]
    isSafe: bool
    activeCount: int

# ----------------- Digital Logbook -----------------
class LogbookCreate(BaseModel):
    date: str
    amount: float = Field(..., gt=0)
    type: Literal["income", "expense"]
    category: str
    note: str
    tags: List[str] = Field(default_factory=list)

class LogbookUpdate(BaseModel):
    date: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    type: Optional[Literal["income", "expense"]] = None
    category: Optional[str] = None
    note: Optional[str] = None
    tags: Optional[List[str]] = None

class LogbookEntry(LogbookCreate):
    id: str
    timestamp: int

# ----------------- Cash Flow & Dashboard -----------------
class CashFlowPeriod(BaseModel):
    period: str
    income: float
    expense: float
    net: float

class DashboardResponse(BaseModel):
    totalIncome: float
    totalExpenses: float
    netCashFlow: float
    expenseRatio: float
    healthScore: FinancialHealthResponse
    detectedRisks: List[DetectedRisk]
    finance: FinancePlanResponse
    cashFlowTrend: List[CashFlowPeriod]
    recentEntries: List[LogbookEntry]

# ----------------- Business Advisor (RAG + Gemini) -----------------
class MarketReach(BaseModel):
    headline: str
    details: str
    targetSegment: str
    estimatedLocalDemand: str

class OpportunityAnalysis(BaseModel):
    overview: str
    primaryDrivers: List[str]
    seasonalOpportunity: str

class SWOTAnalysis(BaseModel):
    strengths: List[str]
    weaknesses: List[str]
    opportunities: List[str]
    threats: List[str]

class CompetitorDensity(BaseModel):
    densityLevel: Literal["Low", "Moderate", "High"]
    description: str
    mitigationStrategy: str

class PricingSuggestion(BaseModel):
    recommendedBand: str
    benchmarkComparison: str
    marginTarget: str

class GroundedFacts(BaseModel):
    district: str
    category: str
    benchmarkOpex: List[Dict[str, Any]] = []

class AdvisorAnalyzeRequest(BaseModel):
    location: str
    category: str
    marginCapital: float = 100000.0
    language: str = "en"
    userQuery: Optional[str] = None
    history: Optional[List[ChatMessage]] = Field(default_factory=list)

class AdvisorAnalyzeResponse(BaseModel):
    reply: Optional[str] = None
    marketReach: MarketReach
    opportunityAnalysis: OpportunityAnalysis
    swot: SWOTAnalysis
    competitorDensity: CompetitorDensity
    pricingSuggestion: PricingSuggestion
    risks: List[str]
    assumptions: List[str]
    groundedFacts: GroundedFacts
    sourcesUsed: List[str]
    providerUsed: str

# ----------------- Unified Lender-Ready Business Plan -----------------
class MonthlyCashFlowItem(BaseModel):
    month: int
    monthName: str
    projectedRevenue: float
    projectedExpense: float
    netOperatingIncome: float
    debtService: float
    netCashFlow: float
    closingCashBalance: float

class DscrAnalysis(BaseModel):
    dscrValue: float
    annualNetOperatingIncome: float
    annualDebtService: float
    isHealthy: bool
    benchmark: str = "Minimum 1.20x required by commercial banks & MFIs"
    interpretation: str
    interpretationTe: str

class GuaranteeCoverageInfo(BaseModel):
    schemeName: str
    guaranteeAgency: str
    coveragePercent: float
    isCollateralFree: bool = True
    statutoryBacking: str
    plainLanguageExplanation: str
    plainLanguageExplanationTe: str

class CapitalAllocationItem(BaseModel):
    item: str
    itemTe: str
    amount: float
    percentage: float
    category: Literal["capex", "working_capital", "contingency"]

class SupportingDocument(BaseModel):
    id: str
    name: str
    nameTe: str
    importance: Literal["Mandatory", "Conditional", "Recommended"]
    description: str
    descriptionTe: str

class BusinessPlanRequest(BaseModel):
    entrepreneurName: Optional[str] = "Anita Sharma"
    businessName: Optional[str] = "Sharma Dairy Farm"
    location: str = "Warangal, Telangana"
    category: str = "Dairy Farming"
    gender: str = "female"
    socialCategory: str = "OBC"
    isNewEnterprise: bool = True
    marginCapital: float = 100000.0
    loanAmount: Optional[float] = None
    projectCost: Optional[float] = None
    selectedSchemeId: Optional[str] = None
    monthlyRevenueEstimate: Optional[float] = None
    monthlyExpenseEstimate: Optional[float] = None
    businessAdvisorSummary: Optional[str] = None
    language: str = "en"

class BusinessPlanResponse(BaseModel):
    enterpriseName: str
    entrepreneurName: str
    location: str
    category: str
    gender: str
    socialCategory: str
    isNewEnterprise: bool
    generatedDate: str
    executiveSummary: str
    executiveSummaryTe: Optional[str] = None
    marketOpportunitySummary: str
    marketOpportunitySummaryTe: Optional[str] = None
    localDemandDrivers: List[str]
    seasonalAdvice: str
    totalProjectCost: float
    promoterMargin: float
    promoterMarginPercent: float
    requestedLoanAmount: float
    selectedSchemeId: str
    selectedSchemeName: str
    selectedSchemeNameTe: str
    interestRateAnnual: float
    subsidyPercent: Optional[float] = None
    subsidyAmount: Optional[float] = None
    tenureYears: float
    moratoriumMonths: int
    monthlyEmi: float
    quarterlyEmi: float
    capitalAllocations: List[CapitalAllocationItem]
    cashFlowForecast: List[MonthlyCashFlowItem]
    dscr: DscrAnalysis
    guaranteeInfo: GuaranteeCoverageInfo
    documentChecklist: List[SupportingDocument]
    riskMitigations: List[str]
    riskMitigationsTe: List[str]
    providerUsed: str

# ----------------- Health -----------------
class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "RuralCred Advisor FastAPI Backend"
    version: str = "1.0.0"
    ai_provider: str = "Google Gemini (gemini-2.5-flash)"
    vector_store: str = "ChromaDB (ruralcred_knowledge)"
    chromadb_connected: bool = False
    chromadb_documents: int = 0
    gemini_configured: bool = False
    active_mode: str = "Live Gemini + ChromaDB RAG"

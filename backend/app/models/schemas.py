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

class AdvisorAnalyzeResponse(BaseModel):
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

# ----------------- Health -----------------
class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "RuralCred Advisor FastAPI Backend"
    version: str = "1.0.0"
    chromadb_connected: bool = False
    gemini_configured: bool = False

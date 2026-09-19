from typing import List, Optional
from app.models.schemas import DetectedRisk, RiskAnalysisResponse

def evaluate_financial_risks(
    has_active_loan: bool,
    simulating_second_loan: bool,
    total_income: float,
    total_expenses: float,
    net_cash_flow: float,
    previous_net_cash_flow: Optional[float] = None,
) -> RiskAnalysisResponse:
    """
    Deterministic Risk Engine: Evaluates invariant financial rules.
    Python code decides if a risk exists; LLM only explains an already detected risk.
    """
    detected_risks: List[DetectedRisk] = []

    # Rule 1: Over-Leverage Risk (Active loan present while seeking 2nd loan)
    if has_active_loan and simulating_second_loan:
        detected_risks.append(
            DetectedRisk(
                ruleCode="RULE_1",
                riskType="active_loan_multiple",
                severity="alert",
                title="Over-Leverage Risk Detected",
                titleTe="అధిక రుణ భారం హెచ్చరిక (Rule 1)",
                reason="User currently carries an active loan while simulating/requesting a second credit line. Debt service coverage ratio may be strained.",
                reasonTe="ప్రస్తుతం క్రియాశీల రుణం ఉండగా రెండవ రుణాన్ని కోరుతున్నారు. రెండు రుణాల వాయిదాల చెల్లింపు కష్టం కావచ్చు.",
                metrics={
                    "hasActiveLoan": True,
                    "simulatingSecondLoan": True,
                },
            )
        )

    # Rule 2: Negative Net Cash Flow (Total expenses > Total income)
    if net_cash_flow < 0:
        deficit = abs(net_cash_flow)
        detected_risks.append(
            DetectedRisk(
                ruleCode="RULE_2",
                riskType="negative_cash_flow",
                severity="alert",
                title="Negative Cash Flow Alert",
                titleTe="నగదు లోటు హెచ్చరిక (Rule 2)",
                reason=f"Operating expenses exceed incoming receipts by ₹{deficit:,.0f}. Enterprise is running an operational cash deficit.",
                reasonTe=f"ఖర్చులు ఆదాయాన్ని మించాయి (లోటు: ₹{deficit:,.0f}). వ్యాపార నిర్వహణకు నగదు కొరత ఉంది.",
                metrics={
                    "totalIncome": total_income,
                    "totalExpenses": total_expenses,
                    "netCashFlow": net_cash_flow,
                    "deficit": deficit,
                },
            )
        )

    # Rule 3: Downward Net Cash Flow Trend
    if previous_net_cash_flow is not None and previous_net_cash_flow > 0:
        if net_cash_flow < (previous_net_cash_flow * 0.70):
            drop_pct = round(((previous_net_cash_flow - net_cash_flow) / previous_net_cash_flow) * 100)
            detected_risks.append(
                DetectedRisk(
                    ruleCode="RULE_3",
                    riskType="downward_profit_trend",
                    severity="warning",
                    title="Downward Cash Flow Trend",
                    titleTe="నగదు ప్రవాహం క్షీణత (Rule 3)",
                    reason=f"Net monthly cash flow dropped by {drop_pct}% compared to prior interval (from ₹{previous_net_cash_flow:,.0f} to ₹{net_cash_flow:,.0f}).",
                    reasonTe=f"గత నెలతో పోలిస్తే నికర నగదు ప్రవాహం {drop_pct}% తగ్గింది.",
                    metrics={
                        "previousNet": previous_net_cash_flow,
                        "currentNet": net_cash_flow,
                        "dropPercentage": drop_pct,
                    },
                )
            )

    return RiskAnalysisResponse(
        detectedRisks=detected_risks,
        isSafe=len(detected_risks) == 0,
        activeCount=len(detected_risks),
    )

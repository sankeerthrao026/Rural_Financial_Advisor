'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import schemesData from '@/data/schemes.json';
import { formatINR } from '@/lib/utils/currency';
import { ShieldCheck, ArrowRight, Percent, Calendar, IndianRupee, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SchemeMatchingScreen({ setActive }: { setActive?: (tab: string) => void }) {
  const { finance, language } = useApp();
  const isTe = language === 'te';

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border bg-card p-6 shadow-xs hover-lift transition-all">
        <h2 className="text-xl font-bold font-sora tracking-tight text-foreground">
          {isTe ? 'అధికారిక ప్రభుత్వ రుణ పథకాలు' : 'Authentic Government Credit Schemes'}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
          {isTe
            ? 'గ్రామీణ సూక్ష్మ మరియు చిన్న పరిశ్రమల కోసం అందుబాటులో ఉన్న నిజమైన కేంద్ర మరియు రాష్ట్ర ప్రభుత్వ ఆర్థిక పథకాలు.'
            : 'Pre-vetted statutory schemes offered through NBCFDC, MUDRA, SIDBI, and state channelising agencies with subsidized interest.'}
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {schemesData.schemes.map((scheme: any, idx: number) => {
          const isCurrentlyRouted = scheme.id === finance.scheme.id;

          return (
            <div
              key={scheme.id}
              className={`stagger-${Math.min(idx + 1, 6)} hover-lift rounded-2xl border p-6 flex flex-col justify-between shadow-xs transition-all ${
                isCurrentlyRouted
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                  : 'bg-card hover:border-primary/40'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {isCurrentlyRouted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2.5 py-0.5 text-[10px] font-bold mb-2">
                        <ShieldCheck className="size-3" />
                        {isTe ? 'ప్రస్తుత ప్రొఫైల్‌కు వర్తించిన పథకం' : 'Routed for your capital'}
                      </span>
                    )}
                    <h3 className="font-bold font-sora text-base text-foreground">{scheme.name}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{scheme.agency}</p>
                  </div>
                </div>

                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                  {scheme.description}
                </p>

                <div className="mt-4 grid grid-cols-3 gap-2 border-y py-3 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">{isTe ? 'వడ్డీ రేటు' : 'Interest Rate'}</span>
                    <span className="font-bold font-sora text-foreground mt-0.5 block">{scheme.interestRate}% {isTe ? 'సం.' : 'p.a.'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">{isTe ? 'కాలపరిమితి' : 'Tenure'}</span>
                    <span className="font-bold font-sora text-foreground mt-0.5 block">{scheme.tenureYears} {isTe ? 'సంవత్సరాలు' : 'Years'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">{isTe ? 'మారటోరియం' : 'Moratorium'}</span>
                    <span className="font-bold font-sora text-foreground mt-0.5 block">{scheme.moratoriumMonths} {isTe ? 'నెలలు' : 'Months'}</span>
                  </div>
                </div>

                <div className="mt-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{isTe ? 'అర్హత:' : 'Eligibility:'}</span>{' '}
                  {scheme.eligibility}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  {isTe ? 'గరిష్ట పరిమితి:' : 'Max Limit:'} {formatINR(scheme.maxProjectCost)}
                </span>
                <Button
                  variant={isCurrentlyRouted ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActive?.('Finance Advisor')}
                  className="text-xs"
                >
                  {isCurrentlyRouted
                    ? (isTe ? 'ఫైనాన్స్ ఇంజిన్‌లో చూడండి' : 'View In Finance Engine')
                    : (isTe ? 'అడ్వైజర్‌లో లెక్కించండి' : 'Simulate in Advisor')}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

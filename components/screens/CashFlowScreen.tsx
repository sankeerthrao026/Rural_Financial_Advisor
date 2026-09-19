'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import { formatINR } from '@/lib/utils/currency';
import { DigitalLogbookScreen } from './DigitalLogbookScreen';

export function CashFlowScreen() {
  return <DigitalLogbookScreen />;
}

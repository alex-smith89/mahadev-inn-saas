// src/context/BranchDataContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface BranchData {
  bookings: any[];
  stats: any;
  notifications: any[];
  branchInfo: any;
  lastUpdated: string;
}

interface BranchDataContextType {
  branchData: BranchData;
  setBranchData: (data: BranchData) => void;
  refreshBranchData: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  lastRefreshed: string;
  selectedBranch: string;
  setSelectedBranch: (branch: string) => void;
}

const BranchDataContext = createContext<BranchDataContextType | undefined>(undefined);

export function BranchDataProvider({ children }: { children: React.ReactNode }) {
  const [branchData, setBranchData] = useState<BranchData>({
    bookings: [],
    stats: {},
    notifications: [],
    branchInfo: null,
    lastUpdated: new Date().toISOString()
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date().toISOString());
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  useEffect(() => {
    // Load selected branch from localStorage
    const savedBranch = localStorage.getItem('selectedBranch');
    if (savedBranch) {
      setSelectedBranch(savedBranch);
    }
  }, []);

  const refreshBranchData = () => {
    setLastRefreshed(new Date().toISOString());
    window.dispatchEvent(new CustomEvent('refreshBranchData'));
  };

  return (
    <BranchDataContext.Provider value={{
      branchData,
      setBranchData,
      refreshBranchData,
      isLoading,
      setIsLoading,
      lastRefreshed,
      selectedBranch,
      setSelectedBranch
    }}>
      {children}
    </BranchDataContext.Provider>
  );
}

export function useBranchData() {
  const context = useContext(BranchDataContext);
  if (context === undefined) {
    throw new Error('useBranchData must be used within a BranchDataProvider');
  }
  return context;
}
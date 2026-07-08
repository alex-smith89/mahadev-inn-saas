// src/context/BranchContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface BranchContextType {
  selectedBranch: string;
  setSelectedBranch: (branch: string) => void;
  branches: string[];
  setBranches: (branches: string[]) => void;
  refreshData: () => void;
  triggerRefresh: () => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [branches, setBranches] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load from localStorage on mount
  useEffect(() => {
    const savedBranch = localStorage.getItem('selectedBranch');
    if (savedBranch) {
      setSelectedBranch(savedBranch);
    }
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    if (selectedBranch) {
      localStorage.setItem('selectedBranch', selectedBranch);
    }
  }, [selectedBranch]);

  const triggerRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <BranchContext.Provider value={{
      selectedBranch,
      setSelectedBranch,
      branches,
      setBranches,
      refreshData: triggerRefresh,
      triggerRefresh,
    }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
}
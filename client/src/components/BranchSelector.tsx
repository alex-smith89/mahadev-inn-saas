// src/components/BranchSelector.tsx
'use client';

import { useBranchData } from '@/context/BranchDataContext';

interface BranchSelectorProps {
  branches: string[];
  onBranchChange?: (branch: string) => void;
}

export function BranchSelector({ branches, onBranchChange }: BranchSelectorProps) {
  const { selectedBranch, setSelectedBranch, refreshBranchData } = useBranchData();

  const handleBranchChange = (branch: string) => {
    setSelectedBranch(branch);
    localStorage.setItem('selectedBranch', branch);
    if (onBranchChange) {
      onBranchChange(branch);
    }
    refreshBranchData();
  };

  return (
    <select
      value={selectedBranch || (branches.length > 0 ? branches[0] : '')}
      onChange={(e) => handleBranchChange(e.target.value)}
      className="text-sm border-2 border-indigo-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium text-gray-700 hover:border-indigo-400 cursor-pointer shadow-sm"
    >
      {branches.map((branch) => (
        <option key={branch} value={branch}>
          🏨 {branch}
        </option>
      ))}
    </select>
  );
}
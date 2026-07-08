// src/components/BranchFilter.tsx
'use client';

import { useBranch } from '@/context/BranchContext';

export function BranchFilter() {
  const { selectedBranch, setSelectedBranch, branches } = useBranch();

  const handleBranchChange = (branch: string) => {
    setSelectedBranch(branch);
    localStorage.setItem('selectedBranch', branch);
    // Trigger refresh
    window.dispatchEvent(new Event('forceRefresh'));
  };

  return (
    <select
      value={selectedBranch}
      onChange={(e) => handleBranchChange(e.target.value)}
      className="text-sm border-2 border-indigo-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium text-gray-700"
    >
      {branches.map((branch) => (
        <option key={branch} value={branch}>
          🏨 {branch}
        </option>
      ))}
    </select>
  );
}
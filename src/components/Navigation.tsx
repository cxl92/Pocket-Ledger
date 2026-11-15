import React from 'react';
import type { User } from 'firebase/auth';
import {
  BarChart3,
  BookOpen,
  LogIn,
  LogOut,
  Plus,
  Settings,
  Wallet,
} from 'lucide-react';
import type { TabId } from '../types/ledger';

interface NavigationProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  onAddEntry: () => void;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

const NAV_ITEMS: {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'ledger', label: 'Ledger', icon: BookOpen },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'accounts', label: 'Accounts', icon: Wallet },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const TopBar: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  onAddEntry,
  user,
  onSignIn,
  onSignOut,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#ffffff]/95 dark:bg-[#17211d]/95 backdrop-blur-md border-b border-[#dce2de] dark:border-[#27342e]">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4 lg:gap-8">
        {/* Zone 1: App Logo */}
        <button
          type="button"
          onClick={() => onSelectTab('ledger')}
          aria-label="Pocket Ledger home"
          className="flex items-center gap-3 shrink-0 cursor-pointer rounded-lg py-1 focus-visible:outline-2 focus-visible:outline-[#1d4e89]"
        >
          <svg
            className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 block rounded-[9px] dark:ring-1 dark:ring-white/15"
            viewBox="0 0 120 120"
            role="img"
            aria-hidden="true"
          >
            <rect width="120" height="120" rx="27" fill="#0B3D2E" />
            <g
              transform="translate(60 60) scale(.84) translate(-62 -60)"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="11"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M84 96H40V24H62A19 19 0 0 1 62 62H40" />
              <circle cx="72" cy="79" r="5.5" fill="#FFFFFF" stroke="none" />
            </g>
          </svg>
          <span className="flex flex-col items-start gap-1 text-left">
            <span className="text-[19px] sm:text-[22px] leading-none tracking-[-0.03em] text-[#0B3D2E] dark:text-[#e6eee9] whitespace-nowrap">
              <span className="font-bold">Pocket</span>{' '}
              <span className="font-normal">Ledger</span>
            </span>
            <span className="text-[8px] sm:text-[9px] font-medium leading-none tracking-[0.28em] uppercase text-[#3F6B5A] dark:text-[#8fbba8] pl-[1px] whitespace-nowrap">
              Track. Save. Grow.
            </span>
          </span>
        </button>

        {/* Zone 2: Horizontal Navigation Links (Desktop / Tablet) */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 lg:gap-8"
        >
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative min-h-[44px] px-1 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center ${
                  active
                    ? 'text-[#1d4e89] dark:text-[#86b4ee] font-semibold'
                    : 'text-[#5b6962] dark:text-[#8fa097] hover:text-[#14201c] dark:hover:text-[#e6eee9]'
                }`}
              >
                <span>{item.label}</span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#1d4e89] dark:bg-[#86b4ee]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Account Sync & Primary CTA */}
        <div className="flex items-center gap-4 shrink-0">
          {user ? (
            <button
              type="button"
              onClick={onSignOut}
              title={user.email || user.displayName || 'Signed in'}
              className="min-h-[40px] px-2.5 text-xs font-medium text-[#5b6962] dark:text-[#8fa097] hover:text-[#14201c] dark:hover:text-[#e6eee9] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Sign out</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="min-h-[40px] px-2.5 text-xs font-medium text-[#5b6962] dark:text-[#8fa097] hover:text-[#14201c] dark:hover:text-[#e6eee9] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5 shrink-0" />
              <span>Sign in</span>
            </button>
          )}

          <button
            type="button"
            onClick={onAddEntry}
            className="hidden md:inline-flex min-h-[40px] px-4 py-2 rounded-xl bg-[#1d4e89] hover:bg-[#173f70] dark:bg-[#86b4ee] dark:hover:bg-[#9ec3f2] text-white dark:text-[#0b1a2e] font-semibold text-sm items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Add entry</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export const MobileNav: React.FC<
  Pick<NavigationProps, 'activeTab' | 'onSelectTab' | 'onAddEntry'>
> = ({ activeTab, onSelectTab, onAddEntry }) => {
  return (
    <>
      <div className="md:hidden fixed right-4 bottom-[74px] z-20 pointer-events-none">
        <button
          type="button"
          onClick={onAddEntry}
          aria-label="Add entry"
          className="pointer-events-auto min-h-[48px] px-5 rounded-full bg-[#1d4e89] hover:bg-[#173f70] dark:bg-[#86b4ee] dark:text-[#0b1a2e] text-white font-semibold text-sm shadow-lg shadow-black/20 flex items-center gap-2 active:scale-[0.98] transition-transform cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Add entry</span>
        </button>
      </div>

      <nav
        aria-label="Mobile sections"
        className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-[#ffffff]/95 dark:bg-[#17211d]/95 backdrop-blur-md border-t border-[#dce2de] dark:border-[#27342e] px-2 pb-[env(safe-area-inset-bottom,0px)]"
      >
        <div className="max-w-xl mx-auto grid grid-cols-4 gap-1 py-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`min-h-[48px] rounded-lg flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'text-[#1d4e89] dark:text-[#86b4ee] bg-[#e7ece9] dark:bg-[#202d27] font-semibold'
                    : 'text-[#5b6962] dark:text-[#8fa097]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

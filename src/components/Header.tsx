'use client'
import React from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { useTheme } from 'next-themes'
import { Moon, Sun, Monitor, LogOut, User } from 'lucide-react'

// Theme Toggle Component
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
      className="text-white hover:bg-white/10 transition-colors"
    >
      {theme === 'dark' ? (
        <Moon className="h-4 w-4" />
      ) : theme === 'light' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Monitor className="h-4 w-4" />
      )}
    </Button>
  );
}

interface HeaderProps {
  showBackButton?: boolean;
  onBackClick?: () => void;
  title?: string;
  subtitle?: string;
}

export default function Header({ showBackButton = false, onBackClick, title, subtitle }: HeaderProps) {
  const { data: session } = useSession();

  const handleLogout = () => {
    signOut({ callbackUrl: '/' });
  };

  return (
    <header className="bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-800 dark:to-indigo-900 text-white p-4 shadow-lg">
      <nav className="container mx-auto flex flex-col lg:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          {showBackButton && onBackClick && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackClick}
              className="text-white hover:bg-white/10"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </Button>
          )}
          
          <div className="text-xl lg:text-2xl font-bold bg-white/10 dark:bg-white/20 rounded-md px-3 py-1 backdrop-blur-sm">
            NRGTech
          </div>
          
          {title && (
            <div>
              <h1 className="text-2xl font-bold">{title}</h1>
              {subtitle && <p className="text-blue-100 dark:text-blue-200 text-sm">{subtitle}</p>}
            </div>
          )}
        </div>

        {!title && (
          <div className="text-lg lg:text-2xl font-semibold text-center">
            AUTOMATED P&ID PARTS COUNT
          </div>
        )}

        <div className="flex items-center gap-4">
          {!showBackButton && (
            <ul className="flex space-x-4 lg:space-x-6 text-sm lg:text-lg">
              <li><a href="#" className="hover:text-blue-200 dark:hover:text-blue-300 transition-colors">Home</a></li>
              <li><a href="#" className="hover:text-blue-200 dark:hover:text-blue-300 transition-colors">About</a></li>
              <li><a href="#" className="hover:text-blue-200 dark:hover:text-blue-300 transition-colors">Contact</a></li>
            </ul>
          )}
          
          {session?.user && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4" />
                <span className="hidden md:inline">{session.user.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-white hover:bg-white/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline ml-1">Logout</span>
              </Button>
            </div>
          )}
          
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
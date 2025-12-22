"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useVault } from "@/app/components/providers/VaultProvider";
import { decryptItem } from "@/lib/crypto";
import { buildMetadataFromDecrypted } from "@/lib/secret-utils";

import type { Metadata } from "@/lib/secret-utils";

interface PasswordItem {
  id: string;
  secretType: string;
  title: string;
  username?: string;
  metadata?: Metadata | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const { vaultKey, isUnlocked } = useVault();
  const [items, setItems] = useState<PasswordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const fetchInProgressRef = useRef(false);

  const handleLogout = async () => {
    try {
      await fetch("/logout", { method: "POST" });
      router.push("/");
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  useEffect(() => {
    if (!isUnlocked || fetchInProgressRef.current) return;

    fetchInProgressRef.current = true;

    async function fetchItems() {
      try {
        const res = await fetch("/api/passwords");
        if (!res.ok) throw new Error("Failed to fetch");
        const encryptedItems = await res.json();

        const decryptedItems = await Promise.all(
          encryptedItems.map(async (item: {
            id: string;
            encryptedData?: string;
            iv?: string;
            secretType?: string;
            metadata?: unknown;
          }) => {
            try {
              // Validate that required fields exist
              if (!item.encryptedData || !item.iv) {
                throw new Error('Missing encryptedData or iv');
              }
              const data = await decryptItem<Record<string, unknown>>(item.encryptedData, item.iv, vaultKey!);
              
              // Use metadata if available, otherwise build from decrypted data (backward compatibility)
              let metadata = item.metadata as Metadata | null | undefined;
              if (!metadata) {
                metadata = buildMetadataFromDecrypted(data);
              }
              
              return { 
                id: item.id, 
                secretType: item.secretType || 'PASSWORD',
                title: metadata?.title || (typeof data.title === 'string' ? data.title : 'Untitled'),
                username: metadata && 'username' in metadata ? metadata.username : (typeof (data as Record<string, unknown>).username === 'string' ? (data as Record<string, unknown>).username : undefined),
                metadata
              };
            } catch (e) {
              console.error("Failed to decrypt item", item.id, e);
              return { 
                id: item.id, 
                secretType: 'PASSWORD',
                title: "Error decrypting", 
                metadata: null 
              };
            }
          })
        );

        setItems(decryptedItems);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        fetchInProgressRef.current = false;
      }
    }

    fetchItems();
  }, [isUnlocked, vaultKey]);

  // Filter items based on search query
  const filteredItems = items.filter(item => {
    const query = searchQuery.toLowerCase();
    const titleMatch = item.title.toLowerCase().includes(query);
    const usernameMatch = item.username?.toLowerCase().includes(query);
    const serviceMatch = item.secretType === 'API_KEY' && 
                        item.metadata && 
                        'serviceName' in item.metadata && 
                        String(item.metadata.serviceName).toLowerCase().includes(query);
    return titleMatch || usernameMatch || serviceMatch;
  });

  if (!isUnlocked) return null; // Or loading spinner

  return (
    <div className="min-h-screen bg-[#2b2d42]">
      {/* Top Navigation Bar */}
      <nav className="border-b border-[rgba(141,153,174,0.1)] bg-[rgba(0,0,0,0.2)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-300 items-center justify-between px-6">
          {/* Logo/Brand */}
          <div className="flex items-center gap-8">
            <Link 
              href="/dashboard"
              className="text-xl font-bold text-white no-underline"
            >
              Vaultr
            </Link>
          </div>

          {/* Navigation Links & Actions */}
          <div className="flex items-center gap-4">
            {/* Add Item Button with Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="flex items-center gap-2 rounded-md bg-[#8d99ae] px-4 py-2 text-sm font-semibold text-[#2b2d42] transition-opacity duration-200 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#8d99ae]/60 focus:ring-offset-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Item
              </button>

              {/* Dropdown Menu */}
              {showAddMenu && (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-50 rounded-lg border border-[rgba(141,153,174,0.35)] bg-[rgba(43,45,66,0.9)] p-2 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                  <Link 
                    href="/secrets/passwords/new"
                    className="block rounded-md px-4 py-3 text-sm text-white transition-colors duration-200 hover:bg-[rgba(141,153,174,0.1)]"
                  >
                    🔑 Password
                  </Link>
                  <Link 
                    href="/secrets/api-keys/new"
                    className="block rounded-md px-4 py-3 text-sm text-white transition-colors duration-200 hover:bg-[rgba(141,153,174,0.1)]"
                  >
                    🔐 API Key
                  </Link>
                  <Link 
                    href="/secrets/env-vars/new"
                    className="block rounded-md px-4 py-3 text-sm text-white transition-colors duration-200 hover:bg-[rgba(141,153,174,0.1)]"
                  >
                    ⚙️ Environment Variables
                  </Link>
                </div>
              )}
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="rounded-md border border-[rgba(141,153,174,0.3)] px-4 py-2 text-sm font-medium text-[rgba(141,153,174,0.8)] transition-all duration-200 hover:bg-[rgba(141,153,174,0.1)] hover:text-[#8d99ae] focus:outline-none focus:ring-2 focus:ring-[rgba(141,153,174,0.4)]"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="mx-auto max-w-300 px-6 py-8">
        {/* Search Bar and View Toggle */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="relative min-w-75 max-w-150 flex-1">
            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(141,153,174,0.5)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search your vault..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[rgba(141,153,174,0.2)] bg-[rgba(0,0,0,0.3)] px-12 py-3 text-[0.938rem] text-white outline-none transition-colors duration-200 placeholder:text-[rgba(141,153,174,0.5)] focus:border-[rgba(141,153,174,0.6)]"
            />
          </div>
          
          {/* View Toggle Buttons */}
          <div className="flex rounded-lg border border-[rgba(141,153,174,0.2)] bg-[rgba(0,0,0,0.3)] p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 ${viewMode === 'grid' ? 'bg-[rgba(141,153,174,0.2)] text-[#8d99ae]' : 'text-[rgba(141,153,174,0.6)]'}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 ${viewMode === 'list' ? 'bg-[rgba(141,153,174,0.2)] text-[#8d99ae]' : 'text-[rgba(141,153,174,0.6)]'}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              List
            </button>
          </div>
        </div>

        {/* Vault Items */}
        {loading ? (
          <div className="py-24 text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-[3px] border-[rgba(141,153,174,0.2)] border-t-[#8d99ae]" />
            <p className="text-[0.938rem] text-[rgba(255,255,255,0.6)]">
              Loading your vault...
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-24 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(141,153,174,0.1)]">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8d99ae" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-semibold text-white">
              {searchQuery ? 'No items found' : 'Your vault is empty'}
            </h2>
            <p className="mb-8 text-[0.938rem] text-[rgba(141,153,174,0.8)]">
              {searchQuery 
                ? 'Try adjusting your search query'
                : 'Add your first password, API key, or environment variable to get started'
              }
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowAddMenu(true)}
                className="rounded-lg bg-[#8d99ae] px-6 py-3 text-[0.938rem] font-semibold text-[#2b2d42] transition-opacity duration-200 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#8d99ae]/60"
              >
                Add Your First Item
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5">
            {filteredItems.map(item => {
              // Determine link based on secret type
              let detailLink = `/secrets/passwords/${item.id}`;
              let typeLabel = 'PASSWORD';
              let typeIcon = '🔑';
              
              if (item.secretType === 'API_KEY') {
                detailLink = `/secrets/api-keys/${item.id}`;
                typeLabel = 'API KEY';
                typeIcon = '🔐';
              } else if (item.secretType === 'ENV_VARS') {
                detailLink = `/secrets/env-vars/${item.id}`;
                typeLabel = 'ENV VARS';
                typeIcon = '⚙️';
              }
              
              return (
                <div 
                  key={item.id} 
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(detailLink)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(detailLink);
                    }
                  }}
                  className="group flex cursor-pointer flex-col rounded-xl border border-[rgba(141,153,174,0.2)] bg-[rgba(0,0,0,0.2)] p-5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[rgba(141,153,174,0.5)] hover:border-[rgba(141,153,174,0.5)]"
                >
                  {/* Header with Title and Type Badge */}
                  <div className="mb-3 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="mb-1 overflow-hidden text-ellipsis whitespace-nowrap text-lg font-semibold text-white">
                        {item.title}
                      </h3>
                    </div>
                    <span className="rounded bg-[rgba(141,153,174,0.15)] px-2.5 py-1 text-[0.688rem] font-semibold tracking-[0.5px] text-[#8d99ae]">
                      {typeIcon} {typeLabel}
                    </span>
                  </div>
                  
                  {/* Metadata */}
                  <div className="mb-4 flex-1 space-y-2">
                    {item.username && (
                      <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.875rem] text-[rgba(141,153,174,0.8)]">
                        {item.username}
                      </p>
                    )}
                    {item.secretType === 'API_KEY' && item.metadata && 'serviceName' in item.metadata && (
                      <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.875rem] text-[rgba(141,153,174,0.8)]">
                        {String(item.metadata.serviceName)}
                      </p>
                    )}
                    {item.secretType === 'ENV_VARS' && item.metadata && 'variableCount' in item.metadata && (
                      <p className="text-[0.875rem] text-[rgba(141,153,174,0.8)]">
                        {item.metadata.variableCount} variable{item.metadata.variableCount !== 1 ? 's' : ''}
                      </p>
                    )}
                    
                    {/* Hidden password indicator */}
                    {(item.secretType === 'PASSWORD' || item.secretType === 'API_KEY') && (
                      <p className="mt-2 font-mono text-[0.875rem] tracking-[2px] text-[rgba(141,153,174,0.5)]">
                        ••••••••
                      </p>
                    )}
                  </div>
                  
                  {/* Action Button */}
                  <Link 
                    href={detailLink}
                    className="view-link ml-auto inline-flex items-center gap-[0.35rem] text-sm font-semibold text-[#8d99ae] transition-transform duration-200 group-hover:translate-x-1 group-hover:scale-[1.02]"
                  >
                    <span className="tracking-[0.3px]">View Details</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredItems.map(item => {
              // Determine link based on secret type
              let detailLink = `/secrets/passwords/${item.id}`;
              let typeLabel = 'PASSWORD';
              let typeIcon = '🔑';
              
              if (item.secretType === 'API_KEY') {
                detailLink = `/secrets/api-keys/${item.id}`;
                typeLabel = 'API KEY';
                typeIcon = '🔐';
              } else if (item.secretType === 'ENV_VARS') {
                detailLink = `/secrets/env-vars/${item.id}`;
                typeLabel = 'ENV VARS';
                typeIcon = '⚙️';
              }
              
              return (
                <div 
                  key={item.id} 
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(detailLink)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(detailLink);
                    }
                  }}
                  className="group flex cursor-pointer items-center gap-5 rounded-lg border border-[rgba(141,153,174,0.2)] bg-[rgba(0,0,0,0.2)] p-5 transition-all duration-200 hover:border-[rgba(141,153,174,0.5)] hover:bg-[rgba(0,0,0,0.3)] focus:outline-none focus:ring-2 focus:ring-[rgba(141,153,174,0.5)]"
                >
                  {/* Type Badge */}
                  <div className="flex h-12 w-12 min-w-12 items-center justify-center rounded-lg bg-[rgba(141,153,174,0.15)] text-xl">
                    {typeIcon}
                  </div>
                  
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-3">
                      <h3 className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-base font-semibold text-white">
                        {item.title}
                      </h3>
                      <span className="rounded bg-[rgba(141,153,174,0.15)] px-2 py-0.5 text-[0.625rem] font-semibold tracking-[0.5px] text-[#8d99ae]">
                        {typeLabel}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4">
                      {item.username && (
                        <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.813rem] text-[rgba(141,153,174,0.8)]">
                          {item.username}
                        </p>
                      )}
                      {item.secretType === 'API_KEY' && item.metadata && 'serviceName' in item.metadata && (
                        <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.813rem] text-[rgba(141,153,174,0.8)]">
                          {String(item.metadata.serviceName)}
                        </p>
                      )}
                      {item.secretType === 'ENV_VARS' && item.metadata && 'variableCount' in item.metadata && (
                        <p className="text-[0.813rem] text-[rgba(141,153,174,0.8)]">
                          {item.metadata.variableCount} variable{item.metadata.variableCount !== 1 ? 's' : ''}
                        </p>
                      )}
                      
                      {/* Hidden password indicator */}
                      {(item.secretType === 'PASSWORD' || item.secretType === 'API_KEY') && (
                        <p className="font-mono text-[0.813rem] tracking-[2px] text-[rgba(141,153,174,0.5)]">
                          ••••••••
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Button */}
                  <Link 
                    href={detailLink}
                    className="view-link inline-flex items-center gap-[0.35rem] whitespace-nowrap text-sm font-semibold text-[#8d99ae] transition-transform duration-200 group-hover:translate-x-1 group-hover:scale-[1.02]"
                  >
                    <span className="tracking-[0.3px]">View Details</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

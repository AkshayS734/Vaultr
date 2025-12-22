"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useVault } from "@/components/VaultProvider";
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
    <div style={{ minHeight: '100vh', backgroundColor: '#2b2d42' }}>
      {/* Top Navigation Bar */}
      <nav style={{ 
        backgroundColor: 'rgba(0,0,0,0.2)', 
        borderBottom: '1px solid rgba(141,153,174,0.1)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          padding: '0 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px'
        }}>
          {/* Logo/Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <Link 
              href="/dashboard"
              style={{ 
                fontSize: '1.25rem', 
                fontWeight: '700',
                color: '#ffffff',
                textDecoration: 'none'
              }}
            >
              Vaultr
            </Link>
          </div>

          {/* Navigation Links & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Add Item Button with Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#8d99ae',
                  color: '#2b2d42',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Item
              </button>

              {/* Dropdown Menu */}
              {showAddMenu && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 0.5rem)',
                  right: '0',
                  backgroundColor: 'rgba(43,45,66,0.9)',
                  border: '1px solid rgba(141,153,174,0.35)',
                  borderRadius: '8px',
                  padding: '0.5rem',
                  minWidth: '200px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  zIndex: 50
                }}>
                  <Link 
                    href="/passwords/new"
                    style={{
                      display: 'block',
                      padding: '0.75rem 1rem',
                      color: '#ffffff',
                      textDecoration: 'none',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(141,153,174,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    🔑 Password
                  </Link>
                  <Link 
                    href="/api-keys/new"
                    style={{
                      display: 'block',
                      padding: '0.75rem 1rem',
                      color: '#ffffff',
                      textDecoration: 'none',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(141,153,174,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    🔐 API Key
                  </Link>
                  <Link 
                    href="/env-vars/new"
                    style={{
                      display: 'block',
                      padding: '0.75rem 1rem',
                      color: '#ffffff',
                      textDecoration: 'none',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(141,153,174,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    ⚙️ Environment Variables
                  </Link>
                </div>
              )}
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'transparent',
                color: 'rgba(141,153,174,0.8)',
                border: '1px solid rgba(141,153,174,0.3)',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(141,153,174,0.1)';
                e.currentTarget.style.color = '#8d99ae';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'rgba(141,153,174,0.8)';
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Search Bar and View Toggle */}
        <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ 
            position: 'relative',
            flex: '1',
            minWidth: '300px',
            maxWidth: '600px'
          }}>
            <div style={{
              position: 'absolute',
              left: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'rgba(141,153,174,0.5)',
              pointerEvents: 'none'
            }}>
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
              style={{
                width: '100%',
                padding: '0.875rem 1rem 0.875rem 3rem',
                backgroundColor: 'rgba(0,0,0,0.3)',
                color: '#ffffff',
                border: '1px solid rgba(141,153,174,0.2)',
                borderRadius: '8px',
                fontSize: '0.938rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(141,153,174,0.6)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(141,153,174,0.2)'}
            />
          </div>
          
          {/* View Toggle Buttons */}
          <div style={{ 
            display: 'flex',
            backgroundColor: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(141,153,174,0.2)',
            borderRadius: '8px',
            padding: '0.25rem'
          }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: viewMode === 'grid' ? 'rgba(141,153,174,0.2)' : 'transparent',
                color: viewMode === 'grid' ? '#8d99ae' : 'rgba(141,153,174,0.6)',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
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
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: viewMode === 'list' ? 'rgba(141,153,174,0.2)' : 'transparent',
                color: viewMode === 'list' ? '#8d99ae' : 'rgba(141,153,174,0.6)',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
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
          <div style={{ 
            textAlign: 'center', 
            paddingTop: '6rem',
            paddingBottom: '6rem'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              margin: '0 auto 1rem',
              border: '3px solid rgba(141,153,174,0.2)',
              borderTopColor: '#8d99ae',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}/>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.938rem' }}>
              Loading your vault...
            </p>
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            paddingTop: '6rem',
            paddingBottom: '6rem'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 1.5rem',
              backgroundColor: 'rgba(141,153,174,0.1)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8d99ae" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h2 style={{ 
              color: '#ffffff', 
              fontSize: '1.25rem',
              fontWeight: '600',
              marginBottom: '0.5rem'
            }}>
              {searchQuery ? 'No items found' : 'Your vault is empty'}
            </h2>
            <p style={{ 
              color: 'rgba(141,153,174,0.8)', 
              fontSize: '0.938rem',
              marginBottom: '2rem'
            }}>
              {searchQuery 
                ? 'Try adjusting your search query'
                : 'Add your first password, API key, or environment variable to get started'
              }
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowAddMenu(true)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#8d99ae',
                  color: '#2b2d42',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.938rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Add Your First Item
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem'
          }}>
            {filteredItems.map(item => {
              // Determine link based on secret type
              let detailLink = `/passwords/${item.id}`;
              let typeLabel = 'PASSWORD';
              let typeIcon = '🔑';
              
              if (item.secretType === 'API_KEY') {
                detailLink = `/api-keys/${item.id}`;
                typeLabel = 'API KEY';
                typeIcon = '🔐';
              } else if (item.secretType === 'ENV_VARS') {
                detailLink = `/env-vars/${item.id}`;
                typeLabel = 'ENV VARS';
                typeIcon = '⚙️';
              }
              
              return (
                <div 
                  key={item.id} 
                  role="button"
                  tabIndex={0}
                  style={{
                    padding: '1.25rem',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(141,153,174,0.2)',
                    borderRadius: '12px',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                  onClick={() => router.push(detailLink)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(detailLink);
                    }
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(141,153,174,0.5)';
                    const viewLink = e.currentTarget.querySelector('.view-link') as HTMLElement | null;
                    if (viewLink) {
                      viewLink.style.transform = 'translateX(4px) scale(1.02)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(141,153,174,0.2)';
                    const viewLink = e.currentTarget.querySelector('.view-link') as HTMLElement | null;
                    if (viewLink) {
                      viewLink.style.transform = 'translateX(0) scale(1)';
                    }
                  }}
                >
                  {/* Header with Title and Type Badge */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: '0.75rem',
                    marginBottom: '0.75rem'
                  }}>
                    <div style={{ flex: '1', minWidth: '0' }}>
                      <h3 style={{ 
                        fontSize: '1.125rem',
                        fontWeight: '600',
                        color: '#ffffff',
                        marginBottom: '0.25rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.title}
                      </h3>
                    </div>
                    <span style={{
                      padding: '0.25rem 0.625rem',
                      backgroundColor: 'rgba(141,153,174,0.15)',
                      color: '#8d99ae',
                      fontSize: '0.688rem',
                      fontWeight: '600',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.5px'
                    }}>
                      {typeIcon} {typeLabel}
                    </span>
                  </div>
                  
                  {/* Metadata */}
                  <div style={{ marginBottom: '1rem', flex: '1' }}>
                    {item.username && (
                      <p style={{ 
                        fontSize: '0.875rem',
                        color: 'rgba(141,153,174,0.8)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.username}
                      </p>
                    )}
                    {item.secretType === 'API_KEY' && item.metadata && 'serviceName' in item.metadata && (
                      <p style={{ 
                        fontSize: '0.875rem',
                        color: 'rgba(141,153,174,0.8)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {String(item.metadata.serviceName)}
                      </p>
                    )}
                    {item.secretType === 'ENV_VARS' && item.metadata && 'variableCount' in item.metadata && (
                      <p style={{ 
                        fontSize: '0.875rem',
                        color: 'rgba(141,153,174,0.8)'
                      }}>
                        {item.metadata.variableCount} variable{item.metadata.variableCount !== 1 ? 's' : ''}
                      </p>
                    )}
                    
                    {/* Hidden password indicator */}
                    {(item.secretType === 'PASSWORD' || item.secretType === 'API_KEY') && (
                      <p style={{ 
                        fontSize: '0.875rem',
                        color: 'rgba(141,153,174,0.5)',
                        fontFamily: 'monospace',
                        marginTop: '0.5rem',
                        letterSpacing: '2px'
                      }}>
                        ••••••••
                      </p>
                    )}
                  </div>
                  
                  {/* Action Button */}
                  <Link 
                    href={detailLink}
                    className="view-link"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.5rem 0.35rem',
                      backgroundColor: 'transparent',
                      color: '#8d99ae',
                      textDecoration: 'none',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      borderRadius: '4px',
                      border: 'none',
                      transition: 'transform 0.2s ease, color 0.2s ease',
                      marginLeft: 'auto'
                    }}
                  >
                    <span style={{ letterSpacing: '0.3px' }}>View Details</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            {filteredItems.map(item => {
              // Determine link based on secret type
              let detailLink = `/passwords/${item.id}`;
              let typeLabel = 'PASSWORD';
              let typeIcon = '🔑';
              
              if (item.secretType === 'API_KEY') {
                detailLink = `/api-keys/${item.id}`;
                typeLabel = 'API KEY';
                typeIcon = '🔐';
              } else if (item.secretType === 'ENV_VARS') {
                detailLink = `/env-vars/${item.id}`;
                typeLabel = 'ENV VARS';
                typeIcon = '⚙️';
              }
              
              return (
                <div 
                  key={item.id} 
                  role="button"
                  tabIndex={0}
                  style={{
                    padding: '1rem 1.25rem',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(141,153,174,0.2)',
                    borderRadius: '8px',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem'
                  }}
                  onClick={() => router.push(detailLink)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(detailLink);
                    }
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(141,153,174,0.5)';
                    e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.3)';
                    const viewLink = e.currentTarget.querySelector('.view-link') as HTMLElement | null;
                    if (viewLink) {
                      viewLink.style.transform = 'translateX(4px) scale(1.02)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(141,153,174,0.2)';
                    e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.2)';
                    const viewLink = e.currentTarget.querySelector('.view-link') as HTMLElement | null;
                    if (viewLink) {
                      viewLink.style.transform = 'translateX(0) scale(1)';
                    }
                  }}
                >
                  {/* Type Badge */}
                  <div style={{
                    padding: '0.5rem',
                    backgroundColor: 'rgba(141,153,174,0.15)',
                    borderRadius: '8px',
                    fontSize: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '48px',
                    height: '48px'
                  }}>
                    {typeIcon}
                  </div>
                  
                  {/* Content */}
                  <div style={{ flex: '1', minWidth: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                      <h3 style={{ 
                        fontSize: '1rem',
                        fontWeight: '600',
                        color: '#ffffff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.title}
                      </h3>
                      <span style={{
                        padding: '0.125rem 0.5rem',
                        backgroundColor: 'rgba(141,153,174,0.15)',
                        color: '#8d99ae',
                        fontSize: '0.625rem',
                        fontWeight: '600',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.5px'
                      }}>
                        {typeLabel}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      {item.username && (
                        <p style={{ 
                          fontSize: '0.813rem',
                          color: 'rgba(141,153,174,0.8)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {item.username}
                        </p>
                      )}
                      {item.secretType === 'API_KEY' && item.metadata && 'serviceName' in item.metadata && (
                        <p style={{ 
                          fontSize: '0.813rem',
                          color: 'rgba(141,153,174,0.8)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {String(item.metadata.serviceName)}
                        </p>
                      )}
                      {item.secretType === 'ENV_VARS' && item.metadata && 'variableCount' in item.metadata && (
                        <p style={{ 
                          fontSize: '0.813rem',
                          color: 'rgba(141,153,174,0.8)'
                        }}>
                          {item.metadata.variableCount} variable{item.metadata.variableCount !== 1 ? 's' : ''}
                        </p>
                      )}
                      
                      {/* Hidden password indicator */}
                      {(item.secretType === 'PASSWORD' || item.secretType === 'API_KEY') && (
                        <p style={{ 
                          fontSize: '0.813rem',
                          color: 'rgba(141,153,174,0.5)',
                          fontFamily: 'monospace',
                          letterSpacing: '2px'
                        }}>
                          ••••••••
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Button */}
                  <Link 
                    href={detailLink}
                    className="view-link"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.5rem 0.35rem',
                      backgroundColor: 'transparent',
                      color: '#8d99ae',
                      textDecoration: 'none',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      borderRadius: '4px',
                      border: 'none',
                      transition: 'transform 0.2s ease, color 0.2s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span style={{ letterSpacing: '0.3px' }}>View Details</span>
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

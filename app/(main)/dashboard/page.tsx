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

  if (!isUnlocked) return null; // Or loading spinner

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <nav className="space-x-3">
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:underline"
            >
              Logout
            </button>
          </nav>
        </header>

        <section className="mb-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Your Secrets</h2>
                <div className="flex gap-2">
                    <Link 
                      href="/passwords/new" 
                      className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
                      title="Add a password"
                    >
                        + Password
                    </Link>
                    <Link 
                      href="/api-keys/new" 
                      className="rounded bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 transition"
                      title="Add an API key"
                    >
                        + API Key
                    </Link>
                    <Link 
                      href="/env-vars/new" 
                      className="rounded bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 transition"
                      title="Add environment variables"
                    >
                        + Env Vars
                    </Link>
                </div>
            </div>
            
            {loading ? (
                <p>Loading...</p>
            ) : items.length === 0 ? (
                <p className="text-gray-500">No passwords found.</p>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {items.map(item => {
                      // Determine link based on secret type
                      let detailLink = `/passwords/${item.id}`;
                      let typeColor = "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
                      
                      if (item.secretType === 'API_KEY') {
                        detailLink = `/api-keys/${item.id}`;
                        typeColor = "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
                      } else if (item.secretType === 'ENV_VARS') {
                        detailLink = `/env-vars/${item.id}`;
                        typeColor = "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300";
                      }
                      
                      return (
                        <div key={item.id} className="p-4 bg-white dark:bg-gray-800 rounded shadow hover:shadow-lg transition">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-bold text-lg flex-1 truncate">{item.title}</h3>
                              <span className={`text-xs px-2 py-1 rounded font-medium whitespace-nowrap ${typeColor}`}>
                                {item.secretType}
                              </span>
                            </div>
                            
                            {item.username && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{item.username}</p>
                            )}
                            {item.secretType === 'API_KEY' && item.metadata && 'serviceName' in item.metadata && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{item.metadata.serviceName}</p>
                            )}
                            {item.secretType === 'ENV_VARS' && item.metadata && 'variableCount' in item.metadata && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">{item.metadata.variableCount} variable{item.metadata.variableCount !== 1 ? 's' : ''}</p>
                            )}
                            
                            {/* Generic secure indicator - NO real secret fragments */}
                            {(item.secretType === 'PASSWORD' || item.secretType === 'API_KEY') && (
                              <p className="text-sm text-gray-400 dark:text-gray-500 font-mono mt-1">••••••••</p>
                            )}
                            
                            <Link href={detailLink} className="text-blue-600 dark:text-blue-400 text-sm hover:underline mt-3 inline-block">
                                View Details
                            </Link>
                        </div>
                      );
                    })}
                </div>
            )}
        </section>
      </div>
    </div>
  );
}

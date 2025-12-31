"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Key, FileText, Code, Plus, Clock, RefreshCw } from "lucide-react";
import { useVault } from "@/app/components/providers/VaultProvider";
import { decryptItem } from "@/app/lib/crypto";
import { buildMetadataFromDecrypted } from "@/app/lib/secret-utils";
import { AddItemOverlay } from "@/app/components/ui/AddItemOverlay";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "../../../components/vaultr-ui";

import type { Metadata } from "@/app/lib/secret-utils";

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
  const addMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterType, setFilterType] = useState<'ALL' | 'PASSWORD' | 'API_KEY' | 'ENV_VARS'>('ALL');
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

  // Retain focus on trigger when closing overlay
  useEffect(() => {
    if (!showAddMenu) {
      addMenuTriggerRef.current?.focus();
    }
  }, [showAddMenu]);

  // Filter items based on search query
  const filteredItems = items.filter(item => {
    const query = searchQuery.toLowerCase();
    const titleMatch = item.title.toLowerCase().includes(query);
    const matchesType = filterType === 'ALL' ? true : item.secretType === filterType;
    return titleMatch && matchesType;
  });

  const passwordCount = items.filter(item => item.secretType === 'PASSWORD').length;
  const apiKeyCount = items.filter(item => item.secretType === 'API_KEY').length;
  const envVarCount = items.filter(item => item.secretType === 'ENV_VARS').length;

  if (!isUnlocked) return null; // Or loading spinner

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight whitespace-nowrap">
            Vaultr
          </Link>
          <div className="flex-1 max-w-3xl">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your vault"
              className="w-full"
            />
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3 whitespace-nowrap">
            <span className="hidden items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary lg:inline-flex">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Vault unlocked
            </span>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => router.push('/generator')}
            >
              <RefreshCw className="h-4 w-4" />
              Generate password
            </Button>
            <Button
              ref={addMenuTriggerRef}
              size="sm"
              className="gap-2"
              onClick={() => setShowAddMenu(true)}
              disabled={showAddMenu}
            >
              <Plus className="h-4 w-4" />
              Add item
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <AddItemOverlay
        open={showAddMenu}
        onClose={() => setShowAddMenu(false)}
        onNavigate={() => setShowAddMenu(false)}
        anchorRef={addMenuTriggerRef}
      />

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <section className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Your vault is unlocked and ready to use.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card
            className={`cursor-pointer transition hover:border-primary/50 ${filterType === 'PASSWORD' ? 'border-primary/60' : ''}`}
            onClick={() => setFilterType('PASSWORD')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Passwords</CardTitle>
              <Key className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{passwordCount}</div>
              <p className="mt-1 text-xs text-muted-foreground">Stored credentials</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition hover:border-primary/50 ${filterType === 'API_KEY' ? 'border-primary/60' : ''}`}
            onClick={() => setFilterType('API_KEY')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">API Keys</CardTitle>
              <Code className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{apiKeyCount}</div>
              <p className="mt-1 text-xs text-muted-foreground">Developer credentials</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition hover:border-primary/50 ${filterType === 'ENV_VARS' ? 'border-primary/60' : ''}`}
            onClick={() => setFilterType('ENV_VARS')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Env Vars</CardTitle>
              <FileText className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{envVarCount}</div>
              <p className="mt-1 text-xs text-muted-foreground">Project configuration</p>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Vault items</CardTitle>
              <CardDescription>Search and open anything in your vault</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                  >
                    Grid
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    List
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground">
                  {loading ? 'Loading items...' : `${filteredItems.length} item${filteredItems.length === 1 ? '' : 's'} found`}
                </span>
              </div>

              {loading ? (
                <div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Fetching your vault...</span>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  {searchQuery ? 'No items match your search.' : 'Your vault is empty. Add your first secret to get started.'}
                </div>
              ) : (
                <div className={viewMode === 'grid' ? 'grid gap-4 md:grid-cols-2' : 'divide-y rounded-lg border'}>
                  {filteredItems.map(item => {
                    let detailLink = `/secrets/passwords/${item.id}`;
                    let typeLabel = 'PASSWORD';
                    let TypeIcon = Key;

                    if (item.secretType === 'API_KEY') {
                      detailLink = `/secrets/api-keys/${item.id}`;
                      typeLabel = 'API KEY';
                      TypeIcon = Code;
                    } else if (item.secretType === 'ENV_VARS') {
                      detailLink = `/secrets/env-vars/${item.id}`;
                      typeLabel = 'ENV VARS';
                      TypeIcon = FileText;
                    }

                    const secondaryLine = item.secretType === 'API_KEY' && item.metadata && 'serviceName' in item.metadata
                      ? String(item.metadata.serviceName)
                      : item.secretType === 'ENV_VARS' && item.metadata && 'variableCount' in item.metadata
                        ? `${item.metadata.variableCount} variable${item.metadata.variableCount === 1 ? '' : 's'}`
                        : item.username || 'Hidden secret';

                    if (viewMode === 'grid') {
                      return (
                        <Card
                          key={item.id}
                          className="cursor-pointer transition hover:border-primary/50"
                          onClick={() => router.push(detailLink)}
                        >
                          <CardContent className="flex items-start gap-3 pt-6">
                            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                              <TypeIcon className="h-5 w-5" aria-hidden />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{item.title}</p>
                              <p className="truncate text-xs text-muted-foreground">{secondaryLine}</p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => router.push(detailLink)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(detailLink);
                          }
                        }}
                        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <TypeIcon className="h-5 w-5" aria-hidden />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{item.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{secondaryLine}</p>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-primary">{"Open ->"}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

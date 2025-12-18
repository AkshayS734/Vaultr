"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useVault } from "@/components/VaultProvider";
import { decryptItem } from "@/lib/crypto";

interface PasswordItem {
  id: string;
  title: string;
  username?: string;
  // ... other fields
}

export default function DashboardPage() {
  const router = useRouter();
  const { vaultKey, isUnlocked } = useVault();
  const [items, setItems] = useState<PasswordItem[]>([]);
  const [loading, setLoading] = useState(true);

  const handleLogout = async () => {
    try {
      await fetch("/logout", { method: "POST" });
      router.push("/");
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  useEffect(() => {
    if (!isUnlocked) return; // VaultProvider will redirect

    async function fetchItems() {
      try {
        const res = await fetch("/api/passwords");
        if (!res.ok) throw new Error("Failed to fetch");
        const encryptedItems = await res.json();

        const decryptedItems = await Promise.all(
          encryptedItems.map(async (item: any) => {
            try {
              // Validate that required fields exist
              if (!item.encryptedData || !item.iv) {
                throw new Error('Missing encryptedData or iv');
              }
              const data = await decryptItem(item.encryptedData, item.iv, vaultKey!);
              return { id: item.id, ...data };
            } catch (e) {
              console.error("Failed to decrypt item", item.id, e);
              return { id: item.id, title: "Error decrypting" };
            }
          })
        );

        setItems(decryptedItems);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
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
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Your Passwords</h2>
                <Link href="/passwords/new" className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                    Add Password
                </Link>
            </div>
            
            {loading ? (
                <p>Loading...</p>
            ) : items.length === 0 ? (
                <p className="text-gray-500">No passwords found.</p>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {items.map(item => (
                        <div key={item.id} className="p-4 bg-white dark:bg-gray-800 rounded shadow">
                            <h3 className="font-bold text-lg">{item.title}</h3>
                            <p className="text-sm text-gray-500">{item.username}</p>
                            <Link href={`/passwords/${item.id}`} className="text-blue-600 text-sm hover:underline mt-2 inline-block">
                                View Details
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </section>
      </div>
    </div>
  );
}

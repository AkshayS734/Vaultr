"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/app/components/providers/VaultProvider";
import { encryptItem, decryptItem } from "@/app/lib/crypto";
import { 
  SecretType, 
  buildEncryptedPayload, 
  buildMetadata,
  validatePasswordInput,
  type PasswordInput
} from "@/app/lib/secret-utils";

export default function PasswordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { vaultKey, isUnlocked } = useVault();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  
  // Unwrap params
  const { id } = use(params);

  useEffect(() => {
    if (!isUnlocked) return;

    async function fetchItem() {
      try {
        const res = await fetch(`/api/passwords/${id}`);
        if (!res.ok) throw new Error("Failed to fetch password");
        
        const item = await res.json();
        
        // Validate required fields
        if (!item.encryptedData || !item.iv) {
          throw new Error("Missing encrypted data");
        }
        
        // Decrypt using centralized function with correct parameters
        const data = await decryptItem<Record<string, unknown>>(item.encryptedData, item.iv, vaultKey!);

        setTitle(typeof data.title === 'string' ? data.title : "");
        setUsername(typeof data.username === 'string' ? data.username : "");
        setPassword(typeof data.password === 'string' ? data.password : "");
        setWebsite(typeof data.website === 'string' ? data.website : "");
        setNotes(typeof data.notes === 'string' ? data.notes : "");
      } catch (err) {
        console.error(err);
        setError("Failed to load password details");
      } finally {
        setLoading(false);
      }
    }

    fetchItem();
  }, [id, isUnlocked, vaultKey]);

  if (!isUnlocked) return null;
  if (loading) return <div className="p-8 text-center">Loading...</div>;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!vaultKey) throw new Error("Vault is locked");

      // Build password input
      const passwordInput: PasswordInput = {
        title,
        username,
        password,
        website,
        notes,
      };

      // Validate input
      validatePasswordInput(passwordInput);

      // Build encrypted payload (ALL sensitive data)
      const encryptedPayload = buildEncryptedPayload(SecretType.PASSWORD, passwordInput);

      // Build metadata (ONLY non-sensitive data)
      const metadata = buildMetadata(SecretType.PASSWORD, passwordInput);

      // Encrypt the payload
      const { encryptedData, iv: ivBase64 } = await encryptItem(
        encryptedPayload,
        vaultKey
      );

      const res = await fetch(`/api/passwords/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encryptedData,
          iv: ivBase64,
          metadata,
          secretType: SecretType.PASSWORD,
        }),
      });

      if (!res.ok) throw new Error("Failed to update password");

      setIsEditing(false);
    } catch (err) {
      console.error(err);
      setError("Failed to update password");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this password?")) return;
    
    try {
      const res = await fetch(`/api/passwords/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Failed to delete password");
    }
  }

  async function handleLogout() {
    try {
      await fetch("/logout", { method: "POST" });
      router.push("/");
    } catch (err) {
      console.error("Logout failed", err);
    }
  }

  return (
    <div className="min-h-screen bg-[#2b2d42]">
      {/* Top Navigation Bar */}
      <nav className="border-b border-[rgba(141,153,174,0.1)] bg-[rgba(0,0,0,0.2)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-300 items-center justify-between px-6">
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-[#8d99ae] hover:text-white transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            Back
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="rounded-md border border-[rgba(141,153,174,0.3)] px-4 py-2 text-sm font-medium text-[rgba(141,153,174,0.8)] transition-all duration-200 hover:bg-[rgba(141,153,174,0.1)] hover:text-[#8d99ae] focus:outline-none focus:ring-2 focus:ring-[rgba(141,153,174,0.4)]"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="bg-black/20 rounded-lg shadow-lg p-6 border border-[#8d99ae]/20">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">
            {isEditing ? "Edit Password" : title}
          </h1>
          {!isEditing && (
            <div className="space-x-2">
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-md border border-[rgba(141,153,174,0.3)] px-3 py-1 text-sm font-medium text-[rgba(141,153,174,0.8)] transition-all duration-200 hover:bg-[rgba(141,153,174,0.1)] hover:text-[#8d99ae] focus:outline-none focus:ring-2 focus:ring-[rgba(141,153,174,0.4)]"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="rounded-md border border-[rgba(220,53,69,0.3)] px-3 py-1 text-sm font-medium text-[rgba(220,53,69,0.8)] transition-all duration-200 hover:bg-[rgba(220,53,69,0.1)] hover:text-[#dc3545] focus:outline-none focus:ring-2 focus:ring-[rgba(220,53,69,0.4)]"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/85">Title</label>
            <input
              type="text"
              required
              disabled={!isEditing}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[#8d99ae]/30 bg-[#2b2d42]/50 px-3 py-2 shadow-sm focus:border-[#8d99ae]/60 focus:ring-[#8d99ae]/20 disabled:bg-[#2b2d42]/30 disabled:cursor-not-allowed text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/85">Username</label>
            <div className="flex">
              <input
                type="text"
                disabled={!isEditing}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full rounded-md border border-[#8d99ae]/30 bg-[#2b2d42]/50 px-3 py-2 shadow-sm focus:border-[#8d99ae]/60 focus:ring-[#8d99ae]/20 disabled:bg-[#2b2d42]/30 disabled:cursor-not-allowed text-white"
              />
              {!isEditing && username && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(username)}
                  className="ml-2 px-3 py-2 text-sm text-[#8d99ae]/70 hover:text-[#8d99ae]"
                >
                  Copy
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/85">Password</label>
            <div className="flex">
              <input
                type={isEditing ? "text" : "password"}
                required
                disabled={!isEditing}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-[#8d99ae]/30 bg-[#2b2d42]/50 px-3 py-2 shadow-sm focus:border-[#8d99ae]/60 focus:ring-[#8d99ae]/20 disabled:bg-[#2b2d42]/30 disabled:cursor-not-allowed text-white"
              />
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(password)}
                  className="ml-2 px-3 py-2 text-sm text-[#8d99ae]/70 hover:text-[#8d99ae]"
                >
                  Copy
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/85">Website</label>
            <div className="flex">
              <input
                type="url"
                disabled={!isEditing}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="mt-1 block w-full rounded-md border border-[#8d99ae]/30 bg-[#2b2d42]/50 px-3 py-2 shadow-sm focus:border-[#8d99ae]/60 focus:ring-[#8d99ae]/20 disabled:bg-[#2b2d42]/30 disabled:cursor-not-allowed text-white"
              />
              {!isEditing && website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 px-3 py-2 text-sm text-[#8d99ae] hover:underline flex items-center"
                >
                  Open
                </a>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/85">Notes</label>
            <textarea
              disabled={!isEditing}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border border-[#8d99ae]/30 bg-[#2b2d42]/50 px-3 py-2 shadow-sm focus:border-[#8d99ae]/60 focus:ring-[#8d99ae]/20 disabled:bg-[#2b2d42]/30 disabled:cursor-not-allowed text-white"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          {isEditing && (
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm font-medium text-[#2b2d42] bg-[#8d99ae] border border-[#8d99ae] rounded-md hover:bg-[#8d99ae]/90"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-[#2b2d42] bg-[#8d99ae] rounded-md hover:bg-[#8d99ae]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}

          {!isEditing && (
            <></>
          )}
        </form>
      </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/app/components/providers/VaultProvider";
import { encryptItem, decryptItem } from "@/lib/crypto";
import { 
  SecretType, 
  buildEncryptedPayload, 
  buildMetadata,
  validateEnvVarsInput,
  type EnvVarsInput
} from "@/lib/secret-utils";

interface EnvVariable {
  key: string;
  value: string;
}

export default function EnvVarsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { vaultKey, isUnlocked } = useVault();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [variables, setVariables] = useState<EnvVariable[]>([]);
  const [notes, setNotes] = useState("");
  
  // Unwrap params
  const { id } = use(params);

  useEffect(() => {
    if (!isUnlocked) return;

    async function fetchItem() {
      try {
        const res = await fetch(`/api/passwords/${id}`);
        if (!res.ok) throw new Error("Failed to fetch environment variables");
        
        const item = await res.json();
        
        // Validate required fields
        if (!item.encryptedData || !item.iv) {
          throw new Error("Missing encrypted data");
        }
        
        // Decrypt using centralized function
        const data = await decryptItem<Record<string, unknown>>(item.encryptedData, item.iv, vaultKey!);

        setTitle(typeof data.title === 'string' ? data.title : "");
        setDescription(typeof data.description === 'string' ? data.description : "");
        setVariables(Array.isArray((data as { variables?: unknown }).variables)
          ? (data as { variables?: EnvVariable[] }).variables ?? [{ key: "", value: "" }]
          : [{ key: "", value: "" }]);
        const notesValue = (data as { notes?: unknown }).notes;
        setNotes(typeof notesValue === 'string' ? notesValue : "");
      } catch (err) {
        console.error(err);
        setError("Failed to load environment variables");
      } finally {
        setLoading(false);
      }
    }

    fetchItem();
  }, [id, isUnlocked, vaultKey]);

  if (!isUnlocked) return null;
  if (loading) return <div className="p-8 text-center">Loading...</div>;

  const addVariable = () => {
    setVariables([...variables, { key: "", value: "" }]);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const updateVariable = (index: number, field: "key" | "value", val: string) => {
    const updated = [...variables];
    updated[index][field] = val;
    setVariables(updated);
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!vaultKey) throw new Error("Vault is locked");

      // Filter out empty variables
      const filledVariables = variables.filter(v => v.key.trim() !== "");

      // Build environment variables input
      const envVarsInput: EnvVarsInput = {
        title,
        description,
        variables: filledVariables,
        notes,
      };

      // Validate input
      validateEnvVarsInput(envVarsInput);

      // Build encrypted payload (ALL sensitive data)
      const encryptedPayload = buildEncryptedPayload(SecretType.ENV_VARS, envVarsInput);

      // Build metadata (ONLY non-sensitive data)
      const metadata = buildMetadata(SecretType.ENV_VARS, envVarsInput);

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
          secretType: SecretType.ENV_VARS,
        }),
      });

      if (!res.ok) throw new Error("Failed to update environment variables");

      setIsEditing(false);
    } catch (err) {
      console.error(err);
      setError("Failed to update environment variables");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this environment variable set?")) return;
    
    try {
      const res = await fetch(`/api/passwords/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Failed to delete environment variables");
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
            {isEditing ? "Edit Environment Variables" : title}
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
            <label className="block text-sm font-medium text-white/85">Description</label>
            <input
              type="text"
              disabled={!isEditing}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[#8d99ae]/30 bg-[#2b2d42]/50 px-3 py-2 shadow-sm focus:border-[#8d99ae]/60 focus:ring-[#8d99ae]/20 disabled:bg-[#2b2d42]/30 disabled:cursor-not-allowed text-white"
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-white/85">Environment Variables</label>
              {isEditing && (
                <button
                  type="button"
                  onClick={addVariable}
                  className="text-sm text-[#8d99ae] hover:text-[#8d99ae]/80"
                >
                  + Add Variable
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {variables.map((variable, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Key (e.g. DATABASE_URL)"
                    disabled={!isEditing}
                    value={variable.key}
                    onChange={(e) => updateVariable(index, "key", e.target.value)}
                    className="flex-1 rounded-md border border-[#8d99ae]/30 bg-[#2b2d42]/50 px-3 py-2 shadow-sm focus:border-[#8d99ae]/60 focus:ring-[#8d99ae]/20 disabled:bg-[#2b2d42]/30 disabled:cursor-not-allowed text-white text-sm"
                  />
                  <input
                    type={isEditing ? "text" : "password"}
                    placeholder="Value"
                    disabled={!isEditing}
                    value={variable.value}
                    onChange={(e) => updateVariable(index, "value", e.target.value)}
                    className="flex-1 rounded-md border border-[#8d99ae]/30 bg-[#2b2d42]/50 px-3 py-2 shadow-sm focus:border-[#8d99ae]/60 focus:ring-[#8d99ae]/20 disabled:bg-[#2b2d42]/30 disabled:cursor-not-allowed text-white text-sm"
                  />
                  {isEditing && variables.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVariable(index)}
                      className="px-2 py-2 text-sm text-red-600 hover:bg-red-50 rounded dark:hover:bg-red-900/20"
                    >
                      Remove
                    </button>
                  )}
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(variable.value)}
                      className="px-2 py-2 text-sm text-[#8d99ae]/70 hover:text-[#8d99ae]"
                      title="Copy value"
                    >
                      Copy
                    </button>
                  )}
                </div>
              ))}
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

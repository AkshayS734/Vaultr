"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/components/VaultProvider";
import { encryptItem, decryptItem } from "@/lib/crypto";
import { 
  SecretType, 
  buildEncryptedPayload, 
  buildMetadata,
  validateApiKeyInput,
  type ApiKeyInput
} from "@/lib/secret-utils";

export default function ApiKeyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { vaultKey, isUnlocked } = useVault();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [notes, setNotes] = useState("");
  
  // Unwrap params
  const { id } = use(params);

  useEffect(() => {
    if (!isUnlocked) return;

    async function fetchItem() {
      try {
        const res = await fetch(`/api/passwords/${id}`);
        if (!res.ok) throw new Error("Failed to fetch API key");
        
        const item = await res.json();
        
        // Validate required fields
        if (!item.encryptedData || !item.iv) {
          throw new Error("Missing encrypted data");
        }
        
        // Decrypt using centralized function
        const data = await decryptItem(item.encryptedData, item.iv, vaultKey!);

        setTitle(data.title || "");
        setServiceName(data.serviceName || "");
        setApiKey(data.apiKey || "");
        setEnvironment(data.environment || "production");
        setNotes(data.notes || "");
      } catch (err) {
        console.error(err);
        setError("Failed to load API key details");
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

      // Build API key input
      const apiKeyInput: ApiKeyInput = {
        title,
        serviceName,
        apiKey,
        environment,
        notes,
      };

      // Validate input
      validateApiKeyInput(apiKeyInput);

      // Build encrypted payload (ALL sensitive data)
      const encryptedPayload = buildEncryptedPayload(SecretType.API_KEY, apiKeyInput);

      // Build metadata (ONLY non-sensitive data)
      const metadata = buildMetadata(SecretType.API_KEY, apiKeyInput);

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
          secretType: SecretType.API_KEY,
        }),
      });

      if (!res.ok) throw new Error("Failed to update API key");

      setIsEditing(false);
    } catch (err) {
      console.error(err);
      setError("Failed to update API key");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this API key?")) return;
    
    try {
      const res = await fetch(`/api/passwords/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Failed to delete API key");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="mx-auto max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEditing ? "Edit API Key" : title}
          </h1>
          {!isEditing && (
            <div className="space-x-2">
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded dark:hover:bg-green-900/20"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded dark:hover:bg-red-900/20"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
            <input
              type="text"
              required
              disabled={!isEditing}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500 disabled:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:disabled:bg-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Service Name</label>
            <input
              type="text"
              required
              disabled={!isEditing}
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500 disabled:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:disabled:bg-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">API Key</label>
            <div className="flex">
              <input
                type={isEditing ? "text" : "password"}
                required
                disabled={!isEditing}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500 disabled:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:disabled:bg-gray-800"
              />
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(apiKey)}
                  className="ml-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  Copy
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Environment</label>
            <select
              disabled={!isEditing}
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500 disabled:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:disabled:bg-gray-800"
            >
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
              <option value="testing">Testing</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea
              disabled={!isEditing}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500 disabled:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:disabled:bg-gray-800"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          {isEditing && (
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}

          {!isEditing && (
            <div className="pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                &larr; Back to Dashboard
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

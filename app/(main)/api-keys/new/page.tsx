"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/components/VaultProvider";
import { encryptItem } from "@/lib/crypto";
import { 
  SecretType, 
  buildEncryptedPayload, 
  buildMetadata,
  validateApiKeyInput,
  type ApiKeyInput 
} from "@/lib/secret-utils";

export default function NewApiKeyPage() {
  const router = useRouter();
  const { vaultKey, isUnlocked } = useVault();
  const [title, setTitle] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isUnlocked) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!vaultKey) throw new Error("Vault is locked");

      // 1. Build API key input
      const apiKeyInput: ApiKeyInput = {
        title,
        serviceName,
        apiKey,
        environment,
        notes,
      };

      // 2. Validate input
      validateApiKeyInput(apiKeyInput);

      // 3. Build encrypted payload (ALL sensitive data)
      const encryptedPayload = buildEncryptedPayload(SecretType.API_KEY, apiKeyInput);

      // 4. Build metadata (ONLY non-sensitive data)
      const metadata = buildMetadata(SecretType.API_KEY, apiKeyInput);

      // 5. Encrypt the payload
      const { encryptedData, iv: ivBase64 } = await encryptItem(
        encryptedPayload,
        vaultKey
      );

      // 6. Send to backend with metadata and secretType
      const res = await fetch("/api/passwords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encryptedData,
          iv: ivBase64,
          metadata,
          secretType: SecretType.API_KEY,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save API key");
      }

      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="mx-auto max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Add New API Key</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="e.g. GitHub API, Stripe API"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Service Name</label>
            <input
              type="text"
              required
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="e.g. GitHub, Stripe, SendGrid"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">API Key</label>
            <input
              type="password"
              required
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Paste your API key here"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Environment</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Add any additional notes..."
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save API Key"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/components/VaultProvider";
import { encryptItem } from "@/lib/crypto";
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

export default function NewEnvVarsPage() {
  const router = useRouter();
  const { vaultKey, isUnlocked } = useVault();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [variables, setVariables] = useState<EnvVariable[]>([{ key: "", value: "" }]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isUnlocked) return null;

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!vaultKey) throw new Error("Vault is locked");

      // Filter out empty variables
      const filledVariables = variables.filter(v => v.key.trim() !== "");

      // 1. Build environment variables input
      const envVarsInput: EnvVarsInput = {
        title,
        description,
        variables: filledVariables,
        notes,
      };

      // 2. Validate input
      validateEnvVarsInput(envVarsInput);

      // 3. Build encrypted payload (ALL sensitive data)
      const encryptedPayload = buildEncryptedPayload(SecretType.ENV_VARS, envVarsInput);

      // 4. Build metadata (ONLY non-sensitive data)
      const metadata = buildMetadata(SecretType.ENV_VARS, envVarsInput);

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
          secretType: SecretType.ENV_VARS,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save environment variables");
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Add Environment Variables</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-purple-500 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="e.g. Production Database, Development Config"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-purple-500 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Brief description of what these variables are for"
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Environment Variables</label>
              <button
                type="button"
                onClick={addVariable}
                className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
              >
                + Add Variable
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {variables.map((variable, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Key (e.g. DATABASE_URL)"
                    value={variable.key}
                    onChange={(e) => updateVariable(index, "key", e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-purple-500 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  />
                  <input
                    type="password"
                    placeholder="Value"
                    value={variable.value}
                    onChange={(e) => updateVariable(index, "value", e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-purple-500 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  />
                  {variables.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVariable(index)}
                      className="px-2 py-2 text-sm text-red-600 hover:bg-red-50 rounded dark:hover:bg-red-900/20"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-purple-500 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Environment Variables"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

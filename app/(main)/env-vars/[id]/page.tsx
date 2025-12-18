"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/components/VaultProvider";
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
        const data = await decryptItem(item.encryptedData, item.iv, vaultKey!);

        setTitle(data.title || "");
        setDescription(data.description || "");
        setVariables(data.variables || [{ key: "", value: "" }]);
        setNotes(data.notes || "");
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="mx-auto max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEditing ? "Edit Environment Variables" : title}
          </h1>
          {!isEditing && (
            <div className="space-x-2">
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1 text-sm text-purple-600 hover:bg-purple-50 rounded dark:hover:bg-purple-900/20"
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
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-purple-500 focus:ring-purple-500 disabled:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:disabled:bg-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <input
              type="text"
              disabled={!isEditing}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-purple-500 focus:ring-purple-500 disabled:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:disabled:bg-gray-800"
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Environment Variables</label>
              {isEditing && (
                <button
                  type="button"
                  onClick={addVariable}
                  className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
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
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-purple-500 focus:ring-purple-500 disabled:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:disabled:bg-gray-800 text-sm"
                  />
                  <input
                    type={isEditing ? "text" : "password"}
                    placeholder="Value"
                    disabled={!isEditing}
                    value={variable.value}
                    onChange={(e) => updateVariable(index, "value", e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-purple-500 focus:ring-purple-500 disabled:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:disabled:bg-gray-800 text-sm"
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
                      className="px-2 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea
              disabled={!isEditing}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-purple-500 focus:ring-purple-500 disabled:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:disabled:bg-gray-800"
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
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
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

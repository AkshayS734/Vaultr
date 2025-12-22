import { VaultProvider } from "@/components/VaultProvider";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VaultProvider>
      {children}
    </VaultProvider>
  );
}

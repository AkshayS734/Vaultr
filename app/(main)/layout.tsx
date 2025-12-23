import { VaultProvider } from "@/app/components/providers/VaultProvider";

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

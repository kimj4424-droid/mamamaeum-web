import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "엄마마음",
  description: "부모님과의 대화를 위한 카톡 문장을 함께 정리해요.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

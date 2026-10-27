export const metadata = {
  title: "Lingua",
  description: "Personal fluency practice: Yoruba & Mandarin",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          padding: "1.5rem",
          maxWidth: 720,
          marginInline: "auto",
        }}
      >
        {children}
      </body>
    </html>
  );
}

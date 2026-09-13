import './globals.css';

export const metadata = {
  title: 'Meow O shop',
  description: 'ระบบจัดการร้าน Meow O shop สำหรับทาสแมว',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>
        <header className="navbar">
          <div className="navbar-brand">
            <span className="navbar-paw">🐾</span>
            <span>Meow O shop</span>
          </div>
          <nav className="navbar-nav">
            <a href="/" className="nav-link">🏠 หน้าแรก</a>
            <a href="/sell" className="nav-link">🛒 ขายสินค้า</a>
            <a href="/history" className="nav-link">📜 ประวัติการขาย</a>
          </nav>
        </header>
        <main className="main-content">{children}</main>
        <footer className="footer">
          <p>🐱 Meow O shop — ร้านของแมว ดูแลด้วยใจทาสแมว 🐾</p>
        </footer>
      </body>
    </html>
  );
}

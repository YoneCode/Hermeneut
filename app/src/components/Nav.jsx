import Logo from "./Logo.jsx";
import { GitHubIcon, XIcon } from "./Icons.jsx";

function short(a) {
  return a ? `${a.slice(0, 6)}\u2026${a.slice(-4)}` : "";
}

/**
 * Sticky top navigation. Left: brand. Center: in-page anchors. Right:
 * external links + wallet/sign-in. Presentational; auth state via props.
 */
export default function Nav({ ready, authenticated, address, login, logout }) {
  return (
    <header className="ht-nav">
      <div className="ht-nav__inner">
        <a href="#top" className="ht-nav__brand" aria-label="HERMENEUT home">
          <Logo size={28} />
          <span className="ht-mono-label">HERMENEUT</span>
        </a>

        <nav className="ht-nav__links" aria-label="Primary">
          <a href="#how">How it works</a>
          <a href="#protocol">Live protocol</a>
          <a href="#faq">FAQ</a>
        </nav>

        <div className="ht-nav__actions">
          <a className="ht-nav__icon" href="https://github.com/YoneCode/Hermeneut"
            target="_blank" rel="noopener noreferrer" title="GitHub" aria-label="GitHub repository">
            <GitHubIcon size={18} />
          </a>
          <a className="ht-nav__icon" href="https://x.com/YoneCode"
            target="_blank" rel="noopener noreferrer" title="X" aria-label="X profile">
            <XIcon size={16} />
          </a>
          {ready && authenticated ? (
            <span className="ht-nav__wallet ht-mono-label">
              <span className="ht-dot" aria-hidden /> {short(address)}
              <button type="button" onClick={logout} className="ht-nav__logout">Log out</button>
            </span>
          ) : (
            <button type="button" className="ht-btn ht-btn--solid" disabled={!ready} onClick={login}>
              <span>{ready ? "Sign in" : "Loading"}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

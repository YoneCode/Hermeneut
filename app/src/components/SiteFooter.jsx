import Logo from "./Logo.jsx";
import { GitHubIcon, XIcon } from "./Icons.jsx";

function short(a) {
  return a ? `${a.slice(0, 6)}\u2026${a.slice(-4)}` : "";
}

export default function SiteFooter({ contract, chain, explorer }) {
  return (
    <footer className="ht-footer">
      <div className="ht-footer__inner">
        <div className="ht-footer__brand">
          <div className="ht-footer__mark">
            <Logo size={28} />
            <span className="ht-mono-label">HERMENEUT</span>
          </div>
          <p>
            A recursive semantic jurisprudence engine on GenLayer. Capital,
            bound to language, settled by consensus.
          </p>
        </div>

        <nav className="ht-footer__col" aria-label="Protocol">
          <h3 className="ht-mono-label">Protocol</h3>
          <a href="#how">How it works</a>
          <a href="#features">What it does</a>
          <a href="#protocol">Live protocol</a>
          <a href="#faq">FAQ</a>
        </nav>

        <nav className="ht-footer__col" aria-label="Resources">
          <h3 className="ht-mono-label">Resources</h3>
          <a href="https://docs.genlayer.com" target="_blank" rel="noopener noreferrer">GenLayer docs</a>
          <a href="https://github.com/YoneCode/Hermeneut" target="_blank" rel="noopener noreferrer">
            <GitHubIcon size={14} /> GitHub
          </a>
          <a href="https://x.com/YoneCode" target="_blank" rel="noopener noreferrer">
            <XIcon size={12} /> X / @YoneCode
          </a>
        </nav>

        <nav className="ht-footer__col" aria-label="Network">
          <h3 className="ht-mono-label">Network</h3>
          {explorer && (
            <a href={explorer} target="_blank" rel="noopener noreferrer">
              Contract {short(contract)}
            </a>
          )}
          <a href="https://explorer-bradbury.genlayer.com" target="_blank" rel="noopener noreferrer">
            Bradbury explorer
          </a>
          <span className="ht-footer__meta">{chain?.toUpperCase()} · chain 4221</span>
        </nav>
      </div>

      <div className="ht-footer__base">
        <span className="ht-mono-label">HERMENEUT</span>
        <span className="ht-footer__meta">Live on GenLayer Bradbury testnet</span>
      </div>
    </footer>
  );
}

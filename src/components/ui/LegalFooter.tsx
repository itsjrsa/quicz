const SOURCE_URL = "https://github.com/itsjrsa/quicz";
const LICENSE_URL = `${SOURCE_URL}/blob/master/LICENSE`;

export function LegalFooter() {
  return (
    <footer className="border-t border-ink-faint/10 px-6 py-4 text-center text-xs text-ink-faint">
      <p>
        <span>Quicz © 2026 José Andrade.</span>{" "}
        <span>Free software, no warranty. Released under the </span>
        <a
          href={LICENSE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-ink-muted"
        >
          GNU AGPL v3
        </a>
        <span>.</span>{" "}
        <a
          href={SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-ink-muted"
        >
          Source
        </a>
        <span>.</span>
      </p>
    </footer>
  );
}

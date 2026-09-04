const BIG_CHECK_STORE_URL = 'https://www.bigcheckstore.com/'

function SponsorCredit({ placement }: { placement: 'sidebar' | 'mobile-menu' }) {
  return (
    <aside
      aria-label="Summer 2026 Lobo League sponsor"
      className={`sponsor-credit sponsor-credit--${placement}`}
    >
      <span>Summer 2026 Lobo League</span>
      <span>Sponsored by</span>
      <a
        href={BIG_CHECK_STORE_URL}
        rel="noopener noreferrer sponsored"
        target="_blank"
      >
        Big Check Store <span aria-hidden="true">↗</span>
      </a>
    </aside>
  )
}

export { BIG_CHECK_STORE_URL }
export default SponsorCredit

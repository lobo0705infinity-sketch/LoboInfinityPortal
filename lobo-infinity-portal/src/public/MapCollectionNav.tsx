import { Link } from 'react-router-dom'
export default function MapCollectionNav({ aurora = false }: { aurora?: boolean }) {
  return <nav className="lobo-map-section-nav" aria-label="Map collections">
    <Link aria-current={!aurora ? 'page' : undefined} to="/maps">ITS18 <span>40 setups</span></Link>
    <Link aria-current={aurora ? 'page' : undefined} to="/maps/aurora-vii">Aurora VII <span>24 locations · 48 setups</span></Link>
  </nav>
}

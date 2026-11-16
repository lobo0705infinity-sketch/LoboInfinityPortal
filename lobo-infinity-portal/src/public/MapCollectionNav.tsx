import { Link } from 'react-router-dom'
import { loboWorkshopMaps } from '../../shared/lobo-workshop-maps.mjs'
export default function MapCollectionNav({ aurora = false }: { aurora?: boolean }) {
  return <nav className="lobo-map-section-nav" aria-label="Map collections">
    <Link aria-current={!aurora ? 'page' : undefined} to="/maps">ITS18 <span>{loboWorkshopMaps.length} setups</span></Link>
    <Link aria-current={aurora ? 'page' : undefined} to="/maps/aurora-vii">Aurora VII <span>24 locations + public terrain</span></Link>
  </nav>
}

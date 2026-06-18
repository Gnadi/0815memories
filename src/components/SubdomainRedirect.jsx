import { Navigate } from 'react-router-dom'
import { getSubdomainSlug } from '../utils/familySlug'
import LandingPage from '../pages/LandingPage'

// Root "/" element. On a family subdomain (e.g. the-millers.kaydo.app) we send
// the visitor to the login form; otherwise we render the public landing page.
// During static pre-rendering getSubdomainSlug() returns null, so the landing
// page is what gets baked into the HTML for "/".
export default function SubdomainRedirect() {
  const subdomain = getSubdomainSlug()
  if (subdomain) {
    return <Navigate to="/login" replace />
  }
  return <LandingPage />
}

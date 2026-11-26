import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

// Pages where the phone's Back button leaves the app instead of going back.
const EXIT_PATHS = ['/home', '/login']

/**
 * The Android Back button in the app:
 *  - an open popup closes first (same as pressing Escape);
 *  - on Home (or Login) the app closes, so Back never loops between Login and Home;
 *  - anywhere else it goes back one page, or to Home when there is nothing to go back to.
 * Does nothing in a browser.
 */
export function useAndroidBackButton() {
  const navigate = useNavigate()
  const location = useLocation()
  // The listener is registered once; it reads the current page from here.
  const pathRef = useRef(location.pathname)
  useEffect(() => {
    pathRef.current = location.pathname
  }, [location.pathname])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const handle = App.addListener('backButton', () => {
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]')
      if (dialog) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        return
      }
      if (EXIT_PATHS.includes(pathRef.current)) {
        void App.exitApp()
        return
      }
      // React Router keeps the position in this tab's history; 0 = the first page the app opened on.
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
      if (idx > 0) navigate(-1)
      else navigate('/home', { replace: true })
    })
    return () => {
      void handle.then((h) => h.remove())
    }
  }, [navigate])
}

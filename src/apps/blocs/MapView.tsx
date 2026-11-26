import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Database, Row } from './types'
import { primaryColumn } from './dbViews'
import { cellDisplay } from './fields'

const markerIcon = L.icon({
  iconUrl: `${import.meta.env.BASE_URL}leaflet/marker-icon.png`,
  iconRetinaUrl: `${import.meta.env.BASE_URL}leaflet/marker-icon-2x.png`,
  shadowUrl: `${import.meta.env.BASE_URL}leaflet/marker-shadow.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})

const geocodeCache = new Map<string, { lat: number; lon: number } | null>()

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  if (geocodeCache.has(address)) return geocodeCache.get(address) ?? null
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
      { headers: { 'Accept-Language': 'fr' } }
    )
    const data = (await r.json()) as { lat: string; lon: string }[]
    const hit = data[0] ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null
    geocodeCache.set(address, hit)
    return hit
  } catch {
    geocodeCache.set(address, null)
    return null
  }
}

export default function MapView({ db, rows }: { db: Database; rows: Row[] }) {
  const locCol = db.columns.find((c) => c.type === 'location')
  const primary = primaryColumn(db)
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])

  useEffect(() => {
    if (!locCol) return
    if (!mapRef.current) return
    if (!leafletRef.current) {
      leafletRef.current = L.map(mapRef.current, { zoomControl: true }).setView([46.6, 2.3], 5)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(leafletRef.current)
    }
    const map = leafletRef.current
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    const withLoc = rows.filter((r) => cellDisplay(r.cells[locCol.id]).trim())
    if (withLoc.length === 0) return

    let cancelled = false
    const bounds: L.LatLngBounds | null = null
    const bb = L.latLngBounds([])
    void (async () => {
      for (const r of withLoc) {
        if (cancelled) return
        const addr = cellDisplay(r.cells[locCol.id])
        const hit = await geocode(addr)
        if (!hit || cancelled) continue
        const title = primary ? cellDisplay(r.cells[primary.id]) : 'Ligne'
        const m = L.marker([hit.lat, hit.lon], { icon: markerIcon })
          .addTo(map)
          .bindPopup(`<strong>${title}</strong><br/>${addr}`)
        markersRef.current.push(m)
        bb.extend([hit.lat, hit.lon])
      }
      if (!cancelled && markersRef.current.length > 0) map.fitBounds(bb, { padding: [40, 40] })
    })()
    return () => {
      cancelled = true
    }
  }, [db, rows, locCol, primary])

  useEffect(() => {
    return () => {
      leafletRef.current?.remove()
      leafletRef.current = null
    }
  }, [])

  if (!locCol) {
    return (
      <p className="db-empty">
        Ajoute une colonne « Lieu » (adresse) pour utiliser la vue carte.
      </p>
    )
  }
  return (
    <div className="db-map-wrap">
      <div ref={mapRef} className="db-map" />
      <p className="db-type" style={{ padding: '4px 2px' }}>
        Géocodage Nominatim/OSM — les adresses sont résolues à la volée (connexion requise)
      </p>
    </div>
  )
}

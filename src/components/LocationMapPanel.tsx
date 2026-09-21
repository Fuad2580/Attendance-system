import React from 'react';
import { MapPin, Crosshair, RefreshCw } from 'lucide-react';
import { NearestLocationResult } from '../utils/geo';

interface LocationMapPanelProps {
  latitude: number;
  longitude: number;
  accuracy: number;
  geoStatus: NearestLocationResult;
  isFlexible?: boolean;
  isGpsLoading: boolean;
  onRefresh: () => void;
}

/**
 * Peta lokasi (OpenStreetMap embed - tidak butuh API key).
 * Hanya menampilkan; lokasi absensi ditentukan otomatis dari kantor terdekat.
 */
export const LocationMapPanel: React.FC<LocationMapPanelProps> = ({
  latitude,
  longitude,
  accuracy,
  geoStatus,
  isFlexible,
  isGpsLoading,
  onRefresh,
}) => {
  const delta = 0.004;
  const bbox = [longitude - delta, latitude - delta / 2, longitude + delta, latitude + delta / 2]
    .map((n) => n.toFixed(5))
    .join('%2C');
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude.toFixed(
    5
  )}%2C${longitude.toFixed(5)}`;

  const inRange = isFlexible || geoStatus.isWithinRadius;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-800 truncate">
            {geoStatus.location?.locationName || 'Mencari kantor terdekat...'}
          </span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          title="Perbarui titik GPS"
        >
          <RefreshCw className={`w-4 h-4 ${isGpsLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="relative flex-1 min-h-[180px] bg-slate-100">
        <iframe
          title="Peta lokasi absensi"
          src={src}
          className="absolute inset-0 w-full h-full border-0"
          loading="lazy"
        />
      </div>

      <div className="px-4 py-3 border-t border-slate-100 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500 flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5" />
            Jarak ke kantor
          </span>
          <span
            className={`font-bold px-2 py-0.5 rounded-full ${
              inRange ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}
          >
            {geoStatus.distance >= 1000
              ? `${(geoStatus.distance / 1000).toFixed(1)} km`
              : `${geoStatus.distance} m`}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Radius {geoStatus.allowedRadius} m • akurasi GPS ±{accuracy} m. Lokasi dipilih otomatis
          dari kantor terdekat dan tidak bisa diubah manual.
        </p>
      </div>
    </div>
  );
};

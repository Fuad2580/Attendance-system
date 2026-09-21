import React from 'react';
import { MapPin, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { NearestLocationResult } from '../utils/geo';

interface LocationCardProps {
  accuracy: number;
  geoStatus: NearestLocationResult;
  isFlexible?: boolean;
  isGpsLoading: boolean;
  onRefresh: () => void;
}

/**
 * Kartu lokasi ringkas (tanpa peta): cukup nama kantor terdekat, jarak, dan status radius.
 */
export const LocationCard: React.FC<LocationCardProps> = ({
  accuracy,
  geoStatus,
  isFlexible,
  isGpsLoading,
  onRefresh,
}) => {
  const inRange = isFlexible || geoStatus.isWithinRadius;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            inRange ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          }`}
        >
          <MapPin className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500">Lokasi terdeteksi</p>
          <p className="text-sm font-bold text-slate-900 truncate">
            {geoStatus.location?.locationName || 'Mencari kantor terdekat...'}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {geoStatus.distance >= 1000
              ? `${(geoStatus.distance / 1000).toFixed(1)} km`
              : `${geoStatus.distance} m`}{' '}
            dari titik kantor • radius {geoStatus.allowedRadius} m • akurasi ±{accuracy} m
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
            inRange ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {inRange ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
          {inRange ? 'Dalam jangkauan' : 'Di luar radius'}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Perbarui titik GPS"
        >
          <RefreshCw className={`w-4 h-4 ${isGpsLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
};

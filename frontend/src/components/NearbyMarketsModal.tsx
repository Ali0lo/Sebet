"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  MapPin,
  Navigation,
  Compass,
  ExternalLink,
  Footprints,
  Clock,
  Store,
  RefreshCw,
} from "lucide-react";
import { getNearbyStores } from "@/lib/api";
import { NearbyStore } from "@/lib/types";
import { useSebEtStore, BAKU_LOCATIONS } from "@/lib/store";
import { ChainLogo } from "@/components/ChainLogo";

interface NearbyMarketsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NearbyMarketsModal: React.FC<NearbyMarketsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { selectedLocation, setLocation } = useSebEtStore();
  const [stores, setStores] = useState<NearbyStore[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [selectedChainFilter, setSelectedChainFilter] = useState<string>("all");
  const [radiusKm, setRadiusKm] = useState<number>(3.0);

  // Load stores whenever coordinates or radius change
  useEffect(() => {
    if (!isOpen) return;

    async function loadStores() {
      setIsLoading(true);
      try {
        const data = await getNearbyStores(
          selectedLocation.lat,
          selectedLocation.lon,
          radiusKm
        );
        setStores(data);
      } catch (err) {
        console.error("Failed to load nearby stores", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadStores();
  }, [isOpen, selectedLocation.lat, selectedLocation.lon, radiusKm]);

  if (!isOpen) return null;

  // Trigger HTML5 Real-time GPS
  const handleGetLiveLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsError("Cihazınızda GPS geolokasiya dəstəklənmir.");
      return;
    }

    setIsLocating(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({
          name: "Cari Məkanım (Canlı GPS)",
          lat: latitude,
          lon: longitude,
        });
        setGpsActive(true);
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        if (err.code === 1) {
          setGpsError(
            "Məkan icazəsi verilmədi. Brauzerinizdə məkan icazəsini aktiv edin və ya siyahıdan seçin."
          );
        } else {
          setGpsError("Cari məkan təyin edilə bilmədi. Yenidən cəhd edin.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const filteredStores =
    selectedChainFilter === "all"
      ? stores
      : stores.filter((s) => s.chain_slug === selectedChainFilter);

  // Map embed URL using OpenStreetMap centered on active coordinates
  const mapEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${
    selectedLocation.lon - 0.02
  }%2C${selectedLocation.lat - 0.015}%2C${selectedLocation.lon + 0.02}%2C${
    selectedLocation.lat + 0.015
  }&layer=mapnik&marker=${selectedLocation.lat}%2C${selectedLocation.lon}`;

  // Google Maps Search link around current coordinates
  const googleMapsSearchUrl = `https://www.google.com/maps/search/supermarket/@${selectedLocation.lat},${selectedLocation.lon},15z`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shadow-2xs">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span>Yaxın Marketlər & Xəritə</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30">
                  Canlı GPS
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Bakı üzrə Bravo, Araz, OBA və Bazarstore filialları
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Real-time GPS Trigger Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-black">
                <Navigation className="w-4 h-4 text-amber-300 shrink-0" />
                <span className="truncate">{selectedLocation.name}</span>
              </div>
              <p className="text-[10px] text-emerald-100 mt-0.5 font-mono">
                {selectedLocation.lat.toFixed(4)}, {selectedLocation.lon.toFixed(4)}
              </p>
            </div>

            <button
              disabled={isLocating}
              onClick={handleGetLiveLocation}
              className="px-3 py-2 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-black shrink-0 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-75"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLocating ? "animate-spin" : ""}`}
              />
              <span>{isLocating ? "Axtarılır..." : "Cari Məkanım (GPS)"}</span>
            </button>
          </div>

          {/* GPS Error Message */}
          {gpsError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
              {gpsError}
            </div>
          )}

          {/* Preset Location Quick Pills */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Və ya Bakı Ərazisini Seçin:
            </label>
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {BAKU_LOCATIONS.map((loc) => (
                <button
                  key={loc.name}
                  onClick={() => {
                    setLocation(loc);
                    setGpsActive(false);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold shrink-0 border transition-all ${
                    selectedLocation.name === loc.name && !gpsActive
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200/80"
                  }`}
                >
                  {loc.name.split("/")[0].trim()}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Map Frame with Direct Google Maps Link */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Xəritə Baxışı & Filiallar:
              </label>
              <a
                href={googleMapsSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Google Maps-də Tam Aç</span>
              </a>
            </div>

            <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner bg-slate-100 dark:bg-slate-800">
              <iframe
                title="Baku Supermarket Map"
                src={mapEmbedUrl}
                className="w-full h-full border-0 pointer-events-auto"
                loading="lazy"
              />
              <div className="absolute bottom-2 left-2 right-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-[10px]">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Mərkəz: {selectedLocation.name}
                </span>
                <span className="text-slate-500 font-mono">
                  {stores.length} yaxın filial
                </span>
              </div>
            </div>
          </div>

          {/* Radius & Chain Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            {/* Radius Selector */}
            <div className="flex items-center gap-1">
              {[1.0, 2.0, 3.0, 5.0].map((r) => (
                <button
                  key={r}
                  onClick={() => setRadiusKm(r)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all ${
                    radiusKm === r
                      ? "bg-slate-900 dark:bg-emerald-600 text-white border-slate-900 dark:border-emerald-600"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {r} km
                </button>
              ))}
            </div>

            {/* Chain Filter */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {[
                { label: "Hamısı", slug: "all" },
                { label: "Bravo", slug: "bravo" },
                { label: "Araz", slug: "araz" },
                { label: "OBA", slug: "oba" },
                { label: "Bazarstore", slug: "bazarstore" },
              ].map((c) => (
                <button
                  key={c.slug}
                  onClick={() => setSelectedChainFilter(c.slug)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all ${
                    selectedChainFilter === c.slug
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nearby Stores List */}
          <div className="space-y-2">
            {isLoading ? (
              <div className="space-y-2 py-2">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200 dark:border-slate-700"
                  />
                ))}
              </div>
            ) : filteredStores.length === 0 ? (
              <div className="text-center py-8 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                <Store className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-1.5" />
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Bu radiusda filial tapılmadı
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Axtarış radiusunu 3 km və ya 5 km olaraq artırın.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {filteredStores.map((st) => {
                  const distMeters = Math.round((st.distance_km || 0) * 1000);
                  const walkingMins = Math.max(1, Math.round(distMeters / 80)); // 80m/min avg walking speed

                  // Direct Google Maps Turn-by-Turn Navigation URL
                  const googleMapsNavUrl = `https://www.google.com/maps/dir/?api=1&origin=${selectedLocation.lat},${selectedLocation.lon}&destination=${st.latitude},${st.longitude}&travelmode=walking`;

                  return (
                    <div
                      key={st.id}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-all flex flex-col gap-2.5"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ChainLogo slug={st.chain_slug} size="sm" />
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {st.branch_name}
                            </h4>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {st.address} • {st.neighborhood}
                            </p>
                          </div>
                        </div>

                        {/* Walking distance & time tag */}
                        <div className="text-right shrink-0">
                          <div className="text-xs font-black text-emerald-700 dark:text-emerald-400 flex items-center justify-end gap-1">
                            <Footprints className="w-3 h-3" />
                            <span>
                              {distMeters < 1000
                                ? `${distMeters} m`
                                : `${st.distance_km} km`}
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-end gap-0.5 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            <span>~{walkingMins} dəq piyada</span>
                          </span>
                        </div>
                      </div>

                      {/* Action buttons: Google Maps Directions & Select Hub */}
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <a
                          href={googleMapsNavUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-1.5 px-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-colors border border-emerald-200/80 dark:border-emerald-800/40 shadow-2xs"
                        >
                          <Navigation className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>Google Maps-də Marşrut</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                        </a>

                        <button
                          onClick={() => {
                            setLocation({
                              name: st.branch_name,
                              lat: st.latitude,
                              lon: st.longitude,
                            });
                            onClose();
                          }}
                          className="py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-colors"
                        >
                          Məkan et
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

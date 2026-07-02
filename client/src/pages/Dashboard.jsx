/**
 * Dashboard.jsx  –  LifeDrop Admin Dashboard
 *
 * Features:
 *  - Live Google Map showing donors (green) and patients (red)
 *  - Click any donor marker → fetches real Google Directions route to
 *    the matched patient hospital and shows a route info panel
 *    (distance, estimated time, first 3 turn-by-turn steps)
 *  - Donor eligibility approval / rejection
 *  - Patient request approval / rejection
 *  - Donation history table
 *
 * API key setup:
 *   Add  VITE_GOOGLE_MAPS_API_KEY=<your_key>  to  client/.env
 *   Enable: Maps JavaScript API + Directions API in Google Cloud Console
 */

import React, {
    useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
    DirectionsRenderer,
    GoogleMap,
    InfoWindowF,
    LoadScript,
    MarkerF,
} from '@react-google-maps/api';
import { useNavigate } from 'react-router-dom';
import {
    Activity, AlertTriangle, Building2, CalendarDays, Car,
    Droplet, HeartPulse, Loader2, MapPin, Navigation,
    RefreshCw, ShieldCheck, Users,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAP_CONTAINER_STYLE = {
    width: '100%', height: '100%', minHeight: '540px', borderRadius: '32px',
};
const INDIA_CENTER          = { lat: 20.5937, lng: 78.9629 };
const ADMIN_RESET_EVENT     = 'lifedrop-admin-reset-complete';
const DONATION_COOLDOWN_DAYS = 112;
const EMPTY_DATA = {
    stats: { donors: 0, eligibleDonors: 0, activeRequests: 0, criticalRequests: 0 },
    donors: [], patients: [], historyByDate: {},
};
const GOOGLE_MAPS_LIBRARIES = ['places'];

const cooldownLeft = (d) => {
    if (!d) return 0;
    return Math.max(0, DONATION_COOLDOWN_DAYS -
        Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000));
};

const STATUS_TONE = {
    Eligible:        'bg-emerald-50 text-emerald-700',
    Ineligible:      'bg-rose-50 text-blood-dark',
    'Not Submitted': 'bg-amber-50 text-amber-700',
};

// ─── Tiny reusable components ─────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, helper, tone }) => (
    <div className="soft-card p-6">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">{label}</p>
                <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
            </div>
            <div className={`rounded-3xl p-4 ${tone}`}><Icon size={28} /></div>
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-500">{helper}</p>
    </div>
);

// ─── Route info overlay ───────────────────────────────────────────────────────

const RoutePanel = ({ info, onClear }) => {
    if (!info) return null;
    return (
        <div className="absolute bottom-4 left-4 right-4 z-10 rounded-[24px] border border-rose-100 bg-white/95 p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-rose-50 p-3 text-blood-DEFAULT"><Car size={20} /></div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                            {info.donorName} → {info.destName}
                        </p>
                        <p className="mt-1 text-base font-black text-slate-900">Driving Route</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClear}
                    className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-200"
                >
                    ✕ Clear
                </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-rose-50 p-3 text-center">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Distance</p>
                    <p className="mt-1 text-xl font-black text-blood-DEFAULT">{info.distance}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-3 text-center">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Est. Time</p>
                    <p className="mt-1 text-xl font-black text-emerald-700">{info.duration}</p>
                </div>
                <div className="hidden rounded-2xl bg-sky-50 p-3 text-center sm:block">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Donor</p>
                    <p className="mt-1 truncate text-sm font-black text-sky-700">{info.donorName}</p>
                </div>
            </div>
            {info.steps?.length > 0 && (
                <div className="mt-4 space-y-2">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Turn-by-turn</p>
                    {info.steps.slice(0, 4).map((step, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blood-DEFAULT" />
                            <span
                                className="flex-1 text-xs font-semibold text-slate-700"
                                dangerouslySetInnerHTML={{ __html: step.instructions }}
                            />
                            <span className="shrink-0 text-xs font-black text-slate-400">{step.distance}</span>
                        </div>
                    ))}
                </div>
            )}
            <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${info.donorLat},${info.donorLng}&destination=${info.destLat},${info.destLng}&travelmode=driving`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blood-DEFAULT py-3 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-blood-dark"
            >
                <Navigation size={14} /> Open in Google Maps
            </a>
        </div>
    );
};

// ─── Map section (inside LoadScript) ─────────────────────────────────────────

const MapSection = ({ donors, patients, apiKey }) => {
    const [directions, setDirections]   = useState(null);
    const [routeInfo, setRouteInfo]     = useState(null);
    const [activeMarker, setActiveMarker] = useState(null);
    const [loadingRoute, setLoadingRoute] = useState(false);
    const mapRef = useRef(null);

    const mapCenter = useMemo(() => {
        const p = patients.find(x => x.latitude && x.longitude);
        const d = donors.find(x => x.latitude && x.longitude);
        const s = p || d;
        return s ? { lat: Number(s.latitude), lng: Number(s.longitude) } : INDIA_CENTER;
    }, [donors, patients]);

    const fetchRoute = useCallback((donor, patient) => {
        if (!donor.latitude || !donor.longitude || !patient.latitude || !patient.longitude) return;
        setLoadingRoute(true);
        setDirections(null);
        setRouteInfo(null);

        const directionsService = new window.google.maps.DirectionsService();
        directionsService.route(
            {
                origin:      { lat: Number(donor.latitude),  lng: Number(donor.longitude)  },
                destination: { lat: Number(patient.latitude), lng: Number(patient.longitude) },
                travelMode:  window.google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
                setLoadingRoute(false);
                if (status === 'OK' && result) {
                    setDirections(result);
                    const leg = result.routes[0]?.legs[0];
                    setRouteInfo({
                        donorName: donor.name,
                        destName:  patient.patient_name || 'Hospital',
                        distance:  leg?.distance?.text  || '–',
                        duration:  leg?.duration?.text  || '–',
                        donorLat:  donor.latitude,
                        donorLng:  donor.longitude,
                        destLat:   patient.latitude,
                        destLng:   patient.longitude,
                        steps: leg?.steps?.map(s => ({
                            instructions: s.instructions,
                            distance: s.distance?.text,
                        })) || [],
                    });
                    // fit map
                    const bounds = new window.google.maps.LatLngBounds();
                    bounds.extend({ lat: Number(donor.latitude),   lng: Number(donor.longitude)   });
                    bounds.extend({ lat: Number(patient.latitude), lng: Number(patient.longitude) });
                    mapRef.current?.fitBounds(bounds);
                } else {
                    alert(`Could not get directions: ${status}`);
                }
            }
        );
    }, []);

    const handleDonorClick = useCallback((donor) => {
        setActiveMarker(`donor-${donor.id}`);
        // Find best matched patient (nearest by donor assignment or first active)
        const matched = patients.find(p => p.nearest_donor_id === donor.id)
            || patients.find(p => p.latitude && p.longitude);
        if (matched) fetchRoute(donor, matched);
    }, [patients, fetchRoute]);

    return (
        <div className="relative h-[580px]">
            <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={mapCenter}
                zoom={11}
                onLoad={map => { mapRef.current = map; }}
                options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: true }}
            >
                {/* Donor markers – green */}
                {donors.filter(d => d.latitude && d.longitude).map(donor => (
                    <MarkerF
                        key={`donor-${donor.id}`}
                        position={{ lat: Number(donor.latitude), lng: Number(donor.longitude) }}
                        icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png', scaledSize: new window.google.maps.Size(36, 36) }}
                        onClick={() => handleDonorClick(donor)}
                        title={`${donor.name} (${donor.blood_group})`}
                    >
                        {activeMarker === `donor-${donor.id}` && (
                            <InfoWindowF onCloseClick={() => setActiveMarker(null)}>
                                <div className="min-w-[140px] p-1">
                                    <p className="font-black text-slate-900">{donor.name}</p>
                                    <p className="mt-0.5 text-xs font-bold text-slate-500">{donor.blood_group} · {donor.eligibility_status}</p>
                                    <p className="mt-1 text-xs font-black text-blood-DEFAULT">Click to see route →</p>
                                </div>
                            </InfoWindowF>
                        )}
                    </MarkerF>
                ))}

                {/* Patient/hospital markers – red */}
                {patients.filter(p => p.latitude && p.longitude).map(patient => (
                    <MarkerF
                        key={`patient-${patient.id}`}
                        position={{ lat: Number(patient.latitude), lng: Number(patient.longitude) }}
                        icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png', scaledSize: new window.google.maps.Size(36, 36) }}
                        onClick={() => setActiveMarker(`patient-${patient.id}`)}
                        title={`${patient.patient_name} (${patient.blood_group_required})`}
                    >
                        {activeMarker === `patient-${patient.id}` && (
                            <InfoWindowF onCloseClick={() => setActiveMarker(null)}>
                                <div className="min-w-[140px] p-1">
                                    <p className="font-black text-slate-900">{patient.patient_name}</p>
                                    <p className="mt-0.5 text-xs font-bold text-slate-500">{patient.blood_group_required} · {patient.emergency_level}</p>
                                    <p className="mt-1 text-xs text-slate-500">{patient.request_status}</p>
                                </div>
                            </InfoWindowF>
                        )}
                    </MarkerF>
                ))}

                {/* Directions route */}
                {directions && (
                    <DirectionsRenderer
                        directions={directions}
                        options={{
                            suppressMarkers: true,
                            polylineOptions: { strokeColor: '#e11d48', strokeWeight: 5, strokeOpacity: 0.85 },
                        }}
                    />
                )}
            </GoogleMap>

            {/* Loading spinner over map */}
            {loadingRoute && (
                <div className="absolute inset-0 flex items-center justify-center rounded-[32px] bg-white/60 backdrop-blur-sm">
                    <div className="flex items-center gap-3 rounded-full bg-white px-5 py-3 shadow-xl">
                        <Loader2 className="animate-spin text-blood-DEFAULT" size={20} />
                        <span className="text-sm font-black text-slate-700">Getting directions…</span>
                    </div>
                </div>
            )}

            {/* Route info panel */}
            <RoutePanel info={routeInfo} onClear={() => { setDirections(null); setRouteInfo(null); }} />
        </div>
    );
};

// ─── Main Dashboard component ─────────────────────────────────────────────────

const Dashboard = () => {
    const { user, loading, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const [adminData,       setAdminData]       = useState(EMPTY_DATA);
    const [syncing,         setSyncing]         = useState(true);
    const [message,         setMessage]         = useState('');
    const [updatingDonorId, setUpdatingDonorId] = useState(null);
    const [selectedDonor,   setSelectedDonor]   = useState(null);

    const visiblePatients = useMemo(
        () => (adminData.patients || []).filter(p => !['Completed','Cancelled'].includes(p.request_status)),
        [adminData.patients],
    );
    const visibleDonors = useMemo(
        () => (adminData.donors || []).filter(d => cooldownLeft(d.last_donation_date) === 0),
        [adminData.donors],
    );

    useEffect(() => {
        if (!loading && !user)                           { navigate('/login'); return; }
        if (!loading && user && user.role !== 'admin')   { logout(); navigate('/login'); }
    }, [user, loading, navigate, logout]);

    const fetchAdminOverview = useCallback(async () => {
        if (!user || user.role !== 'admin') return;
        setSyncing(true); setMessage('');
        try {
            const res = await api.get('/admin/overview');
            setAdminData(res.data);
        } catch (err) {
            setMessage(err.response?.data?.msg || 'Unable to load admin overview.');
        } finally {
            setSyncing(false);
        }
    }, [user]);

    useEffect(() => { fetchAdminOverview(); }, [fetchAdminOverview]);

    useEffect(() => {
        const handler = (e) => {
            setSelectedDonor(null);
            setMessage(e.detail?.msg || 'Data reset successfully.');
            setAdminData(e.detail || EMPTY_DATA);
            fetchAdminOverview();
        };
        window.addEventListener(ADMIN_RESET_EVENT, handler);
        return () => window.removeEventListener(ADMIN_RESET_EVENT, handler);
    }, [fetchAdminOverview]);

    const updateEligibility = async (donorId, status) => {
        setUpdatingDonorId(donorId); setMessage('');
        try {
            await api.post('/admin/donor-eligibility', { donorId, status });
            setMessage(`Donor marked as ${status}.`);
            await fetchAdminOverview();
        } catch (err) {
            setMessage(err.response?.data?.msg || 'Update failed.');
        } finally {
            setUpdatingDonorId(null);
        }
    };

    const reviewRequestDonor = async (requestId, donorId, decision) => {
        setMessage('');
        try {
            await api.post('/admin/request-donor-review', { requestId, donorId, decision });
            setMessage(decision === 'approve'
                ? 'Donor approved – request moved to Donation In Progress.'
                : 'Donor rejected – queue shifted to next donor.');
            await fetchAdminOverview();
        } catch (err) {
            setMessage(err.response?.data?.msg || 'Review failed.');
        }
    };

    if (loading || !user) return (
        <div className="flex flex-1 items-center justify-center text-sm font-bold uppercase tracking-[0.3em] text-slate-400">
            Loading…
        </div>
    );

    const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">

            {/* ── Header ── */}
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-blood-DEFAULT">Admin command center</p>
                    <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900">LifeDrop Admin Dashboard</h1>
                    <p className="mt-2 max-w-3xl text-base font-medium text-slate-500">
                        Monitor donors, patients, eligibility, and live routes on the map.
                    </p>
                </div>
                <button type="button" onClick={fetchAdminOverview}
                    className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white">
                    {syncing ? 'Syncing…' : 'Refresh Data'}
                </button>
            </div>

            {message && (
                <div className="mb-6 rounded-3xl bg-rose-50 px-5 py-4 text-sm font-bold text-blood-dark">{message}</div>
            )}

            {/* ── Stat cards ── */}
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                <StatCard icon={Users}         label="Total Donors"    value={adminData.stats.donors || 0}          helper="Registered donor accounts." tone="bg-rose-50 text-blood-DEFAULT" />
                <StatCard icon={ShieldCheck}   label="Eligible Donors" value={adminData.stats.eligibleDonors || 0}  helper="Currently eligible after screening." tone="bg-emerald-50 text-emerald-600" />
                <StatCard icon={Activity}      label="Active Requests" value={adminData.stats.activeRequests || 0}  helper="Open patient requests." tone="bg-sky-50 text-sky-600" />
                <StatCard icon={AlertTriangle} label="Critical Cases"  value={adminData.stats.criticalRequests || 0} helper="Highest-priority requests." tone="bg-amber-50 text-amber-600" />
            </div>

            {/* ── Map ── */}
            <section className="soft-card mt-8 overflow-hidden p-6">
                <div className="mb-5 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">Live Map — Donors & Patients</h2>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                            🟢 Green = donors &nbsp;·&nbsp; 🔴 Red = patients.&nbsp;
                            <strong>Click a donor marker</strong> to see the driving route to their matched patient.
                        </p>
                    </div>
                    <MapPin className="text-blood-DEFAULT" size={26} />
                </div>

                <div className="h-[580px] overflow-hidden rounded-[32px] bg-slate-100">
                    {googleMapsApiKey ? (
                        <LoadScript googleMapsApiKey={googleMapsApiKey} libraries={GOOGLE_MAPS_LIBRARIES}>
                            <MapSection
                                donors={visibleDonors}
                                patients={visiblePatients}
                                apiKey={googleMapsApiKey}
                            />
                        </LoadScript>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                            <MapPin className="text-blood-DEFAULT" size={48} />
                            <h3 className="mt-4 text-2xl font-black text-slate-900">Google Maps key not configured</h3>
                            <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
                                Create <code className="rounded bg-slate-100 px-1">client/.env</code> and add:<br />
                                <code className="mt-2 block rounded bg-slate-100 px-3 py-2 text-left text-xs">
                                    VITE_GOOGLE_MAPS_API_KEY=your_key_here
                                </code>
                                Enable <em>Maps JavaScript API</em> and <em>Directions API</em> in Google Cloud Console.
                            </p>
                        </div>
                    )}
                </div>
            </section>

            {/* ── Patient Requests ── */}
            <section className="soft-card mt-8 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="rounded-3xl bg-rose-50 p-3 text-blood-DEFAULT"><Building2 size={24} /></div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">Patient Requests</h2>
                        <p className="text-sm font-semibold text-slate-500">Active blood applications from the mobile app.</p>
                    </div>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                    {visiblePatients.length === 0 ? (
                        <p className="rounded-3xl bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">No patient requests yet.</p>
                    ) : visiblePatients.map(patient => (
                        <article key={patient.id} className="rounded-[28px] border border-rose-100 bg-white p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-blood-DEFAULT">{patient.emergency_level} Priority</p>
                                    <h3 className="mt-2 text-xl font-black text-slate-900">{patient.patient_name}</h3>
                                    <p className="mt-1 text-sm font-semibold text-slate-500">{patient.requester_name} · {patient.requester_phone}</p>
                                </div>
                                <span className="rounded-full bg-rose-50 px-4 py-2 text-lg font-black text-blood-dark">{patient.blood_group_required}</span>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.2em]">
                                <span className="rounded-full bg-slate-100 px-3 py-2 text-slate-700">{patient.units_required} Units</span>
                                <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-700">{patient.request_status}</span>
                                {patient.nearest_donor_distance_km !== null && (
                                    <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">
                                        {patient.nearest_donor_distance_km} km · {patient.nearest_donor_name}
                                    </span>
                                )}
                                <span className="rounded-full bg-sky-50 px-3 py-2 text-sky-700">{patient.nearest_donor_status}</span>
                            </div>
                            {/* Open route in Google Maps */}
                            {patient.nearest_donor_latitude && patient.nearest_donor_longitude && (
                                <a
                                    href={`https://www.google.com/maps/dir/?api=1&origin=${patient.nearest_donor_latitude},${patient.nearest_donor_longitude}&destination=${patient.latitude},${patient.longitude}&travelmode=driving`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 py-2 text-xs font-black uppercase tracking-[0.15em] text-blood-DEFAULT hover:bg-rose-100"
                                >
                                    <Navigation size={14} /> Navigate donor → hospital
                                </a>
                            )}
                            {patient.nearest_donor_id && (
                                <div className="mt-3 flex gap-2">
                                    <button type="button"
                                        onClick={() => reviewRequestDonor(patient.id, patient.nearest_donor_id, 'approve')}
                                        className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-emerald-700">
                                        Approve Donor
                                    </button>
                                    <button type="button"
                                        onClick={() => reviewRequestDonor(patient.id, patient.nearest_donor_id, 'reject')}
                                        className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-rose-700">
                                        Reject Donor
                                    </button>
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            </section>

            {/* ── Donor table ── */}
            <section className="soft-card mt-8 p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">Donor Eligibility & Location</h2>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                            Click a row for Aadhaar details. Use Approve / Reject to update eligibility.
                        </p>
                    </div>
                    <Droplet className="text-blood-DEFAULT" size={26} />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left">
                        <thead>
                            <tr className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                                {['Donor','Assigned Request','Blood','Eligibility','Availability','Age/Weight','Location','Donations','Review'].map(h => (
                                    <th key={h} className="px-4 py-4">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {visibleDonors.map(donor => (
                                <tr key={donor.id}
                                    className="cursor-pointer border-t border-rose-100 hover:bg-rose-50/30"
                                    onClick={() => setSelectedDonor(donor)}>
                                    <td className="px-4 py-4">
                                        <p className="font-black text-slate-900">{donor.name}</p>
                                        <p className="text-sm font-semibold text-slate-500">{donor.phone}</p>
                                    </td>
                                    <td className="px-4 py-4">
                                        <p className="text-sm font-black text-slate-900">{donor.assigned_patient_name || 'Unassigned'}</p>
                                        <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                                            {donor.assignment_role}{donor.assigned_patient_blood_group ? ` · ${donor.assigned_patient_blood_group}` : ''}
                                        </p>
                                    </td>
                                    <td className="px-4 py-4 text-lg font-black text-blood-DEFAULT">{donor.blood_group}</td>
                                    <td className="px-4 py-4">
                                        <span className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.15em] ${STATUS_TONE[donor.eligibility_status] || 'bg-slate-100 text-slate-700'}`}>
                                            {donor.eligibility_status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-sm font-bold text-slate-700">{donor.availability_status}</td>
                                    <td className="px-4 py-4 text-sm font-bold text-slate-700">{donor.age || '–'} yr / {donor.weight || '–'} kg</td>
                                    <td className="px-4 py-4 text-sm font-bold text-slate-700">
                                        {donor.latitude && donor.longitude
                                            ? <a href={`https://www.google.com/maps?q=${donor.latitude},${donor.longitude}`} target="_blank" rel="noopener noreferrer" className="text-blood-DEFAULT hover:underline">{Number(donor.latitude).toFixed(4)}, {Number(donor.longitude).toFixed(4)}</a>
                                            : 'Not set'}
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                                            <HeartPulse size={16} className="text-blood-DEFAULT" />{donor.donation_count}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex gap-2">
                                            <button type="button" disabled={updatingDonorId === donor.id}
                                                onClick={e => { e.stopPropagation(); updateEligibility(donor.id,'Eligible'); }}
                                                className="rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-[0.15em] text-white disabled:opacity-60 hover:bg-emerald-700">Approve</button>
                                            <button type="button" disabled={updatingDonorId === donor.id}
                                                onClick={e => { e.stopPropagation(); updateEligibility(donor.id,'Ineligible'); }}
                                                className="rounded-2xl bg-rose-600 px-4 py-2 text-xs font-black uppercase tracking-[0.15em] text-white disabled:opacity-60 hover:bg-rose-700">Reject</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {visibleDonors.length === 0 && (
                        <div className="rounded-3xl bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">No donors yet.</div>
                    )}
                </div>
            </section>

            {/* ── Donation history ── */}
            <section className="soft-card mt-8 p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">Donation History</h2>
                        <p className="mt-1 text-sm font-semibold text-slate-500">Completed, QR-verified donations grouped by date.</p>
                    </div>
                    <CalendarDays className="text-blood-DEFAULT" size={26} />
                </div>
                {Object.keys(adminData.historyByDate || {}).length === 0 ? (
                    <div className="rounded-3xl bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">No verified donations yet.</div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(adminData.historyByDate).map(([date, entries]) => (
                            <div key={date} className="rounded-[28px] border border-rose-100 bg-white p-5">
                                <p className="text-xs font-black uppercase tracking-[0.25em] text-blood-DEFAULT">{date}</p>
                                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                                    {entries.map(e => (
                                        <div key={e.id} className="rounded-3xl bg-slate-50 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="text-lg font-black text-slate-900">{e.patient_name}</h3>
                                                    <p className="mt-1 text-sm font-semibold text-slate-500">Donor: {e.donor_name || 'N/A'} · {e.donor_phone || 'N/A'}</p>
                                                    <p className="text-sm font-semibold text-slate-500">Requester: {e.requester_name}</p>
                                                </div>
                                                <span className="rounded-full bg-rose-50 px-4 py-2 text-sm font-black text-blood-dark">{e.blood_group_required}</span>
                                            </div>
                                            <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-emerald-700">{e.status} · {e.units_required} unit(s)</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* ── Syncing indicator ── */}
            {syncing && (
                <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white shadow-2xl">
                    <Loader2 className="animate-spin" size={16} /> Syncing
                </div>
            )}

            {/* ── Donor detail modal ── */}
            {selectedDonor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="w-full max-w-2xl rounded-[32px] bg-white p-8 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.3em] text-blood-DEFAULT">Donor Verification</p>
                                <h2 className="mt-2 text-3xl font-black text-slate-900">{selectedDonor.name}</h2>
                                <p className="mt-1 text-sm font-semibold text-slate-500">{selectedDonor.phone}</p>
                            </div>
                            <button type="button" onClick={() => setSelectedDonor(null)}
                                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">Close</button>
                        </div>
                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            <div className="rounded-3xl bg-rose-50 p-4">
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Aadhaar Status</p>
                                <p className="mt-2 text-lg font-black text-slate-900">{selectedDonor.aadhaar_verification_status}</p>
                                <p className="mt-1 text-sm font-semibold text-slate-600">{selectedDonor.aadhaar_nationality_status || 'Pending Review'}</p>
                            </div>
                            <div className="rounded-3xl bg-emerald-50 p-4">
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Trust Score</p>
                                <p className="mt-2 text-lg font-black text-emerald-700">{selectedDonor.trust_score || 40}%</p>
                                <p className="mt-1 text-sm font-semibold text-slate-600">Higher = stronger ID confidence</p>
                            </div>
                            <div className="rounded-3xl bg-slate-50 p-4">
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Health Data</p>
                                <p className="mt-2 text-sm font-bold text-slate-700">Age: {selectedDonor.age || '–'} · Weight: {selectedDonor.weight || '–'} kg</p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                    Fever: {selectedDonor.has_fever ? 'Yes' : 'No'} ·
                                    HIV: {selectedDonor.has_hiv ? 'Yes' : 'No'} ·
                                    Hepatitis: {selectedDonor.has_hepatitis ? 'Yes' : 'No'}
                                </p>
                            </div>
                            <div className="rounded-3xl bg-sky-50 p-4">
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Location</p>
                                {selectedDonor.latitude && selectedDonor.longitude ? (
                                    <a href={`https://www.google.com/maps?q=${selectedDonor.latitude},${selectedDonor.longitude}`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="mt-2 flex items-center gap-2 text-sm font-black text-sky-700 hover:underline">
                                        <MapPin size={14} /> {Number(selectedDonor.latitude).toFixed(5)}, {Number(selectedDonor.longitude).toFixed(5)}
                                    </a>
                                ) : (
                                    <p className="mt-2 text-sm font-bold text-slate-500">Location not set</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;

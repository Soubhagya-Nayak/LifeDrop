import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { GoogleMap, LoadScript, MarkerF, PolylineF } from '@react-google-maps/api';
import { useNavigate } from 'react-router-dom';
import {
    Activity,
    AlertTriangle,
    Building2,
    CalendarDays,
    Droplet,
    HeartPulse,
    Loader2,
    MapPin,
    ShieldCheck,
    Users,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const mapContainerStyle = {
    width: '100%',
    height: '100%',
    minHeight: '580px',
    borderRadius: '32px',
};

const fallbackCenter = { lat: 19.076, lng: 72.8777 };
const ADMIN_RESET_EVENT = 'lifedrop-admin-reset-complete';
const EMPTY_ADMIN_DATA = {
    stats: { donors: 0, eligibleDonors: 0, activeRequests: 0, criticalRequests: 0 },
    donors: [],
    patients: [],
    historyByDate: {},
};

const statusTone = {
    Eligible: 'bg-emerald-50 text-emerald-700',
    Ineligible: 'bg-rose-50 text-blood-dark',
    'Not Submitted': 'bg-amber-50 text-amber-700',
};

const StatCard = ({ icon, label, value, helper, tone }) => {
    const IconComponent = icon;

    return (
        <div className="soft-card p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">{label}</p>
                    <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
                </div>
                <div className={`rounded-3xl p-4 ${tone}`}>
                    <IconComponent size={28} />
                </div>
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-500">{helper}</p>
        </div>
    );
};

const Dashboard = () => {
    const { user, loading, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const [adminData, setAdminData] = useState(EMPTY_ADMIN_DATA);
    const [syncing, setSyncing] = useState(true);
    const [message, setMessage] = useState('');
    const [updatingDonorId, setUpdatingDonorId] = useState(null);
    const [selectedDonor, setSelectedDonor] = useState(null);

    useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
            return;
        }

        if (!loading && user && user.role !== 'admin') {
            logout();
            navigate('/login');
        }
    }, [user, loading, navigate, logout]);

    const fetchAdminOverview = useCallback(async () => {
        if (!user || user.role !== 'admin') return;

        setSyncing(true);
        setMessage('');
        try {
            const res = await api.get('/admin/overview');
            setAdminData(res.data);
        } catch (err) {
            setMessage(err.response?.data?.msg || 'Unable to load admin overview.');
        } finally {
            setSyncing(false);
        }
    }, [user]);

    useEffect(() => {
        fetchAdminOverview();
    }, [fetchAdminOverview]);

    useEffect(() => {
        const handleResetComplete = (event) => {
            setSelectedDonor(null);
            setMessage(event.detail?.msg || 'Admin data reset successfully. You can register fresh accounts now.');
            setAdminData(event.detail || EMPTY_ADMIN_DATA);
            fetchAdminOverview();
        };

        window.addEventListener(ADMIN_RESET_EVENT, handleResetComplete);
        return () => window.removeEventListener(ADMIN_RESET_EVENT, handleResetComplete);
    }, [fetchAdminOverview]);

    const updateEligibility = async (donorId, status) => {
        setUpdatingDonorId(donorId);
        setMessage('');
        try {
            await api.post('/admin/donor-eligibility', { donorId, status });
            setMessage(`Donor eligibility updated to ${status}.`);
            await fetchAdminOverview();
        } catch (err) {
            setMessage(err.response?.data?.msg || 'Could not update donor eligibility.');
        } finally {
            setUpdatingDonorId(null);
        }
    };

    const reviewRequestDonor = async (requestId, donorId, decision) => {
        setMessage('');
        try {
            await api.post('/admin/request-donor-review', { requestId, donorId, decision });
            setMessage(decision === 'approve'
                ? 'Donor approved for receiver. Request moved to Donation In Progress.'
                : 'Donor rejected and request queue shifted to next donor.');
            await fetchAdminOverview();
        } catch (err) {
            setMessage(err.response?.data?.msg || 'Could not process donor review.');
        }
    };

    const mapCenter = useMemo(() => {
        const donor = adminData.donors.find((item) => item.latitude && item.longitude);
        const patient = adminData.patients.find((item) => item.latitude && item.longitude);
        const source = patient || donor;

        return source
            ? { lat: Number(source.latitude), lng: Number(source.longitude) }
            : fallbackCenter;
    }, [adminData]);

    if (loading || !user) {
        return (
            <div className="flex flex-1 items-center justify-center text-sm font-bold uppercase tracking-[0.3em] text-slate-400">
                Loading...
            </div>
        );
    }

    const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-blood-DEFAULT">Admin command center</p>
                    <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900">LifeDrop Admin Dashboard</h1>
                    <p className="mt-2 max-w-3xl text-base font-medium text-slate-500">
                        Monitor donor eligibility, patient blood requests, and map-based donor/patient locations in real time.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={fetchAdminOverview}
                    className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white"
                >
                    {syncing ? 'Syncing...' : 'Refresh Data'}
                </button>
            </div>

            {message && (
                <div className="mb-6 rounded-3xl bg-rose-50 px-5 py-4 text-sm font-bold text-blood-dark">
                    {message}
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                <StatCard icon={Users} label="Total Donors" value={adminData.stats.donors || 0} helper="Registered donor accounts in the system." tone="bg-rose-50 text-blood-DEFAULT" />
                <StatCard icon={ShieldCheck} label="Eligible Donors" value={adminData.stats.eligibleDonors || 0} helper="Donors currently marked eligible after screening." tone="bg-emerald-50 text-emerald-600" />
                <StatCard icon={Activity} label="Active Requests" value={adminData.stats.activeRequests || 0} helper="Patient requests still open or in progress." tone="bg-sky-50 text-sky-600" />
                <StatCard icon={AlertTriangle} label="Critical Cases" value={adminData.stats.criticalRequests || 0} helper="Highest priority requests needing fast donor routing." tone="bg-amber-50 text-amber-600" />
            </div>

            <div className="mt-8 space-y-6">
                <section className="soft-card overflow-hidden p-6">
                    <div className="mb-5 flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-black text-slate-900">Google Map Section</h2>
                            <p className="mt-1 text-sm font-semibold text-slate-500">Red markers = patients, green markers = donors.</p>
                        </div>
                        <MapPin className="text-blood-DEFAULT" size={26} />
                    </div>

                    <div className="h-[580px] overflow-hidden rounded-[32px] bg-slate-100">
                        {googleMapsApiKey ? (
                            <LoadScript googleMapsApiKey={googleMapsApiKey}>
                                <GoogleMap mapContainerStyle={mapContainerStyle} center={mapCenter} zoom={11}>
                                    {adminData.donors.map((donor) => donor.latitude && donor.longitude && (
                                        <MarkerF
                                            key={`donor-${donor.id}`}
                                            position={{ lat: Number(donor.latitude), lng: Number(donor.longitude) }}
                                            label="D"
                                            icon="https://maps.google.com/mapfiles/ms/icons/green-dot.png"
                                        />
                                    ))}
                                    {adminData.patients.map((patient) => patient.latitude && patient.longitude && (
                                        <MarkerF
                                            key={`patient-${patient.id}`}
                                            position={{ lat: Number(patient.latitude), lng: Number(patient.longitude) }}
                                            label="P"
                                        />
                                    ))}
                                    {adminData.patients.map((patient) => patient.latitude && patient.longitude && patient.nearest_donor_latitude && patient.nearest_donor_longitude && (
                                        <PolylineF
                                            key={`route-${patient.id}-${patient.nearest_donor_id}`}
                                            path={[
                                                {
                                                    lat: Number(patient.latitude),
                                                    lng: Number(patient.longitude),
                                                },
                                                {
                                                    lat: Number(patient.nearest_donor_latitude),
                                                    lng: Number(patient.nearest_donor_longitude),
                                                },
                                            ]}
                                            options={{
                                                strokeColor: '#e11d48',
                                                strokeOpacity: 0.8,
                                                strokeWeight: 4,
                                            }}
                                        />
                                    ))}
                                </GoogleMap>
                            </LoadScript>
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                                <MapPin className="text-blood-DEFAULT" size={42} />
                                <h3 className="mt-4 text-2xl font-black text-slate-900">Google Maps key not configured</h3>
                                <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
                                    Add `VITE_GOOGLE_MAPS_API_KEY` in `client/.env` to render the live map with donor and patient markers.
                                </p>
                            </div>
                        )}
                    </div>
                </section>

                <section className="soft-card p-6">
                    <div className="flex items-center gap-3">
                        <div className="rounded-3xl bg-rose-50 p-3 text-blood-DEFAULT">
                            <Building2 size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900">Patient Requests</h2>
                            <p className="text-sm font-semibold text-slate-500">All blood applications from mobile users.</p>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4 xl:grid-cols-2">
                        {adminData.patients.length === 0 ? (
                            <p className="rounded-3xl bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">No patient requests yet.</p>
                        ) : (
                            adminData.patients.map((patient) => (
                                <article key={patient.id} className="rounded-[28px] border border-rose-100 bg-white p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-[0.2em] text-blood-DEFAULT">{patient.emergency_level} Priority</p>
                                            <h3 className="mt-2 text-xl font-black text-slate-900">{patient.patient_name}</h3>
                                            <p className="mt-1 text-sm font-semibold text-slate-500">{patient.requester_name} - {patient.requester_phone}</p>
                                        </div>
                                        <span className="rounded-full bg-rose-50 px-4 py-2 text-lg font-black text-blood-dark">{patient.blood_group_required}</span>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.2em]">
                                        <span className="rounded-full bg-slate-100 px-3 py-2 text-slate-700">{patient.units_required} Units</span>
                                        <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-700">{patient.request_status}</span>
                                        <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">
                                            {patient.nearest_donor_distance_km !== null
                                                ? `${patient.nearest_donor_distance_km} km from ${patient.nearest_donor_name}`
                                                : 'No eligible donor distance'}
                                        </span>
                                        <span className="rounded-full bg-sky-50 px-3 py-2 text-sky-700">
                                            {patient.nearest_donor_status}
                                        </span>
                                    </div>

                                    {patient.nearest_donor_id && (
                                        <div className="mt-4 flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => reviewRequestDonor(patient.id, patient.nearest_donor_id, 'approve')}
                                                className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-white"
                                            >
                                                Approve Donor
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => reviewRequestDonor(patient.id, patient.nearest_donor_id, 'reject')}
                                                className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-white"
                                            >
                                                Reject Donor
                                            </button>
                                        </div>
                                    )}
                                </article>
                            ))
                        )}
                    </div>
                </section>
            </div>

            <section className="soft-card mt-8 p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">Donor Eligibility & Location</h2>
                        <p className="mt-1 text-sm font-semibold text-slate-500">Check donor profile, health status, blood group, and coordinates.</p>
                    </div>
                    <Droplet className="text-blood-DEFAULT" size={26} />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left">
                        <thead>
                            <tr className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                                <th className="px-4 py-4">Donor</th>
                                <th className="px-4 py-4">Blood</th>
                                <th className="px-4 py-4">Eligibility</th>
                                <th className="px-4 py-4">Availability</th>
                                <th className="px-4 py-4">Age / Weight</th>
                                <th className="px-4 py-4">Location</th>
                                <th className="px-4 py-4">Donations</th>
                                <th className="px-4 py-4">Review</th>
                            </tr>
                        </thead>
                        <tbody>
                            {adminData.donors.map((donor) => (
                                <tr
                                    key={donor.id}
                                    className="cursor-pointer border-t border-rose-100 hover:bg-rose-50/30"
                                    onClick={() => setSelectedDonor(donor)}
                                >
                                    <td className="px-4 py-4">
                                        <p className="font-black text-slate-900">{donor.name}</p>
                                        <p className="text-sm font-semibold text-slate-500">{donor.phone}</p>
                                    </td>
                                    <td className="px-4 py-4 text-lg font-black text-blood-DEFAULT">{donor.blood_group}</td>
                                    <td className="px-4 py-4">
                                        <span className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.15em] ${statusTone[donor.eligibility_status] || 'bg-slate-100 text-slate-700'}`}>
                                            {donor.eligibility_status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-sm font-bold text-slate-700">{donor.availability_status}</td>
                                    <td className="px-4 py-4 text-sm font-bold text-slate-700">{donor.age || '-'} yrs / {donor.weight || '-'} kg</td>
                                    <td className="px-4 py-4 text-sm font-bold text-slate-700">
                                        {donor.latitude && donor.longitude
                                            ? `${Number(donor.latitude).toFixed(4)}, ${Number(donor.longitude).toFixed(4)}`
                                            : 'Not set'}
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                                            <HeartPulse size={16} className="text-blood-DEFAULT" />
                                            {donor.donation_count}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    updateEligibility(donor.id, 'Eligible');
                                                }}
                                                disabled={updatingDonorId === donor.id}
                                                className="rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-[0.15em] text-white disabled:opacity-60"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    updateEligibility(donor.id, 'Ineligible');
                                                }}
                                                disabled={updatingDonorId === donor.id}
                                                className="rounded-2xl bg-rose-600 px-4 py-2 text-xs font-black uppercase tracking-[0.15em] text-white disabled:opacity-60"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {adminData.donors.length === 0 && (
                        <div className="rounded-3xl bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
                            No donor records yet.
                        </div>
                    )}
                </div>
            </section>

            <section className="soft-card mt-8 p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">Donation History</h2>
                        <p className="mt-1 text-sm font-semibold text-slate-500">Completed donations grouped date-wise after QR verification.</p>
                    </div>
                    <CalendarDays className="text-blood-DEFAULT" size={26} />
                </div>

                {Object.keys(adminData.historyByDate || {}).length === 0 ? (
                    <div className="rounded-3xl bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
                        No verified donation history yet.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(adminData.historyByDate || {}).map(([dateLabel, entries]) => (
                            <div key={dateLabel} className="rounded-[28px] border border-rose-100 bg-white p-5">
                                <p className="text-xs font-black uppercase tracking-[0.25em] text-blood-DEFAULT">{dateLabel}</p>
                                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                                    {entries.map((entry) => (
                                        <div key={entry.id} className="rounded-3xl bg-slate-50 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="text-lg font-black text-slate-900">{entry.patient_name}</h3>
                                                    <p className="mt-1 text-sm font-semibold text-slate-500">
                                                        Donor: {entry.donor_name || 'N/A'} - {entry.donor_phone || 'N/A'}
                                                    </p>
                                                    <p className="text-sm font-semibold text-slate-500">
                                                        Receiver: {entry.requester_name} - {entry.requester_phone}
                                                    </p>
                                                </div>
                                                <span className="rounded-full bg-rose-50 px-4 py-2 text-sm font-black text-blood-dark">
                                                    {entry.blood_group_required}
                                                </span>
                                            </div>
                                            <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                                                {entry.status} - {entry.units_required} unit(s)
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {syncing && (
                <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white shadow-2xl">
                    <Loader2 className="animate-spin" size={16} /> Syncing
                </div>
            )}

            {selectedDonor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="w-full max-w-2xl rounded-[32px] bg-white p-8 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.3em] text-blood-DEFAULT">Donor Verification Details</p>
                                <h2 className="mt-2 text-3xl font-black text-slate-900">{selectedDonor.name}</h2>
                                <p className="mt-1 text-sm font-semibold text-slate-500">{selectedDonor.phone}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedDonor(null)}
                                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700"
                            >
                                Close
                            </button>
                        </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            <div className="rounded-3xl bg-rose-50 p-4">
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Aadhaar Status</p>
                                <p className="mt-2 text-lg font-black text-slate-900">{selectedDonor.aadhaar_verification_status}</p>
                                <p className="mt-1 text-sm font-semibold text-slate-600">{selectedDonor.aadhaar_nationality_status || 'Pending Review'}</p>
                            </div>
                            <div className="rounded-3xl bg-emerald-50 p-4">
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Trust Score</p>
                                <p className="mt-2 text-lg font-black text-emerald-700">{selectedDonor.trust_score || 40}% Trustable</p>
                                <p className="mt-1 text-sm font-semibold text-slate-600">Higher score means stronger ID and eligibility confidence.</p>
                            </div>
                            <div className="rounded-3xl bg-slate-50 p-4">
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Health Data</p>
                                <p className="mt-2 text-sm font-bold text-slate-800">Age: {selectedDonor.age || '-'} yrs</p>
                                <p className="text-sm font-bold text-slate-800">Weight: {selectedDonor.weight || '-'} kg</p>
                                <p className="text-sm font-bold text-slate-800">Fever: {selectedDonor.has_fever ? 'Yes' : 'No'}</p>
                                <p className="text-sm font-bold text-slate-800">HIV: {selectedDonor.has_hiv ? 'Yes' : 'No'}</p>
                                <p className="text-sm font-bold text-slate-800">Hepatitis: {selectedDonor.has_hepatitis ? 'Yes' : 'No'}</p>
                                <p className="text-sm font-bold text-slate-800">Recent Surgery: {selectedDonor.recent_surgery ? 'Yes' : 'No'}</p>
                            </div>
                            <div className="rounded-3xl bg-slate-50 p-4">
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Identity & Donation</p>
                                <p className="mt-2 text-sm font-bold text-slate-800">Aadhaar: {selectedDonor.aadhaar_number || 'Not Submitted'}</p>
                                <p className="text-sm font-bold text-slate-800">Document: {selectedDonor.aadhaar_document_name || 'Not Uploaded'}</p>
                                <p className="text-sm font-bold text-slate-800">Blood Group: {selectedDonor.blood_group}</p>
                                <p className="text-sm font-bold text-slate-800">Last Donation: {selectedDonor.last_donation_date ? new Date(selectedDonor.last_donation_date).toLocaleDateString() : 'No donation yet'}</p>
                                <p className="text-sm font-bold text-slate-800">112-Day Rule: {selectedDonor.last_donation_date ? 'Check cooldown before next donation' : 'Eligible after approval'}</p>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={() => updateEligibility(selectedDonor.id, 'Eligible')}
                                className="flex-1 rounded-2xl bg-emerald-600 py-4 text-sm font-black uppercase tracking-[0.2em] text-white"
                            >
                                Approve Eligibility
                            </button>
                            <button
                                type="button"
                                onClick={() => updateEligibility(selectedDonor.id, 'Ineligible')}
                                className="flex-1 rounded-2xl bg-rose-600 py-4 text-sm font-black uppercase tracking-[0.2em] text-white"
                            >
                                Reject Eligibility
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;

/**
 * donors.js  –  Nearby Donors screen with embedded map
 *
 * Shows all compatible, eligible donors within the search radius on a map,
 * with a scrollable list below. Tapping "Get Directions" on any donor opens
 * the full-screen turn-by-turn map-route screen.
 *
 * Route params:
 *   requestId     – BloodRequest ID
 *   hospitalLat   – hospital / request latitude  (optional, read from API)
 *   hospitalLng   – hospital / request longitude (optional, read from API)
 *   hospitalName  – display name (optional)
 */

import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Callout, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft,
    CheckCircle,
    Droplet,
    HeartPulse,
    MapPin,
    Navigation,
    User as UserIcon,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { Colors } from '../constants/theme';

const palette = Colors.light;

// ─── Badge helpers ────────────────────────────────────────────────────────────

const BADGE_MAP = {
    20: { label: 'Super Donor',  color: '#e11d48' },
    10: { label: 'Blood Hero',   color: '#8b5cf6' },
    5:  { label: 'Life Helper',  color: '#0ea5e9' },
    1:  { label: 'First Saver',  color: '#f59e0b' },
};
const getBadge = (count) => {
    for (const threshold of [20, 10, 5, 1]) {
        if (count >= threshold) return BADGE_MAP[threshold];
    }
    return null;
};

// ─── Donor list card ──────────────────────────────────────────────────────────

const DonorCard = ({ donor, myLat, myLng, onNavigate }) => {
    const badge = getBadge(donor.donation_count || 0);

    return (
        <View style={styles.donorCard}>
            <View style={styles.cardHeader}>
                <View style={styles.avatarWrap}>
                    <UserIcon size={20} color={palette.tint} />
                </View>
                <View style={styles.donorInfo}>
                    <Text style={styles.donorName}>{donor.name}</Text>
                    <Text style={styles.donorPhone}>{donor.phone}</Text>
                </View>
                <View style={styles.bloodBadge}>
                    <Text style={styles.bloodBadgeText}>{donor.blood_group}</Text>
                </View>
            </View>

            <View style={styles.pillRow}>
                <View style={styles.pill}>
                    <MapPin size={12} color={palette.muted} />
                    <Text style={styles.pillText}>
                        {typeof donor.distance === 'number' ? donor.distance.toFixed(1) : '?'} km
                    </Text>
                </View>
                <View style={styles.pill}>
                    <HeartPulse size={12} color={palette.muted} />
                    <Text style={styles.pillText}>{donor.eligibility_status}</Text>
                </View>
                <View style={styles.pill}>
                    <CheckCircle size={12} color={palette.muted} />
                    <Text style={styles.pillText}>{donor.donation_count || 0} donations</Text>
                </View>
            </View>

            {badge && (
                <View style={[styles.badge, { borderColor: badge.color }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                </View>
            )}

            {/* Navigate: from my location → donor location */}
            <TouchableOpacity
                style={styles.navBtn}
                onPress={() => onNavigate(donor)}
            >
                <Navigation size={15} color="#fff" />
                <Text style={styles.navBtnText}>Get Directions to Donor</Text>
            </TouchableOpacity>
        </View>
    );
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DonorsScreen() {
    const router  = useRouter();
    const params  = useLocalSearchParams();
    const { user } = useContext(AuthContext);

    const requestId   = params.requestId   || '';
    const hospitalLat = parseFloat(params.hospitalLat || '0');
    const hospitalLng = parseFloat(params.hospitalLng || '0');
    const hospitalName = params.hospitalName || 'Hospital';

    const mapRef = useRef(null);

    const [donors,     setDonors]     = useState([]);
    const [radius,     setRadius]     = useState(10);
    const [loading,    setLoading]    = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error,      setError]      = useState(null);
    const [myCoords,   setMyCoords]   = useState(null);       // user's GPS
    const [reqCoords,  setReqCoords]  = useState(           // request coords
        hospitalLat ? { lat: hospitalLat, lng: hospitalLng } : null
    );

    // ── Get user location ─────────────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;
                const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                setMyCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            } catch {
                // silently skip
            }
        })();
    }, []);

    // ── Load donors ───────────────────────────────────────────────────────────
    const loadDonors = useCallback(async () => {
        if (!requestId) { setError('No request ID.'); setLoading(false); return; }
        try {
            const res = await api.get(`/request/nearby-donors/${requestId}`);
            setDonors(res.data.donors || []);
            setRadius(res.data.radius || 10);
            setError(null);

            // If hospitalLat wasn't passed, try to infer from first donor's request data
            // (already stored in reqCoords if passed as param)
        } catch (err) {
            setError(err.response?.data?.msg || 'Could not load nearby donors.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [requestId]);

    useEffect(() => { loadDonors(); }, [loadDonors]);

    // ── Fit map when donors load ──────────────────────────────────────────────
    useEffect(() => {
        if (!donors.length || !mapRef.current) return;
        const coords = donors
            .filter(d => d.latitude && d.longitude)
            .map(d => ({ latitude: Number(d.latitude), longitude: Number(d.longitude) }));

        if (reqCoords) {
            coords.push({ latitude: reqCoords.lat, longitude: reqCoords.lng });
        }
        if (coords.length > 0) {
            setTimeout(() => {
                mapRef.current?.fitToCoordinates(coords, {
                    edgePadding: { top: 60, right: 40, bottom: 60, left: 40 },
                    animated: true,
                });
            }, 400);
        }
    }, [donors, reqCoords]);

    // ── Navigate to a donor from my current location ──────────────────────────
    const handleNavigateToDonor = (donor) => {
        if (!donor.latitude || !donor.longitude) {
            return;
        }
        const origin = myCoords || (reqCoords ? { lat: reqCoords.lat, lng: reqCoords.lng } : null);
        if (!origin) {
            // No origin — just open the donor's location in Maps
            router.push(
                `/map-route?originLat=${donor.latitude}&originLng=${donor.longitude}` +
                `&destLat=${reqCoords?.lat || donor.latitude}` +
                `&destLng=${reqCoords?.lng || donor.longitude}` +
                `&destName=${encodeURIComponent(hospitalName)}` +
                `&requestId=${requestId}`
            );
            return;
        }
        router.push(
            `/map-route?originLat=${origin.lat}&originLng=${origin.lng}` +
            `&destLat=${donor.latitude}&destLng=${donor.longitude}` +
            `&destName=${encodeURIComponent(donor.name)}` +
            `&requestId=${requestId}`
        );
    };

    // ── Navigate from donor to hospital (for approved donors on index screen) ─
    const handleNavigateToHospital = () => {
        const origin = myCoords;
        if (!origin || !reqCoords) return;
        router.push(
            `/map-route?originLat=${origin.lat}&originLng=${origin.lng}` +
            `&destLat=${reqCoords.lat}&destLng=${reqCoords.lng}` +
            `&destName=${encodeURIComponent(hospitalName)}` +
            `&requestId=${requestId}`
        );
    };

    // ── Derive map center ─────────────────────────────────────────────────────
    const mapCenter = reqCoords
        ? { latitude: reqCoords.lat, longitude: reqCoords.lng }
        : donors[0]?.latitude
          ? { latitude: Number(donors[0].latitude), longitude: Number(donors[0].longitude) }
          : { latitude: 20.5937, longitude: 78.9629 }; // India center fallback

    const onRefresh = () => { setRefreshing(true); loadDonors(); };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft color={palette.dark} size={22} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Nearby Donors</Text>
                    <Text style={styles.headerSub}>Within {radius} km radius</Text>
                </View>
                {reqCoords && myCoords ? (
                    <TouchableOpacity style={styles.hospitalNavBtn} onPress={handleNavigateToHospital}>
                        <Navigation size={16} color="#fff" />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 40 }} />
                )}
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={palette.tint} />
                    <Text style={styles.infoText}>Finding compatible donors…</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.tint} />
                    }
                >
                    {/* ── Mini map ── */}
                    {!error && (
                        <View style={styles.mapContainer}>
                            <MapView
                                ref={mapRef}
                                style={styles.map}
                                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                                initialRegion={{
                                    ...mapCenter,
                                    latitudeDelta: 0.08,
                                    longitudeDelta: 0.08,
                                }}
                                showsUserLocation
                                showsMyLocationButton={false}
                                toolbarEnabled={false}
                            >
                                {/* Hospital / request marker */}
                                {reqCoords && (
                                    <Marker
                                        coordinate={{ latitude: reqCoords.lat, longitude: reqCoords.lng }}
                                        pinColor="#e11d48"
                                        title={hospitalName}
                                        description="Blood request location"
                                    >
                                        <Callout>
                                            <View style={styles.callout}>
                                                <Text style={styles.calloutTitle}>{hospitalName}</Text>
                                                <Text style={styles.calloutSub}>Blood request</Text>
                                            </View>
                                        </Callout>
                                    </Marker>
                                )}

                                {/* Donor markers */}
                                {donors
                                    .filter(d => d.latitude && d.longitude)
                                    .map((donor) => (
                                        <Marker
                                            key={`donor-${donor.id}`}
                                            coordinate={{
                                                latitude:  Number(donor.latitude),
                                                longitude: Number(donor.longitude),
                                            }}
                                            pinColor="#22c55e"
                                            title={donor.name}
                                            description={`${donor.blood_group} · ${typeof donor.distance === 'number' ? donor.distance.toFixed(1) + ' km' : ''}`}
                                        >
                                            <Callout onPress={() => handleNavigateToDonor(donor)}>
                                                <View style={styles.callout}>
                                                    <Text style={styles.calloutTitle}>{donor.name}</Text>
                                                    <Text style={styles.calloutSub}>
                                                        {donor.blood_group} · {typeof donor.distance === 'number' ? donor.distance.toFixed(1) + ' km' : ''}
                                                    </Text>
                                                    <Text style={styles.calloutAction}>Tap for directions →</Text>
                                                </View>
                                            </Callout>
                                        </Marker>
                                    ))
                                }
                            </MapView>

                            <View style={styles.mapLegend}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: '#e11d48' }]} />
                                    <Text style={styles.legendText}>Request</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
                                    <Text style={styles.legendText}>Donor</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* ── Summary ── */}
                    <View style={styles.summaryBar}>
                        <Text style={styles.summaryText}>
                            {error
                                ? error
                                : donors.length === 0
                                  ? 'No eligible donors found nearby'
                                  : `${donors.length} eligible donor${donors.length === 1 ? '' : 's'} found`}
                        </Text>
                    </View>

                    {/* ── Donor cards ── */}
                    {donors.length === 0 && !error ? (
                        <View style={styles.emptyState}>
                            <Droplet size={48} color={palette.tint} />
                            <Text style={styles.emptyTitle}>No donors nearby</Text>
                            <Text style={styles.infoText}>
                                No compatible, eligible donors within {radius} km.{'\n'}
                                The system expands search automatically.
                            </Text>
                        </View>
                    ) : (
                        donors.map((donor) => (
                            <DonorCard
                                key={donor.id}
                                donor={donor}
                                myLat={myCoords?.lat}
                                myLng={myCoords?.lng}
                                onNavigate={handleNavigateToDonor}
                            />
                        ))
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: palette.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderColor: palette.border,
    },
    backBtn: { padding: 8, backgroundColor: palette.softSlate, borderRadius: 14 },
    headerCenter: { alignItems: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '900', color: palette.dark },
    headerSub: { fontSize: 11, fontWeight: '800', color: palette.tint, letterSpacing: 1.2 },
    hospitalNavBtn: {
        width: 40, height: 40, borderRadius: 14,
        backgroundColor: palette.tint,
        alignItems: 'center', justifyContent: 'center',
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    scrollContent: { paddingBottom: 40 },

    // Map
    mapContainer: {
        height: 280,
        margin: 16,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: palette.border,
        position: 'relative',
    },
    map: { flex: 1 },
    mapLegend: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 8,
        gap: 6,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 11, fontWeight: '800', color: palette.dark },

    callout: { padding: 6, minWidth: 140 },
    calloutTitle: { fontSize: 13, fontWeight: '900', color: palette.dark },
    calloutSub: { fontSize: 11, fontWeight: '700', color: palette.muted, marginTop: 2 },
    calloutAction: { fontSize: 11, fontWeight: '900', color: palette.tint, marginTop: 4 },

    summaryBar: {
        marginHorizontal: 16,
        marginBottom: 12,
        backgroundColor: palette.softRose,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    summaryText: { fontSize: 13, fontWeight: '900', color: palette.tint },

    emptyState: {
        alignItems: 'center',
        padding: 32,
        marginHorizontal: 16,
        backgroundColor: '#fff',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: palette.border,
    },
    emptyTitle: { marginTop: 16, fontSize: 20, fontWeight: '900', color: palette.dark },

    donorCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: palette.border,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    avatarWrap: {
        width: 40, height: 40, borderRadius: 14,
        backgroundColor: palette.softRose,
        alignItems: 'center', justifyContent: 'center',
    },
    donorInfo: { flex: 1 },
    donorName: { fontSize: 15, fontWeight: '900', color: palette.dark },
    donorPhone: { marginTop: 2, fontSize: 11, fontWeight: '700', color: palette.muted },
    bloodBadge: {
        backgroundColor: palette.softRose, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14,
    },
    bloodBadgeText: { fontSize: 15, fontWeight: '900', color: palette.tint },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    pill: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: palette.softSlate, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12,
    },
    pillText: { fontSize: 11, fontWeight: '800', color: palette.muted },
    badge: {
        alignSelf: 'flex-start', marginTop: 8,
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1.5,
    },
    badgeText: { fontSize: 10, fontWeight: '900' },
    navBtn: {
        marginTop: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
        backgroundColor: palette.tint, borderRadius: 15, paddingVertical: 12,
    },
    navBtnText: { fontSize: 13, fontWeight: '900', color: '#fff' },

    infoText: { marginTop: 10, fontSize: 13, fontWeight: '600', color: palette.muted, textAlign: 'center', lineHeight: 21 },
});

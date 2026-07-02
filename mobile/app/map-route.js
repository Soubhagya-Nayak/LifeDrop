/**
 * map-route.js  –  Full-screen route map for LifeDrop
 *
 * Shows the turn-by-turn driving / walking route from the donor's current
 * location to the hospital / blood-request location using the Google
 * Directions API and react-native-maps.
 *
 * Route params (all required):
 *   originLat      – donor's current latitude
 *   originLng      – donor's current longitude
 *   destLat        – hospital / request latitude
 *   destLng        – hospital / request longitude
 *   destName       – label shown on the destination marker
 *   requestId      – blood request ID (shown in header)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft,
    Car,
    ExternalLink,
    Footprints,
    MapPin,
    Navigation,
    RefreshCw,
} from 'lucide-react-native';
import { Colors } from '../constants/theme';

const palette = Colors.light;
const GMAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Decode a Google encoded polyline into an array of {latitude, longitude} */
function decodePolyline(encoded) {
    const points = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
        let b;
        let shift = 0;
        let result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlat = result & 1 ? ~(result >> 1) : result >> 1;
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlng = result & 1 ? ~(result >> 1) : result >> 1;
        lng += dlng;

        points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
}

/** Strip HTML tags from Directions API step instructions */
const stripHtml = (html) => html.replace(/<[^>]*>/g, '');

/** Format seconds → "X min" or "X hr Y min" */
function formatDuration(seconds) {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MapRouteScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const originLat  = parseFloat(params.originLat  || '0');
    const originLng  = parseFloat(params.originLng  || '0');
    const destLat    = parseFloat(params.destLat    || '0');
    const destLng    = parseFloat(params.destLng    || '0');
    const destName   = params.destName  || 'Hospital';
    const requestId  = params.requestId || '';

    const mapRef = useRef(null);
    const [mode, setMode]             = useState('driving');   // 'driving' | 'walking'
    const [routeCoords, setRouteCoords] = useState([]);
    const [steps, setSteps]           = useState([]);
    const [summary, setSummary]       = useState(null);        // { distance, duration }
    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState(null);

    // ── Fetch directions from Google Directions API ───────────────────────────
    const fetchRoute = useCallback(async () => {
        if (!originLat || !originLng || !destLat || !destLng) {
            setError('Missing coordinates.');
            return;
        }
        if (!GMAPS_KEY) {
            setError('Google Maps API key is not configured.\nAdd EXPO_PUBLIC_GOOGLE_MAPS_KEY to mobile/.env');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const url =
                `https://maps.googleapis.com/maps/api/directions/json` +
                `?origin=${originLat},${originLng}` +
                `&destination=${destLat},${destLng}` +
                `&mode=${mode}` +
                `&key=${GMAPS_KEY}`;

            const res  = await fetch(url);
            const json = await res.json();

            if (json.status !== 'OK' || !json.routes?.length) {
                throw new Error(json.error_message || `Directions API: ${json.status}`);
            }

            const leg = json.routes[0].legs[0];
            const polyline = json.routes[0].overview_polyline.points;

            setRouteCoords(decodePolyline(polyline));
            setSummary({
                distance: leg.distance.text,
                duration: leg.duration.text,
                durationValue: leg.duration.value,
            });
            setSteps(
                (leg.steps || []).slice(0, 5).map((s) => ({
                    instruction: stripHtml(s.html_instructions),
                    distance: s.distance.text,
                }))
            );

            // Fit map to show both markers
            mapRef.current?.fitToCoordinates(
                [
                    { latitude: originLat, longitude: originLng },
                    { latitude: destLat,   longitude: destLng   },
                ],
                { edgePadding: { top: 80, right: 40, bottom: 260, left: 40 }, animated: true }
            );
        } catch (err) {
            setError(err.message || 'Could not fetch route. Check your internet connection.');
        } finally {
            setLoading(false);
        }
    }, [originLat, originLng, destLat, destLng, mode]);

    useEffect(() => {
        fetchRoute();
    }, [fetchRoute]);

    // ── Open in Google Maps app / browser ────────────────────────────────────
    const openExternal = async () => {
        const url = Platform.OS === 'ios'
            ? `comgooglemaps://?saddr=${originLat},${originLng}&daddr=${destLat},${destLng}&directionsmode=${mode}`
            : `google.navigation:q=${destLat},${destLng}&mode=${mode === 'driving' ? 'd' : 'w'}`;

        const fallback =
            `https://www.google.com/maps/dir/?api=1` +
            `&origin=${originLat},${originLng}` +
            `&destination=${destLat},${destLng}` +
            `&travelmode=${mode}`;

        const canOpen = await Linking.canOpenURL(url);
        await Linking.openURL(canOpen ? url : fallback);
    };

    // ── Initial region ────────────────────────────────────────────────────────
    const midLat  = (originLat + destLat) / 2;
    const midLng  = (originLng + destLng) / 2;
    const latDelta = Math.abs(originLat - destLat) * 1.8 + 0.02;
    const lngDelta = Math.abs(originLng - destLng) * 1.8 + 0.02;

    const validCoords = originLat !== 0 && destLat !== 0;

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* ── Top bar ── */}
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft color={palette.dark} size={22} />
                </TouchableOpacity>
                <View style={styles.titleWrap}>
                    <Text style={styles.title} numberOfLines={1}>{destName}</Text>
                    {requestId ? (
                        <Text style={styles.subtitle}>Request #{requestId}</Text>
                    ) : null}
                </View>
                <TouchableOpacity onPress={openExternal} style={styles.externalBtn}>
                    <ExternalLink color={palette.tint} size={20} />
                </TouchableOpacity>
            </View>

            {/* ── Mode toggle ── */}
            <View style={styles.modeRow}>
                <TouchableOpacity
                    style={[styles.modeBtn, mode === 'driving' && styles.modeBtnActive]}
                    onPress={() => setMode('driving')}
                >
                    <Car size={16} color={mode === 'driving' ? '#fff' : palette.muted} />
                    <Text style={[styles.modeBtnText, mode === 'driving' && styles.modeBtnTextActive]}>
                        Drive
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.modeBtn, mode === 'walking' && styles.modeBtnActive]}
                    onPress={() => setMode('walking')}
                >
                    <Footprints size={16} color={mode === 'walking' ? '#fff' : palette.muted} />
                    <Text style={[styles.modeBtnText, mode === 'walking' && styles.modeBtnTextActive]}>
                        Walk
                    </Text>
                </TouchableOpacity>
            </View>

            {/* ── Map ── */}
            <View style={styles.mapWrap}>
                {validCoords ? (
                    <MapView
                        ref={mapRef}
                        style={styles.map}
                        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                        initialRegion={{
                            latitude: midLat,
                            longitude: midLng,
                            latitudeDelta: latDelta,
                            longitudeDelta: lngDelta,
                        }}
                        showsUserLocation
                        showsMyLocationButton={false}
                        toolbarEnabled={false}
                    >
                        {/* Origin — donor */}
                        <Marker
                            coordinate={{ latitude: originLat, longitude: originLng }}
                            title="Your location"
                            pinColor="#22c55e"
                        />
                        {/* Destination — hospital */}
                        <Marker
                            coordinate={{ latitude: destLat, longitude: destLng }}
                            title={destName}
                            pinColor="#e11d48"
                        />
                        {/* Route polyline */}
                        {routeCoords.length > 0 && (
                            <Polyline
                                coordinates={routeCoords}
                                strokeWidth={5}
                                strokeColor="#e11d48"
                                lineDashPattern={undefined}
                            />
                        )}
                    </MapView>
                ) : (
                    <View style={styles.mapError}>
                        <MapPin size={44} color={palette.muted} />
                        <Text style={styles.mapErrorText}>Coordinates unavailable</Text>
                    </View>
                )}

                {/* Loading overlay */}
                {loading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color={palette.tint} />
                    </View>
                )}

                {/* Re-center button */}
                <TouchableOpacity
                    style={styles.recenterBtn}
                    onPress={() =>
                        mapRef.current?.fitToCoordinates(
                            [
                                { latitude: originLat, longitude: originLng },
                                { latitude: destLat,   longitude: destLng   },
                            ],
                            { edgePadding: { top: 80, right: 40, bottom: 260, left: 40 }, animated: true }
                        )
                    }
                >
                    <Navigation size={20} color={palette.tint} />
                </TouchableOpacity>
            </View>

            {/* ── Route info panel ── */}
            <View style={styles.infoPanel}>
                {error ? (
                    <View style={styles.errorRow}>
                        <Text style={styles.errorText} numberOfLines={3}>{error}</Text>
                        <TouchableOpacity onPress={fetchRoute} style={styles.retryBtn}>
                            <RefreshCw size={16} color={palette.tint} />
                            <Text style={styles.retryText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : summary ? (
                    <>
                        <View style={styles.summaryRow}>
                            <View style={styles.summaryTile}>
                                <Text style={styles.summaryLabel}>Distance</Text>
                                <Text style={styles.summaryValue}>{summary.distance}</Text>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryTile}>
                                <Text style={styles.summaryLabel}>Est. time</Text>
                                <Text style={[styles.summaryValue, { color: palette.tint }]}>
                                    {summary.duration}
                                </Text>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryTile}>
                                <Text style={styles.summaryLabel}>Mode</Text>
                                <Text style={styles.summaryValue}>
                                    {mode === 'driving' ? '🚗 Drive' : '🚶 Walk'}
                                </Text>
                            </View>
                        </View>

                        {steps.length > 0 && (
                            <View style={styles.stepsWrap}>
                                <Text style={styles.stepsTitle}>Next steps</Text>
                                {steps.map((step, i) => (
                                    <View key={i} style={styles.stepRow}>
                                        <View style={styles.stepDot} />
                                        <View style={styles.stepTextWrap}>
                                            <Text style={styles.stepInstruction} numberOfLines={2}>
                                                {step.instruction}
                                            </Text>
                                            <Text style={styles.stepDistance}>{step.distance}</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </>
                ) : !loading ? (
                    <Text style={styles.noRouteText}>Tap Retry to load the route.</Text>
                ) : null}

                <TouchableOpacity style={styles.openMapsBtn} onPress={openExternal}>
                    <Navigation size={16} color="#fff" />
                    <Text style={styles.openMapsBtnText}>Open in Google Maps</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: palette.background },

    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderColor: palette.border,
        gap: 10,
    },
    backBtn: { padding: 8, backgroundColor: palette.softSlate, borderRadius: 14 },
    titleWrap: { flex: 1 },
    title: { fontSize: 17, fontWeight: '900', color: palette.dark },
    subtitle: { fontSize: 11, fontWeight: '800', color: palette.tint, letterSpacing: 1.2 },
    externalBtn: { padding: 8, backgroundColor: palette.softRose, borderRadius: 14 },

    modeRow: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderColor: palette.border,
    },
    modeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.softSlate,
    },
    modeBtnActive: { backgroundColor: palette.tint, borderColor: palette.tint },
    modeBtnText: { fontSize: 13, fontWeight: '900', color: palette.muted },
    modeBtnTextActive: { color: '#fff' },

    mapWrap: { flex: 1, position: 'relative' },
    map: { flex: 1 },
    mapError: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.softSlate,
    },
    mapErrorText: { marginTop: 12, fontSize: 14, fontWeight: '700', color: palette.muted },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    recenterBtn: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },

    infoPanel: {
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderColor: palette.border,
        padding: 16,
        paddingBottom: 8,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    summaryTile: { flex: 1, alignItems: 'center' },
    summaryDivider: { width: 1, height: 36, backgroundColor: palette.border },
    summaryLabel: {
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        color: palette.muted,
    },
    summaryValue: {
        marginTop: 4,
        fontSize: 17,
        fontWeight: '900',
        color: palette.dark,
    },

    stepsWrap: { marginBottom: 12 },
    stepsTitle: {
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        color: palette.muted,
        marginBottom: 8,
    },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
    stepDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: palette.tint,
        marginTop: 5,
    },
    stepTextWrap: { flex: 1 },
    stepInstruction: { fontSize: 13, fontWeight: '700', color: palette.dark, lineHeight: 19 },
    stepDistance: { fontSize: 11, fontWeight: '700', color: palette.muted, marginTop: 2 },

    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
        backgroundColor: palette.softRose,
        borderRadius: 16,
        padding: 12,
    },
    errorText: { flex: 1, fontSize: 12, fontWeight: '700', color: palette.dark },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    retryText: { fontSize: 12, fontWeight: '900', color: palette.tint },
    noRouteText: { fontSize: 13, fontWeight: '600', color: palette.muted, marginBottom: 12 },

    openMapsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: palette.tint,
        borderRadius: 18,
        paddingVertical: 14,
        marginTop: 4,
        marginBottom: 4,
    },
    openMapsBtnText: { fontSize: 14, fontWeight: '900', color: '#fff' },
});

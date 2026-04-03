import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
    Activity,
    AlertTriangle,
    Droplet,
    HeartPulse,
    LocateFixed,
    MapPin,
    QrCode,
    RotateCcw,
    ShieldCheck,
    Siren,
    User as UserIcon,
    Users,
} from 'lucide-react-native';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { Colors } from '../constants/theme';

const palette = Colors.light;
const REQUEST_DEVICE_ID_KEY = 'lifedrop_request_device_id';

const defaultRequestForm = {
    patient_name: '',
    patient_aadhaar_number: '',
    patient_aadhaar_document_name: '',
    patient_aadhaar_document_uri: '',
    blood_group_required: 'O+',
    latitude: '19.076',
    longitude: '72.8777',
    units_required: '1',
    emergency_level: 'High',
};

const getRequestDeviceId = async () => {
    let deviceId = await AsyncStorage.getItem(REQUEST_DEVICE_ID_KEY);

    if (!deviceId) {
        const randomPart = Math.random().toString(36).slice(2, 10);
        deviceId = `lifedrop-device-${Date.now()}-${randomPart}`;
        await AsyncStorage.setItem(REQUEST_DEVICE_ID_KEY, deviceId);
    }

    return deviceId;
};

const StatTile = ({ icon: Icon, label, value, color, background }) => (
    <View style={styles.statTile}>
        <View style={[styles.statIcon, { backgroundColor: background }]}>
            <Icon size={22} color={color} />
        </View>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
    </View>
);

export default function DashboardScreen() {
    const { user, appMode, setAppMode, loading } = useContext(AuthContext);
    const router = useRouter();
    const [dashboard, setDashboard] = useState(null);
    const [history, setHistory] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [requestForm, setRequestForm] = useState(defaultRequestForm);
    const [locationLoading, setLocationLoading] = useState(false);
    const [locationReady, setLocationReady] = useState(false);
    const [locationError, setLocationError] = useState('Phone location permission is mandatory for all users.');

    const loadDashboard = useCallback(async () => {
        if (!user) return;
        setRefreshing(true);
        try {
            const [dashboardRes, historyRes] = await Promise.all([
                api.get('/request/dashboard'),
                api.get('/donation/history'),
            ]);
            setDashboard(dashboardRes.data);
            setHistory(historyRes.data.history || []);
        } catch (err) {
            Alert.alert('Dashboard Error', err.response?.data?.msg || 'Unable to load dashboard');
        } finally {
            setRefreshing(false);
        }
    }, [user]);

    const openInGoogleMaps = async (latitude, longitude, label) => {
        if (!latitude || !longitude) {
            Alert.alert('Location unavailable', 'No coordinates found for this request.');
            return;
        }

        const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
            await Linking.openURL(url);
        } else {
            Alert.alert('Unable to open map', `Please search this location manually: ${label}`);
        }
    };

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const syncCurrentLocation = useCallback(async () => {
        if (!user) return false;
        setLocationLoading(true);
        try {
            const servicesEnabled = await Location.hasServicesEnabledAsync();
            if (!servicesEnabled) {
                setLocationReady(false);
                setLocationError('GPS is turned off. Please enable device location services.');
                Alert.alert('Turn On GPS', 'Please enable device location services, then tap Grant GPS Access.', [
                    { text: 'Open Settings', onPress: () => Linking.openSettings() },
                    { text: 'Cancel', style: 'cancel' },
                ]);
                return false;
            }

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocationReady(false);
                setLocationError('Location permission denied. Please allow GPS access to continue.');
                Alert.alert('Permission Needed', 'Please allow location permission. LifeDrop cannot work without GPS access.', [
                    { text: 'Open Settings', onPress: () => Linking.openSettings() },
                    { text: 'Cancel', style: 'cancel' },
                ]);
                return false;
            }

            const currentLocation = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
                mayShowUserSettingsDialog: true,
            }).catch(async () => {
                const lastKnown = await Location.getLastKnownPositionAsync({
                    maxAge: 300000,
                    requiredAccuracy: 1000,
                });
                if (lastKnown) {
                    return lastKnown;
                }
                throw new Error('No current or last known location available');
            });
            const latitude = Number(currentLocation.coords.latitude.toFixed(6));
            const longitude = Number(currentLocation.coords.longitude.toFixed(6));

            await api.post('/auth/location', { latitude, longitude });

            setRequestForm((prev) => ({
                ...prev,
                latitude: String(latitude),
                longitude: String(longitude),
            }));
            setLocationReady(true);
            setLocationError(`Location synced: ${latitude}, ${longitude}`);
            return true;
        } catch {
            setLocationReady(false);
            setLocationError('Unable to detect or sync location. Please retry and keep GPS enabled.');
            Alert.alert('Location Error', 'Unable to detect current location. Please enable GPS and try again.', [
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
                { text: 'Cancel', style: 'cancel' },
            ]);
            return false;
        } finally {
            setLocationLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            syncCurrentLocation();
        }
    }, [user, syncCurrentLocation]);

    const pickPatientAadhaar = async () => {
        const result = await DocumentPicker.getDocumentAsync({
            type: ['image/*', 'application/pdf'],
            copyToCacheDirectory: true,
            multiple: false,
        });

        if (!result.canceled && result.assets?.[0]) {
            const asset = result.assets[0];
            setRequestForm((prev) => ({
                ...prev,
                patient_aadhaar_document_name: asset.name,
                patient_aadhaar_document_uri: asset.uri,
            }));
        }
    };

    const donationRequests = useMemo(
        () => dashboard?.donateRequests || dashboard?.requests || [],
        [dashboard]
    );
    const requesterRequests = useMemo(
        () => dashboard?.myRequests || [],
        [dashboard]
    );

    const requesterStats = useMemo(() => {
        const requests = requesterRequests;
        return {
            total: requests.length,
            active: requests.filter((request) => request.request_status !== 'Completed' && request.request_status !== 'Cancelled').length,
            donors: requests.reduce((sum, request) => sum + Number(request.donor_responses || 0), 0),
        };
    }, [requesterRequests]);

    const acceptRequest = async (requestId) => {
        setSaving(true);
        try {
            const res = await api.post('/request/accept', { requestId });
            Alert.alert('Request Joined', `You are in queue rank #${res.data.rank}`);
            await loadDashboard();
        } catch (err) {
            Alert.alert('Unable to Join', err.response?.data?.msg || 'Request failed');
        } finally {
            setSaving(false);
        }
    };

    const createRequest = async () => {
        if (!requestForm.patient_name.trim()) {
            Alert.alert('Missing Details', 'Enter the patient name to publish a request.');
            return;
        }

        if (!/^\d{12}$/.test(requestForm.patient_aadhaar_number.trim()) || !requestForm.patient_aadhaar_document_name) {
            Alert.alert('Aadhaar Required', 'Enter a valid 12-digit patient Aadhaar and upload the Aadhaar document.');
            return;
        }

        setSaving(true);
        try {
            await api.post('/request/create', {
                ...requestForm,
                latitude: Number(requestForm.latitude),
                longitude: Number(requestForm.longitude),
                units_required: Number(requestForm.units_required) || 1,
                request_device_id: await getRequestDeviceId(),
            });
            setRequestForm(defaultRequestForm);
            Alert.alert('Request Published', 'Compatible donors can now respond.');
            await loadDashboard();
        } catch (err) {
            Alert.alert('Unable to Publish', err.response?.data?.msg || 'Please try again');
        } finally {
            setSaving(false);
        }
    };

    if (loading || !user) {
        return (
            <View style={[styles.safeArea, styles.center]}>
                <ActivityIndicator size="large" color={palette.tint} />
                <Text style={styles.loadingText}>Preparing LifeDrop...</Text>
            </View>
        );
    }

    if (!locationReady) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.center}>
                    <LocateFixed size={48} color={palette.tint} />
                    <Text style={styles.sectionTitle}>Location Access Required</Text>
                    <Text style={styles.emptyText}>{locationError}</Text>
                    <TouchableOpacity style={styles.healthButton} onPress={syncCurrentLocation} disabled={locationLoading}>
                        <LocateFixed color="#fff" size={22} />
                        <Text style={styles.healthButtonText}>{locationLoading ? 'Syncing GPS...' : 'Grant GPS Access'}</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const renderModePicker = () => (
        <View style={styles.modeCard}>
            <Text style={styles.sectionTitle}>Choose what you want to do</Text>
            <Text style={styles.modeSubtitle}>Select Donate Blood to see patient requests, or Need Blood to apply for blood.</Text>

            <TouchableOpacity style={styles.donateModeButton} onPress={() => setAppMode('donate')}>
                <HeartPulse color="#fff" size={24} />
                <Text style={styles.modeButtonText}>Donate Blood</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.needModeButton} onPress={() => setAppMode('need')}>
                <Droplet color={palette.tint} size={24} />
                <Text style={styles.needModeButtonText}>Need Blood</Text>
            </TouchableOpacity>
        </View>
    );

    const renderDonorDashboard = () => (
        <View style={styles.section}>
            <View style={styles.statsGrid}>
                <StatTile icon={HeartPulse} label="Blood" value={user.bloodGroup || 'N/A'} color={palette.tint} background={palette.softRose} />
                <StatTile icon={ShieldCheck} label="Health" value={dashboard?.donor?.eligibility_status || 'Not Submitted'} color={palette.success} background="#ecfdf5" />
            </View>

            <TouchableOpacity style={styles.healthButton} onPress={() => router.push('/health')}>
                <Activity color="#fff" size={22} />
                <Text style={styles.healthButtonText}>Update Health Eligibility</Text>
            </TouchableOpacity>

                <Text style={styles.sectionTitle}>Nearby compatible requests</Text>
            {donationRequests.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No urgent requests near you</Text>
                    <Text style={styles.emptyText}>You are on standby and new alerts will appear here.</Text>
                </View>
            ) : (
                donationRequests.map((request) => (
                    <View key={request.id} style={styles.requestCard}>
                        <View style={styles.requestHeader}>
                            <View style={styles.requestTitleWrap}>
                                <Text style={styles.requestHospital}>{request.hospital_name}</Text>
                                <Text style={styles.requestPatient}>{request.patient_name}</Text>
                            </View>
                            <View style={styles.bloodBadge}>
                                <Text style={styles.bloodBadgeText}>{request.blood_group_required}</Text>
                            </View>
                        </View>

                        <View style={styles.infoRow}>
                            <View style={styles.infoPill}>
                                <MapPin size={14} color={palette.muted} />
                                <Text style={styles.infoPillText}>{Number(request.distance || 0).toFixed(1)} km</Text>
                            </View>
                            <View style={styles.infoPill}>
                                <Users size={14} color={palette.muted} />
                                <Text style={styles.infoPillText}>{request.units_required} unit(s)</Text>
                            </View>
                            <View style={styles.infoPill}>
                                <Siren size={14} color={palette.muted} />
                                <Text style={styles.infoPillText}>{request.emergency_level}</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.mapButton}
                            onPress={() => openInGoogleMaps(request.latitude, request.longitude, request.patient_name)}
                        >
                            <MapPin size={16} color={palette.tint} />
                            <Text style={styles.mapButtonText}>Open Google Map</Text>
                        </TouchableOpacity>

                        {request.approved_donor_id === user.id && request.request_status === 'Donation In Progress' && (
                            <TouchableOpacity
                                style={styles.scanButton}
                                onPress={() => router.push(`/scan-qr?requestId=${request.id}`)}
                            >
                                <QrCode size={16} color="#fff" />
                                <Text style={styles.scanButtonText}>Scan Patient QR</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.acceptButton, request.has_joined && styles.disabledButton]}
                            onPress={() => acceptRequest(request.id)}
                            disabled={saving || request.has_joined}
                        >
                            <Text style={styles.acceptButtonText}>
                                {request.has_joined ? 'Already Joined' : 'Accept Request'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ))
            )}
        </View>
    );

    const renderHospitalDashboard = () => (
        <View style={styles.section}>
            <View style={styles.statsGrid}>
                <StatTile icon={AlertTriangle} label="Requests" value={requesterStats.total} color={palette.tint} background={palette.softRose} />
                <StatTile icon={Users} label="Responses" value={requesterStats.donors} color={palette.success} background="#ecfdf5" />
            </View>

            <View style={styles.formCard}>
                <Text style={styles.sectionTitle}>Apply for required blood</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Patient name"
                    placeholderTextColor="#94a3b8"
                    value={requestForm.patient_name}
                    onChangeText={(value) => setRequestForm({ ...requestForm, patient_name: value })}
                />

                <View style={styles.duoRow}>
                    <TextInput
                        style={[styles.input, styles.halfInput]}
                        placeholder="Blood group"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="characters"
                        value={requestForm.blood_group_required}
                        onChangeText={(value) => setRequestForm({ ...requestForm, blood_group_required: value.toUpperCase() })}
                    />
                    <TextInput
                        style={[styles.input, styles.halfInput]}
                        placeholder="Units"
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        value={requestForm.units_required}
                        onChangeText={(value) => setRequestForm({ ...requestForm, units_required: value })}
                    />
                </View>

                <TextInput
                    style={styles.input}
                    placeholder="Patient Aadhaar number"
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                    maxLength={12}
                    value={requestForm.patient_aadhaar_number}
                    onChangeText={(value) => setRequestForm({ ...requestForm, patient_aadhaar_number: value })}
                />

                <TouchableOpacity style={styles.uploadBox} onPress={pickPatientAadhaar}>
                    <Text style={styles.uploadTitle}>
                        {requestForm.patient_aadhaar_document_name || 'Upload Patient Aadhaar'}
                    </Text>
                    <Text style={styles.uploadSubtitle}>Required for patient verification</Text>
                </TouchableOpacity>

                <View style={styles.duoRow}>
                    <TextInput
                        style={[styles.input, styles.halfInput]}
                        placeholder="Latitude"
                        placeholderTextColor="#94a3b8"
                        keyboardType="decimal-pad"
                        value={requestForm.latitude}
                        onChangeText={(value) => setRequestForm({ ...requestForm, latitude: value })}
                    />
                    <TextInput
                        style={[styles.input, styles.halfInput]}
                        placeholder="Longitude"
                        placeholderTextColor="#94a3b8"
                        keyboardType="decimal-pad"
                        value={requestForm.longitude}
                        onChangeText={(value) => setRequestForm({ ...requestForm, longitude: value })}
                    />
                </View>

                <TouchableOpacity style={styles.locationButton} onPress={syncCurrentLocation} disabled={locationLoading}>
                    <LocateFixed size={16} color={palette.tint} />
                    <Text style={styles.locationButtonText}>{locationLoading ? 'Detecting location...' : 'Use Current Phone Location'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.publishButton} onPress={createRequest} disabled={saving}>
                    <Text style={styles.publishButtonText}>{saving ? 'Submitting...' : 'Submit Blood Request'}</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Your request dashboard</Text>
            {requesterRequests.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No requests yet</Text>
                    <Text style={styles.emptyText}>Publish your first request using the form above.</Text>
                </View>
            ) : (
                requesterRequests.map((request) => (
                    <View key={request.id} style={styles.requestCard}>
                        <View style={styles.requestHeader}>
                            <View style={styles.requestTitleWrap}>
                                <Text style={styles.requestHospital}>{request.emergency_level} Priority</Text>
                                <Text style={styles.requestPatient}>{request.patient_name}</Text>
                            </View>
                            <View style={styles.bloodBadge}>
                                <Text style={styles.bloodBadgeText}>{request.blood_group_required}</Text>
                            </View>
                        </View>
                        <View style={styles.infoRow}>
                            <View style={styles.infoPill}>
                                <Users size={14} color={palette.muted} />
                                <Text style={styles.infoPillText}>{request.donor_responses || 0} donors</Text>
                            </View>
                            <View style={styles.infoPill}>
                                <Droplet size={14} color={palette.muted} />
                                <Text style={styles.infoPillText}>{request.units_required} unit(s)</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.mapButton}
                            onPress={() => openInGoogleMaps(request.latitude, request.longitude, request.patient_name)}
                        >
                            <MapPin size={16} color={palette.tint} />
                            <Text style={styles.mapButtonText}>Open Google Map</Text>
                        </TouchableOpacity>

                        {request.patient_qr_code ? (
                            <View style={styles.qrWrap}>
                                <Image source={{ uri: request.patient_qr_code }} style={styles.qrImage} />
                                <Text style={styles.qrText}>Patient QR for donor scan</Text>
                            </View>
                        ) : null}

                        <Text style={styles.statusText}>{request.request_status}</Text>
                    </View>
                ))
            )}
        </View>
    );

    const renderHistorySection = () => (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>History</Text>
            {history.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No completed donation history</Text>
                    <Text style={styles.emptyText}>Completed QR-verified donations will appear here.</Text>
                </View>
            ) : (
                history.map((item) => (
                    <View key={item.id} style={styles.requestCard}>
                        <View style={styles.requestHeader}>
                            <View style={styles.requestTitleWrap}>
                                <Text style={styles.requestHospital}>
                                    {new Date(item.created_at).toLocaleDateString()} - {item.status}
                                </Text>
                                <Text style={styles.requestPatient}>{item.patient_name}</Text>
                            </View>
                            <View style={styles.bloodBadge}>
                                <Text style={styles.bloodBadgeText}>{item.blood_group_required}</Text>
                            </View>
                        </View>
                        <View style={styles.infoRow}>
                            <View style={styles.infoPill}>
                                <Users size={14} color={palette.muted} />
                                <Text style={styles.infoPillText}>Donor: {item.donor_name || 'N/A'}</Text>
                            </View>
                            <View style={styles.infoPill}>
                                <Droplet size={14} color={palette.muted} />
                                <Text style={styles.infoPillText}>Requester: {item.requester_name}</Text>
                            </View>
                            <View style={styles.infoPill}>
                                <Siren size={14} color={palette.muted} />
                                <Text style={styles.infoPillText}>{item.units_required} unit(s)</Text>
                            </View>
                        </View>
                    </View>
                ))
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.topBar}>
                <View style={styles.brandWrap}>
                    <View style={styles.brandIcon}>
                        <Droplet color="#fff" size={22} />
                    </View>
                    <View>
                        <Text style={styles.brandTitle}>LifeDrop</Text>
                        <Text style={styles.brandSubtitle}>Smart blood dispatch</Text>
                    </View>
                </View>
                <View style={styles.topActions}>
                    <TouchableOpacity onPress={() => router.push('/scan-qr')} style={styles.profileButton}>
                        <QrCode color={palette.dark} size={22} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => router.push('/profile')} style={styles.profileButton}>
                        <UserIcon color={palette.dark} size={22} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadDashboard} tintColor={palette.tint} />}
            >
                <Text style={styles.greeting}>Welcome back,</Text>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.subtitle}>
                    {appMode === 'donate'
                        ? 'Accept compatible nearby requests and keep your eligibility updated.'
                        : appMode === 'need'
                          ? 'Apply for required blood and track donor responses live.'
                        : 'Apply for required blood and track donor responses live.'}
                </Text>

                {appMode ? (
                    <>
                        <TouchableOpacity style={styles.switchModeButton} onPress={() => setAppMode('')}>
                            <RotateCcw color={palette.tint} size={16} />
                            <Text style={styles.switchModeText}>Switch Donate / Need Blood</Text>
                        </TouchableOpacity>
                        {appMode === 'donate' ? renderDonorDashboard() : renderHospitalDashboard()}
                        {renderHistorySection()}
                    </>
                ) : renderModePicker()}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: palette.background },
    center: { justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 14, fontSize: 13, color: palette.muted, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 22,
        paddingVertical: 16,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
    },
    brandWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    brandIcon: {
        width: 46,
        height: 46,
        borderRadius: 18,
        backgroundColor: palette.tint,
        justifyContent: 'center',
        alignItems: 'center',
    },
    brandTitle: { fontSize: 20, fontWeight: '900', color: palette.dark },
    brandSubtitle: { fontSize: 11, color: palette.tint, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.8 },
    profileButton: { backgroundColor: palette.softSlate, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: palette.border },
    topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    scrollContent: { padding: 22, paddingBottom: 40 },
    greeting: { fontSize: 16, fontWeight: '700', color: palette.muted },
    userName: { fontSize: 34, fontWeight: '900', color: palette.dark, marginTop: 4 },
    subtitle: { fontSize: 14, color: palette.muted, marginTop: 8, lineHeight: 22, fontWeight: '600' },
    section: { marginTop: 24 },
    modeCard: {
        marginTop: 24,
        backgroundColor: palette.card,
        borderRadius: 28,
        padding: 22,
        borderWidth: 1,
        borderColor: palette.border,
    },
    modeSubtitle: { marginBottom: 20, fontSize: 14, color: palette.muted, fontWeight: '600', lineHeight: 22 },
    donateModeButton: {
        backgroundColor: palette.tint,
        borderRadius: 22,
        paddingVertical: 18,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
    },
    needModeButton: {
        backgroundColor: palette.softRose,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: 22,
        paddingVertical: 18,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
    },
    modeButtonText: { color: '#fff', fontSize: 15, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4 },
    needModeButtonText: { color: palette.tint, fontSize: 15, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4 },
    switchModeButton: {
        marginTop: 18,
        alignSelf: 'flex-start',
        backgroundColor: palette.softRose,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    switchModeText: { color: palette.tint, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
    statsGrid: { flexDirection: 'row', gap: 12 },
    statTile: {
        flex: 1,
        backgroundColor: palette.card,
        borderRadius: 26,
        padding: 18,
        borderWidth: 1,
        borderColor: palette.border,
    },
    statIcon: { width: 46, height: 46, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    statLabel: { marginTop: 16, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4, color: palette.muted },
    statValue: { marginTop: 6, fontSize: 20, fontWeight: '900', color: palette.dark },
    healthButton: {
        marginTop: 16,
        backgroundColor: palette.dark,
        borderRadius: 22,
        paddingVertical: 18,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
    },
    healthButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
    sectionTitle: { marginTop: 24, marginBottom: 14, fontSize: 18, fontWeight: '900', color: palette.dark },
    emptyState: {
        backgroundColor: palette.card,
        borderRadius: 28,
        padding: 24,
        borderWidth: 1,
        borderColor: palette.border,
        alignItems: 'center',
    },
    emptyTitle: { fontSize: 18, fontWeight: '900', color: palette.dark },
    emptyText: { marginTop: 8, textAlign: 'center', fontSize: 13, lineHeight: 20, color: palette.muted, fontWeight: '600' },
    requestCard: {
        backgroundColor: palette.card,
        borderRadius: 28,
        padding: 20,
        borderWidth: 1,
        borderColor: palette.border,
        marginBottom: 14,
    },
    requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
    requestTitleWrap: { flex: 1 },
    requestHospital: { fontSize: 11, fontWeight: '900', color: palette.tint, textTransform: 'uppercase', letterSpacing: 1.4 },
    requestPatient: { marginTop: 6, fontSize: 22, fontWeight: '900', color: palette.dark },
    bloodBadge: { backgroundColor: palette.softRose, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
    bloodBadgeText: { color: palette.tint, fontSize: 18, fontWeight: '900' },
    infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
    infoPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: palette.softSlate,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
    },
    infoPillText: { fontSize: 12, color: palette.muted, fontWeight: '800' },
    acceptButton: { marginTop: 16, backgroundColor: palette.tint, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
    disabledButton: { opacity: 0.55 },
    acceptButtonText: { color: '#fff', fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4 },
    mapButton: {
        marginTop: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.softRose,
        paddingVertical: 14,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    mapButtonText: { color: palette.tint, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
    scanButton: {
        marginTop: 12,
        borderRadius: 18,
        backgroundColor: palette.dark,
        paddingVertical: 14,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    scanButtonText: { color: '#fff', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
    formCard: {
        backgroundColor: palette.card,
        borderRadius: 28,
        padding: 20,
        borderWidth: 1,
        borderColor: palette.border,
    },
    input: {
        backgroundColor: palette.softSlate,
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 15,
        fontSize: 15,
        color: palette.dark,
        fontWeight: '700',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: palette.border,
    },
    duoRow: { flexDirection: 'row', gap: 10 },
    halfInput: { flex: 1 },
    uploadBox: {
        backgroundColor: palette.softRose,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: palette.border,
        padding: 16,
        marginBottom: 12,
    },
    uploadTitle: { fontSize: 14, fontWeight: '900', color: palette.dark },
    uploadSubtitle: { marginTop: 4, fontSize: 12, fontWeight: '600', color: palette.muted },
    locationButton: {
        backgroundColor: palette.softRose,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: palette.border,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    locationButtonText: { color: palette.tint, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
    publishButton: { backgroundColor: palette.dark, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
    publishButtonText: { color: '#fff', fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
    qrWrap: {
        marginTop: 16,
        alignItems: 'center',
        backgroundColor: palette.softSlate,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: palette.border,
        padding: 16,
    },
    qrImage: { width: 160, height: 160, borderRadius: 12, backgroundColor: '#fff' },
    qrText: { marginTop: 10, fontSize: 12, fontWeight: '900', color: palette.muted, textTransform: 'uppercase', letterSpacing: 1.2 },
    statusText: { marginTop: 14, fontSize: 12, fontWeight: '900', color: palette.warning, textTransform: 'uppercase', letterSpacing: 1.4 },
});

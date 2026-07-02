/**
 * generate-qr.js
 *
 * Screen for the PRIMARY donor to generate their personal QR code for a
 * specific blood request. The hospital scans this QR to verify identity and
 * mark the donation as complete.
 *
 * Route params:
 *   requestId  – ID of the BloodRequest the donor has accepted
 */

import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    SafeAreaView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Download, QrCode } from 'lucide-react-native';
import api from '../services/api';
import { Colors } from '../constants/theme';

const palette = Colors.light;

export default function GenerateQRScreen() {
    const router = useRouter();
    const { requestId } = useLocalSearchParams();

    const [qrCode, setQrCode] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchQR = async () => {
        if (!requestId) {
            setError('No request ID provided.');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await api.post('/donation/generate-qr', {
                requestId: Number(requestId),
            });
            setQrCode(res.data.qrCode);
        } catch (err) {
            const msg = err.response?.data?.msg || 'Could not generate QR code.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQR();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestId]);

    const handleShare = async () => {
        try {
            await Share.share({
                message: `LifeDrop Donor QR Code — Request #${requestId}. Show this to the hospital staff.`,
                url: qrCode, // iOS only; Android uses 'message'
            });
        } catch {
            Alert.alert('Share failed', 'Could not share QR code.');
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft color={palette.dark} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Donor QR Code</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.body}>
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={palette.tint} />
                        <Text style={styles.infoText}>Generating your QR code…</Text>
                    </View>
                ) : error ? (
                    <View style={styles.center}>
                        <QrCode size={52} color={palette.tint} />
                        <Text style={styles.errorTitle}>Unable to generate QR</Text>
                        <Text style={styles.infoText}>{error}</Text>
                        <TouchableOpacity style={styles.button} onPress={fetchQR}>
                            <Text style={styles.buttonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <View style={styles.card}>
                            <Text style={styles.cardLabel}>Show this to hospital staff</Text>
                            <Text style={styles.cardSub}>
                                Request #{requestId} — valid until donation is verified
                            </Text>

                            {qrCode ? (
                                <Image
                                    source={{ uri: qrCode }}
                                    style={styles.qrImage}
                                    accessibilityLabel="Donor QR code for blood donation verification"
                                />
                            ) : (
                                <View style={styles.qrPlaceholder}>
                                    <QrCode size={80} color={palette.muted} />
                                </View>
                            )}

                            <Text style={styles.instructions}>
                                The hospital will scan this QR code to confirm your identity and
                                complete the donation record.
                            </Text>
                        </View>

                        <View style={styles.actions}>
                            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                                <Download size={18} color={palette.tint} />
                                <Text style={styles.shareButtonText}>Share QR</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.refreshButton} onPress={fetchQR}>
                                <Text style={styles.refreshButtonText}>Refresh QR</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: palette.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderColor: palette.border,
    },
    backBtn: { padding: 8, backgroundColor: palette.softSlate, borderRadius: 14 },
    headerTitle: { fontSize: 18, fontWeight: '900', color: palette.dark },
    body: { flex: 1, padding: 24 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    card: {
        backgroundColor: '#fff',
        borderRadius: 28,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: palette.border,
    },
    cardLabel: {
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1.6,
        color: palette.tint,
        marginBottom: 6,
    },
    cardSub: { fontSize: 13, fontWeight: '700', color: palette.muted, marginBottom: 24 },
    qrImage: {
        width: 220,
        height: 220,
        borderRadius: 16,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: palette.border,
    },
    qrPlaceholder: {
        width: 220,
        height: 220,
        borderRadius: 16,
        backgroundColor: palette.softSlate,
        alignItems: 'center',
        justifyContent: 'center',
    },
    instructions: {
        marginTop: 20,
        textAlign: 'center',
        fontSize: 13,
        lineHeight: 21,
        fontWeight: '600',
        color: palette.muted,
    },
    actions: { marginTop: 24, gap: 12 },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.softRose,
        borderRadius: 18,
        paddingVertical: 16,
    },
    shareButtonText: { fontSize: 14, fontWeight: '900', color: palette.tint },
    refreshButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.dark,
        borderRadius: 18,
        paddingVertical: 16,
    },
    refreshButtonText: { fontSize: 14, fontWeight: '900', color: '#fff' },
    errorTitle: { marginTop: 16, fontSize: 22, fontWeight: '900', color: palette.dark },
    infoText: {
        marginTop: 12,
        fontSize: 14,
        fontWeight: '600',
        color: palette.muted,
        textAlign: 'center',
        lineHeight: 22,
    },
    button: {
        marginTop: 20,
        backgroundColor: palette.tint,
        borderRadius: 18,
        paddingVertical: 16,
        paddingHorizontal: 28,
    },
    buttonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});

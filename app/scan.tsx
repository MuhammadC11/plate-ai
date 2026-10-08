import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { File as FsFile } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { colors, radius, spacing } from '@/lib/theme';

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  function openReview(uri: string) {
    // replace, not push: the camera has served its purpose and shouldn't sit
    // behind the review screen in the history stack.
    router.replace({ pathname: '/review', params: { uri } });
  }

  async function capture() {
    if (!cameraRef.current || !ready || capturing) return;

    setCapturing(true);
    try {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) openReview(photo.uri);
    } catch (error) {
      console.error('Capture failed:', error);
    } finally {
      setCapturing(false);
    }
  }

  async function pickFromLibrary() {
    try {
      const picked = await FsFile.pickFileAsync({ mimeTypes: 'image/*' });
      if (!picked.canceled && picked.result) openReview(picked.result.uri);
    } catch (error) {
      console.error('Picking an image failed:', error);
    }
  }

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Icon name="camera" color={colors.textMuted} size={40} />
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionBody}>
          Plate AI reads your meal from a photo, so it needs permission to use the camera. You can
          also pick a photo from your library instead.
        </Text>
        <View style={styles.permissionActions}>
          <Button label="Allow camera" onPress={requestPermission} />
          <Button label="Choose from library" variant="secondary" onPress={pickFromLibrary} />
          <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        onCameraReady={() => setReady(true)}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close camera"
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <Icon name="close" color={colors.text} size={22} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch camera"
          onPress={() => setFacing((prev) => (prev === 'back' ? 'front' : 'back'))}
          style={styles.iconButton}
        >
          <Icon name="flip" color={colors.text} size={22} />
        </Pressable>
      </View>

      <View style={styles.guideWrap} pointerEvents="none">
        <View style={styles.guide} />
        <Text style={styles.guideHint}>
          Fill the frame with the plate. Shoot from a slight angle so depth is visible.
        </Text>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose a photo from your library"
          onPress={pickFromLibrary}
          style={styles.iconButton}
        >
          <Icon name="image" color={colors.text} size={22} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          onPress={capture}
          disabled={!ready || capturing}
          style={({ pressed }) => [styles.shutter, pressed && styles.shutterPressed]}
        >
          {capturing ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </Pressable>

        {/* Balances the row so the shutter stays centred. */}
        <View style={styles.iconButtonSpacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  permissionTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: spacing.sm },
  permissionBody: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  permissionActions: { alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.lg },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonSpacer: { width: 44, height: 44 },
  guideWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  guide: {
    width: '82%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  guideHint: {
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
    lineHeight: 19,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 6,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterPressed: { transform: [{ scale: 0.93 }] },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: '#fff',
  },
});

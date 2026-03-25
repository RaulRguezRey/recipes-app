import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { searchGoogleImages, GoogleImage } from '../lib/googleImages';
import { C, FONT, RADIUS, SHADOW } from '../constants/theme';

type Props = {
  visible: boolean;
  initialQuery: string;
  onSelect: (url: string) => void;
  onClose: () => void;
};

const NUM_COLUMNS = 2;
const MAX_PAGE = 10; // Google CSE allows start up to 91 (10 pages of 10)

export default function GoogleImagePickerModal({ visible, initialQuery, onSelect, onClose }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [images, setImages] = useState<GoogleImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (visible) {
      setQuery(initialQuery);
      setImages([]);
      setPage(1);
      setHasMore(true);
      doSearch(initialQuery, 1, true);
    }
  }, [visible, initialQuery]);

  async function doSearch(q: string, p: number, reset: boolean) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const results = await searchGoogleImages(q.trim(), p);
      setImages((prev) => reset ? results : [...prev, ...results]);
      setHasMore(results.length === 10 && p < MAX_PAGE);
    } catch (e: any) {
      setError(e?.message ?? 'Error al buscar imágenes.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit() {
    setImages([]);
    setPage(1);
    setHasMore(true);
    doSearch(query, 1, true);
  }

  function handleLoadMore() {
    if (loading || !hasMore) return;
    const next = page + 1;
    setPage(next);
    doSearch(query, next, false);
  }

  function handleSelect(image: GoogleImage) {
    onSelect(image.link);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Buscar imagen</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={22} color={C.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            placeholder="Buscar imagen..."
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSubmit}>
            <Text style={styles.searchBtnText}>Buscar</Text>
          </TouchableOpacity>
        </View>

        {/* Results */}
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <FlatList
            data={images}
            keyExtractor={(item, i) => `${item.link}-${i}`}
            numColumns={NUM_COLUMNS}
            contentContainerStyle={styles.grid}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={
              loading ? null : <Text style={styles.emptyText}>Sin resultados</Text>
            }
            ListFooterComponent={
              loading ? <ActivityIndicator style={styles.spinner} color={C.primary} /> : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.imageCell} onPress={() => handleSelect(item)} activeOpacity={0.8}>
                <Image
                  source={{ uri: item.thumbnail }}
                  style={styles.imageThumb}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const CELL_GAP = 8;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bgPage,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: C.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: {
    fontSize: 18,
    fontFamily: FONT.serif,
    color: C.textPrimary,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: C.bgSurface,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    backgroundColor: C.bgInput,
    color: C.textPrimary,
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: C.primary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  grid: {
    padding: CELL_GAP,
    gap: CELL_GAP,
  },
  imageCell: {
    flex: 1,
    margin: CELL_GAP / 2,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    backgroundColor: C.border,
    ...SHADOW.sm,
  },
  imageThumb: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  spinner: {
    marginVertical: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: C.textMuted,
    marginTop: 40,
    fontSize: 14,
  },
  errorText: {
    textAlign: 'center',
    color: C.danger,
    marginTop: 24,
    marginHorizontal: 16,
    fontSize: 14,
  },
});

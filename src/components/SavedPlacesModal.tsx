import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
} from "react-native";

export default function SavedPlacesModal({
  visible,
  places,
  onSelect,
  onDelete, // ✅ NEW
  onClose,
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Saved Places</Text>

          <FlatList
            data={places}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.row}>
                {/* SELECT SAVED PLACE */}
                <TouchableOpacity
                  style={styles.item}
                  onPress={() => onSelect(item)}
                >
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.address}>{item.address}</Text>
                </TouchableOpacity>

                {/* DELETE BUTTON */}
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => onDelete(item.id)}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          />

          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "65%",
  },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  item: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 8,
  },

  name: { fontSize: 16, fontWeight: "600" },
  address: { fontSize: 12, color: "#666" },

  deleteBtn: {
    backgroundColor: "#ffe5e5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginLeft: 6,
  },
  deleteText: {
    color: "#cc0000",
    fontWeight: "700",
    fontSize: 12,
  },

  closeBtn: {
    marginTop: 12,
    backgroundColor: "#eee",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  closeText: { fontWeight: "700" },
});

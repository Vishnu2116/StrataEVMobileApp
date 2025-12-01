import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

type RouteInputCardProps = {
  startLabel: string;
  destinationLabel: string;
  onPressStart: () => void;
  onPressDestination: () => void;
  onPressSaved: () => void;
};

const RouteInputCard: React.FC<RouteInputCardProps> = ({
  startLabel,
  destinationLabel,
  onPressStart,
  onPressDestination,
  onPressSaved,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.handleBar} />

      {/* Start */}
      <TouchableOpacity style={styles.row} onPress={onPressStart}>
        <View style={styles.dotWrapper}>
          <View style={[styles.dot, styles.dotStart]} />
        </View>
        <View style={styles.textWrapper}>
          <Text style={styles.label}>Start</Text>
          <Text
            style={[styles.value, !startLabel && styles.placeholderText]}
            numberOfLines={1}
          >
            {startLabel || "Choose starting point"}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.divider} />

      {/* Destination */}
      <TouchableOpacity style={styles.row} onPress={onPressDestination}>
        <View style={styles.dotWrapper}>
          <View style={[styles.dot, styles.dotDest]} />
        </View>
        <View style={styles.textWrapper}>
          <Text style={styles.label}>Destination</Text>
          <Text
            style={[styles.value, !destinationLabel && styles.placeholderText]}
            numberOfLines={1}
          >
            {destinationLabel || "Enter destination"}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Saved Places */}
      <View style={styles.addRow}>
        <TouchableOpacity style={styles.addBtn} onPress={onPressSaved}>
          <Text style={styles.addIcon}>★</Text>
          <Text style={styles.addText}>Saved Places</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default RouteInputCard;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  handleBar: {
    alignSelf: "center",
    width: 32,
    height: 3,
    borderRadius: 999,
    backgroundColor: "#E0E0E0",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  dotWrapper: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotStart: {
    backgroundColor: "#0A8754",
  },
  dotDest: {
    backgroundColor: "#0A5CFF",
  },
  textWrapper: {
    flex: 1,
    marginLeft: 6,
  },
  label: {
    fontSize: 11,
    color: "#888",
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    color: "#222",
    fontWeight: "600",
  },
  placeholderText: {
    color: "#AAA",
    fontWeight: "400",
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginVertical: 4,
  },
  addRow: {
    marginTop: 4,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  addIcon: {
    fontSize: 14,
    marginRight: 4,
    color: "#0A5CFF",
  },
  addText: {
    fontSize: 12,
    color: "#0A5CFF",
    fontWeight: "600",
  },
});

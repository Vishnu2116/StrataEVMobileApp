import React from "react";
import { View, Text } from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { TabParamList } from "../navigation/TabNavigator";

type Props = BottomTabScreenProps<TabParamList, "Map">;

export default function MainMapScreen({ navigation }: Props) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Map Screen</Text>
    </View>
  );
}

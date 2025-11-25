import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import MainMapScreen from "../screens/MainMapScreen";
import ProfileScreen from "../screens/ProfileScreen";

// 1️⃣ Define the param list for the tabs
export type TabParamList = {
  Map: undefined;
  Profile: undefined;
};

// 2️⃣ Pass the type to createBottomTabNavigator
const Tab = createBottomTabNavigator<TabParamList>();

export default function TabNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Map" component={MainMapScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

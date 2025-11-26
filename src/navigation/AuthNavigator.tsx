import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "../screens/LoginScreen";
import OTPScreen from "../screens/OTPScreen";
import NameScreen from "../screens/NameScreen";

export type AuthStackParamList = {
  Login: undefined;
  OTP: { phone: string; confirmation: any }; // 🔥 updated
  Name: { uid: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />
      <Stack.Screen name="Name" component={NameScreen} />
    </Stack.Navigator>
  );
}

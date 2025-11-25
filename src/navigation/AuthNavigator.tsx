import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

export type AuthStackParamList = {
  Login: undefined;
  OTP: { phone: string };
  Name: { uid: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

// Temporary placeholder screens until Step 3.2
function TempScreen({ route }: any) {
  return (
    <>
      {route.name === "Login" && <></>}
      {route.name === "OTP" && <></>}
      {route.name === "Name" && <></>}
    </>
  );
}

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={TempScreen} />
      <Stack.Screen name="OTP" component={TempScreen} />
      <Stack.Screen name="Name" component={TempScreen} />
    </Stack.Navigator>
  );
}

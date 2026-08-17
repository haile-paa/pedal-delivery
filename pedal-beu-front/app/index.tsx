import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAppState } from "../src/context/AppStateContext";

export default function Index() {
  const { state } = useAppState();

  // AppStateContext's loadUser() effect restores the persisted session
  // (token + role + user) from AsyncStorage/backend on launch, and that
  // network round trip can take a few seconds. auth.isLoading starts
  // `true` and only flips to `false` once that restore finishes (see
  // LOGIN_SUCCESS / LOGOUT in the reducer).
  //
  // This screen used to decide where to go based on `state.auth.token`
  // alone, which is still `null` at the very first render — so on every
  // cold launch with a saved session it redirected to /(auth)/welcome
  // immediately, then had to redirect AGAIN to /(customer)/home or
  // /(driver)/dashboard once the slow restore resolved a few seconds
  // later. That second redirect could land while the first screen's
  // mount/animations were still settling, which is what caused the
  // "addViewAt: failed to insert view ... already has a parent" crash.
  //
  // Waiting for isLoading to settle means we only ever issue ONE redirect.
  if (state.auth.isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#fff",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size='large' color='#2f6a3f' />
      </View>
    );
  }

  if (!state.auth.token) {
    return <Redirect href='/(auth)/welcome' />;
  }

  if (state.auth.role === "customer") {
    return <Redirect href='/(customer)/home' />;
  } else if (state.auth.role === "driver") {
    return <Redirect href='/(driver)/dashboard' />;
  }

  return <Redirect href='/(auth)/welcome' />;
}

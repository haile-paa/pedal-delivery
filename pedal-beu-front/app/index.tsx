import { Redirect } from "expo-router";
import { useAppState } from "../src/context/AppStateContext";

export default function Index() {
  const { state } = useAppState();

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

import React from "react";
import { StatusBar } from "expo-status-bar";
import MainScreen from "./src/screens/MainScreen"; // Import the new screen

export default function App() {
  return (
    <>
      <StatusBar style="auto" />
      <MainScreen />
    </>
  );
}

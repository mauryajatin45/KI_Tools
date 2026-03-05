import React from "react";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import WaitlistPage from "./pages/WaitlistPage.jsx";

export default function App() {
  return (
    <AppProvider i18n={enTranslations}>
      <WaitlistPage />
    </AppProvider>
  );
}

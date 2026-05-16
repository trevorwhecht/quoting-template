import DashboardSettingsViewSetupFeePresets from "./Dashboard-SettingsView-SetupFeePresets"

export default function DashboardSettingsView() {
  return (
    <div className="p-6 max-w-4xl space-y-10">
      <h2 className="text-xl font-semibold text-(--color-foreground)">Settings</h2>
      <DashboardSettingsViewSetupFeePresets />
    </div>
  )
}

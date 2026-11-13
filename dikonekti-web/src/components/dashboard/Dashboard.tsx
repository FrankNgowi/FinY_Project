"use client";

import { useState } from "react";
import type { UserProfile } from "@/lib/types";
import { AlertCard } from "./AlertCard";
import { ErrorBanner } from "./ErrorBanner";
import { LogoutButton } from "./LogoutButton";
import { PatientCard } from "./PatientCard";
import { QuickActions, type QuickAction } from "./QuickActions";
import { TabTitle } from "./TabTitle";
import { WelcomeHeader } from "./WelcomeHeader";
import { HealthTipsDialog } from "./dialogs/HealthTipsDialog";
import { MessagesDialog } from "./dialogs/MessagesDialog";
import { ProfileDialog } from "./dialogs/ProfileDialog";
import { ScheduleDialog } from "./dialogs/ScheduleDialog";
import { useAcknowledge, useAlerts, usePatients } from "./hooks/useDashboardData";

export function Dashboard({ profile }: { profile: UserProfile }) {
  const alertsQuery = useAlerts();
  const patientsQuery = usePatients();
  const acknowledge = useAcknowledge();
  const [openAction, setOpenAction] = useState<QuickAction | null>(null);
  const closeDialog = () => setOpenAction(null);

  const alerts = alertsQuery.data;
  const patients = patientsQuery.data;
  const loadError = alertsQuery.error ?? patientsQuery.error;
  const loading = alerts === undefined && patients === undefined && !loadError;

  const active = alerts?.filter((a) => !a.acknowledged) ?? [];
  const resolved = alerts?.filter((a) => a.acknowledged) ?? [];
  const activeCount = alerts ? active.length : null;

  function retry() {
    void alertsQuery.mutate();
    void patientsQuery.mutate();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TabTitle activeAlertCount={activeCount} />
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <p className="text-lg font-bold text-ink">Doctor Dashboard</p>
          <LogoutButton />
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
        <WelcomeHeader displayName={profile.display_name} activeAlertCount={activeCount} />

        {loadError && (
          <ErrorBanner
            message={`Could not load some dashboard data. ${loadError instanceof Error ? loadError.message : ""}`.trim()}
            onRetry={retry}
          />
        )}

        {loading ? (
          <p role="status" className="py-12 text-center text-muted">
            Loading dashboard…
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <section aria-labelledby="alerts-heading" className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 id="alerts-heading" className="text-xl font-bold text-ink">
                  Emergency Alerts
                </h2>
                {active.length > 0 && (
                  <span className="rounded-full bg-danger px-3 py-1 text-xs font-bold text-white">
                    {active.length} active
                  </span>
                )}
              </div>
              {alerts === undefined ? (
                <p className="text-sm text-muted">Alerts are unavailable right now.</p>
              ) : alerts.length === 0 ? (
                <p className="rounded-2xl border border-line bg-surface p-5 text-muted">
                  No emergency alerts right now.
                </p>
              ) : (
                <>
                  {active.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} onAcknowledge={acknowledge} />
                  ))}
                  {resolved.length > 0 && (
                    <>
                      <h3 className="mt-2 text-sm font-semibold text-muted">Resolved</h3>
                      {resolved.map((alert) => (
                        <AlertCard key={alert.id} alert={alert} onAcknowledge={acknowledge} />
                      ))}
                    </>
                  )}
                </>
              )}
            </section>

            <div className="flex flex-col gap-6">
              <section aria-labelledby="patients-heading" className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 id="patients-heading" className="text-xl font-bold text-ink">
                    My Patients
                  </h2>
                  {patients && (
                    <span
                      aria-label={`${patients.length} ${patients.length === 1 ? "patient" : "patients"}`}
                      className="rounded-full bg-navy px-3 py-1 text-xs font-bold text-white"
                    >
                      {patients.length}
                    </span>
                  )}
                </div>
                {patients === undefined ? (
                  <p className="text-sm text-muted">Patients are unavailable right now.</p>
                ) : patients.length === 0 ? (
                  <p className="rounded-2xl border border-line bg-surface p-5 text-muted">
                    No patients have registered with you yet. New patients who choose you as their doctor at sign-up
                    will appear here automatically.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {patients.map((patient) => (
                      <PatientCard key={patient.username} patient={patient} />
                    ))}
                  </ul>
                )}
              </section>

              <QuickActions onSelect={setOpenAction} />
            </div>
          </div>
        )}
      </main>

      {openAction === "profile" && <ProfileDialog profile={profile} onClose={closeDialog} />}
      {openAction === "tips" && <HealthTipsDialog onClose={closeDialog} />}
      {openAction === "schedule" && <ScheduleDialog onClose={closeDialog} />}
      {openAction === "messages" && (
        <MessagesDialog currentUsername={profile.username} patients={patients ?? []} onClose={closeDialog} />
      )}
    </div>
  );
}

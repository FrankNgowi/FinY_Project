import type { Appointment, ChatMessage, EmergencyAlert, UserProfile } from "@/lib/types";

export function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    username: "patient1",
    role: "disabled",
    display_name: "Amina Otieno",
    first_name: "Amina",
    middle_name: "",
    last_name: "Otieno",
    email: "amina@example.test",
    phone_number: "+254700111222",
    area: "Kibera",
    disability_type: "Vision",
    specialization: null,
    ...overrides,
  };
}

export function makeDoctor(overrides: Partial<UserProfile> = {}): UserProfile {
  return makeProfile({
    username: "dr1",
    role: "doctor",
    display_name: "Dr. Jane Doe",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.test",
    phone_number: "+254700000001",
    area: "Nairobi",
    disability_type: null,
    specialization: "Cardiology",
    ...overrides,
  });
}

export function makeAlert(overrides: Partial<EmergencyAlert> = {}): EmergencyAlert {
  return {
    id: 1,
    patient_username: "patient1",
    patient_name: "Amina Otieno",
    patient_area: "Kibera",
    patient_phone_number: "+254700111222",
    disability_type: "Vision",
    latitude: -1.28639,
    longitude: 36.81722,
    location_error: null,
    timestamp: new Date().toISOString(),
    acknowledged: false,
    ...overrides,
  };
}

export function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 1,
    patient_username: "patient1",
    patient_name: "Amina Otieno",
    requested_time: "2026-11-20T09:30:00Z",
    reason: "Check-up",
    status: "pending",
    created_at: "2026-11-13T08:00:00Z",
    ...overrides,
  };
}

export function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 1,
    sender_username: "patient1",
    recipient_username: "dr1",
    body: "Hello doctor",
    timestamp: "2026-11-13T08:00:00Z",
    read: false,
    ...overrides,
  };
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

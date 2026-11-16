// Wire types: mirror the Django serializers exactly (snake_case).

export type VerificationStatus = "not_submitted" | "pending" | "approved" | "rejected";

/** What `GET /api/me/verification/` returns: the doctor's own record, never the file. */
export type VerificationRecord = {
  status: VerificationStatus;
  submitted_at: string | null;
  rejection_reason: string;
};

export type UserProfile = {
  username: string;
  role: string;
  display_name: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  area: string | null;
  disability_type: string | null;
  specialization: string | null;
  /** A doctor's certificate status; null for every other role. */
  verification_status: VerificationStatus | null;
};

/** One row of the admin review queue (`GET /api/admin/verifications/`). Never carries the file itself. */
export type AdminVerification = {
  id: number;
  username: string;
  display_name: string;
  specialization: string | null;
  area: string | null;
  phone_number: string | null;
  email: string;
  status: VerificationStatus;
  submitted_at: string | null;
  rejection_reason: string;
  reviewed_at: string | null;
};

export type EmergencyAlert = {
  id: number;
  patient_username: string;
  patient_name: string;
  patient_area: string | null;
  patient_phone_number: string | null;
  disability_type: string | null;
  latitude: number | null;
  longitude: number | null;
  location_error: string | null;
  timestamp: string;
  acknowledged: boolean;
};

export type AppointmentStatus = "pending" | "confirmed" | "declined";

export type Appointment = {
  id: number;
  patient_username: string;
  patient_name: string;
  requested_time: string;
  reason: string;
  status: AppointmentStatus;
  created_at: string;
};

export type ChatMessage = {
  id: number;
  sender_username: string;
  recipient_username: string;
  body: string;
  timestamp: string;
  read: boolean;
};

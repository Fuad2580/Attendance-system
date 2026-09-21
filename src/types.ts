export type RoleLevel = 'R1' | 'R2' | 'R3' | 'ADMIN';

export type AttendanceType = 'IN' | 'OUT';

export type RequestType = 
  | 'Overtime'
  | 'Clock In Revision'
  | 'Clock Out Revision'
  | 'Sick Leave'
  | 'Annual Leave';

export type RequestStatus = 
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export interface AppConfig {
  attendanceRadiusMeter: number;
  attendanceRetentionDays: number;
  allowFaceRegistration: boolean;
  requireFaceRecognition: boolean;
  /** @deprecated dipakai oleh biometrik versi lama (cosine similarity). */
  faceMatchThreshold: number;
  /** Ambang jarak Euclidean face recognition (0.35 = sangat ketat, 0.5 = longgar). */
  faceMaxDistance: number;
  faceConsentRequired: boolean;
  allowClockIn: boolean;
  allowClockOut: boolean;
  workStartTime: string;
  workEndTime: string;
  archiveBeforeDelete: boolean;
  requestRetentionDays: number;
}

export interface Manpower {
  nik: string;
  employeeName: string;
  email: string;
  phone: string;
  position: string;
  roleLevel: RoleLevel;
  department: string;
  homebaseLocationId: string;
  flexibleAttendance: boolean;
  supervisorNik: string;
  status: 'ACTIVE' | 'INACTIVE';
  faceRegistered: boolean;
  joinDate: string;
  endDate?: string;
}

export interface LocationMaster {
  locationId: string;
  locationName: string;
  locationType: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeter?: number; // If empty or undefined, uses CONFIG Attendance Radius Meter
  status: 'ACTIVE' | 'INACTIVE';
}

export interface AttendanceRecord {
  attendanceId: string;
  nik: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  type: AttendanceType;
  locationId: string;
  locationName: string;
  homebase: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  distance: number;
  attendanceMode: 'STANDARD' | 'FLEXIBLE' | 'REVISED';
  faceVerified: boolean;
  status: 'VERIFIED' | 'FAILED_GPS' | 'FAILED_FACE' | 'REVISED';
  createdAt: string;
}

export interface RequestRecord {
  requestId: string;
  nik: string;
  employeeName: string;
  requestType: RequestType;
  requestDate: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  reason: string;
  attachment?: string;
  status: RequestStatus;
  currentApproverNik: string;
  submittedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  targetAttendanceDate?: string;
  targetRevisedTime?: string;
  overtimeHours?: number;
}

export interface ApprovalRecord {
  approvalId: string;
  requestId: string;
  approverNik: string;
  approverName: string;
  role: RoleLevel;
  action: 'APPROVE' | 'REJECT';
  actionDate: string;
  comment: string;
}

export interface FaceRegisterRecord {
  nik: string;
  employeeName: string;
  faceTemplate: string; // JSON string of normalized biometric embedding vector
  registeredAt: string;
  updatedAt: string;
  status: 'ACTIVE' | 'REVOKED';
}

export interface AuditLogRecord {
  logId: string;
  timestamp: string;
  nik: string;
  user: string;
  action: string;
  referenceId: string;
  oldValue: string;
  newValue: string;
  latitude: number;
  longitude: number;
  description: string;
}

export interface GeoLocationState {
  latitude: number;
  longitude: number;
  accuracy: number;
  nearestLocation: LocationMaster | null;
  distance: number; // meters
  isVerified: boolean;
  isFlexible: boolean;
  allowedRadius: number;
  error?: string;
}

export interface NearestLocationResult {
  location: LocationMaster | null;
  distance: number;
  allowedRadius: number;
  isWithinRadius: boolean;
}

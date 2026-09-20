import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  AppConfig,
  Manpower,
  LocationMaster,
  AttendanceRecord,
  RequestRecord,
  ApprovalRecord,
  FaceRegisterRecord,
  AuditLogRecord,
  NearestLocationResult,
  RequestType,
} from '../types';
import {
  DEFAULT_CONFIG,
  DEFAULT_LOCATIONS,
  DEFAULT_MANPOWER,
  DEFAULT_ATTENDANCE,
  DEFAULT_REQUESTS,
  DEFAULT_APPROVALS,
  DEFAULT_FACE_REGISTER,
  DEFAULT_AUDIT_LOGS,
} from '../data/defaultData';
import { findNearestLocation } from '../utils/geo';
import { DEFAULT_SPREADSHEET_URL, DEFAULT_SPREADSHEET_ID } from '../utils/gasExporter';

interface AppContextType {
  // Master Data
  config: AppConfig;
  updateConfig: (newConfig: Partial<AppConfig>) => void;
  locations: LocationMaster[];
  updateLocations: (locations: LocationMaster[]) => void;
  manpower: Manpower[];
  updateManpower: (manpower: Manpower[]) => void;
  attendance: AttendanceRecord[];
  requests: RequestRecord[];
  approvals: ApprovalRecord[];
  faceRegisters: FaceRegisterRecord[];
  auditLogs: AuditLogRecord[];

  // Session / Auth
  currentUser: Manpower | null;
  login: (nik: string) => { success: boolean; message?: string };
  loginWithNik: (nik: string) => boolean;
  logout: () => void;
  switchUser: (nik: string) => void;

  // Geolocation
  userCoords: { latitude: number; longitude: number; accuracy: number };
  geoStatus: NearestLocationResult;
  isGpsLoading: boolean;
  gpsError: string | null;
  refreshGPS: () => void;
  setSimulatedLocation: (lat: number, lon: number, label?: string) => void;
  currentSimulatedLabel: string | null;

  // Actions
  clockIn: (options?: { faceVerified?: boolean }) => { success: boolean; message: string };
  clockOut: (options?: { faceVerified?: boolean }) => { success: boolean; message: string };
  registerFaceTemplate: (nik: string, templateJson: string) => { success: boolean; message: string };

  // Requests & Approvals
  submitRequest: (requestData: {
    requestType: RequestType;
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
    reason: string;
    attachment?: string;
    targetAttendanceDate?: string;
    targetRevisedTime?: string;
    overtimeHours?: number;
  }) => { success: boolean; message: string };

  approveRequest: (requestId: string, comment?: string) => { success: boolean; message: string };
  rejectRequest: (requestId: string, reason: string) => { success: boolean; message: string };

  // Retention & Maintenance
  runRetentionCleanup: () => { purgedCount: number; archivedCount: number };
  resetAllDataToDefault: () => void;

  // Google Spreadsheet & Apps Script Connection
  spreadsheetUrl: string;
  spreadsheetId: string;
  setSpreadsheetUrl: (url: string) => void;
  gasUrl: string;
  setGasUrl: (url: string) => void;
  isSyncingGas: boolean;
  syncGas: () => Promise<{ success: boolean; message: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  CONFIG: 'retail_att_config',
  LOCATIONS: 'retail_att_locations',
  MANPOWER: 'retail_att_manpower',
  ATTENDANCE: 'retail_att_attendance',
  REQUESTS: 'retail_att_requests',
  APPROVALS: 'retail_att_approvals',
  FACE_REGISTER: 'retail_att_face_reg',
  AUDIT_LOGS: 'retail_att_audit_logs',
  ACTIVE_NIK: 'retail_att_active_nik',
  GAS_URL: 'retail_att_gas_url',
  SPREADSHEET_URL: 'retail_att_spreadsheet_url',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Persistent state initialized from localStorage with fallback to defaultData
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });

  const [locations, setLocations] = useState<LocationMaster[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LOCATIONS);
    return saved ? JSON.parse(saved) : DEFAULT_LOCATIONS;
  });

  const [manpower, setManpower] = useState<Manpower[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MANPOWER);
    return saved ? JSON.parse(saved) : DEFAULT_MANPOWER;
  });

  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    return saved ? JSON.parse(saved) : DEFAULT_ATTENDANCE;
  });

  const [requests, setRequests] = useState<RequestRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.REQUESTS);
    return saved ? JSON.parse(saved) : DEFAULT_REQUESTS;
  });

  const [approvals, setApprovals] = useState<ApprovalRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.APPROVALS);
    return saved ? JSON.parse(saved) : DEFAULT_APPROVALS;
  });

  const [faceRegisters, setFaceRegisters] = useState<FaceRegisterRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FACE_REGISTER);
    return saved ? JSON.parse(saved) : DEFAULT_FACE_REGISTER;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    return saved ? JSON.parse(saved) : DEFAULT_AUDIT_LOGS;
  });

  const [gasUrl, setGasUrlState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.GAS_URL) || '';
  });

  const [spreadsheetUrl, setSpreadsheetUrlState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.SPREADSHEET_URL) || DEFAULT_SPREADSHEET_URL;
  });

  const extractSpreadsheetId = (url: string): string => {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : DEFAULT_SPREADSHEET_ID;
  };

  const spreadsheetId = useMemo(() => extractSpreadsheetId(spreadsheetUrl), [spreadsheetUrl]);

  const setSpreadsheetUrl = (url: string) => {
    const clean = url.trim() || DEFAULT_SPREADSHEET_URL;
    setSpreadsheetUrlState(clean);
    localStorage.setItem(STORAGE_KEYS.SPREADSHEET_URL, clean);
  };

  const [isSyncingGas, setIsSyncingGas] = useState(false);

  // Active user (starts with Andi Pratama 1001 for seamless live demonstration)
  const [currentUserNik, setCurrentUserNik] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_NIK) || '1001';
  });

  // GPS State (defaulting to near Ruko Puri: -6.18562, 106.73448 ~14m from LOC001)
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number; accuracy: number }>({
    latitude: -6.18562,
    longitude: 106.73448,
    accuracy: 10,
  });

  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [currentSimulatedLabel, setCurrentSimulatedLabel] = useState<string | null>('Ruko Puri (14m)');

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(locations));
  }, [locations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MANPOWER, JSON.stringify(manpower));
  }, [manpower]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendance));
  }, [attendance]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));
  }, [requests]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.APPROVALS, JSON.stringify(approvals));
  }, [approvals]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FACE_REGISTER, JSON.stringify(faceRegisters));
  }, [faceRegisters]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    if (currentUserNik) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_NIK, currentUserNik);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_NIK);
    }
  }, [currentUserNik]);

  const setGasUrl = (url: string) => {
    setGasUrlState(url);
    localStorage.setItem(STORAGE_KEYS.GAS_URL, url);
  };

  const currentUser = useMemo(() => {
    if (!currentUserNik) return null;
    return manpower.find((m) => m.nik === currentUserNik) || null;
  }, [currentUserNik, manpower]);

  // Compute nearest location from current coordinates and locations list
  const geoStatus = useMemo(() => {
    return findNearestLocation(userCoords.latitude, userCoords.longitude, locations, config);
  }, [userCoords, locations, config]);

  // Real Geolocation querying
  const refreshGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Browser does not support Geolocation API');
      return;
    }

    setIsGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setCurrentSimulatedLabel(null);
        setIsGpsLoading(false);
      },
      (err) => {
        setIsGpsLoading(false);
        setGpsError(err.message || 'GPS permission denied or unavailable');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const setSimulatedLocation = (lat: number, lon: number, label?: string) => {
    setUserCoords({ latitude: lat, longitude: lon, accuracy: 8 });
    setCurrentSimulatedLabel(label || null);
    setGpsError(null);
  };

  // Auth methods
  const login = (nik: string) => {
    const found = manpower.find((m) => m.nik.trim() === nik.trim());
    if (found) {
      if (found.status === 'INACTIVE') {
        return { success: false, message: 'Employee account is inactive. Please contact HR.' };
      }
      setCurrentUserNik(found.nik);
      // Log login
      addAuditLog({
        nik: found.nik,
        user: `${found.employeeName} (${found.roleLevel})`,
        action: 'Login',
        referenceId: found.nik,
        oldValue: '-',
        newValue: 'ACTIVE_SESSION',
        description: 'Employee logged into Retail Attendance portal',
      });
      return { success: true };
    }
    return { success: false, message: 'Employee not found. Please check your NIK.' };
  };

  const loginWithNik = (nik: string): boolean => {
    const res = login(nik);
    return res.success;
  };

  const logout = () => {
    if (currentUser) {
      addAuditLog({
        nik: currentUser.nik,
        user: `${currentUser.employeeName} (${currentUser.roleLevel})`,
        action: 'Logout',
        referenceId: currentUser.nik,
        oldValue: 'ACTIVE_SESSION',
        newValue: 'LOGGED_OUT',
        description: 'Employee signed out',
      });
    }
    setCurrentUserNik(null);
  };

  const switchUser = (nik: string) => {
    login(nik);
  };

  // Helper to add audit log
  const addAuditLog = (item: {
    nik: string;
    user: string;
    action: string;
    referenceId: string;
    oldValue: string;
    newValue: string;
    description: string;
  }) => {
    const newLog: AuditLogRecord = {
      logId: `AUD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: new Date().toISOString(),
      nik: item.nik,
      user: item.user,
      action: item.action,
      referenceId: item.referenceId,
      oldValue: item.oldValue,
      newValue: item.newValue,
      latitude: userCoords.latitude,
      longitude: userCoords.longitude,
      description: item.description,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Attendance Actions
  const clockIn = (options?: { faceVerified?: boolean }) => {
    if (!currentUser) return { success: false, message: 'User is not logged in.' };
    if (!config.allowClockIn) return { success: false, message: 'Clock In is currently disabled by administrator.' };

    const todayStr = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toTimeString().split(' ')[0];

    // Check if user already clocked in today
    const existingIn = attendance.find(
      (a) => a.nik === currentUser.nik && a.date === todayStr && a.type === 'IN'
    );
    if (existingIn) {
      return { success: false, message: `You have already clocked in today at ${existingIn.time}.` };
    }

    // Geolocation Validation
    const isFlexible = currentUser.flexibleAttendance;
    const isWithinRadius = geoStatus.isWithinRadius;
    const nearestLoc = geoStatus.location;

    if (!isFlexible && !isWithinRadius) {
      const msg = `Clock In gagal. Anda berada ${geoStatus.distance} meter dari lokasi terdekat (${nearestLoc ? nearestLoc.locationName : 'Unknown'}). Maksimum radius adalah ${geoStatus.allowedRadius} meter.`;
      
      // Save failed attempt to AUDIT_LOG as mandated by rule #6
      addAuditLog({
        nik: currentUser.nik,
        user: `${currentUser.employeeName} (${currentUser.roleLevel})`,
        action: 'Failed Clock In',
        referenceId: 'GPS_REJECTED',
        oldValue: 'OUTSIDE_RANGE',
        newValue: `${geoStatus.distance}m (Max: ${geoStatus.allowedRadius}m)`,
        description: `GPS validation failed at (${userCoords.latitude.toFixed(4)}, ${userCoords.longitude.toFixed(4)}): ${msg}`,
      });

      return { success: false, message: msg };
    }

    // Biometric Check if required
    if (config.requireFaceRecognition && !options?.faceVerified) {
      addAuditLog({
        nik: currentUser.nik,
        user: `${currentUser.employeeName} (${currentUser.roleLevel})`,
        action: 'Failed Face Recognition',
        referenceId: 'FACE_FAILED',
        oldValue: 'UNVERIFIED',
        newValue: 'FAILED',
        description: 'Clock In halted: Face biometric verification failed or skipped.',
      });
      return { success: false, message: 'Face verification failed. Facial biometrics are required to clock in.' };
    }

    // Find Homebase Name
    const homebaseObj = locations.find((l) => l.locationId === currentUser.homebaseLocationId);
    const homebaseName = homebaseObj ? homebaseObj.locationName : currentUser.homebaseLocationId;

    const newRecord: AttendanceRecord = {
      attendanceId: `ATT-${todayStr.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      nik: currentUser.nik,
      employeeName: currentUser.employeeName,
      date: todayStr,
      time: nowTimeStr,
      type: 'IN',
      locationId: nearestLoc ? nearestLoc.locationId : 'REMOTE',
      locationName: isFlexible && !isWithinRadius ? 'Remote / Flexible Location' : (nearestLoc ? nearestLoc.locationName : 'Unmapped Location'),
      homebase: homebaseName,
      latitude: userCoords.latitude,
      longitude: userCoords.longitude,
      accuracy: userCoords.accuracy,
      distance: geoStatus.distance,
      attendanceMode: isFlexible ? 'FLEXIBLE' : 'STANDARD',
      faceVerified: !!options?.faceVerified,
      status: 'VERIFIED',
      createdAt: new Date().toISOString(),
    };

    setAttendance((prev) => [newRecord, ...prev]);

    addAuditLog({
      nik: currentUser.nik,
      user: `${currentUser.employeeName} (${currentUser.roleLevel})`,
      action: 'Clock In',
      referenceId: newRecord.attendanceId,
      oldValue: 'NOT CLOCKED IN',
      newValue: `CLOCKED IN ${nowTimeStr}`,
      description: `Clock In verified at ${newRecord.locationName} (${geoStatus.distance}m from center). Homebase: ${homebaseName}.`,
    });

    return { success: true, message: `Clock In successful at ${nowTimeStr} (${newRecord.locationName})!` };
  };

  const clockOut = (options?: { faceVerified?: boolean }) => {
    if (!currentUser) return { success: false, message: 'User is not logged in.' };
    if (!config.allowClockOut) return { success: false, message: 'Clock Out is currently disabled by administrator.' };

    const todayStr = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toTimeString().split(' ')[0];

    // Business rule: User cannot clock out if there is no valid clock in
    const existingIn = attendance.find(
      (a) => a.nik === currentUser.nik && a.date === todayStr && a.type === 'IN'
    );
    if (!existingIn) {
      return { success: false, message: 'Clock Out gagal. Anda belum melakukan Clock In hari ini.' };
    }

    // Business rule: User cannot clock out twice
    const existingOut = attendance.find(
      (a) => a.nik === currentUser.nik && a.date === todayStr && a.type === 'OUT'
    );
    if (existingOut) {
      return { success: false, message: `You have already clocked out today at ${existingOut.time}.` };
    }

    // Geolocation Validation
    const isFlexible = currentUser.flexibleAttendance;
    const isWithinRadius = geoStatus.isWithinRadius;
    const nearestLoc = geoStatus.location;

    if (!isFlexible && !isWithinRadius) {
      const msg = `Clock Out gagal. Anda berada ${geoStatus.distance} meter dari lokasi terdekat. Maksimum radius adalah ${geoStatus.allowedRadius} meter.`;
      
      addAuditLog({
        nik: currentUser.nik,
        user: `${currentUser.employeeName} (${currentUser.roleLevel})`,
        action: 'Failed Clock Out',
        referenceId: 'GPS_REJECTED',
        oldValue: 'OUTSIDE_RANGE',
        newValue: `${geoStatus.distance}m`,
        description: `GPS validation failed during Clock Out: ${msg}`,
      });

      return { success: false, message: msg };
    }

    const homebaseObj = locations.find((l) => l.locationId === currentUser.homebaseLocationId);
    const homebaseName = homebaseObj ? homebaseObj.locationName : currentUser.homebaseLocationId;

    const newRecord: AttendanceRecord = {
      attendanceId: `ATT-${todayStr.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      nik: currentUser.nik,
      employeeName: currentUser.employeeName,
      date: todayStr,
      time: nowTimeStr,
      type: 'OUT',
      locationId: nearestLoc ? nearestLoc.locationId : 'REMOTE',
      locationName: isFlexible && !isWithinRadius ? 'Remote / Flexible Location' : (nearestLoc ? nearestLoc.locationName : 'Unmapped Location'),
      homebase: homebaseName,
      latitude: userCoords.latitude,
      longitude: userCoords.longitude,
      accuracy: userCoords.accuracy,
      distance: geoStatus.distance,
      attendanceMode: isFlexible ? 'FLEXIBLE' : 'STANDARD',
      faceVerified: !!options?.faceVerified,
      status: 'VERIFIED',
      createdAt: new Date().toISOString(),
    };

    setAttendance((prev) => [newRecord, ...prev]);

    addAuditLog({
      nik: currentUser.nik,
      user: `${currentUser.employeeName} (${currentUser.roleLevel})`,
      action: 'Clock Out',
      referenceId: newRecord.attendanceId,
      oldValue: 'CLOCKED IN',
      newValue: `CLOCKED OUT ${nowTimeStr}`,
      description: `Clock Out recorded at ${nowTimeStr} (${newRecord.locationName}).`,
    });

    return { success: true, message: `Clock Out recorded at ${nowTimeStr}. Have a great rest!` };
  };

  const registerFaceTemplate = (nik: string, templateJson: string) => {
    const emp = manpower.find((m) => m.nik === nik);
    if (!emp) return { success: false, message: 'Employee not found.' };

    const now = new Date().toISOString();
    const existingIndex = faceRegisters.findIndex((f) => f.nik === nik);

    const newEntry: FaceRegisterRecord = {
      nik,
      employeeName: emp.employeeName,
      faceTemplate: templateJson,
      registeredAt: existingIndex >= 0 ? faceRegisters[existingIndex].registeredAt : now,
      updatedAt: now,
      status: 'ACTIVE',
    };

    if (existingIndex >= 0) {
      const updated = [...faceRegisters];
      updated[existingIndex] = newEntry;
      setFaceRegisters(updated);
    } else {
      setFaceRegisters((prev) => [...prev, newEntry]);
    }

    // Update manpower faceRegistered field
    setManpower((prev) =>
      prev.map((m) => (m.nik === nik ? { ...m, faceRegistered: true } : m))
    );

    addAuditLog({
      nik,
      user: `${emp.employeeName} (${emp.roleLevel})`,
      action: 'Face Registration',
      referenceId: nik,
      oldValue: emp.faceRegistered ? 'TEMPLATE_REGISTERED' : 'UNREGISTERED',
      newValue: 'TEMPLATE_ACTIVE',
      description: 'Biometric face embedding vector registered successfully',
    });

    return { success: true, message: 'Face biometric template registered successfully.' };
  };

  // Request & Approval
  const submitRequest = (data: {
    requestType: RequestType;
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
    reason: string;
    attachment?: string;
    targetAttendanceDate?: string;
    targetRevisedTime?: string;
    overtimeHours?: number;
  }) => {
    if (!currentUser) return { success: false, message: 'User not logged in.' };

    // Determine approver based on hierarchy (Rule 10: R1 -> R2 supervisor, R2 -> R3 manager, R3 -> Admin)
    let approverNik = currentUser.supervisorNik;
    if (!approverNik) {
      // If supervisor not specified, assign to first active administrator
      const admin = manpower.find((m) => m.roleLevel === 'ADMIN' && m.status === 'ACTIVE');
      approverNik = admin ? admin.nik : '9999';
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const prefix = data.requestType.replace(/\s+/g, '').substring(0, 3).toUpperCase();
    const requestId = `REQ-${prefix}-${todayStr.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    const newReq: RequestRecord = {
      requestId,
      nik: currentUser.nik,
      employeeName: currentUser.employeeName,
      requestType: data.requestType,
      requestDate: todayStr,
      startDate: data.startDate,
      endDate: data.endDate,
      startTime: data.startTime,
      endTime: data.endTime,
      reason: data.reason,
      attachment: data.attachment,
      status: 'PENDING APPROVAL',
      currentApproverNik: approverNik,
      submittedAt: new Date().toISOString(),
      targetAttendanceDate: data.targetAttendanceDate,
      targetRevisedTime: data.targetRevisedTime,
      overtimeHours: data.overtimeHours,
    };

    setRequests((prev) => [newReq, ...prev]);

    addAuditLog({
      nik: currentUser.nik,
      user: `${currentUser.employeeName} (${currentUser.roleLevel})`,
      action: 'Request Created',
      referenceId: requestId,
      oldValue: 'DRAFT',
      newValue: 'PENDING APPROVAL',
      description: `Submitted ${data.requestType} request. Assigned approver: NIK ${approverNik}.`,
    });

    return { success: true, message: `Your ${data.requestType} request has been submitted successfully.` };
  };

  const approveRequest = (requestId: string, comment: string = 'Approved') => {
    if (!currentUser) return { success: false, message: 'User not logged in.' };
    const req = requests.find((r) => r.requestId === requestId);
    if (!req) return { success: false, message: 'Request not found.' };

    // Self-approval check
    if (req.nik === currentUser.nik) {
      return { success: false, message: 'Request cannot be self-approved.' };
    }

    const now = new Date().toISOString();

    // 1. Update Request
    setRequests((prev) =>
      prev.map((r) => (r.requestId === requestId ? { ...r, status: 'APPROVED', approvedAt: now } : r))
    );

    // 2. Add Approval record
    const newApproval: ApprovalRecord = {
      approvalId: `APP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      requestId,
      approverNik: currentUser.nik,
      approverName: currentUser.employeeName,
      role: currentUser.roleLevel,
      action: 'APPROVE',
      actionDate: now,
      comment,
    };
    setApprovals((prev) => [newApproval, ...prev]);

    // 3. If Clock In/Out Revision: update target attendance record (Rule 25)
    if (req.requestType === 'Clock In Revision' || req.requestType === 'Clock Out Revision') {
      const isClockIn = req.requestType === 'Clock In Revision';
      const typeKey = isClockIn ? 'IN' : 'OUT';
      const targetDate = req.targetAttendanceDate || req.startDate;
      const revisedTime = req.targetRevisedTime || req.startTime || '08:00';

      setAttendance((prev) =>
        prev.map((att) => {
          if (att.nik === req.nik && att.date === targetDate && att.type === typeKey) {
            addAuditLog({
              nik: currentUser.nik,
              user: `${currentUser.employeeName} (${currentUser.roleLevel})`,
              action: 'Attendance Revision',
              referenceId: att.attendanceId,
              oldValue: `${typeKey}: ${att.time}`,
              newValue: `${typeKey}: ${revisedTime} (Approved by ${currentUser.employeeName})`,
              description: `Attendance time revised from ${att.time} to ${revisedTime} following approved request ${requestId}. Reason: ${req.reason}`,
            });
            return {
              ...att,
              time: revisedTime,
              attendanceMode: 'REVISED',
              status: 'REVISED',
            };
          }
          return att;
        })
      );
    }

    addAuditLog({
      nik: currentUser.nik,
      user: `${currentUser.employeeName} (${currentUser.roleLevel})`,
      action: 'Request Approved',
      referenceId: requestId,
      oldValue: 'PENDING APPROVAL',
      newValue: 'APPROVED',
      description: `Request ${requestId} (${req.requestType}) approved by ${currentUser.employeeName}. Comment: ${comment}`,
    });

    return { success: true, message: `Request ${requestId} successfully approved.` };
  };

  const rejectRequest = (requestId: string, reason: string) => {
    if (!currentUser) return { success: false, message: 'User not logged in.' };
    if (!reason || reason.trim() === '') {
      return { success: false, message: 'Rejection reason is mandatory.' };
    }

    const req = requests.find((r) => r.requestId === requestId);
    if (!req) return { success: false, message: 'Request not found.' };

    const now = new Date().toISOString();

    setRequests((prev) =>
      prev.map((r) =>
        r.requestId === requestId
          ? { ...r, status: 'REJECTED', rejectedAt: now, rejectionReason: reason }
          : r
      )
    );

    const newApproval: ApprovalRecord = {
      approvalId: `APP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      requestId,
      approverNik: currentUser.nik,
      approverName: currentUser.employeeName,
      role: currentUser.roleLevel,
      action: 'REJECT',
      actionDate: now,
      comment: reason,
    };
    setApprovals((prev) => [newApproval, ...prev]);

    addAuditLog({
      nik: currentUser.nik,
      user: `${currentUser.employeeName} (${currentUser.roleLevel})`,
      action: 'Request Rejected',
      referenceId: requestId,
      oldValue: 'PENDING APPROVAL',
      newValue: 'REJECTED',
      description: `Request ${requestId} rejected by ${currentUser.employeeName}. Reason: ${reason}`,
    });

    return { success: true, message: `Request ${requestId} has been rejected.` };
  };

  // Retention cleanup runner (Rule 19)
  const runRetentionCleanup = () => {
    const retentionDays = config.attendanceRetentionDays || 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const expired = attendance.filter((a) => a.date < cutoffStr);
    const remaining = attendance.filter((a) => a.date >= cutoffStr);

    setAttendance(remaining);

    addAuditLog({
      nik: currentUser ? currentUser.nik : 'SYSTEM',
      user: currentUser ? currentUser.employeeName : 'System Cron Trigger',
      action: 'Admin Change',
      referenceId: 'DATA_RETENTION',
      oldValue: `${attendance.length} records`,
      newValue: `${remaining.length} active records`,
      description: `Automated cleanup executed: ${expired.length} records older than ${retentionDays} days processed (Archive Mode: ${config.archiveBeforeDelete ? 'ENABLED' : 'DISABLED'}).`,
    });

    return {
      purgedCount: expired.length,
      archivedCount: config.archiveBeforeDelete ? expired.length : 0,
    };
  };

  const updateConfig = (newConfig: Partial<AppConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      addAuditLog({
        nik: currentUser ? currentUser.nik : 'ADMIN',
        user: currentUser ? currentUser.employeeName : 'Administrator',
        action: 'Configuration Change',
        referenceId: 'CONFIG',
        oldValue: JSON.stringify(prev),
        newValue: JSON.stringify(updated),
        description: 'Spreadsheet configuration parameters updated',
      });
      return updated;
    });
  };

  const resetAllDataToDefault = () => {
    localStorage.clear();
    setConfig(DEFAULT_CONFIG);
    setLocations(DEFAULT_LOCATIONS);
    setManpower(DEFAULT_MANPOWER);
    setAttendance(DEFAULT_ATTENDANCE);
    setRequests(DEFAULT_REQUESTS);
    setApprovals(DEFAULT_APPROVALS);
    setFaceRegisters(DEFAULT_FACE_REGISTER);
    setAuditLogs(DEFAULT_AUDIT_LOGS);
    setCurrentUserNik('1001');
  };

  const syncGas = async () => {
    if (!gasUrl) {
      return { success: false, message: 'Please provide a valid Google Apps Script Web App URL.' };
    }

    setIsSyncingGas(true);
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'ping' }),
      });
      const data = await res.json();
      setIsSyncingGas(false);
      return {
        success: data.success,
        message: data.message || 'Connected to Google Apps Script successfully!',
      };
    } catch (err: any) {
      setIsSyncingGas(false);
      return {
        success: false,
        message: `Connection to Apps Script failed: ${err.message}. (Ensure deployment access is set to 'Anyone').`,
      };
    }
  };

  return (
    <AppContext.Provider
      value={{
        config,
        updateConfig,
        locations,
        updateLocations: setLocations,
        manpower,
        updateManpower: setManpower,
        attendance,
        requests,
        approvals,
        faceRegisters,
        auditLogs,
        currentUser,
        login,
        loginWithNik,
        logout,
        switchUser,
        userCoords,
        geoStatus,
        isGpsLoading,
        gpsError,
        refreshGPS,
        setSimulatedLocation,
        currentSimulatedLabel,
        clockIn,
        clockOut,
        registerFaceTemplate,
        submitRequest,
        approveRequest,
        rejectRequest,
        runRetentionCleanup,
        resetAllDataToDefault,
        spreadsheetUrl,
        spreadsheetId,
        setSpreadsheetUrl,
        gasUrl,
        setGasUrl,
        isSyncingGas,
        syncGas,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

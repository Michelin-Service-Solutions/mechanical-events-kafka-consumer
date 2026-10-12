export enum MechanicalCaseStatus {
    New = "new",
    Dispatched = "dispatched",
    EnRoute = "en_route",
    Arrived = "arrived",
    Rolling = "rolling",
    Closed = "closed",
}

export interface MechanicalCaseRecord {
    PaidInFull?: string | null;
    WorkCompleteDate?: string | null;
    RepairStarted?: string | null;
    EstimatedVendorArrival?: string | null;
    ServiceDateTime?: string | null;
}

// DMS sends 1900-01-01 instead of null for empty dates.
export function isValidCaseDate(input?: string | null): boolean {
    if (!input) return false;
    const time = Date.parse(input);
    return !Number.isNaN(time) && new Date(time).getUTCFullYear() >= 2000;
}

export function getMechanicalCaseStatus(caseRecord: MechanicalCaseRecord): MechanicalCaseStatus {
    if (caseRecord.PaidInFull === "Yes") return MechanicalCaseStatus.Closed;
    if (isValidCaseDate(caseRecord.WorkCompleteDate)) return MechanicalCaseStatus.Rolling;
    if (isValidCaseDate(caseRecord.RepairStarted)) return MechanicalCaseStatus.Arrived;
    if (isValidCaseDate(caseRecord.EstimatedVendorArrival)) return MechanicalCaseStatus.EnRoute;
    if (isValidCaseDate(caseRecord.ServiceDateTime)) return MechanicalCaseStatus.Dispatched;
    return MechanicalCaseStatus.New;
}
